import path from 'node:path'

/** `GWB_HOME` 是名字就放在 appData/gwb-kernel/homes/<名字>，带路径分隔符就是目录本身 */
export function homePathFor(gwbHomeSetting: string, appDataDir: string): string {
  return /[\\/]/.test(gwbHomeSetting) ? path.resolve(gwbHomeSetting) : path.join(appDataDir, 'gwb-kernel', 'homes', gwbHomeSetting)
}
