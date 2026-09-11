import { resolve } from 'node:path'
import Link from 'next/link'
import { ThemeSwitch } from 'fumadocs-ui/layouts/shared/slots/theme-switch'
import { buildTrajectory } from '@godcreator02/docfirst-trajectory'
import { StarDisk } from '@godcreator02/docfirst-trajectory/react'
import { launcherThumbs } from '@godcreator02/docfirst-trajectory/server'

// 星轨整页：读站里的卡目录建模，渲一条顶栏加一张吃满剩余高度的盘或启动器卡阵。
// `?disk=` 缺失渲启动器（每张盘一张服务端渲好的静态定妆照），有则渲那张盘；组件切盘 / 回
// 启动器时也写回这个参数。轨迹区没有导读页，这条整页路由就是区的入口，侧栏第一项指到这儿。
export default async function Page({ searchParams }: { searchParams: Promise<{ disk?: string }> }) {
  const { disk } = await searchParams
  const data = await buildTrajectory(resolve(process.cwd(), 'content/trajectory'))
  const thumbs = launcherThumbs(data)
  return (
    <div className="trajectory-page">
      <header className="trajectory-topbar">
        <div className="trajectory-topbar-left">
          <Link href="/docs">← 文档</Link>
          {disk ? <Link href="/trajectory">启动器</Link> : null}
        </div>
        <div className="trajectory-topbar-right">
          {data.sick.length > 0 ? (
            <span className="trajectory-sick" title={data.sick.map((f) => f.path).join('\n')}>
              报病 {data.sick.length}
            </span>
          ) : null}
          <ThemeSwitch mode="light-dark" />
        </div>
      </header>
      <div className="trajectory-stage">
        <StarDisk data={data} hrefBase="/trajectory" mode="page" initialDisk={disk} thumbs={thumbs} />
      </div>
    </div>
  )
}
