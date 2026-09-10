// 一次性进程：每个升级动作之后新起一个，报「此刻磁盘上 Node 解析成什么」。
// 它跟长跑进程用同一份解析代码，差别只有一个——它是新起的，没有任何进程内缓存。
// 两者对不上，那个差就是缓存；对得上，那就是磁盘真变了/真没变。
const LIB = process.argv[2];
const plugin = await import(process.argv[3]);
const url = plugin.resolveNow();
process.stdout.write(
  JSON.stringify({ lib: LIB, url, read: plugin.readUrl(url), require: plugin.requireResolveNow() }) + '\n',
);
