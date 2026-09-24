import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { resolveFromHome } from './bare-import.js'

export interface CollectImportsDeps {
  /** home 的目录：home 清单与 node_modules 都在它下面 */
  dataDir: string
  warn: (msg: string) => void
}

const stackOf = (e: unknown): string => (e instanceof Error ? (e.stack ?? e.message) : String(e))

function readJson(file: string): unknown {
  return JSON.parse(fs.readFileSync(file, 'utf8'))
}

/** home 清单的直接依赖；没有清单或读不出来时是空表 */
function homeDependencyNames(dataDir: string): string[] {
  try {
    const homeManifest = readJson(path.join(dataDir, 'package.json')) as { dependencies?: Record<string, unknown> }
    return Object.keys(homeManifest.dependencies ?? {})
  } catch {
    return []
  }
}

/** 包清单里 `gwb.shared` 的「包名 → exports 子路径」；包不在、没有声明、形状不对的条目一律跳过 */
function sharedDeclarationsOf(dataDir: string, packageName: string): [bareName: string, subpath: string][] {
  let declared: unknown
  try {
    const manifest = readJson(path.join(dataDir, 'node_modules', ...packageName.split('/'), 'package.json')) as {
      gwb?: { shared?: unknown }
    }
    declared = manifest.gwb?.shared
  } catch {
    return []
  }
  if (typeof declared !== 'object' || declared === null) return []
  return Object.entries(declared as Record<string, unknown>).filter(
    (declaration): declaration is [string, string] => declaration[0] !== '' && typeof declaration[1] === 'string' && declaration[1] !== '',
  )
}

/** 页面的 importmap：home 里各包 `gwb.shared` 声明的包名 → 真实文件的 `file://` 地址；同一个包名有多个提供方时全部不收 */
export function collectImports(deps: CollectImportsDeps): Record<string, string> {
  const fileUrlsByBareName: Record<string, string> = {}
  const bareNamesWithSeveralProviders = new Set<string>()
  for (const packageName of homeDependencyNames(deps.dataDir)) {
    for (const [bareName, subpath] of sharedDeclarationsOf(deps.dataDir, packageName)) {
      if (fileUrlsByBareName[bareName] !== undefined || bareNamesWithSeveralProviders.has(bareName)) {
        delete fileUrlsByBareName[bareName]
        bareNamesWithSeveralProviders.add(bareName)
        deps.warn(`包名 ${bareName} 有多个提供方，全部拒绝：importmap 不收录这个名字（本次为 ${packageName} 的声明）`)
        continue
      }
      try {
        fileUrlsByBareName[bareName] = pathToFileURL(resolveFromHome(deps.dataDir, packageName, subpath)).href
      } catch (err) {
        deps.warn(`${packageName} 声明的 ${bareName} → ${subpath} 解析不到：${stackOf(err)}`)
      }
    }
  }
  return fileUrlsByBareName
}
