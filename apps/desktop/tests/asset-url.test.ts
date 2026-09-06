import { describe, expect, it } from 'vitest'
import { clientUrl, parseAssetUrl } from '../src/shared/asset-url'

const parse = (href: string): { pkg: string } | undefined => parseAssetUrl(new URL(href))

describe('asset-url', () => {
  it('拼出来的地址自己认得', () => {
    expect(parse(clientUrl('@test/shell'))).toEqual({ pkg: '@test/shell' })
    expect(parse(clientUrl('plain'))).toEqual({ pkg: 'plain' })
  })

  it('包名带 scope 是两段,最后一段才是资源名', () => {
    expect(parse('gwb://asset/plugins/@a/b/client.js')).toEqual({ pkg: '@a/b' })
  })

  it('host 不对、前缀不对、资源名不对,一律不认', () => {
    expect(parse('gwb://other/plugins/@a/b/client.js')).toBeUndefined()
    expect(parse('gwb://asset/shared/@a/b/client.js')).toBeUndefined()
    expect(parse('gwb://asset/plugins/@a/b/index.js')).toBeUndefined()
    expect(parse('gwb://asset/plugins/@a/b/style.css')).toBeUndefined()
  })

  it('没有包名那一段不认', () => {
    expect(parse('gwb://asset/plugins/client.js')).toBeUndefined()
    expect(parse('gwb://asset/plugins/')).toBeUndefined()
  })
})
