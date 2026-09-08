(async () => {
  const gwb = window.gwb
  const panes = await gwb.command('shell.panes')
  const env = await gwb.command('shell.env')
  const backlog = await gwb.command('logger.backlog')
  const rows = backlog.data ?? []
  const bySource = {}
  for (const r of rows) bySource[r.source] = (bySource[r.source] ?? 0) + 1
  const pane = document.querySelector('[data-gwb-plugin="@godcreator02/gwb-logger"]')
  return {
    hasDockview: !!document.querySelector('.dv-groupview'),
    importmaps: [...document.querySelectorAll('script[type=importmap]')].map((s) => Object.keys(JSON.parse(s.textContent).imports)),
    panes: panes.data,
    envStyles: env.data && env.data.styles,
    loggerPaneDom: pane !== null,
    logRowsInPane: pane ? pane.querySelectorAll('.font-mono').length : -1,
    paneBg: pane ? getComputedStyle(pane.firstElementChild).backgroundColor : null,
    backlogCount: rows.length,
    bySource,
    sample: rows.slice(0, 6).map((r) => `${r.source} ${r.level} ${r.name} ${r.msg.slice(0, 70)}`),
    dark: document.documentElement.classList.contains('dark'),
    bodyBg: getComputedStyle(document.body).backgroundColor,
    rootText: document.getElementById('root').textContent.slice(0, 100),
  }
})()
