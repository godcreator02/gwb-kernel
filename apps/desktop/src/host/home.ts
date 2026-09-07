import fs from 'node:fs'
import path from 'node:path'
import README from './home-readme.md?raw'

/**
 * home 目录的最小形态：**起得来**所需的那几个文件，外加一份给人看的说明书。
 *
 * 装机不在这儿——包怎么进 home 归件管，内核只把目录铺出来。取舍见文档站。
 */

/** 条目表的文件名。这是它的唯一定义，宿主入口从这儿取——两处各写一份必然漂移 */
export const CONFIG_NAME = 'cordis.yml'

/** 说明书落进 home 时的文件名。正本是同目录下的 `home-readme.md` */
export const README_NAME = 'README.md'

/** 缺哪样补哪样，逐个判在不在，幂等 */
function seed(file: string, content: string): void {
  if (!fs.existsSync(file)) fs.writeFileSync(file, content, 'utf8')
}

/**
 * 把 home 建成**起得来**的最小形态：一份包清单、一份空条目表、一份说明书。
 *
 * `cordis.yml` 不能少：include 件读不到它会抛，而那个错落在 loader 的挂载链上、
 * 是一条未捕获的 promise rejection——**宿主整个退出**，不是「一个件都没装」。
 * 空表 `[]` 才是「一个件都没装」的正当表达。
 *
 * 三样都是**在不在才补**，不是每次覆盖：用户在 `README.md` 上写了批注不该被抹掉。
 * 代价是说明书改版之后，老 home 里那份还是旧的。
 */
export function ensureHome(homeDir: string): void {
  fs.mkdirSync(homeDir, { recursive: true })
  seed(path.join(homeDir, 'package.json'), `${JSON.stringify({ name: 'gwb-home', private: true }, null, 2)}\n`)
  seed(path.join(homeDir, CONFIG_NAME), '[]\n')
  seed(path.join(homeDir, README_NAME), README)
}

/** 这个 home 之前建过吗。看包清单在不在——`ensureHome` 铺的第一样就是它 */
export function homeExists(homeDir: string): boolean {
  return fs.existsSync(path.join(homeDir, 'package.json'))
}
