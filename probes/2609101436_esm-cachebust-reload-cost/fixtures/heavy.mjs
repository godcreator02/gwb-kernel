// 「模块作用域里存了大数组」的假件：跟 light.mjs 逐字一样，只多一个 1 MiB 的载荷。
// 两者的斜率之差 = 模块闭包持有的东西；light 自己的斜率 = 模块本身。

// 131072 个 double = 1 MiB，V8 里是 PACKED_DOUBLE_ELEMENTS，尺寸可预测。
const PAYLOAD_ELEMENTS = 131072;
const payload = Array.from({ length: PAYLOAD_ELEMENTS }, (_, i) => i + 0.5);

export const loadId = new URL(import.meta.url).searchParams.get('v') ?? 'noversion';

export function touch() {
  return payload[0] + loadId.length;
}
