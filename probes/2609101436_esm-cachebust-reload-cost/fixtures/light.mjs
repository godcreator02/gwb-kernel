// 「什么都不存」的假件：模块作用域里只有一个函数，没有数据。
// 用来量「重载一次模块本身」的底价（模块记录 + 编译产物 + 命名空间对象）。

export const loadId = new URL(import.meta.url).searchParams.get('v') ?? 'noversion';

export function touch() {
  return loadId;
}
