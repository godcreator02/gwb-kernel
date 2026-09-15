// 种子决策的纯逻辑：不 import electron、不碰盘（exists 由调用方给），node --test 直测。
// 想种的条件只有一条：用户没点名 home（落 default），且 default 还不存在。
// 点名了（名字或路径）一律不种——devkit 的测试 home 必须出生为空，不能被壳偷偷塞东西。

/**
 * 该不该种、种到哪。
 *
 * @param homeArg `process.env.GWB_HOME` 的原文；**只有 undefined 算「没点名」**——内核那边
 *   `?? 'default'` 也只兜 undefined，设成空串是点了个怪名（内核会当名字拼），壳不替它当
 *   default、不种
 * @param defaultHome 内核的 default home 路径（appData/gwb-kernel/homes/default）
 * @param exists 判在不在盘上
 * @returns 该种子的目标目录；undefined = 不种
 */
export function decideSeed({ homeArg, defaultHome, exists }) {
  if (homeArg !== undefined) return undefined
  if (exists(defaultHome)) return undefined
  return defaultHome
}

/** 候选模板取第一个存在的；都没有返回 undefined，怎么收由调用方定 */
export function pickTemplate(candidates, exists) {
  for (const candidate of candidates) {
    if (exists(candidate)) return candidate
  }
  return undefined
}
