import { createMDX } from 'fumadocs-mdx/next'

const withMDX = createMDX()

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  // **空着,这一行就是那条「不许外置」的账。** `@godcreator/docfirst-workflow` 一个包里
  // 同时住着服务端那半（读盘、调 git、remark 插件）与客户端组件 /fumadocs/pre,
  // serverExternalPackages 按包名匹配、没有子路径粒度,所以它整包不能外置:外置之后 Next
  // 走 Node 单独加载、跟站打包的 React 分了家,预渲染报 Cannot read properties of null
  serverExternalPackages: [],
  redirects: async () => [
    // 站的入口是现状区的入口页；未来区只剩路线一页
    { source: '/', destination: '/docs', permanent: false },
    { source: '/future', destination: '/future/roadmap', permanent: false },
    // 愿景与边界归现状（2026-09-23）：总览与刻意不做拆进入口与边界，老 URL 全保（系统地图见下方 rewrites）
    { source: '/future/overview', destination: '/docs', permanent: true },
    { source: '/future/not-doing', destination: '/docs/boundary', permanent: true },
    // 六区装配（2026-09-12）：轨迹升独立区、生成正本归自己的区，老 URL 全保
    { source: '/docs/trajectory/:path*', destination: '/trajectory/:path*', permanent: true },
    { source: '/docs/decisions', destination: '/trajectory', permanent: true },
    { source: '/docs/walls', destination: '/trajectory', permanent: true },
    { source: '/docs/overview', destination: '/docs', permanent: true },
    { source: '/docs/not-doing', destination: '/docs/boundary', permanent: true },
    { source: '/docs/roadmap', destination: '/future/roadmap', permanent: true },
    { source: '/docs/readme', destination: '/outputs/readme', permanent: true },
    { source: '/docs/agents', destination: '/outputs/agents', permanent: true },
    // 现状区按模块重写（2026-09-23）后已不在的页，指到接住它内容的那一页
    { source: '/docs/four-things', destination: '/docs', permanent: true },
    { source: '/docs/kernel/processes', destination: '/docs', permanent: true },
    { source: '/docs/kernel/cordis', destination: '/docs/kernel/loading', permanent: true },
    { source: '/docs/plugins/:path*', destination: '/docs/kernel/contract', permanent: true },
    { source: '/docs/plugin', destination: '/docs/kernel/contract', permanent: true },
    { source: '/docs/getting-started/:path*', destination: '/docs', permanent: true },
    { source: '/docs/dev-loop', destination: '/docs', permanent: true },
    { source: '/docs/docfirst/:path*', destination: '/docs', permanent: true },
  ],
  // 系统地图并进了入口页，但旧配置曾把 /docs 永久重定向到 /docs/system-map，浏览器缓存着那条 308：
  // 这里再重定向回 /docs 就成环。改写不发 30x，缓存了旧跳转的浏览器落到这个地址也看得到入口页
  rewrites: async () => [{ source: '/docs/system-map', destination: '/docs' }],
}

export default withMDX(config)
