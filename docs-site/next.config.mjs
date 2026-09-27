import { createMDX } from 'fumadocs-mdx/next';

const withMDX = createMDX();

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  // 下面这些都是已经不存在的页面地址，指到现在包含它内容的那一页：轨迹卡与别的仓的文档里还链着它们。
  // 新加的一律用临时跳转——永久跳转会被浏览器缓存，以后这些地址再用上就打不开
  redirects: async () => [
    { source: '/', destination: '/docs', permanent: false },
    { source: '/future', destination: '/future/roadmap', permanent: false },
    { source: '/future/overview', destination: '/docs', permanent: true },
    { source: '/future/not-doing', destination: '/docs', permanent: false },
    { source: '/docs/trajectory/:path*', destination: '/trajectory/:path*', permanent: true },
    { source: '/docs/decisions', destination: '/trajectory', permanent: true },
    { source: '/docs/walls', destination: '/trajectory', permanent: true },
    { source: '/docs/overview', destination: '/docs', permanent: true },
    { source: '/docs/not-doing', destination: '/docs', permanent: false },
    { source: '/docs/roadmap', destination: '/future/roadmap', permanent: true },
    { source: '/docs/readme', destination: '/docs/outputs/readme', permanent: false },
    { source: '/docs/agents', destination: '/docs/outputs/agents', permanent: false },
    { source: '/outputs/:path*', destination: '/docs/outputs/:path*', permanent: false },
    { source: '/spec', destination: '/future', permanent: false },
    { source: '/spec/:path*', destination: '/future', permanent: false },
    { source: '/feedback/:path*', destination: '/future', permanent: false },
    { source: '/docs/four-things', destination: '/docs', permanent: true },
    { source: '/docs/kernel/processes', destination: '/docs', permanent: true },
    { source: '/docs/kernel/cordis', destination: '/docs/seams/loading', permanent: true },
    { source: '/docs/plugins/:path*', destination: '/docs/seams/loading', permanent: true },
    { source: '/docs/plugin', destination: '/docs/seams/loading', permanent: true },
    { source: '/docs/getting-started/:path*', destination: '/docs', permanent: true },
    { source: '/docs/dev-loop', destination: '/docs', permanent: true },
    { source: '/docs/docfirst/:path*', destination: '/docs', permanent: true },
    { source: '/docs/boundary', destination: '/docs', permanent: false },
    { source: '/docs/kernel', destination: '/docs/desktop', permanent: true },
    { source: '/docs/kernel/home', destination: '/docs/desktop', permanent: true },
    { source: '/docs/kernel/loading', destination: '/docs/seams/loading', permanent: true },
    { source: '/docs/kernel/contract', destination: '/docs/desktop/api', permanent: true },
    { source: '/docs/kernel/importmap', destination: '/docs/seams/page-react', permanent: true },
    { source: '/docs/kernel/bridge', destination: '/docs/seams/shell', permanent: true },
    { source: '/docs/kernel/logs', destination: '/docs/seams/log', permanent: true },
    { source: '/docs/criteria/k1', destination: '/docs', permanent: false },
    { source: '/docs/criteria', destination: '/docs', permanent: false },
    { source: '/docs/criteria/:path*', destination: '/docs', permanent: false },
    { source: '/docs/plugin-manager', destination: '/docs', permanent: false },
    { source: '/docs/plugin-manager/:path*', destination: '/docs', permanent: false },
    { source: '/docs/commands', destination: '/docs', permanent: false },
    { source: '/docs/seams/builtin', destination: '/docs', permanent: false },
    { source: '/docs/seams/command-bus', destination: '/docs', permanent: false },
    { source: '/docs/seams/pnpm', destination: '/docs', permanent: false },
    { source: '/docs/seams/skills', destination: '/docs', permanent: false },
    { source: '/docs/map', destination: '/docs', permanent: false },
    { source: '/docs/seams', destination: '/docs', permanent: false },
    { source: '/docs/seams/plugins', destination: '/docs/seams/loading', permanent: false },
    { source: '/docs/seams/shared', destination: '/docs/seams/page-react', permanent: false },
    { source: '/docs/desktop/home', destination: '/docs/desktop', permanent: false },
    { source: '/docs/desktop/log-file', destination: '/docs/desktop', permanent: false },
    { source: '/docs/desktop/status-page', destination: '/docs/desktop', permanent: false },
  ],
  // 浏览器还缓存着早先 /docs → /docs/system-map 的 308：再重定向回 /docs 就成环，改写不发 30x
  rewrites: async () => [{ source: '/docs/system-map', destination: '/docs' }],
};

export default withMDX(config);
