// 从页面里取证：连 CDP，对第一个 page 目标跑一段表达式，把值打成 JSON。
// 用法：node probes/cdp-eval.mjs <端口> <表达式文件>。表达式可以是 async（会 await promise）。
// 表达式走文件不走命令行：PowerShell 的引号会把它截断
import fs from 'node:fs'

const [port, file] = process.argv.slice(2)
const expr = fs.readFileSync(file, 'utf8')
const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json()
const page = targets.find((t) => t.type === 'page')
if (!page) throw new Error(`没有 page 目标：${JSON.stringify(targets)}`)
const ws = new WebSocket(page.webSocketDebuggerUrl)
await new Promise((resolve, reject) => {
  ws.onopen = resolve
  ws.onerror = reject
})
const reply = await new Promise((resolve) => {
  ws.onmessage = (m) => resolve(JSON.parse(m.data))
  ws.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression: expr, awaitPromise: true, returnByValue: true } }))
})
ws.close()
console.log(JSON.stringify(reply.result?.result?.value ?? reply, null, 2))
