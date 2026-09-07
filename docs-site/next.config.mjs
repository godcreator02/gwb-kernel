import { createMDX } from 'fumadocs-mdx/next'

const withMDX = createMDX()

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  // livedoc 的 core / project 只在服务端跑、还要读盘和调 git,标成外部包让 Node 自己解析。
  // format-fumadocs 不外置:它的 /pre 是客户端组件,跟着站一起打包才是同一个 React
  serverExternalPackages: ['@godcreator02/live-doc-project', '@godcreator02/live-doc-core'],
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
