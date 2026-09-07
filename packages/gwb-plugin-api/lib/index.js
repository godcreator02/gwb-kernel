/**
 * 取内核服务。**不要写进 `export const inject`**——它在根上下文 provide、永不撤销,
 * 写进 inject 只会让件多一处挂不上的可能。
 * 挂在别的 cordis 宿主里时,这句报错说得清「这不是工作台」。
 */
export function requireKernel(ctx) {
    const kernel = ctx.gwbKernel;
    if (kernel === undefined) {
        throw new Error('ctx.gwbKernel 不在——这个插件跑在一个不是 gwb-kernel 的 cordis 宿主里');
    }
    return kernel;
}
/** 把 unknown 收窄成对象。命令参数、配置、总线上过来的东西都得先过这关 */
export function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
