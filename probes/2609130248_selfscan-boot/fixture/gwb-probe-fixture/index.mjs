// 探针件：只证明两件事——裸名解析 seam 真把它挂上了（启动日志），effect 收尾真被退出链带走（收尾日志在清理函数里）
export const name = 'gwb-probe-fixture'
export function apply(ctx) {
  ctx.logger('probe').info('探针件挂上了（裸名解析 seam 走通）')
  ctx.effect(() => () => { ctx.logger('probe').info('探针件收尾跑完（will-quit 链带走）') })
}
