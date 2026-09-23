import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { describePnpm, spawnPlan } from '../src/pnpm-path.js'
import { locatePnpm, tailLines } from '../src/pnpm.js'

const EXE = 'C:\\Program Files\\gwb-kernel\\resources\\pnpm\\pnpm.exe'

describe('用内核交来的那份 pnpm', () => {
  let dir = ''
  afterEach(() => {
    if (dir !== '') fs.rmSync(dir, { recursive: true, force: true })
    dir = ''
  })

  it('文件在、旁边有 @pnpm/exe 的 package.json：版本号从那里读', () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pm-pnpm-'))
    const exe = path.join(dir, 'pnpm.exe')
    fs.writeFileSync(exe, '')
    fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: '@pnpm/exe.win32-x64', version: '12.4.2' }))
    expect(locatePnpm(exe)).toEqual({ ok: true, file: exe, version: '12.4.2' })
  })

  it('旁边没有 package.json：照常可用，版本号是 ?', () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pm-pnpm-'))
    const exe = path.join(dir, 'pnpm.exe')
    fs.writeFileSync(exe, '')
    expect(locatePnpm(exe)).toEqual({ ok: true, file: exe, version: '?' })
  })

  it('文件不在：报错，原因里带内核给的路径', () => {
    const missing = path.join(os.tmpdir(), 'pm-pnpm-missing', 'pnpm.exe')
    const found = locatePnpm(missing)
    expect(found.ok).toBe(false)
    expect(found.ok ? '' : found.error).toContain(missing)
  })
})

describe('怎么启动', () => {
  const env = { PATH: 'x', ELECTRON_RUN_AS_NODE: '1', HOME: 'h' }

  it('直接启动可执行文件，环境原样传下去，只去掉 ELECTRON_RUN_AS_NODE', () => {
    expect(spawnPlan(EXE, ['outdated', '--json'], env)).toEqual({
      command: EXE,
      args: ['outdated', '--json'],
      env: { PATH: 'x', HOME: 'h' },
    })
  })

  it('不改调用方给的环境', () => {
    spawnPlan(EXE, [], env)
    expect(env.ELECTRON_RUN_AS_NODE).toBe('1')
  })

  it('日志那句带版本与路径', () => {
    expect(describePnpm({ file: EXE, version: '12.4.2' })).toBe(`pnpm 12.4.2（${EXE}）`)
  })
})

describe('pnpm 输出留尾巴', () => {
  it('只留最后几行——pnpm 把原因放在最后', () => {
    const text = Array.from({ length: 40 }, (_, i) => `line ${i}`).join('\n')
    expect(tailLines(text, 3)).toBe('line 37\nline 38\nline 39')
  })

  it('两头的空行削掉', () => {
    expect(tailLines('\n\na\nb\n\n\n', 10)).toBe('a\nb')
  })

  it('CRLF 归一', () => {
    expect(tailLines('a\r\nb\r\n', 10)).toBe('a\nb')
  })

  it('短的原样', () => {
    expect(tailLines('boom', 12)).toBe('boom')
  })

  it('全是空白时回空串', () => {
    expect(tailLines('\n \n', 12)).toBe('')
  })
})
