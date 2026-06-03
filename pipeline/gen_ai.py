"""AI 分析 → 每个关注 ticker 的 thesis（看多/看空/关注 + 分段长文 + 可比公司）。

两条真实生成路径（构建时调用，二选一）：
  1. Anthropic Claude API —— 需 ANTHROPIC_API_KEY，按 token 计费（优先级最高）。
  2. Claude Code CLI（headless）—— 需 CLAUDE_CODE_OAUTH_TOKEN，走个人订阅额度、无按量计费。
     CI 里 `npm i -g @anthropic-ai/claude-code` 后用 `claude -p ... --output-format json`。
两者都没有 → 回落 mock_thesis（与前端占位一致）。
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


# ---- 兜底 thesis（与前端 mock 一致，缺 key 时用） ----
_MOCK = {
    "NVDA": {"bull": ["数据中心 GPU 仍供不应求", "CUDA 生态护城河深", "主权 AI 与推理需求接力训练需求"],
             "bear": ["估值已计入高增长预期", "定制 ASIC 分流份额", "大资金建立大额 put 对冲"],
             "watch": ["下季度数据中心毛利率", "出口管制变化", "大客户自研芯片进度"]},
    "MRVL": {"bull": ["定制 AI 互连/ASIC 受益", "黄仁勋公开背书", "光通信 DSP 份额领先"],
             "bear": ["客户集中度高", "二阶受益者", "周期性强"],
             "watch": ["定制硅片订单节奏", "数据中心营收占比", "与 NVDA 竞合"]},
    "BE": {"bull": ["AI 数据中心非电网供电", "Leopold 最大多头背书", "订单加速"],
           "bear": ["尚未稳定盈利", "政策补贴依赖", "估值波动大"],
           "watch": ["毛利率转正", "订单兑现", "现金消耗"]},
    "AAPL": {"bull": ["服务高毛利增长", "生态粘性", "资本回报稳定"],
             "bear": ["硬件增长乏力", "AI 叙事落后", "中国承压"],
             "watch": ["Apple Intelligence 落地", "大中华区营收", "服务增速"]},
    "SMH": {"bull": ["半导体板块 beta", "AI 资本开支主线", "成分股龙头集中"],
            "bear": ["周期性强", "对 NVDA 高度敏感", "估值偏高"],
            "watch": ["费城半导体指数趋势", "出口管制", "存储/设备景气"]},
}


def mock_thesis(ticker):
    base = _MOCK.get(ticker, {"bull": [], "bear": [], "watch": []})
    return {**base, "sections": [], "comparables": [],
            "model": "claude-mock", "generatedAt": "2026-06-01T20:00:00Z"}


def run(ticker, name, signals, news):
    if MOCK:
        return mock_thesis(ticker)
    if API_KEY:                                   # 优先用按量计费 API（若配置）
        return safe(lambda: generate(ticker, name, signals, news),
                    f"AI thesis {ticker} (API)", lambda: mock_thesis(ticker))
    if OAUTH:                                      # 否则用订阅额度（Claude Code CLI）
        return safe(lambda: generate_cli(ticker, name, signals, news),
                    f"AI thesis {ticker} (订阅)", lambda: mock_thesis(ticker))
    return mock_thesis(ticker)
