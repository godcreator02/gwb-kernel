// 五处故意的类型错误（E1–E5）加一处正确写法（OK）。类型链全通时应恰好报 E1–E5、OK 行不报。
// 某处不报 = 那段类型静默变成了 any；OK 行报「属性不存在」= cordis 的 Context 没接上。
import type { GwbContext } from '@godcreator/gwb-plugin-api';
import type { BlockNoteMark, LibrariesMark } from '@godcreator/gwb-bn-core';

export function apply(ctx: GwbContext): void {
  // E1 plugin-api 自身类型：dataDir 是 string
  const n: number = ctx.gwbKernel.dataDir;
  // E2 bn-core 的 declare module 'cordis' 增强：ctx.blockNote 应为 BlockNoteMark | undefined
  const prefix: 'nope.' | undefined = ctx.blockNote?.commandPrefix;
  // E3 GwbContext 上没有的名字
  const bogus: number = ctx.definitelyNotAMember;
  // E4 bn-core d.ts 经 @godcreator/block-note 的 LibrarySet['register']：传错参数
  const libs: LibrariesMark | undefined = ctx.blockNoteLibraries;
  libs?.register(123);
  // E5 bn-core 自有类型：contract 是 number
  const mark: BlockNoteMark = { contract: 'x', commandPrefix: 'block-note.' };
  // OK cordis Context 的真成员，不该报
  ctx.effect(() => () => {});
  void n; void prefix; void bogus; void mark;
}
