import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { openLogFile } from '../src/log-file'

/**
 * 上限与轮转的判据：没到线不动、到线滚一份并把上一份留住、滚不动也不能把内核带走。
 * fs 走真的（临时目录），失败那条用「目标格子被目录占着」造——那是 Windows 上真会撞的形态
 */

let dir = ''
const logPath = (): string => path.join(dir, 'gwb.log')
const read = (file: string): string => fs.readFileSync(file, 'utf8')
/** 定长 10 字节的一行：好算上限到没到线 */
const line = (c: string): string => c.repeat(9) + '\n'
const ignoreWarnings = (): void => {}

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gwb-log-'))
})
afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true })
})

describe('openLogFile', () => {
  it('没到上限不轮转：只有 gwb.log，一条都不少、一句都不喊', () => {
    const warns: string[] = []
    const log = openLogFile({ file: logPath(), limitBytes: 1000, onWarn: (m) => warns.push(m) })
    log.write(line('a'))
    log.write(line('b'))
    expect(read(logPath())).toBe(line('a') + line('b'))
    expect(fs.existsSync(`${logPath()}.1`)).toBe(false)
    expect(warns).toEqual([])
  })

  it('超上限滚一份：现行只剩新的，滚走的那段整份进 .1，且只留一份', () => {
    const log = openLogFile({ file: logPath(), limitBytes: 10, onWarn: ignoreWarnings })
    log.write(line('a')) // 10，到线
    log.write(line('b')) // 滚：.1 = a
    log.write(line('c')) // 10，到线
    log.write(line('d')) // 再滚：上一份 .1 被顶掉
    expect(read(logPath())).toBe(line('d'))
    expect(read(`${logPath()}.1`)).toBe(line('c'))
    expect(fs.existsSync(`${logPath()}.2`)).toBe(false)
  })

  it('轮转后写的那条落进新的 gwb.log，不落进刚改名的 .1——fd 不能悬在改过名的文件上', () => {
    const log = openLogFile({ file: logPath(), limitBytes: 8, onWarn: ignoreWarnings })
    log.write(line('旧')) // 10，到线
    log.write(line('新'))
    expect(read(`${logPath()}.1`)).toBe(line('旧'))
    expect(read(logPath())).toBe(line('新'))
  })

  it('开局就超限（上一轮内核留下的那份）→ 第一条日志就把它滚走', () => {
    fs.writeFileSync(logPath(), 'x'.repeat(500))
    const log = openLogFile({ file: logPath(), limitBytes: 64, onWarn: ignoreWarnings })
    log.write('新\n')
    expect(read(`${logPath()}.1`)).toBe('x'.repeat(500))
    expect(read(logPath())).toBe('新\n')
  })

  it('轮转没成不致命：照样往后写、一条不丢，只喊一句，再长一个上限才重试', () => {
    // 造一个必失败的轮转：`.1` 那一格被目录占着，rmSync 走到它就得栽
    fs.mkdirSync(`${logPath()}.1`)
    const warns: string[] = []
    const log = openLogFile({ file: logPath(), limitBytes: 40, onWarn: (m) => warns.push(m) })
    const wrote: string[] = []
    for (const c of ['1', '2', '3', '4']) {
      log.write(line(c))
      wrote.push(line(c))
    }
    expect(warns).toEqual([])
    log.write(line('5'))
    wrote.push(line('5'))
    expect(warns).toHaveLength(1) // 到线滚不动：喊一句
    for (const c of ['6', '7', '8']) {
      log.write(line(c))
      wrote.push(line(c))
    }
    expect(warns).toHaveLength(1) // 40 字节之内不重试，不刷屏
    log.write(line('9'))
    wrote.push(line('9'))
    expect(warns).toHaveLength(2) // 又长满一个上限，真会再试
    expect(read(logPath())).toBe(wrote.join('')) // 滚不动就继续往后写，一条都没丢
    expect(fs.statSync(`${logPath()}.1`).isDirectory()).toBe(true) // 也没把占位的那格铲掉
  })

  it('文件开不出来也不致命：构造与写都不抛，开的时候喊一句', () => {
    // 父目录不在，openSync 必失败（ENOENT）
    const file = path.join(dir, '没有这个目录', 'gwb.log')
    const warns: string[] = []
    const log = openLogFile({ file, limitBytes: 100, onWarn: (m) => warns.push(m) })
    expect(warns).toHaveLength(1)
    expect(() => log.write('谁\n')).not.toThrow()
  })

  it('路径被目录占着：写不进去也不致命，且**只喊一句**、不每条日志喊一遍', () => {
    // 实测这台机器（Windows）：openSync 对目录**不抛**，报错晚到 writeSync 的 EISDIR 上——
    // 所以这条通道的降级点不能只押在「开文件」那一步
    fs.mkdirSync(logPath())
    const warns: string[] = []
    const log = openLogFile({ file: logPath(), limitBytes: 4, onWarn: (m) => warns.push(m) })
    expect(warns).toEqual([]) // 开的时候是真没报错
    for (const c of ['a', 'b', 'c', 'd', 'e']) expect(() => log.write(line(c))).not.toThrow()
    expect(warns).toHaveLength(1)
  })

  it('onWarn 自己抛也不许漏出去', () => {
    const file = path.join(dir, '没有这个目录', 'gwb.log')
    expect(() =>
      openLogFile({
        file,
        limitBytes: 100,
        onWarn: () => {
          throw new Error('说话的人自己炸了')
        },
      }),
    ).not.toThrow()
  })
})
