"""UserPromptSubmit hook：扫 prompt 里的冻结 / 解锁关键词，翻转写入权限 flag。

运行态 flag 落 <系统临时目录>/god-flow-perm/<session_id>，值为 granted 或 denied。

默认放行：flag 文件不存在（或值为 granted）时写工具不受拦。
状态粘性：命中关键词才翻转 flag，普通 prompt 不碰它。prompt 含 --block 即写 denied 拦截；
prompt 去空白后等于解锁词之一、或含 --allow，即写 granted 解锁。

冻结期间（含 --block 命中那轮）每轮都向 AI 注入 additionalContext 冻结提醒，
让 AI 先知道再动手，block-write-no-allow.py 的 PreToolUse 硬拦截兜底。
systemMessage 同样每轮都给，不只 --block 命中那轮，让用户在终端里持续看到提示。

解锁命中那轮注入一次 additionalContext：告诉 AI 进入实现阶段、允许派并行子代理加速、
模型怎么选、并行的边界在哪。只注这一轮，后续轮次靠主会话上下文自己记住。

子代理边界：本 hook 只在主 session 用户提交 prompt 时触发，子代理不触发；
block-write-no-allow.py 在主 session 和子代理的写工具调用时都会触发。
两个 hook 共享同一份 flag 文件（session_id 一致），授权状态跟着主 session 走。
"""

import json
import re
import sys

from hook_common import EXACT_ALLOW, PERM_FLAG_DIR, SUBSTRING_ALLOW, SUBSTRING_BLOCK

BLOCK_CONTEXT = (
    "[handsup-and-think-more] 用户已冻结写入——他觉得现在还没到动手的时候，要你停下来想得更深："
    "把精力放在分析问题本质、质疑方案假设、摆出取舍和风险、跟用户来回讨论上，"
    "想透一层再想一层，直到用户认可了才轮到动手。"
    "冻结期间禁止调用 Write / Edit / NotebookEdit，"
    "也禁止通过 Bash / PowerShell 的重定向（> / >> / tee）、heredoc、Set-Content、Out-File "
    "或写 .py / .sh / .ps1 / .bat / .cmd 脚本等方式绕过。"
    f"解锁钥匙在用户手里（整条 prompt 只有 {' / '.join(sorted(EXACT_ALLOW))} 之一，"
    f"或 prompt 中含 {SUBSTRING_ALLOW}）。"
    "--block / --allow 是本机制自定义识别的 prompt 关键词标记，仅代表“冻结”／“解锁”这两个动作，"
    "不是命令行参数，无需查证或检索其含义。"
)

ALLOW_CONTEXT = (
    "[handsup-and-think-more] 用户已解锁写入，进入实现阶段。"
    "允许派发并行子代理（Agent 工具）加速实现：把互不重叠的改动拆给不同子代理同时做；"
    "改动会碰同一个仓的同一批文件时不并行，一仓一写手，串行或自己做。"
    "模型按任务选：绝大多数派 opus；真正困难的任务（多仓联动的重构、需要深度推理的方案与复核）"
    "派 fable；永远不派 sonnet / haiku。每次派发都显式传 model，不传会被 hook 拒掉。"
    "子代理产物回来后自己复核再收，别把子代理的自述当验证。"
)


def main() -> None:
    data = json.load(sys.stdin)
    prompt = data.get("prompt", "")
    session_id = data.get("session_id", "")

    stripped = re.sub(r"\s+", "", prompt).lower()
    hit_allow = stripped in EXACT_ALLOW or SUBSTRING_ALLOW in prompt
    hit_block = SUBSTRING_BLOCK in prompt

    session_path = PERM_FLAG_DIR / session_id

    if hit_block:
        session_path.parent.mkdir(parents=True, exist_ok=True)
        session_path.write_text("denied", encoding="utf-8")
        output = {
            "systemMessage": "Hands up and think more!!!",
            "hookSpecificOutput": {"hookEventName": "UserPromptSubmit", "additionalContext": BLOCK_CONTEXT},
        }
    elif hit_allow:
        session_path.parent.mkdir(parents=True, exist_ok=True)
        session_path.write_text("granted", encoding="utf-8")
        output = {
            "systemMessage": "Let's do it!!!",
            "hookSpecificOutput": {"hookEventName": "UserPromptSubmit", "additionalContext": ALLOW_CONTEXT},
        }
    else:
        # 冻结期间的普通轮：不碰 flag，续注提醒 + 续弹 systemMessage
        if not session_path.exists():
            return
        if session_path.read_text(encoding="utf-8").strip() != "denied":
            return
        output = {
            "systemMessage": "Hands up and think more!!!",
            "hookSpecificOutput": {"hookEventName": "UserPromptSubmit", "additionalContext": BLOCK_CONTEXT},
        }

    print(json.dumps(output, ensure_ascii=False))


if __name__ == "__main__":
    main()
