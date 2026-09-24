'use client'

/**
 * 第一次安装到开第二个 home：左边是网上的三个来源，中间是本机（用户级配置、安装目录、窗口），右边是两个 home。
 * 第 0 步是全貌，之后按步累积出现、这一步碰到的东西点亮。说明与命令的区域高度固定，按钮不随文字长短移动。
 */

import { Arrow, Box, BORDER, FG, MONO, MUTED, Note, StepCaption } from './parts'
import { StepControls, useSteps } from './steps'

type Part =
  | 'release' | 'registry' | 'npmjs'
  | 'config' | 'launcher' | 'window' | 'window2' | 'refusal'
  | 'defaultManifest' | 'defaultKernel' | 'defaultCordis' | 'defaultPlugins' | 'defaultRuntime'
  | 'otherManifest' | 'otherKernel' | 'otherPlugins' | 'otherRuntime' | 'otherToken'

const STEPS: { title: string; detail: string; command: string; shows: Part[]; lit: Part[] }[] = [
  {
    title: '全貌',
    detail: '安装包只装启动器与 Electron。内核包、cordis 与插件都由 pnpm 装进 home，每个 home 一套，启动器从 home 里加载内核。',
    command: '',
    shows: [],
    lit: [],
  },
  {
    title: '第 1 步：配两处用户级配置',
    detail: 'pnpm 要 12 及以上。@godcreator 的包从团队源下载；放行 @godcreator/* 里发布不满一天的包，其余包照旧受这条规则保护。',
    command: '@godcreator:registry=https://git.tianshen02.online:28377/api/packages/godcreator/npm/    # 写进 ~/.npmrc\nminimumReleaseAgeExclude: [\'@godcreator/*\']    # 写进 pnpm 的用户级配置',
    shows: ['config'],
    lit: ['config'],
  },
  {
    title: '第 2 步：下载安装包',
    detail: '从 gitea 发布页下载最新的 gwb-setup-<版>.exe，版本号是启动器的版本号。',
    command: '(Invoke-RestMethod https://git.tianshen02.online:28377/api/v1/repos/godcreator/gwb-kernel/releases/latest).assets |\n  Select-Object name, size, browser_download_url',
    shows: ['release'],
    lit: ['release'],
  },
  {
    title: '第 3 步：静默安装，只装上启动器',
    detail: '按当前用户安装到 %LOCALAPPDATA%\\Programs\\gwb-kernel，不需要管理员权限，开始菜单出现「gwb-kernel」。先别启动：home 里还没有内核包。',
    command: "Start-Process .\\gwb-setup-<版>.exe -ArgumentList '/S' -Wait",
    shows: ['launcher'],
    lit: ['release', 'launcher'],
  },
  {
    title: '第 4 步：建 default home',
    detail: '%APPDATA%\\gwb-kernel\\homes\\default 目录，里面一份空的 package.json。',
    command: '$gwbHome = "$env:APPDATA\\gwb-kernel\\homes\\default"\n[IO.File]::WriteAllText("$gwbHome\\package.json", \'{ "name": "gwb-home", "private": true }\')',
    shows: ['defaultManifest'],
    lit: ['defaultManifest'],
  },
  {
    title: '第 5 步：装内核包',
    detail: '内核是团队源上的 npm 包，和插件一样装在 home 的 node_modules 里，清单里写精确版本号。',
    command: '$kernel = pnpm view @godcreator/gwb-kernel-desktop dist-tags.latest\npnpm add --save-exact "@godcreator/gwb-kernel-desktop@$kernel"',
    shows: ['registry', 'defaultKernel'],
    lit: ['registry', 'defaultKernel'],
  },
  {
    title: '第 6 步：装 cordis',
    detail: '版本照内核包 peer 里写的那个。home 根上只有这一份 cordis，内核与所有插件都用它。',
    command: 'pnpm add --save-exact "cordis@$cordis"    # $cordis 从内核包清单的 peerDependencies.cordis 读',
    shows: ['npmjs', 'defaultCordis'],
    lit: ['npmjs', 'defaultCordis'],
  },
  {
    title: '第 7 步：写 cordis.yml，装 11 个基础插件',
    detail: 'cordis.yml 一行一个插件，id 手写；内核包与 cordis 不是插件，不写进去。',
    command: 'pnpm add @godcreator/gwb-commands @godcreator/gwb-data @godcreator/gwb-settings … @godcreator/gwb-mcp',
    shows: ['defaultPlugins'],
    lit: ['registry', 'defaultPlugins'],
  },
  {
    title: '第 8 步：启动，启动器从 home 加载内核',
    detail: '没设 GWB_HOME 就是 default。启动器读 home 里内核包的清单，engines.electron 包含自带的 Electron 才 import 内核入口。',
    command: 'Start-Process "$env:LOCALAPPDATA\\Programs\\gwb-kernel\\gwb-kernel.exe"',
    shows: [],
    lit: ['launcher', 'defaultKernel'],
  },
  {
    title: '第 9 步：内核加载插件，写运行记录',
    detail: 'runtime.json 里出现 mcp 字段就算启动完成，default 的 MCP 入口是 127.0.0.1:2870；gwb.log 里有 kernel up、没有 error 行。',
    command: '(Get-Content "$gwbHome\\runtime.json" -Raw | ConvertFrom-Json).mcp.url',
    shows: ['window', 'defaultRuntime'],
    lit: ['window', 'defaultRuntime'],
  },
  {
    title: '第 10 步：连接 MCP 入口',
    detail: 'token 在这个 home 的 mcp\\secret.json 里，每个 home 一份、重启不变。客户端配置要带 Authorization 请求头，连上先调 index。',
    command: 'node $client --url $url index\nnode $client --url $url run mcp.token    # 拿到已带请求头的客户端配置片段',
    shows: [],
    lit: ['defaultRuntime'],
  },
  {
    title: '第 11 步：另开一个 home',
    detail: '换一个目录，照第 4 到第 7 步再装一遍。内核包与插件各装各的，版本可以和 default 不同。',
    command: '$gwbHome = "$env:APPDATA\\gwb-kernel\\homes\\x"\n# 在这个目录里照第 4–7 步：package.json → 内核包 → cordis → cordis.yml 与插件',
    shows: ['otherManifest', 'otherKernel', 'otherPlugins'],
    lit: ['registry', 'otherManifest', 'otherKernel', 'otherPlugins'],
  },
  {
    title: '第 12 步：设 GWB_HOME，用同一个 exe 启动',
    detail: '只写名字就是 homes 下的同名目录，写带路径分隔符的就是那个目录本身。MCP 端口不是 2870、token 也是它自己的，都从这个 home 里读。',
    command: '$env:GWB_HOME = "x"; Start-Process "$env:LOCALAPPDATA\\Programs\\gwb-kernel\\gwb-kernel.exe"\nnode $client --url <它的 runtime.json 里的 mcp.url> --token <它的 mcp\\secret.json 里的 token> index',
    shows: ['window2', 'otherRuntime', 'otherToken'],
    lit: ['launcher', 'window2', 'otherRuntime', 'otherToken'],
  },
  {
    title: '第 13 步：漏装了内核包',
    detail: '启动器不替人安装。home 里没有内核包、或 Electron 不在内核包声明的范围里，就弹框说明缺什么、怎么补，退出码 1，home 里一个文件都不写。',
    command: '# 照第 5、6 步在这个 home 里装上内核包与 cordis，再启动',
    shows: ['refusal'],
    lit: ['launcher', 'refusal'],
  },
]

const BOX_ROWS = [46, 92, 138, 184, 230]

export function FirstInstall() {
  const state = useSteps(STEPS.length, 4200)
  const current = STEPS[state.step]!
  const shown = new Set<Part>(STEPS.slice(0, state.step + 1).flatMap((step) => step.shows))
  const overview = state.step === 0
  const tone = (part: Part) => (current.lit.includes(part) ? 'a' : undefined)
  const dim = (part: Part) => !overview && !shown.has(part)
  const launcherToOther = current.lit.includes('otherKernel') || current.lit.includes('window2')

  return (
    <>
      <svg viewBox="0 0 760 452" role="img" aria-label="第一次安装 gwb 与另开一个 home 的十三步">
        <Note x={20} y={22} size={12} color={FG} weight={600}>网上</Note>
        <rect x={14} y={32} width={150} height={248} rx={10} fill="none" stroke={BORDER} />
        <Box x={26} y={BOX_ROWS[0]!} w={126} h={38} lines={['gitea 发布页', 'gwb-setup-<版>.exe']} mono tone={tone('release')} dim={dim('release')} />
        <Box x={26} y={BOX_ROWS[1]!} w={126} h={38} lines={['团队 npm 源', '@godcreator/*']} mono tone={tone('registry')} dim={dim('registry')} />
        <Box x={26} y={BOX_ROWS[2]!} w={126} h={38} lines={['npmjs', 'cordis 等第三方包']} tone={tone('npmjs')} dim={dim('npmjs')} />

        <Note x={186} y={22} size={12} color={FG} weight={600}>本机</Note>
        <rect x={178} y={32} width={190} height={248} rx={10} fill="none" stroke={BORDER} />
        <Box x={190} y={BOX_ROWS[0]!} w={166} h={38} lines={['用户级配置', '.npmrc · pnpm 的配置']} tone={tone('config')} dim={dim('config')} />
        <Box x={190} y={BOX_ROWS[1]!} w={166} h={38} lines={['安装目录：启动器', 'Electron，没有内核']} tone={tone('launcher')} dim={dim('launcher')} />
        <Box x={190} y={BOX_ROWS[2]!} w={166} h={38} lines={['窗口 1', 'default']} tone={tone('window')} dim={dim('window')} />
        <Box x={190} y={BOX_ROWS[3]!} w={166} h={38} lines={['窗口 2', '另一个 home']} tone={tone('window2')} dim={dim('window2')} />
        <Box x={190} y={BOX_ROWS[4]!} w={166} h={38} lines={['弹框，退出码 1', 'home 里没有内核包']} tone={current.lit.includes('refusal') ? 'b' : undefined} dim={dim('refusal')} />

        <Note x={390} y={22} size={12} color={FG} weight={600}>homes\default</Note>
        <rect x={382} y={32} width={178} height={248} rx={10} fill="none" stroke={BORDER} />
        <Box x={394} y={BOX_ROWS[0]!} w={154} h={38} lines={['package.json', '列出装了哪些包']} tone={tone('defaultManifest')} dim={dim('defaultManifest')} />
        <Box x={394} y={BOX_ROWS[1]!} w={154} h={38} lines={['内核包', 'gwb-kernel-desktop']} mono tone={tone('defaultKernel')} dim={dim('defaultKernel')} />
        <Box x={394} y={BOX_ROWS[2]!} w={154} h={38} lines={['cordis', '内核包 peer 里的版本']} tone={tone('defaultCordis')} dim={dim('defaultCordis')} />
        <Box x={394} y={BOX_ROWS[3]!} w={154} h={38} lines={['cordis.yml + 插件', '11 个基础插件']} tone={tone('defaultPlugins')} dim={dim('defaultPlugins')} />
        <Box x={394} y={BOX_ROWS[4]!} w={154} h={38} lines={['runtime.json', 'MCP 端口 2870 · token']} tone={tone('defaultRuntime')} dim={dim('defaultRuntime')} />

        <Note x={576} y={22} size={12} color={FG} weight={600}>homes\x（另一个 home）</Note>
        <rect x={568} y={32} width={178} height={248} rx={10} fill="none" stroke={BORDER} strokeDasharray={overview || shown.has('otherManifest') ? undefined : '5 4'} />
        <Box x={580} y={BOX_ROWS[0]!} w={154} h={38} lines={['package.json', '自己的一份']} tone={tone('otherManifest')} dim={dim('otherManifest')} />
        <Box x={580} y={BOX_ROWS[1]!} w={154} h={38} lines={['内核包 + cordis', '版本可以和 default 不同']} tone={tone('otherKernel')} dim={dim('otherKernel')} />
        <Box x={580} y={BOX_ROWS[2]!} w={154} h={38} lines={['cordis.yml + 插件', '各装各的']} tone={tone('otherPlugins')} dim={dim('otherPlugins')} />
        <Box x={580} y={BOX_ROWS[3]!} w={154} h={38} lines={['runtime.json', '另一个 MCP 端口']} tone={tone('otherRuntime')} dim={dim('otherRuntime')} />
        <Box x={580} y={BOX_ROWS[4]!} w={154} h={38} lines={['mcp\\secret.json', '它自己的 token']} tone={tone('otherToken')} dim={dim('otherToken')} />

        <Arrow from={[152, 65]} to={[190, 105]} tone={current.lit.includes('launcher') && current.lit.includes('release') ? 'a' : undefined} />
        <Arrow from={[356, 111]} to={[394, 111]} tone={current.lit.includes('defaultKernel') && current.lit.includes('launcher') ? 'a' : undefined} />
        <Note x={375} y={296} anchor="middle" size={10.5}>
          同一个启动器按 GWB_HOME 选 home，从那个 home 里加载内核{launcherToOther ? '：这一步是 homes\\x' : ''}
        </Note>

        <StepCaption x={20} y={326} w={720} title={current.title} detail={current.detail} />
        <foreignObject x={20} y={384} width={720} height={60}>
          <div
            style={{
              height: 60,
              boxSizing: 'border-box',
              overflow: 'hidden',
              padding: '6px 10px',
              borderRadius: 6,
              border: `1px solid ${BORDER}`,
              fontFamily: MONO,
              fontSize: 11,
              lineHeight: 1.55,
              color: current.command === '' ? MUTED : FG,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
            }}
          >
            {current.command === '' ? '（逐步看每一步运行的命令）' : current.command}
          </div>
        </foreignObject>
      </svg>
      <StepControls count={STEPS.length} state={state} />
    </>
  )
}
