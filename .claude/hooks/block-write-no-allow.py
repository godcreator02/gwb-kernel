"""PreToolUse hook：用户冻结写入期间拦掉 Write / Edit / NotebookEdit。

运行态 flag 落 <系统临时目录>/god-flow-perm/<session_id>，由 check-allow.py 写。
默认放行：flag 文件不存在或值非 denied 时不拦。用户 prompt 里带 --block 后
（check-allow.py 写入 denied）才开始拦，直到用户解锁。

子代理边界：check-allow.py（UserPromptSubmit）只在主 session 触发，子代理不触发；
本 hook（PreToolUse）在主 session 和子代理的写工具调用时都会触发。
两个 hook 共享同一份 flag 文件（session_id 一致），授权状态跟着主 session 走。
"""

import json
import sys

from hook_common import EXACT_ALLOW, PERM_FLAG_DIR, SUBSTRING_ALLOW, deny

GATED_TOOLS = {"Write", "Edit", "NotebookEdit"}


def main() -> None:
    data = json.load(sys.stdin)

    if data.get("tool_name", "") not in GATED_TOOLS:
        return

    session_path = PERM_FLAG_DIR / data.get("session_id", "")
    if not session_path.exists():
        return
    if session_path.read_text(encoding="utf-8").strip() != "denied":
        return

    exact_kw = " / ".join(sorted(EXACT_ALLOW))
    deny(
        "[写入冻结中]\n\n"
        "用户已用 --block 冻结写入——他觉得现在还没到动手的时候，要你停下来想得更深。\n"
        "把这次想落盘的改动先放下，回到讨论：分析问题本质、质疑方案假设、"
        "摆出取舍和风险，跟用户对齐了才轮到动手。\n\n"
        "冻结期间禁止调用 Write / Edit / NotebookEdit。\n"
        "也禁止通过 Bash / PowerShell 的重定向（> / >> / tee）、"
        "heredoc、Set-Content、Out-File 等方式绕过写入工具。\n"
        "禁止通过写 .py / .sh / .ps1 / .bat / .cmd 脚本文件来绕过写入冻结。\n\n"
        "解锁由用户在后续 prompt 中输入以下任意一种：\n"
        f"  精确匹配（整个 prompt 只有这几个字）：{exact_kw}\n"
        f"  子串匹配（prompt 中包含即可）：{SUBSTRING_ALLOW}\n\n"
        "--block / --allow 是本机制自定义的 prompt 关键词，不是命令行参数，无需自行查证。"
    )


if __name__ == "__main__":
    main()
