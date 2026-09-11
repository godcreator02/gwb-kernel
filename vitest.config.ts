import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['{apps,packages}/**/tests/**/*.test.ts'],
    // 内核的纯函数住 apps/desktop/src/imports.ts，测试就在旁边 tests/；main.ts 一进门就摸
    // electron，那一半靠实机验证不靠单测
    passWithNoTests: true,
  },
})
