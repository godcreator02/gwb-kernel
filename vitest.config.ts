import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['{apps,packages}/**/tests/**/*.test.ts'],
    // 内核不带 electron 的纯函数（imports / bare-import / entry-state）各自成文件，测试就在
    // 旁边 tests/；main.ts 一进门就摸 electron，那一半靠实机验证不靠单测
    passWithNoTests: true,
  },
})
