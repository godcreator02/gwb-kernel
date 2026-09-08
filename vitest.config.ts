import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['{apps,packages}/**/tests/**/*.test.ts'],
    // 单进程内核眼下一个纯函数模块都没有：main.ts 一进门就摸 electron 与磁盘，验证靠探针不靠单测
    passWithNoTests: true,
  },
})
