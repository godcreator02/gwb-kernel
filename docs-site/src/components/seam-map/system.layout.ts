/**
 * 全局接缝图（system.data.mjs）的坐标与图标。按依赖方向从上往下三行：页面上的代码与插件，内核应用（上一行是页面这边的能力，
 * 下一行是主进程的能力），安装包、devkit 与 home 里的文件；cordis 在内核右边，插件管理从上面直接接进去。
 * 从上往下的竖线都避开各框的标题文字，接缝 12 因此从左边接进 runtime.json；接缝 3、12 各有两段，画出了两个读写 home 文件的地方。
 */
import { Boxes, Cpu, FolderOpen, Monitor, Package, Puzzle, Terminal, User } from 'lucide-react';
import { cap } from '@godcreator/docfirst-explainer';
import type { SeamLayout } from '@godcreator/docfirst-explainer';

export const systemLayout: SeamLayout = {
  view: { w: 1330, h: 536 },
  caps: {
    'pg-shell': cap(304, 72, 116),
    'pg-code': cap(428, 72, 112),

    'p-shell': cap(584, 72, 116),
    'p-provider': cap(708, 72, 116),
    'p-any': cap(832, 72, 116),
    'p-files': cap(956, 72, 116),
    'p-pm': cap(1080, 72, 116),

    'k-page': cap(304, 232, 116),
    'k-preload': cap(428, 232, 112),
    'k-log': cap(910, 232, 116),

    'k-types': cap(26, 296, 110),
    'k-boot': cap(150, 296, 116),
    'k-imports': cap(584, 296, 116),
    'k-requests': cap(708, 296, 116),
    'k-service': cap(832, 296, 116),
    'k-load': cap(980, 296, 116),

    'c-loader': cap(1138, 232, 148),
    'c-context': cap(1138, 296, 148),

    launcher: cap(150, 462, 116),
    'installer-build': cap(274, 462, 112),
    'x-tools': cap(424, 462, 232),

    'h-runtime': cap(756, 462, 116),
    'h-log': cap(880, 462, 116),
    'h-pkgs': cap(1010, 462, 178),
    'h-yml': cap(1196, 462, 110),
  },
  groups: {
    page: { x: 290, y: 40, w: 264, h: 94 },
    plugins: { x: 570, y: 40, w: 640, h: 94 },
    kernel: { x: 12, y: 200, w: 1098, h: 158 },
    cordis: { x: 1126, y: 200, w: 172, h: 158 },
    installer: { x: 136, y: 430, w: 264, h: 94 },
    tools: null,
    home: { x: 742, y: 430, w: 578, h: 94 },
  },
  seamPaths: {
    '1': { d: 'M252,462 V344', badge: [252, 400] },
    '2': { d: 'M1096,320 H1138', badge: [1118, 320] },
    '3': { d: 'M1060,344 V462 M1250,358 V462', badge: [1060, 400] },
    '4': { d: 'M944,120 V184 H1236 V232', badge: [1090, 184] },
    '5': { d: 'M890,120 V296', badge: [890, 160] },
    '6': { d: 'M766,120 V296', badge: [766, 160] },
    '7': { d: 'M642,120 V296', badge: [642, 160] },
    '8': { d: 'M362,120 V232', badge: [362, 166] },
    '9': { d: 'M484,120 V232', badge: [484, 166] },
    '10': { d: 'M922,120 V232', badge: [922, 212] },
    '11': { d: 'M964,280 V462', badge: [964, 400] },
    '12': { d: 'M266,320 H450 V400 H720 V474 H756 M656,498 H756', badge: [600, 400] },
    '13': { d: 'M1180,120 V168 H1266 V232', badge: [1223, 168] },
  },
  entries: {
    'human-ui': { box: { x: 12, y: 72, w: 100, h: 48 }, arrow: [112, 96, 304, 96] },
    'human-start': { box: { x: 12, y: 462, w: 100, h: 48 }, arrow: [112, 486, 150, 486] },
  },
  moduleIcons: {
    page: Monitor,
    plugins: Puzzle,
    kernel: Cpu,
    cordis: Boxes,
    installer: Package,
    tools: Terminal,
    home: FolderOpen,
  },
  entryIcons: { 'human-ui': User, 'human-start': User },
};
