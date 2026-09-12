# 自解释扫描的真机验机（2026-09-13）

代码自解释扫描那轮（裸名解析提出 `bare-import.ts`、状态分类器提出 `entry-state.ts`、
注释三分收编）的行为零改变证明里，vitest 只盖得住纯函数那半；`main.ts` 那半按仓规走真机
——本目录是那三次起机的现场与取证。

## 判据

同一份探针件、同一套步骤，改动前后各起一次隔离 home：挂上日志、`up` 行、优雅退出时
「探针收尾 → kernel 收尾完」的顺序，三次一致即行为零改变。探针件只依赖裸名解析 seam
（`loader.internal` 的 import 真把它从 home 的 `node_modules` 里解出来挂上）与退出链
（effect 清理被 will-quit 的 dispose 带走），正是这轮动过的两处。

## 夹具

`fixture/gwb-probe-fixture/`——手造的件形状包，不经过 registry。铺进 home：

```powershell
$home = "$env:APPDATA\gwb-kernel\homes\scan-<时刻>"
New-Item -ItemType Directory -Force "$home\node_modules\gwb-probe-fixture" | Out-Null
Copy-Item fixture\gwb-probe-fixture\* "$home\node_modules\gwb-probe-fixture\"
Set-Content "$home\cordis.yml" '[{"id":"probe","name":"gwb-probe-fixture"}]'
```

## 起机与收机

内核仓里 build 后直接调 electron.exe（绕开 run.cmd 的参数转发，见 devkit 手册
「你改的是内核，不是件」）：

```bash
cd apps/desktop && pnpm build
GWB_HOME=scan-<时刻> ./node_modules/electron/dist/electron.exe . --remote-debugging-port=<口>
```

收机用优雅退出（`CloseMainWindow()`，不杀进程），才能验到 will-quit 那条链。

## 读数（runs/）

| 文件 | 哪一趟 | 关键行 |
| --- | --- | --- |
| `baseline-gwb-log.txt` + `baseline-runtime.json` | 改动前（bf3ce95 的父提交） | 探针挂上 → up → 退出时探针收尾 → 收尾完 |
| `after-bare-import-gwb-log.txt` | dc59265 之后（seam 改动单独复验） | 同上，逐行一致 |
| `final-gwb-log.txt` | 5e673c3 + 231fb52 之后（终态） | 同上，逐行一致 |

home 用完即删（`scan-2609130248` / `scan-2609130253` / `scan-2609130259`）。
