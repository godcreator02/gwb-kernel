/** 主进程中的有效登记；页面里已经解析的模块另由 preload 持有，不能随登记撤销。 */
export function createBrowserImports() {
  const entries = new Map<string, { url: string; count: number }>()
  return {
    snapshot(): Record<string, string> {
      return Object.fromEntries([...entries].map(([name, entry]) => [name, entry.url]))
    },
    register(imports: Readonly<Record<string, string>>): () => void {
      const batch = Object.entries(imports)
      for (const [name, url] of batch) {
        if (!name || /[\s:\\?#]/.test(name) || name.startsWith('.') || name.startsWith('/') || name.endsWith('/')) {
          throw new Error(`浏览器模块名要是精确的包名或子路径：${name}`)
        }
        if (typeof url !== 'string' || !URL.canParse(url) || new URL(url).protocol !== 'file:' || !/\.m?js$/.test(new URL(url).pathname)) {
          throw new Error(`浏览器模块 ${name} 要提供本地 .js 或 .mjs 文件 URL：${String(url)}`)
        }
        const previous = entries.get(name)
        if (previous !== undefined && previous.url !== url) {
          throw new Error(`浏览器模块 ${name} 冲突：${previous.url} 与 ${url}`)
        }
      }
      for (const [name, url] of batch) {
        const previous = entries.get(name)
        entries.set(name, { url, count: (previous?.count ?? 0) + 1 })
      }
      let revoked = false
      return () => {
        if (revoked) return
        revoked = true
        for (const [name] of batch) {
          const entry = entries.get(name)!
          if (--entry.count === 0) entries.delete(name)
        }
      }
    },
  }
}
