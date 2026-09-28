/** cordis 的级别数字：exporter 只收级别数字不大于这个值的日志 */
const CORDIS_INFO = 2
const CORDIS_DEBUG = 3

/** cordis exporter 的 `levels` 里 `default` 是兜底那一项，不能当 logger 名 */
const RESERVED_LEVEL_KEY = 'default'

/**
 * 内核 exporter 的 `levels`：默认只收 info 及以上；环境变量 `GWB_DEBUG` 点名的 logger 连 debug 也收。
 * `GWB_DEBUG` 是逗号分隔的 logger 名（如 `gwb-commands,renderer`），名字要写全，不认通配
 */
export function fileLogLevels(gwbDebug: string | undefined): Record<string, number> {
  const levels: Record<string, number> = { [RESERVED_LEVEL_KEY]: CORDIS_INFO }
  if (gwbDebug === undefined || gwbDebug === '') return levels
  for (const segment of gwbDebug.split(',')) {
    const loggerName = segment.trim()
    if (loggerName === '') {
      throw new Error(`GWB_DEBUG 给的是 ${JSON.stringify(gwbDebug)}：逗号之间不能是空的，写成逗号分隔的 logger 名，如 gwb-commands,renderer`)
    }
    if (loggerName === RESERVED_LEVEL_KEY) {
      throw new Error(`GWB_DEBUG 里不能写 ${RESERVED_LEVEL_KEY}：它是 cordis 级别表的保留项，要写具体的 logger 名，如 gwb-commands`)
    }
    levels[loggerName] = CORDIS_DEBUG
  }
  return levels
}
