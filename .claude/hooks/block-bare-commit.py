"""PreToolUse hook：拦不带 --only 的 git commit。

裸 `git commit` 会把并行会话 stage 的改动一起搭车带走（实测事故：本想提 4 个
文件、实际提了 5 个）。用户在自己终端里的 commit 不受影响——本 hook 只对
Claude Code 的 Bash / PowerShell 工具调用生效。本仓常开。
"""

import json
import shlex
import sys

from hook_common import deny


def main() -> None:
    data = json.load(sys.stdin)
    if data.get("tool_name") not in {"Bash", "PowerShell"}:
        return

    cmd = data.get("tool_input", {}).get("command", "")
    if not cmd:
        return

    tokens = shlex.split(cmd, posix=True)

    # 真的 git commit 是相邻两个 token；echo/cat 里作字面量的 "git commit" 会挤在同一个 token 里
    is_git_commit = any(tokens[i] == "git" and tokens[i + 1] == "commit" for i in range(len(tokens) - 1))
    if not is_git_commit:
        return

    if "--only" in tokens:
        return

    deny(
        "[commit 范围隔离 hook]\n\n"
        "裸 git commit 会把 staged 区所有改动一起搭车——"
        "另一个并行会话 stage 的改动会被这次 commit 误包进来"
        "（已观察到事故）。\n\n"
        "必须用 git commit --only <paths...> 显式锁路径：\n\n"
        "1. 列本会话 Edit / Write / MultiEdit 改过的所有路径\n"
        "2. 被删除的文件也要进 --only——git status 里 staged 的 deleted 文件"
        "必须一并列入路径清单、不能只带增改文件不带删除\n"
        "3. 新建的未跟踪文件 --only 认不了（pathspec 报错）——"
        "先 git add <paths...> 显式列这些新文件再 commit --only，"
        "add 不准扫全局、只加自己本次新建的\n"
        '4. 改写成 git commit --only <paths...> -m "..." 重新发起\n\n'
        "提交成功即收工——别再 git show / git log 核对范围，省 token、改错也认\n"
    )


if __name__ == "__main__":
    main()
