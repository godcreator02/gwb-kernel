import { createMDX } from 'fumadocs-mdx/next'

const withMDX = createMDX()

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  // **空着,这一行就是那条「不许外置」的账。** `@godcreator02/docfirst-workflow` 一个包里
  // 同时住着服务端那半（读盘、调 git、remark 插件）与客户端组件 /fumadocs/pre,
  // serverExternalPackages 按包名匹配、没有子路径粒度,所以它整包不能外置:外置之后 Next
  // 走 Node 单独加载、跟站打包的 React 分了家,预渲染报 Cannot read properties of null
  serverExternalPackages: [],
  redirects: async () => [
    { source: '/', destination: '/docs/overview', permanent: true },
    { source: '/docs', destination: '/docs/overview', permanent: true },
    // 旧页挪了位置：四件事解体成 kernel/ 各章，写一个件拆成 plugins/ 各页
    { source: '/docs/four-things', destination: '/docs/kernel/processes', permanent: true },
    { source: '/docs/plugin', destination: '/docs/plugins/anatomy', permanent: true },
    { source: '/docs/decisions', destination: '/docs/trajectory', permanent: true },
    { source: '/docs/walls', destination: '/docs/trajectory', permanent: true },
  ],
}

export default withMDX(config)
