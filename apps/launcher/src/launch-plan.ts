import fs from 'node:fs'
import path from 'node:path'
import semver from 'semver'

export const KERNEL_PACKAGE = '@godcreator/gwb-kernel-desktop'

/** 与内核 `apps/desktop/src/home-path.ts` 同一条规则，测试逐个输入比对两份 */
export function homePathFor(gwbHomeSetting: string, appDataDir: string): string {
  return /[\\/]/.test(gwbHomeSetting) ? path.resolve(gwbHomeSetting) : path.join(appDataDir, 'gwb-kernel', 'homes', gwbHomeSetting)
}

export type KernelEntry = { ok: true; entryFile: string } | { ok: false; message: string }

interface KernelManifest {
  version?: unknown
  main?: unknown
  engines?: { electron?: unknown }
}

function readKernelManifest(manifestFile: string): KernelManifest | string {
  try {
    return JSON.parse(fs.readFileSync(manifestFile, 'utf8')) as KernelManifest
  } catch (err) {
    return `读不了内核包的清单 ${manifestFile}：${err instanceof Error ? err.message : String(err)}`
  }
}

/** home 里装的内核包能不能在这个 Electron 上启动；能就给出入口文件 */
export function kernelEntryFor(homeDir: string, electronVersion: string): KernelEntry {
  const packageDir = path.join(homeDir, 'node_modules', ...KERNEL_PACKAGE.split('/'))
  const manifestFile = path.join(packageDir, 'package.json')
  if (!fs.existsSync(manifestFile)) {
    return { ok: false, message: `home ${homeDir} 里没有内核包 ${KERNEL_PACKAGE}：照内核仓的 INSTALL.md 把它装进这个 home` }
  }
  const manifest = readKernelManifest(manifestFile)
  if (typeof manifest === 'string') return { ok: false, message: manifest }

  const kernelVersion = String(manifest.version)
  const electronRange = manifest.engines?.electron
  if (typeof electronRange !== 'string') {
    return { ok: false, message: `内核包 ${kernelVersion} 没有声明 engines.electron，确认不了它能不能在 Electron ${electronVersion} 上运行` }
  }
  if (!semver.satisfies(electronVersion, electronRange)) {
    return {
      ok: false,
      message: `内核包 ${kernelVersion} 要求 Electron ${electronRange}，这个安装包带的是 ${electronVersion}：装新版安装包，或在 home ${homeDir} 里装一个支持它的内核`,
    }
  }
  if (typeof manifest.main !== 'string') {
    return { ok: false, message: `内核包 ${kernelVersion} 的清单 ${manifestFile} 没有 main 入口` }
  }
  return { ok: true, entryFile: path.join(packageDir, manifest.main) }
}
