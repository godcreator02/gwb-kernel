import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['{apps,packages}/**/tests/**/*.test.ts'],
    // 内核里不依赖 electron 的纯函数（imports / bare-import / entry-state）各自一个文件，测试在
    // 旁边的 tests/；main.ts 一开始就用到 electron，这部分靠实机验证，不做单元测试
    passWithNoTests: true,
  },
})
