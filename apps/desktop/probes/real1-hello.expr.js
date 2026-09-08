(async () => {
  const gwb = window.gwb
  const panes = (await gwb.command('shell.panes')).data ?? []
  const probe = await gwb.command('hello.probe')
  const node = await gwb.command('hello.node')
  const py = await gwb.command('hello.python')
  const pick = (r) => {
    const d = r && r.data
    return {
      ok: r && r.ok,
      error: r && r.error,
      exitCode: d && d.exitCode,
      stdout: d && d.stdout && String(d.stdout.text ?? d.stdout).slice(0, 160),
      stderr: d && d.stderr && String(d.stderr.text ?? d.stderr).slice(-160),
      durationMs: d && d.durationMs,
    }
  }
  const helloPanes = document.querySelectorAll('[data-gwb-plugin="@godcreator02/gwb-hello"]')
  return {
    importmaps: [...document.querySelectorAll('script[type=importmap]')].map((s) => Object.keys(JSON.parse(s.textContent).imports)),
    panes: panes.map((p) => `${p.pkg}#${p.id} client=${p.client ? 'yes' : 'no'} style=${p.style ? 'yes' : 'no'}`),
    helloPaneCount: helloPanes.length,
    helloPaneText: [...helloPanes].map((el) => el.textContent.slice(0, 80)),
    helloButtonBg: helloPanes[0] ? getComputedStyle(helloPanes[0].querySelector('button') ?? helloPanes[0]).backgroundColor : null,
    probe,
    node: pick(node),
    python: pick(py),
    rootTabs: [...document.querySelectorAll('.dv-tab')].map((t) => t.textContent.trim()).slice(0, 10),
  }
})()
