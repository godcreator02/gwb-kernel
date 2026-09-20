# 日志上限与轮转：定多大、滚不滚得动

2026-09-20。内核日志出口（`apps/desktop/src/main.ts`）原本是「只追加、无上限」，default home 那份
长到了 6.21 GiB。这次给它加上限与轮转，这个目录是定上限时用的读数与验机的现场。

结论落在两处：上限默认值 `DEFAULT_LIMIT_BYTES = 128 MB`（判据写在 `main.ts` 日志出口那段注释里），
机械在 `apps/desktop/src/log-file.ts`，单测在旁边 `apps/desktop/tests/log-file.test.ts`。

## 一、上限取多大：那份 6.21 GiB 是怎么长出来的

从 6.6 GB 那份里每 512 MB 抽一个 64 KB 样本，读样本里首尾两条的 ISO 时间戳（`runs/01`）：

| 段 | 走了多久 | 速率 |
| --- | --- | --- |
| 0 → 512 MB（09-08 18:29 → 09-19 16:54） | 261.8 h | **2.0 MB/h**（约 48 MB/日） |
| 512 MB → 6144 MB（09-19 16:54 → 09-20 01:13） | 8.3 h | **约 675 MB/h**（约 16 GB/日） |
| 6144 → 6357 MB（09-20 01:13 → 02:01） | 0.79 h | 269 MB/h |

也就是说：**常态一天 48 MB，失控时一小时 675 MB**。那 6.21 GiB 里 5.8 GB 是一夜之间刷出来的——
末 50 MB 里 542,470 行是同一个件的刷屏（`gwb-commands` 报「跑了条不存在的命令：
block-note.overview.read / block-note.page.read」各 27 万条）。

取 **128 MB（现行的加一份旧的，磁盘压在 256 MB 以内）**：常态装得下两天半的排障窗口，刷屏时
十几分钟滚一次、磁盘照样封顶。判据是「这份日志拿来事后查错，不是档案馆」——再往前的没人翻，
而 6.21 GiB 那份之所以要命，正是因为它既看不完、又一直在长。

## 二、轮转在真内核里滚不滚得动

隔离 home（`GWB_HOME` 指到临时目录）起本仓内核，`GWB_LOG_LIMIT_MB=1`，**开局前先铺一份 1.5 MB
的假日志**（模拟「上一轮内核留下的那份已经超限」）。读数见 `runs/02`：

- `gwb.log.1` = 1,572,846 字节——预铺那份整份滚过去了
- `gwb.log` = 0 → 578 字节，8 行，时间戳是起机那一刻的，`runtime.json` 的 `version` 是 `0.2.7`
- 内核自己那句 `up，home=…` 落进了新的活动文件

这条验的是三件事凑一起：「开局就超限」认得出、「fd 跟着新文件走」没写进刚改名的旧文件、
以及产物确实是新构建的（`version` 0.2.7）。

## 三、default home 那 6.21 GiB 的回收

`SetLength(0)`，10 ms 往返，**不改名不删除**——内核（0.2.6 安装版，pid 70068）正握着这个路径的
append 句柄。读数见 `runs/03`：清空后 80 秒内 342 → 4,170 字节，`LastWriteTime` 一路往前，
**没有出现稀疏文件回弹**（不是从 6.67 GB 那个偏移接着写，Windows 的 append 语义让它落在新的
文件尾），也没有冒出第二个同名文件。

抽证的那份尾巴留在同目录 `gwb.log.tail`（52,428,743 字节，从整行边界起，可读）——它是内核
之外的产物，轮转只动 `gwb.log.1`…`.n`，不会碰它。

## 怎么复现

```powershell
# 一：抽样读速率（任意一份够大的 gwb.log）
# 二：隔离 home 验机
pnpm --filter @godcreator/gwb-kernel-desktop build
$env:GWB_HOME = '<一个临时目录>'; $env:GWB_LOG_LIMIT_MB = '1'
# 先往 <那个目录>/gwb.log 铺 1.5 MB 垃圾，再：
cd apps\desktop; & node_modules\electron\dist\electron.exe .
```

（`electron.exe` 要先 `pnpm --filter @godcreator/gwb-kernel-desktop setup:electron` 装二进制。）
