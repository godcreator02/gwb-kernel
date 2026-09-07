# @godcreator02/gwb-plugin-api

gwb-kernel 的**词汇表包**：不做事，只命名。零运行时依赖；`cordis` 是 peer——`Context`
出现在导出的类型里，消费方必须解析得到。

五个名字就是内核契约面的全部：

| 名字 | 一句话 |
| --- | --- |
| `GwbResult<T>` | 命令的回执形状 `{ ok, data?, error? }` |
| `GwbKernelApi` | 内核服务：`{ dataDir, appVersion, emit(payload) }`。没有装机口——内核不碰 pnpm |
| `GwbContext` | 件 `apply` 拿到的上下文：cordis `Context` + `gwbKernel` |
| `requireKernel(ctx)` | 取内核服务；不在 gwb-kernel 宿主里会抛。**别写进 `inject`** |
| `isRecord(value)` | 把 `unknown` 收窄成 `Record` 的判形 |

**类型住这儿，值走服务**：import 到的是类型，拿不到 `dataDir`——那是宿主那次运行算出来
的值，只有 cordis 服务送得到。

参考的正本在内核仓文档站的[词汇表](../../../docs-site/content/docs/plugins/vocab.mdx)一页
（线上路径 `/docs/plugins/vocab`）；为什么它就这么大，见轨迹区的两张墙卡
（`wall-vocab-just-size`、`wall-cordis-peer`）。
