"""PreToolUse hook：每次派子代理（Task / Agent）都必须显式给 model。

拦两类派活：一是「没显式传 model」——AI 想默默继承主会话模型时 deny，逼它做一次显式选择；
二是 model 落在 sonnet / haiku 这类低档模型——CLAUDE.md 约定永远不派它们，文字约束靠不住，
这里机械拦。opus 与 fable 之间怎么选归 CLAUDE.md（绝大多数 opus、真正困难的派 fable），机械层不判。
插件自带 agent（subagent_type 形如「插件名:agent名」、带冒号）放行——模型归其定义
frontmatter 管、hook 读不到定义文件，不拦。
"""

import json
import sys

from hook_common import deny

# CC 版本不同派子代理的工具名不同：旧名 Task、新名 Agent
GATED_TOOLS = {"Task", "Agent"}


def main() -> None:
    data = json.load(sys.stdin)

    if data.get("tool_name") not in GATED_TOOLS:
        return

    tool_input = data.get("tool_input", {})

    subagent_type = tool_input.get("subagent_type")
    if isinstance(subagent_type, str) and ":" in subagent_type:
        return

    model = tool_input.get("model")
    if isinstance(model, str) and model.strip():
        if _is_banned(model):
            deny(
                "[子代理模型 hook]\n\n"
                f"这次派子代理传了 model: {model.strip()}，按约定永远不派 sonnet / haiku。\n"
                '绝大多数情况带 model: "opus"，真正困难的任务（多仓联动重构、需要深度推理的方案与复核）\n'
                '带 model: "fable"，然后重新发起这次调用。\n'
            )
        return

    deny(
        "[子代理模型 hook]\n\n"
        "这次派子代理的调用没带 model 参数，会默默继承主会话模型。\n"
        "按约定，派子代理必须显式选择模型：\n\n"
        '1. 绝大多数情况带 model: "opus"\n'
        '2. 真正困难的任务（多仓联动重构、需要深度推理的方案与复核）带 model: "fable"\n'
        "3. 永远不带 sonnet / haiku\n"
        "4. 补上 model 参数重新发起这次调用\n"
    )


def _is_banned(model: str) -> bool:
    """别名（sonnet / haiku）与完整 ID（claude-sonnet-5、claude-haiku-4-5-…）都算。"""
    m = model.strip().lower()
    return "sonnet" in m or "haiku" in m


if __name__ == "__main__":
    main()
