async () => {
  const missing = await window.gwb.request('request-channel-verification.missing').catch(error => ({message:error.message, isError:error instanceof Error}));
  const malformed = await window.gwb.request('commands.run', {args:{}});
  const command = await window.gwb.request('commands.run', {name:'shell.panes',args:undefined,via:'mcp'});
  return {request:typeof window.gwb.request, legacy:typeof window.gwb.command, missing, malformed, panes:command, body:document.body.innerText.slice(0,700)};
}
