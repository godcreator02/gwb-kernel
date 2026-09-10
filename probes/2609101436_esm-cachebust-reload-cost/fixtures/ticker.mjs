// 有副作用的假件：求值时起一个 setInterval，每 20ms 往全局记事本上记一笔自己的名字。
// 重载之后旧的那个还在不在跳，直接看记事本上有几个名字在涨。
// dispose() 是件自己给的下车口——调用方显式调它，才有清干净的可能。

const loadId = new URL(import.meta.url).searchParams.get('v') ?? 'noversion';

globalThis.__probeTicks ??= new Map();
globalThis.__probeTicks.set(loadId, 0);

const timer = setInterval(() => {
  const ticks = globalThis.__probeTicks;
  ticks.set(loadId, (ticks.get(loadId) ?? 0) + 1);
}, 20);

export { loadId };

export function dispose() {
  clearInterval(timer);
}
