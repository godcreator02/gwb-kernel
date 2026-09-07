/**
 * 构建期把一个文本文件的内容当字符串取进来（vite 的 `?raw`）。
 *
 * 用它是为了让**说明书是一份真的 `.md`**：能当 markdown 写、预览、格式化，而不是
 * 源码里一串引号。`?raw` 在构建期内联进束，所以运行时不会「文件找不着」——那正是
 * 这份说明书要防的局面（白窗口 + 连纸条都没有）。
 */
declare module '*.md?raw' {
  const content: string
  export default content
}
