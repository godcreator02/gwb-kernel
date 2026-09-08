(async () => {
  // 三格进了同一组，dockview 只渲染激活的那格：先点「日志」标签让它上前台
  const tab = [...document.querySelectorAll('.dv-tab')].find((t) => t.textContent.trim() === '日志')
  if (tab) tab.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
  await new Promise((r) => setTimeout(r, 600))
  // 往页面 console 打一句：渲染层 → 内核 console-message → ctx.logger('renderer') → 日志件 exporter → emit → 窗格
  console.log('probe-live-line-8848')
  await new Promise((r) => setTimeout(r, 800))
  const pane = document.querySelector('[data-gwb-plugin="@godcreator02/gwb-logger"]')
  const rows = pane ? [...pane.querySelectorAll('.font-mono')] : []
  const hit = rows.filter((el) => el.textContent.includes('probe-live-line-8848')).map((el) => el.textContent.slice(0, 120))
  const node = await window.gwb.command('hello.node')
  const py = await window.gwb.command('hello.python')
  const brief = (r) => ({ keys: Object.keys(r), exitCode: r.exitCode, stdout: String(r.stdout?.text ?? r.stdout ?? '').trim().slice(0, 200) })
  return { loggerPaneDom: pane !== null, totalRows: rows.length, hit, node: brief(node), python: brief(py) }
})()
