# 执行：在本目录 `pnpm install --ignore-workspace`，然后 `pnpm probe`

Windows，Electron 固定 44.1.1。preload.cjs 是实验时的冻结输入，不引用后续可变的内核源码。
验证隔离 preload 的 importmap 对页面主世界生效、重复准备不多插表、重复 import 保持单例、改变地址会拒绝。
成功退出码 0，20 秒超时或断言失败退出码 1。运行输出在 runs/；这不是完整工作台启动测试。

首次输出 01.txt 来自冻结前相同逻辑的 preload；02.txt 使用本目录快照，重载错误增加稳定前缀。
