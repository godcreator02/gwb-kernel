import { describe, expect, it } from 'vitest'
import { fileLineOf, levelOf, sourceOfLoggerName, terminalLineOf, type LogRecord } from '../src/log-record'

const record: LogRecord = { ts: '2026-09-27T14:00:00.000Z', level: 'error', source: 'plugin', name: 'gwb-x', msg: '第一行\n第二行' }

describe('日志记录的两种输出', () => {
  it('文件里一行一个 JSON：五个键、顺序固定，正文里的换行留在字符串里，行尾一个换行', () => {
    const line = fileLineOf(record)
    expect(line).toBe('{"ts":"2026-09-27T14:00:00.000Z","level":"error","source":"plugin","name":"gwb-x","msg":"第一行\\n第二行"}\n')
    expect(line.slice(0, -1)).not.toContain('\n')
    expect(JSON.parse(line)).toEqual(record)
  })

  it('终端上是「时间 级别 名字 正文」的文本', () => {
    expect(terminalLineOf(record)).toBe('2026-09-27T14:00:00.000Z error gwb-x 第一行\n第二行\n')
  })
})

describe('级别与来源', () => {
  it('error / warn / info / debug 原样，cordis 的其余类型记成 info', () => {
    expect(['error', 'warn', 'info', 'debug', 'success', ''].map(levelOf)).toEqual(['error', 'warn', 'info', 'debug', 'info', 'info'])
  })

  it('kernel 与 cordis 的 loader、include 算内核，renderer 算页面，其余算插件', () => {
    expect(['kernel', 'loader', 'include', 'renderer', 'gwb-commands', 'probe'].map(sourceOfLoggerName)).toEqual([
      'kernel',
      'kernel',
      'kernel',
      'renderer',
      'plugin',
      'plugin',
    ])
  })
})
