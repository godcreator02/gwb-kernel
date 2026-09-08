@echo off
rem 日常启动：直接跑现成的 out/，不重新构建。改了内核才需要先
rem `pnpm exec electron-vite build`（或根目录 pnpm start）。见文档站。
rem 不设 GWB_HOME，落日常那份 default home；要开别的 home 在前面设环境变量。
cd /d "%~dp0"
node_modules\electron\dist\electron.exe .
