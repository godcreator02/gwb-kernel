import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { setAsideTextLogs } from '../src/legacy-text-log'

let dir = ''
const logPath = (): string => path.join(dir, 'gwb.log')
const textLine = '2026-09-27T14:37:34.074Z info kernel up\n'
const jsonLine = '{"ts":"2026-09-27T14:38:00.000Z","level":"info","source":"kernel","name":"kernel","msg":"up"}\n'

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gwb-legacy-log-'))
})
afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true })
})

describe('setAsideTextLogs', () => {
  it('旧内核写的文本 gwb.log 与 gwb.log.1 改名成 .text，内容原样；回改了哪几份', () => {
    fs.writeFileSync(logPath(), textLine)
    fs.writeFileSync(`${logPath()}.1`, textLine + textLine)
    expect(setAsideTextLogs(logPath())).toEqual([`${logPath()}.text`, `${logPath()}.1.text`])
    expect(fs.existsSync(logPath())).toBe(false)
    expect(fs.existsSync(`${logPath()}.1`)).toBe(false)
    expect(fs.readFileSync(`${logPath()}.text`, 'utf8')).toBe(textLine)
    expect(fs.readFileSync(`${logPath()}.1.text`, 'utf8')).toBe(textLine + textLine)
  })

  it('已经是一行一个 JSON 的、空的、不存在的都不动', () => {
    fs.writeFileSync(logPath(), jsonLine)
    fs.writeFileSync(`${logPath()}.1`, '')
    expect(setAsideTextLogs(logPath())).toEqual([])
    expect(fs.readFileSync(logPath(), 'utf8')).toBe(jsonLine)
    expect(fs.readFileSync(`${logPath()}.1`, 'utf8')).toBe('')
    expect(fs.existsSync(`${logPath()}.text`)).toBe(false)
  })

  it('只有 gwb.log.1 是文本（gwb.log 已是 JSON）：只改 .1', () => {
    fs.writeFileSync(logPath(), jsonLine)
    fs.writeFileSync(`${logPath()}.1`, textLine)
    expect(setAsideTextLogs(logPath())).toEqual([`${logPath()}.1.text`])
    expect(fs.readFileSync(logPath(), 'utf8')).toBe(jsonLine)
  })

  it('改名失败（目标位置被一个目录占着）：抛错，写明从哪到哪与原因，原文件不动', () => {
    fs.mkdirSync(`${logPath()}.text`)
    fs.writeFileSync(`${logPath()}.text/占位`, '')
    fs.writeFileSync(logPath(), textLine)
    expect(() => setAsideTextLogs(logPath())).toThrow(`旧内核写的文本日志改名失败（${logPath()} → ${logPath()}.text）：`)
    expect(fs.readFileSync(logPath(), 'utf8')).toBe(textLine)
  })

  it('目标位置已有一份 .text：换成这次的', () => {
    fs.writeFileSync(`${logPath()}.text`, '更早的一份\n')
    fs.writeFileSync(logPath(), textLine)
    setAsideTextLogs(logPath())
    expect(fs.readFileSync(`${logPath()}.text`, 'utf8')).toBe(textLine)
  })
})
