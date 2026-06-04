"""AI 分析 → 每个关注 ticker 的 thesis（看多/看空/关注 + 分段长文 + 可比公司）。

两条真实生成路径（构建时调用，二选一）：
  1. Anthropic Claude API —— 需 ANTHROPIC_API_KEY，按 token 计费（优先级最高）。
  2. Claude Code CLI（headless）—— 需 CLAUDE_CODE_OAUTH_TOKEN，走个人订阅额度、无按量计费。
     CI 里 `npm i -g @anthropic-ai/claude-code` 后用 `claude -p ... --output-format json`。
两者都没有（或生成失败）→ 返回「分析暂不可用」空占位，绝不编造分析（无假数据原则）。
标注：AI 基于公开数据生成，非投资建议 + 模型版本 + 生成时间。
"""
import json
import os
import subprocess
import datetime as dt
from lib import safe, MOCK

API_KEY = os.environ.get("ANTHROPIC_API_KEY")          # 路径1：按量计费 API
OAUTH = os.environ.get("CLAUDE_CODE_OAUTH_TOKEN")      # 路径2：订阅额度（Claude Code CLI）
MODEL = "claude-sonnet-4-5"


def active():
    """是否有可用的真实 AI 生成路径（API 或订阅）。"""
    return bool(API_KEY or OAUTH)

PROMPT = """你是严谨的股票研究助理。基于以下公开信息，为 {ticker}（{name}）生成投资分析。
只输出一个 JSON 对象，结构：
{{"bull":[3条],"bear":[3条],"watch":[3条],
  "sections":[{{"heading":"公司概览","body":"..."}}, ...6段],
  "comparables":[{{"ticker":"...","name":"...","note":"..."}}]}}
要求：中文；客观、点出多空分歧；不得给出买卖指令。

严格输出规则（务必遵守，否则解析失败）：
- 直接输出 JSON，不要 markdown 代码块、不要任何解释或前后缀文字。
- 必须是严格合法 JSON：所有键值用英文双引号；字符串内部不要出现英文双引号 "（如需引用用中文引号「」）；不要使用尾随逗号。
- 字符串内不要使用反斜杠转义或换行。

== 跟踪者动向 ==
{signals}

== 近期新闻 ==
{news}
"""


def generate(ticker, name, signals, news):
    import anthropic  # 仅真实调用时需要
    client = anthropic.Anthropic(api_key=API_KEY)
    msg = client.messages.create(
        model=MODEL, max_tokens=2000,
        messages=[{"role": "user", "content": PROMPT.format(
            ticker=ticker, name=name,
            signals=json.dumps(signals, ensure_ascii=False),
            news=json.dumps([n["title"] for n in news], ensure_ascii=False))}],
    )
    text = msg.content[0].text
    text = text[text.find("{"): text.rfind("}") + 1]
    data = json.loads(text)
    data["model"] = MODEL
    data["generatedAt"] = dt.datetime.utcnow().isoformat() + "Z"
    return data


def generate_cli(ticker, name, signals, news):
    """路径2：用 Claude Code CLI（headless）生成，走订阅额度、不按量计费。
    依赖运行环境装好 `claude` 且 env 有 CLAUDE_CODE_OAUTH_TOKEN。
    `--output-format json` 返回一个对象，其 result 字段是模型纯文本回复。"""
    prompt = PROMPT.format(
        ticker=ticker, name=name,
        signals=json.dumps(signals, ensure_ascii=False),
        news=json.dumps([n["title"] for n in news], ensure_ascii=False))
    proc = subprocess.run(
        ["claude", "-p", prompt, "--output-format", "json"],
        capture_output=True, text=True, timeout=240)
    if proc.returncode != 0:
        raise RuntimeError(f"claude CLI rc={proc.returncode}: {proc.stderr[-300:]}")
    out = json.loads(proc.stdout)
    if out.get("is_error"):
        raise RuntimeError(f"claude CLI is_error: {str(out.get('result'))[:200]}")
    text = out.get("result", "")
    text = text[text.find("{"): text.rfind("}") + 1]
    data = json.loads(text)
    data["model"] = "claude-code（订阅）"
    data["generatedAt"] = dt.datetime.utcnow().isoformat() + "Z"
    return data


# ---- 缺 key / 生成失败时的「分析暂不可用」空占位（不编造任何分析内容） ----
def unavailable_thesis(ticker):
    return {"bull": [], "bear": [], "watch": [], "sections": [], "comparables": [],
            "model": "（分析暂不可用）", "generatedAt": None,
            "unavailable": True}


def run(ticker, name, signals, news):
    if MOCK:
        return unavailable_thesis(ticker)
    if API_KEY:                                   # 优先用按量计费 API（若配置）
        return safe(lambda: generate(ticker, name, signals, news),
                    f"AI thesis {ticker} (API)", lambda: unavailable_thesis(ticker))
    if OAUTH:                                      # 否则用订阅额度（Claude Code CLI）
        return safe(lambda: generate_cli(ticker, name, signals, news),
                    f"AI thesis {ticker} (订阅)", lambda: unavailable_thesis(ticker))
    return unavailable_thesis(ticker)
