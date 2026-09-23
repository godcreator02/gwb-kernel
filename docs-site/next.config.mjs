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
    { source: '/docs/kernel/cordis', destination: '/docs/seams/plugins', permanent: true },
    { source: '/docs/plugins/:path*', destination: '/docs/seams/plugins', permanent: true },
    { source: '/docs/plugin', destination: '/docs/seams/plugins', permanent: true },
    { source: '/docs/getting-started/:path*', destination: '/docs', permanent: true },
    { source: '/docs/dev-loop', destination: '/docs', permanent: true },
    { source: '/docs/docfirst/:path*', destination: '/docs', permanent: true },
    // 现状区按接缝重写（2026-09-23）：边界并进关键设计，六个模块页并进四条接缝与系统地图
    { source: '/docs/boundary', destination: '/docs/design', permanent: true },
    { source: '/docs/kernel', destination: '/docs/map', permanent: true },
    { source: '/docs/kernel/home', destination: '/docs/seams/plugins', permanent: true },
    { source: '/docs/kernel/loading', destination: '/docs/seams/plugins', permanent: true },
    { source: '/docs/kernel/contract', destination: '/docs/seams/plugins', permanent: true },
    { source: '/docs/kernel/importmap', destination: '/docs/seams/shared', permanent: true },
    { source: '/docs/kernel/bridge', destination: '/docs/seams/shell', permanent: true },
    { source: '/docs/kernel/logs', destination: '/docs/map', permanent: true },
  ],
  // 旧配置曾把 /docs 永久重定向到 /docs/system-map，浏览器缓存着那条 308：这里再重定向回 /docs
  // 就成环。改写不发 30x，缓存了旧跳转的浏览器也看得到入口页。系统地图现在的网址是 /docs/map
  rewrites: async () => [{ source: '/docs/system-map', destination: '/docs' }],
}

export default withMDX(config)
