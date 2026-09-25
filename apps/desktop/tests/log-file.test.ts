import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { openLogFile } from '../src/log-file'

/**
 * 上限与轮转：没到上限不轮转，到上限轮转一次并留住上一份，轮转失败不让内核崩溃；首次打不开就抛错。
 * fs 用真的（临时目录），轮转失败用「目标位置被一个目录占着」制造，这是 Windows 上真会遇到的形态；
 * 只有「轮转后重新打开失败」替换了 openSync：真的文件系统造不出「改名成功、紧接着打开失败」
 */

let dir = ''
const logPath = (): string => path.join(dir, 'gwb.log')
const read = (file: string): string => fs.readFileSync(file, 'utf8')
/** 定长 10 字节的一行：方便算写到上限没有 */
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
    log.write(line('a')) // 10，到上限
    log.write(line('b')) // 轮转：.1 = a
    log.write(line('c')) // 10，到上限
    log.write(line('d')) // 再轮转：上一份 .1 被替换
    expect(read(logPath())).toBe(line('d'))
    expect(read(`${logPath()}.1`)).toBe(line('c'))
    expect(fs.existsSync(`${logPath()}.2`)).toBe(false)
  })

  it('轮转后写的那条落进新的 gwb.log，不落进刚改名的 .1——fd 不能悬在改过名的文件上', () => {
    const log = openLogFile({ file: logPath(), limitBytes: 8, onWarn: ignoreWarnings })
    log.write(line('旧')) // 10，到上限
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
    // 制造一次必定失败的轮转：`.1` 的位置被一个目录占着，rmSync 删它时失败
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
    expect(warns).toHaveLength(1) // 到上限、轮转失败：告警一句
    for (const c of ['6', '7', '8']) {
      log.write(line(c))
      wrote.push(line(c))
    }
    expect(warns).toHaveLength(1) // 再写满 40 字节之前不重试，不重复告警
    log.write(line('9'))
    wrote.push(line('9'))
    expect(warns).toHaveLength(2) // 又写满一个上限，确实重试了
    expect(read(logPath())).toBe(wrote.join('')) // 轮转失败就继续往原文件写，一条都没丢
    expect(fs.statSync(`${logPath()}.1`).isDirectory()).toBe(true) // 占着位置的目录也没被删掉
  })

  it('首次打不开就抛错：错误信息写明路径与原因，不告警、不留下文件', () => {
    // 父目录不在，openSync 必失败（ENOENT）
    const file = path.join(dir, '没有这个目录', 'gwb.log')
    const warns: string[] = []
    let thrown: unknown
    try {
      openLogFile({ file, limitBytes: 100, onWarn: (m) => warns.push(m) })
    } catch (err) {
      thrown = err
    }
    expect(thrown).toBeInstanceOf(Error)
    expect((thrown as Error).message.startsWith(`日志文件打不开（${file}）：`)).toBe(true)
    expect((thrown as Error).message).toContain('ENOENT')
    expect(warns).toEqual([])
    expect(fs.existsSync(file)).toBe(false)
  })

  it('轮转后重新打开失败：只告警一次，之后的日志只丢掉、不抛，也不再定时重开', () => {
    vi.useFakeTimers()
    const realOpenSync = fs.openSync.bind(fs)
    let opensAttempted = 0
    const openSpy = vi.spyOn(fs, 'openSync').mockImplementation((...args: Parameters<typeof fs.openSync>) => {
      opensAttempted += 1
      if (opensAttempted > 1) throw new Error('第二次打开失败（测试造的）')
      return realOpenSync(...args)
    })
    try {
      const warns: string[] = []
      const log = openLogFile({ file: logPath(), limitBytes: 10, onWarn: (m) => warns.push(m) })
      log.write(line('a')) // 10，到上限
      log.write(line('b')) // 轮转：改名成功，重新打开失败
      expect(warns).toHaveLength(1)
      expect(warns[0]).toContain('轮转后重新打开日志文件失败')
      expect(warns[0]).toContain('第二次打开失败（测试造的）')
      vi.setSystemTime(Date.now() + 10 * 60_000)
      for (const c of ['c', 'd', 'e']) expect(() => log.write(line(c))).not.toThrow()
      expect(opensAttempted).toBe(2)
      expect(warns).toHaveLength(1)
      expect(read(`${logPath()}.1`)).toBe(line('a'))
      expect(fs.existsSync(logPath())).toBe(false)
    } finally {
      openSpy.mockRestore()
      vi.useRealTimers()
    }
  })

  it('路径被目录占着：写不进去也不致命，且**只喊一句**、不每条日志喊一遍', () => {
    // 实测 Windows 上 openSync 打开目录不抛，到 writeSync 才报 EISDIR：写入失败也要单独处理，不能只在打开时处理
    fs.mkdirSync(logPath())
    const warns: string[] = []
    const log = openLogFile({ file: logPath(), limitBytes: 4, onWarn: (m) => warns.push(m) })
    expect(warns).toEqual([]) // 打开时确实没报错
    for (const c of ['a', 'b', 'c', 'd', 'e']) expect(() => log.write(line(c))).not.toThrow()
    expect(warns).toHaveLength(1)
  })

  it('onWarn 自己抛也不许漏出去', () => {
    // 路径被目录占着：打开不报错，写的时候 EISDIR，触发告警
    fs.mkdirSync(logPath())
    const log = openLogFile({
      file: logPath(),
      limitBytes: 100,
      onWarn: () => {
        throw new Error('说话的人自己炸了')
      },
    })
    expect(() => log.write(line('a'))).not.toThrow()
  })
})
