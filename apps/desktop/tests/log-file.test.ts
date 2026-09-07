import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { archiveName, pruneArchives, rotate } from '../src/main/log-file'

let dir: string

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gwb-log-'))
})

afterEach(() => {
  vi.restoreAllMocks()
  fs.rmSync(dir, { recursive: true, force: true })
})

const current = (): string => path.join(dir, 'gwb.log')
const archives = (): string[] => fs.readdirSync(dir).filter((n) => n !== 'gwb.log').sort()

describe('归档命名', () => {
  it('时刻到秒', () => {
    expect(archiveName(dir, new Date(2026, 8, 7, 14, 30, 5))).toBe('gwb-260907143005.log')
  })

  it('同一秒切两段不覆盖——直接 rename 会静默盖掉一整段', () => {
    const now = new Date(2026, 8, 7, 14, 30, 5)
    fs.writeFileSync(path.join(dir, archiveName(dir, now)), 'x')
    expect(archiveName(dir, now)).toBe('gwb-260907143005-2.log')
    fs.writeFileSync(path.join(dir, 'gwb-260907143005-2.log'), 'x')
    expect(archiveName(dir, now)).toBe('gwb-260907143005-3.log')
  })
})

describe('删旧', () => {
  const make = (names: string[]): void => {
    for (const n of names) fs.writeFileSync(path.join(dir, n), 'x')
  }

  it('留最新那几份，字典序就是时间序', () => {
    make(['gwb-260907143001.log', 'gwb-260907143002.log', 'gwb-260907143003.log'])
    pruneArchives(dir, 2)
    expect(archives()).toEqual(['gwb-260907143002.log', 'gwb-260907143003.log'])
  })

  it('不够数就一个都不删', () => {
    make(['gwb-260907143001.log'])
    pruneArchives(dir, 20)
    expect(archives()).toHaveLength(1)
  })

  it('只认归档名，别的文件一概不碰', () => {
    make(['gwb-260907143001.log', 'gwb.log', '笔记.txt', 'gwb-kernel.log', 'gwb-abc.log'])
    pruneArchives(dir, 0)
    expect(fs.readdirSync(dir).sort()).toEqual(['gwb-abc.log', 'gwb-kernel.log', 'gwb.log', '笔记.txt'].sort())
  })
})

describe('切一段', () => {
  const open = (): number => {
    fs.writeFileSync(current(), '旧的\n')
    return fs.openSync(current(), 'a')
  }

  it('切完之后现役是个新空文件，旧的进了归档', () => {
    const got = rotate(dir, open())
    expect(got.ok).toBe(true)
    expect(archives()).toHaveLength(1)
    expect(fs.readFileSync(path.join(dir, archives()[0]!), 'utf8')).toBe('旧的\n')
    expect(fs.readFileSync(current(), 'utf8')).toBe('')

    fs.writeSync(got.fd, Buffer.from('新的\n'))
    fs.closeSync(got.fd)
    expect(fs.readFileSync(current(), 'utf8')).toBe('新的\n')
  })

  it('rename 失败也交回一个还能写的 fd——否则一次撞占用就把落盘线判死了', () => {
    vi.spyOn(fs, 'renameSync').mockImplementation(() => {
      throw new Error('EPERM: operation not permitted')
    })
    const got = rotate(dir, open())
    expect(got.ok).toBe(false)
    expect(archives()).toHaveLength(0)

    fs.writeSync(got.fd, Buffer.from('接着写\n'))
    fs.closeSync(got.fd)
    expect(fs.readFileSync(current(), 'utf8')).toBe('旧的\n接着写\n')
  })

  it('删旧失败不算切失败——那一段已经归档了', () => {
    vi.spyOn(fs, 'readdirSync').mockImplementation(() => {
      throw new Error('EACCES')
    })
    const got = rotate(dir, open())
    expect(got.ok).toBe(true)
    fs.closeSync(got.fd)
  })
})
