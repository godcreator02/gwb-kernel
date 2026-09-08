"""本仓四个 hook 共用的常量与输出助手。

这套 hook 从 god-flow 插件 3.0.0 的 hooks/ 复制而来、去掉了 god-settings.json 那层
按项目开关的配置读取：四个 hook 在本仓一律常开，不再引用插件缓存。
（这份是从总控台 26090520ntn\\console 搬过来的副本，两边各自带一份、互不相干。）
解释器是同目录 .venv/（uv 建，纯标准库、不装包），重建见 bootstrap.ps1。

写入冻结的 flag 池与解锁关键词：check-allow 写、block-write-no-allow 读，两边必须认同一份。
flag 住系统临时目录，session_id 全局唯一，全机器共用一个池子不会撞。
"""

import json
import tempfile
from pathlib import Path

PERM_FLAG_DIR = Path(tempfile.gettempdir()) / "god-flow-perm"
EXACT_ALLOW = {"ok", "可以", "go", "继续"}
SUBSTRING_ALLOW = "--allow"
SUBSTRING_BLOCK = "--block"


def deny(reason: str) -> None:
    """PreToolUse 拒绝：打印 deny 决定，宿主把 reason 回给 AI。"""
    output = {
        "hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "permissionDecision": "deny",
            "permissionDecisionReason": reason,
        }
    }
    print(json.dumps(output, ensure_ascii=False))
