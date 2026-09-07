import { describe, expect, it } from 'vitest'
import { assetUrl, clientUrl, parseAssetUrl } from '../src/shared/asset-url'

const parse = (href: string): { pkg: string; sub: string } | undefined => parseAssetUrl(new URL(href))

describe('asset-url', () => {
  it('拼出来的地址自己认得', () => {
    expect(parse(clientUrl('@test/shell'))).toEqual({ pkg: '@test/shell', sub: './client' })
    expect(parse(clientUrl('plain'))).toEqual({ pkg: 'plain', sub: './client' })
  })

  it('子路径两种写法拼出同一个地址', () => {
    expect(assetUrl('@a/b', './style.css')).toBe(assetUrl('@a/b', 'style.css'))
  })

  it('包名带 scope 是两段,剩下的全是子路径', () => {
    expect(parse('gwb://asset/plugins/@a/b/client')).toEqual({ pkg: '@a/b', sub: './client' })
    expect(parse('gwb://asset/plugins/plain/client')).toEqual({ pkg: 'plain', sub: './client' })
  })

  it('子路径可以多段、可以带扩展名', () => {
    expect(parse('gwb://asset/plugins/@a/b/style.css')).toEqual({ pkg: '@a/b', sub: './style.css' })
    expect(parse('gwb://asset/plugins/@a/b/lib/style.css')).toEqual({ pkg: '@a/b', sub: './lib/style.css' })
  })

  it('host 不对、前缀不对,一律不认', () => {
    expect(parse('gwb://other/plugins/@a/b/client')).toBeUndefined()
    expect(parse('gwb://asset/shared/@a/b/client')).toBeUndefined()
  })

  it('只有包名、没说要什么,不认', () => {
    expect(parse('gwb://asset/plugins/@a/b')).toBeUndefined()
    expect(parse('gwb://asset/plugins/plain')).toBeUndefined()
    expect(parse('gwb://asset/plugins/')).toBeUndefined()
  })

  it('空段不认', () => {
    expect(parse('gwb://asset/plugins/@a/b//client')).toBeUndefined()
  })

  // 点段轮不到 parseAssetUrl 判：URL 自己先规范化掉了（`%2e%2e` 也一样），
  // 落下来的形状是「只剩包名、没说要什么」。真正的越界防线在 resolvePlugin 那道
  it('点段被 URL 规范化,落成没有子路径', () => {
    expect(new URL('gwb://asset/plugins/@a/b/%2e%2e/escape.js').pathname).toBe('/plugins/@a/escape.js')
    expect(parse('gwb://asset/plugins/@a/b/../escape.js')).toBeUndefined()
    expect(parse('gwb://asset/plugins/@a/b/.')).toBeUndefined()
  })
})
