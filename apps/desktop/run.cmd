@echo off
rem 直接跑现成的 dist/，不重新构建。改了内核先 pnpm build。
rem 不设 GWB_HOME 落 default；GWB_HOME 给名字落 userData\homes\<名>，给路径就用那个目录。
rem 要 CDP 取证在后面带 --remote-debugging-port=9222，Chromium 开关命令行上就生效，内核不管它。
cd /d "%~dp0"
node_modules\electron\dist\electron.exe . %*
