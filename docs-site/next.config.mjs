import { createMDX } from 'fumadocs-mdx/next'

const withMDX = createMDX()

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  // 必须为空：`@godcreator/docfirst-workflow` 一个包里既有服务端代码（读盘、调 git、remark 插件）
  // 又有客户端组件 /fumadocs/pre，serverExternalPackages 只能按整个包名设置，不能只外置子路径。
  // 外置之后 Next 用 Node 单独加载它，它拿到的 React 和站点打包的不是同一份，预渲染报
  // Cannot read properties of null
  serverExternalPackages: [],
  redirects: async () => [
    // 站的入口是现状区的入口页；未来区只剩路线一页
    { source: '/', destination: '/docs', permanent: false },
    { source: '/future', destination: '/future/roadmap', permanent: false },
    // 未来区的总览与刻意不做并进现状区（2026-09-23），旧网址都保留（/docs/system-map 见下方 rewrites）
    { source: '/future/overview', destination: '/docs', permanent: true },
    { source: '/future/not-doing', destination: '/docs/design', permanent: true },
    // 文档站分成六个区（2026-09-12）：轨迹卡、生成文件的正本各有自己的区，旧网址都保留
    { source: '/docs/trajectory/:path*', destination: '/trajectory/:path*', permanent: true },
    { source: '/docs/decisions', destination: '/trajectory', permanent: true },
    { source: '/docs/walls', destination: '/trajectory', permanent: true },
    { source: '/docs/overview', destination: '/docs', permanent: true },
    { source: '/docs/not-doing', destination: '/docs/design', permanent: true },
    { source: '/docs/roadmap', destination: '/future/roadmap', permanent: true },
    { source: '/docs/readme', destination: '/outputs/readme', permanent: true },
    { source: '/docs/agents', destination: '/outputs/agents', permanent: true },
    // 现状区按模块重写（2026-09-23）后已经没有的页，指到现在包含它内容的那一页
    { source: '/docs/four-things', destination: '/docs', permanent: true },
    { source: '/docs/kernel/processes', destination: '/docs', permanent: true },
    { source: '/docs/kernel/cordis', destination: '/docs/seams/loading', permanent: true },
    { source: '/docs/plugins/:path*', destination: '/docs/seams/loading', permanent: true },
    { source: '/docs/plugin', destination: '/docs/seams/loading', permanent: true },
    { source: '/docs/getting-started/:path*', destination: '/docs', permanent: true },
    { source: '/docs/dev-loop', destination: '/docs', permanent: true },
    { source: '/docs/docfirst/:path*', destination: '/docs', permanent: true },
    // 现状区按接缝重写（2026-09-23）：边界并进关键设计，六个模块页并进四条接缝与系统地图
    { source: '/docs/boundary', destination: '/docs/design', permanent: true },
    { source: '/docs/kernel', destination: '/docs/desktop', permanent: true },
    { source: '/docs/kernel/home', destination: '/docs/desktop', permanent: true },
    { source: '/docs/kernel/loading', destination: '/docs/seams/loading', permanent: true },
    { source: '/docs/kernel/contract', destination: '/docs/desktop/api', permanent: true },
    { source: '/docs/kernel/importmap', destination: '/docs/seams/page-react', permanent: true },
    { source: '/docs/kernel/bridge', destination: '/docs/seams/shell', permanent: true },
    { source: '/docs/kernel/logs', destination: '/docs/seams/log', permanent: true },
    // 以下都用临时跳转：永久跳转会被浏览器缓存，以后这些网址再用上就打不开。
    // 准入判据在关键设计；写插件的规矩、插件管理、命令插件的页在各自的仓（devkit 仓、基础插件仓）的文档站，
    // 本站入口页列出它们在哪
    { source: '/docs/criteria/k1', destination: '/docs/design', permanent: false },
    { source: '/docs/criteria', destination: '/docs', permanent: false },
    { source: '/docs/criteria/:path*', destination: '/docs', permanent: false },
    { source: '/docs/plugin-manager', destination: '/docs', permanent: false },
    { source: '/docs/plugin-manager/:path*', destination: '/docs', permanent: false },
    { source: '/docs/commands', destination: '/docs', permanent: false },
    { source: '/docs/seams/builtin', destination: '/docs', permanent: false },
    { source: '/docs/seams/command-bus', destination: '/docs', permanent: false },
    { source: '/docs/seams/pnpm', destination: '/docs', permanent: false },
    { source: '/docs/seams/skills', destination: '/docs', permanent: false },
    { source: '/spec/ecosystem-simplify', destination: '/spec', permanent: false },
    { source: '/spec/platform-plugins', destination: '/spec', permanent: false },
    { source: '/spec/kernel-in-home', destination: '/spec', permanent: false },
    { source: '/spec/drop-shared-scan', destination: '/spec', permanent: false },
    // 接缝图就是入口页
    { source: '/docs/map', destination: '/docs', permanent: false },
    { source: '/docs/seams', destination: '/docs', permanent: false },
    { source: '/docs/seams/plugins', destination: '/docs/seams/loading', permanent: false },
    { source: '/docs/seams/shared', destination: '/docs/seams/page-react', permanent: false },
    // home 的准备、日志文件、只读状态页并进内核应用首页
    { source: '/docs/desktop/home', destination: '/docs/desktop', permanent: false },
    { source: '/docs/desktop/log-file', destination: '/docs/desktop', permanent: false },
    { source: '/docs/desktop/status-page', destination: '/docs/desktop', permanent: false },
  ],
  // 旧配置曾把 /docs 永久重定向到 /docs/system-map，浏览器缓存着那条 308：这里再重定向回 /docs
  // 就成环。改写不发 30x，缓存了旧跳转的浏览器也看得到入口页
  rewrites: async () => [{ source: '/docs/system-map', destination: '/docs' }],
}

export default withMDX(config)
