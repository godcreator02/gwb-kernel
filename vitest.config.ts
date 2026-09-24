import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['{apps,packages}/**/tests/**/*.test.ts'],
    // main.test.ts 把 electron 换成假的，cordis 与 loader 用真的；窗口里真正画出来的样子只能实机验证
    passWithNoTests: true,
  },
})
