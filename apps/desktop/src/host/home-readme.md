# gwb home

这个目录是一个 **gwb 工作台的 home**：装了哪些件、各自怎么配，全在这儿。
内核第一次起来时把它铺出来，之后归你。

## 窗口是白的？

正常——**一个件都没装**。界面是由某个件交出来的（provide `gwbShell` 服务的那个），
内核自己不画任何东西。装几个就有了。

## 装一个件

两步：**把包装进来**，**在 `cordis.yml` 里加一条条目**。少任何一步都不会挂上。

### 一、装包

在**这个目录**下跑：

```
pnpm add @godcreator02/gwb-shell @godcreator02/gwb-commands @godcreator02/gwb-shared-react @godcreator02/gwb-tokens
```

这四个包分两类，**处理方式不同**：

- **件**（`gwb-shell` 外壳、`gwb-commands` 命令总线）——装完还要在 `cordis.yml` 里
  加条目才会挂上
- **共享包**（`gwb-shared-react`、`gwb-tokens`）——装在这儿就行，**不进 `cordis.yml`**。
  它们不是件：没有 `apply`、不在条目树上，是件的浏览器那半在运行时要解析到的东西

`@godcreator02` 这个 scope 指向本机的 Verdaccio。装不动就先看 `%USERPROFILE%\.npmrc`
里有没有这行：

```
@godcreator02:registry=http://127.0.0.1:4873/
```

### 二、加条目

编辑这个目录下的 `cordis.yml`，把 `[]` 换成：

```yaml
- id: commands
  name: '@godcreator02/gwb-commands'
- id: shell
  name: '@godcreator02/gwb-shell'
```

重启应用。

## `id` 必须自己写

**每条条目都要有 `id`，而且要自己写。** 这不是可选的：

- 不写的话 cordis 会发一个 8 位随机十六进制（`a3f9c210` 这种），而且**每次启动都换一个**
- `id` 是这条条目的**身份**——它的设置和数据都挂在这个 id 上。id 一变，重启后全对不上

同理，**改一条条目的 `id` 等于换一个身份**：老的设置和数据不会跟着走，会留在原地
变成无主的。

`id` 只用小写字母、数字和单连字符（`py311`、`mcp-work`），同一个文件里不能重名。

## 有些件可以装好几份

`name` 是「装哪个包」，`id` 才是身份。所以同一个包能挂多条条目，各有各的配置、
各有各的设置和数据：

```yaml
- id: notes-work
  name: '@acme/gwb-notes'
  config:
    dir: D:\work\notes
- id: notes-home
  name: '@acme/gwb-notes'
  config:
    dir: D:\personal\notes
```

**但这条只对一部分件成立。** 交出服务的件（设置件、数据件、外壳这些）**只能挂一条**
——服务名在整个工作台里是唯一的，第二条条目一挂就报：

```
service "xxx" has been registered
```

那条条目挂不上，**但不影响别的**：工作台照常跑，日志里有这句话。哪条挂上了哪条没挂，
看条目列表。

能安全挂多份的是「只登记命令与窗格、不交出服务」的件。不确定就挂第二条试试——挂不上
除了日志里多一句，什么也不会坏。

## 停用一条

不用删，加一行：

```yaml
- id: shell
  name: '@godcreator02/gwb-shell'
  disabled: true
```

## 卸载

应用里不做卸载。要拿掉一个包，在这个目录下手工跑：

```
pnpm remove @godcreator02/gwb-hello
```

再把 `cordis.yml` 里对应的条目删掉。**它的设置和数据不会被一并删除**，留在原地。

## 这个目录里有什么

| | |
| --- | --- |
| `cordis.yml` | 条目表：挂哪些件、各自什么配置。**内核只认这一个文件** |
| `package.json` | 装了哪些包，pnpm 维护 |
| `node_modules/` | 包本身 |
| `settings.json` | 各件的设置值（装了设置件才有） |
| `data/` | 各件的数据（装了数据件才有） |
| `README.md` | 这份，内核铺的 |
