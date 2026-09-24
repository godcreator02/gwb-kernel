import { sourceTrajectory } from '@/lib/source'
import { DocsBody, DocsPage, DocsTitle } from 'fumadocs-ui/layouts/docs/page'
import { getMDXComponents } from '@/components/mdx'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'

// 卡页：标题下一行元信息（born-at、type、domain、parent 链到父卡页），再一行「回到盘」。
// slug 必选——/trajectory 那个根是星轨盘的整页路由（另一组），轨迹区没有导读页。
export default async function Page({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params
  const page = sourceTrajectory.getPage(slug)
  if (!page) notFound()

  const { type, domain, parent, ['born-at']: bornAt } = page.data
  const MDX = page.data.body
  // 回到盘：带上第一个 parent 当盘身份（不是根卡时组件退回第一张盘），没有 parent 就不带
  const backHref =
    parent && parent.length > 0 ? `/trajectory?disk=${encodeURIComponent(parent[0])}` : '/trajectory'
  return (
    <DocsPage toc={page.data.toc}>
      <DocsTitle>{page.data.title}</DocsTitle>
      {bornAt ? (
        <div style={{ fontSize: 13, opacity: 0.7, margin: '-8px 0 4px' }}>
          {String(bornAt)}
          {type ? ` · ${type}` : ''}
          {domain ? ` · ${domain}` : ''}
          {parent && parent.length > 0 ? (
            <>
              {' · 父卡：'}
              {parent.map((id: string, i: number) => (
                <span key={id}>
                  {i > 0 ? '、' : ''}
                  <a href={`/trajectory/${encodeURIComponent(id)}`}>{id}</a>
                </span>
              ))}
            </>
          ) : null}
        </div>
      ) : null}
      <div style={{ fontSize: 13, margin: '0 0 16px' }}>
        <a href={backHref}>← 回到盘</a>
      </div>
      <DocsBody>
        <MDX components={getMDXComponents()} />
      </DocsBody>
    </DocsPage>
  )
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string[] }> }): Promise<Metadata> {
  const { slug } = await params
  const page = sourceTrajectory.getPage(slug)
  if (!page) notFound()
  return { title: page.data.title, description: page.data.description }
}

// 只出卡，不出空 slug——/trajectory 那个根归星轨盘那条路由
export function generateStaticParams() {
  return sourceTrajectory.generateParams().filter((p) => p.slug.length > 0)
}
