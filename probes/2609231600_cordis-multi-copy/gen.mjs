// 由 src/*.template.mjs 生成各变体插件，全部落 dist/（生成物，不入库）：
//   dist/{provider,viewer}-host.mjs  import 'cordis'   → 宿主同一份 rc.9
//   dist/{provider,viewer}-b.mjs     import 'cordis10' → 另一份 rc.10（独立模块实例）
//   dist/{provider,viewer}-bundled{10,9}.mjs           → esbuild 把 cordis（连 cosmokit）整份打进束
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

const here = new URL('.', import.meta.url)
const root = fileURLToPath(here)
fs.mkdirSync(new URL('dist/', here), { recursive: true })
const tpl = (f) => fs.readFileSync(new URL(`src/${f}.template.mjs`, here), 'utf8')
const emit = (out, f, cordis, tag) =>
  fs.writeFileSync(new URL(out, here), tpl(f).replaceAll('__CORDIS__', cordis).replaceAll('__TAG__', tag))

emit('dist/provider-host.mjs', 'provider', 'cordis', 'host-copy rc.9')
emit('dist/provider-b.mjs', 'provider', 'cordis10', 'B-copy rc.10')
emit('dist/viewer-host.mjs', 'viewer', 'cordis', 'host-copy rc.9')
emit('dist/viewer-b.mjs', 'viewer', 'cordis10', 'B-copy rc.10')
// 打束的源写 import 'cordis'，靠 alias 决定打进哪一版
emit('dist/provider-bundle-src.mjs', 'provider', 'cordis', '__BTAG__')
emit('dist/viewer-bundle-src.mjs', 'viewer', 'cordis', '__BTAG__')

for (const [ver, alias] of [['10', 'cordis10'], ['9', 'cordis']]) {
  for (const f of ['provider', 'viewer']) {
    const out = `dist/${f}-bundled${ver}.mjs`
    await build({
      entryPoints: [`dist/${f}-bundle-src.mjs`], absWorkingDir: root,
      outfile: out, bundle: true, format: 'esm', platform: 'node',
      alias: { cordis: alias }, banner: { js: `// bundled cordis via ${alias}` }, logLevel: 'warning',
    })
    const text = fs.readFileSync(new URL(out, here), 'utf8').replaceAll('__BTAG__', `bundled rc.${ver}`)
    fs.writeFileSync(new URL(out, here), text)
    const bare = [...text.matchAll(/^import .* from ["']([^"'.][^"']*)["']/gm)].map((m) => m[1])
    console.log(out, `${(text.length / 1024).toFixed(1)}KB`, 'bare imports:', bare.length ? bare : 'none',
      '| Symbol.for("cordis.tracker") in bundle:', text.includes('Symbol.for("cordis.tracker")'))
  }
}
