# 重建本仓 hook 用的解释器：同目录 .venv/（gitignore），纯标准库、不装任何包。
# 新机器 / 换机器 / .venv 丢了，跑一次即可。settings.json 里的 hook 命令指向这个 .venv 的 python.exe。
$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
uv venv (Join-Path $here '.venv') --python 3.13
& (Join-Path $here '.venv\Scripts\python.exe') --version
