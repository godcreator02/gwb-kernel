import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { expect, it } from 'vitest'

const installerDir = path.join(import.meta.dirname, '..')

it('make-icon.ps1 生成的图标与仓里的 icons/icon.ico 逐字节相同；输出目录不存在时先建出来', () => {
  const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gwb-make-icon-'))
  try {
    const outputIcon = path.join(outputDir, 'nested', 'icon.ico')
    execFileSync('pwsh', ['-NoProfile', '-NonInteractive', '-File', path.join(installerDir, 'scripts', 'make-icon.ps1'), '-Out', outputIcon], {
      stdio: 'pipe',
    })
    expect(fs.readFileSync(outputIcon).equals(fs.readFileSync(path.join(installerDir, 'icons', 'icon.ico')))).toBe(true)
  } finally {
    fs.rmSync(outputDir, { recursive: true, force: true })
  }
}, 60_000)
