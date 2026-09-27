/**
 * 安装包内部接缝图（installer.data.mjs）的坐标与图标。上面两行是运行时：Electron 与 home 里的内核包，下面是启动器的两个文件；
 * 再下面两行是打包：打包脚本与启动器清单，最下面是 electron-builder、它的配置与产物。
 * 跨行的线走行与行之间的空隙；安装程序回到 Electron 的那条走最左的空隙（x=10），Electron 版本比对那条走最右的空隙（x=1150）。
 */
import { Atom, FileBraces, FileCog, Hammer, ListChecks, Package, PackageOpen, Rocket, SquareTerminal, User, Wrench } from 'lucide-react';
import { cap } from '@godcreator/explainer-player';
import type { SeamLayout } from '@godcreator/explainer-player';

export const installerLayout: SeamLayout = {
  view: { w: 1160, h: 720 },
  caps: {
    'electron-api': cap(34, 102, 190),
    exe: cap(234, 102, 192),
    'kernel-entry': cap(574, 102, 180),
    'kernel-home': cap(764, 102, 170),
    manifest: cap(944, 102, 182),

    fail: cap(34, 272, 170),
    load: cap(214, 272, 170),
    select: cap(394, 272, 172),
    'home-rule': cap(634, 272, 230),
    'entry-check': cap(874, 272, 252),

    'clean-check': cap(34, 462, 170),
    assemble: cap(214, 462, 170),
    'run-builder': cap(394, 462, 172),
    'launcher-build': cap(634, 462, 160),
    'launcher-version': cap(804, 462, 140),
    'electron-pin': cap(954, 462, 172),

    setup: cap(34, 632, 180),
    unpacked: cap(224, 632, 142),
    'eb-cli': cap(434, 632, 212),
    nsis: cap(714, 632, 200),
    mirror: cap(924, 632, 202),
  },
  groups: {
    electron: { x: 20, y: 70, w: 420, h: 94 },
    kernel: { x: 560, y: 70, w: 580, h: 94 },
    entry: { x: 20, y: 240, w: 560, h: 94 },
    plan: { x: 620, y: 240, w: 520, h: 94 },
    build: { x: 20, y: 430, w: 560, h: 94 },
    'launcher-pkg': { x: 620, y: 430, w: 520, h: 94 },
    output: { x: 20, y: 600, w: 360, h: 94 },
    eb: { x: 420, y: 600, w: 240, h: 94 },
    'builder-config': { x: 700, y: 600, w: 440, h: 94 },
  },
  seamPaths: {
    '1': { d: 'M330,150 V206 H460 V272', badge: [395, 206] },
    '2': { d: 'M566,296 H634', badge: [600, 296] },
    '3': { d: 'M800,272 V150', badge: [800, 211] },
    '4': { d: 'M299,320 V360 H1000 V320', badge: [650, 360] },
    '5': { d: 'M1035,272 V150', badge: [1035, 211] },
    '6': { d: 'M540,272 V226 H664 V150', badge: [602, 226] },
    '7': { d: 'M119,272 V150', badge: [119, 211] },
    '8': { d: 'M1126,486 H1150 V126 H1126', badge: [1150, 300] },
    '9': { d: 'M566,486 H634 M600,486 V548 H1040 V510 M874,548 V510', badge: [740, 548] },
    '10': { d: 'M540,510 V632', badge: [540, 571] },
    '11': { d: 'M646,656 H714 M680,656 V706 H1025 V680', badge: [850, 706] },
    '12': { d: 'M434,656 H366 M400,656 V706 H124 V680', badge: [260, 706] },
    '13': { d: 'M34,656 H10 V58 H250 V102', badge: [10, 400] },
  },
  entries: {
    user: { box: { x: 330, y: 14, w: 140, h: 30 }, arrow: [400, 44, 400, 102] },
    dev: { box: { x: 34, y: 376, w: 220, h: 30 }, arrow: [119, 406, 119, 462] },
  },
  moduleIcons: {
    electron: Atom,
    kernel: Package,
    entry: Rocket,
    plan: ListChecks,
    build: SquareTerminal,
    'launcher-pkg': FileBraces,
    output: PackageOpen,
    eb: Wrench,
    'builder-config': FileCog,
  },
  entryIcons: { user: User, dev: Hammer },
};
