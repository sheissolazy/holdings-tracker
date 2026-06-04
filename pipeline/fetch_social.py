"""社交喊单 → social 信号（Trump / Musk / Serenity）+ 公开言论（黄仁勋 statement）。

「第三条路」：非付费 API、非手动。
  - Trump  → Truth Social（Mastodon 兼容）公开帖，免登录：
             truthsocial.com/api/v1/accounts/{id}/statuses（开源 truthbrush 封装）
  - Musk / Serenity → 自托管 RSSHub 喂入【你自己的 X 登录 cookie】(X_AUTH_TOKEN / X_CT0)
             拉 timeline（不是 $100/月 API；脆弱、有账号风险，但零成本）
  - 黄仁勋 → 不发交易帖，公开讲话走新闻管道；signalType=statement
分类层：抓到的帖子在构建时过一遍 Claude → 抽取 ticker + 看多/看空，只留与股票相关的。
（分类调用见 gen_ai.classify_posts；此处先产出原始/兜底信号结构。）
"""
import os
from lib import safe, write_json

X_AUTH = os.environ.get("X_AUTH_TOKEN")
X_CT0 = os.environ.get("X_CT0")


def fetch_trump():
    # truthbrush / Truth Social Mastodon API。需把 handle→account_id 解析后拉 statuses。
    # 真实实现略（依赖 truthbrush）；缺依赖时回落 mock。
    raise NotImplementedError("truthsocial 抓取需 truthbrush，回落 mock")


def fetch_x(handle):
    if not (X_AUTH and X_CT0):
        raise RuntimeError("缺 X_AUTH_TOKEN / X_CT0，无法拉 X timeline")
    raise NotImplementedError("RSSHub + 自有 cookie 抓取，回落 mock")


def mock():
    return [
        {"personId": "jensen", "type": "statement", "ticker": "MRVL", "asOf": "2026-05-28",
         "sentiment": "bull", "excerpt": "在 GTC 上点名 Marvell 的定制 AI 互连方案是「关键合作伙伴」。",
         "postUrl": "https://example.com/news/jensen-mrvl"},
        {"personId": "trump", "type": "social", "ticker": "NVDA", "asOf": "2026-05-30",
         "sentiment": "bull", "excerpt": "AMERICAN CHIPS ARE THE BEST IN THE WORLD!",
         "postUrl": "https://truthsocial.com/@realDonaldTrump/123"},
        {"personId": "musk", "type": "social", "ticker": "TSLA", "asOf": "2026-05-31",
         "sentiment": "bull", "excerpt": "Robotaxi network scaling faster than expected.",
         "postUrl": "https://x.com/elonmusk/456"},
        {"personId": "serenity", "type": "social", "ticker": "MRVL", "asOf": "2026-05-29",
         "sentiment": "bull", "excerpt": "MRVL custom silicon ramp is underappreciated. Watching $90.",
         "postUrl": "https://x.com/serenity/789"},
    ]


def run():
    # 社交/言论抓取暂未接入真实源（truthbrush / X cookie）→ 一律空，不编造（无假数据原则）
    sigs = []
    sigs += safe(fetch_trump, "Truth Social (Trump)", lambda: [])
    for pid, handle in (("musk", "elonmusk"), ("serenity", "serenity")):
        sigs += safe(lambda h=handle: fetch_x(h), f"X timeline ({pid})", lambda: [])
    return sigs


if __name__ == "__main__":
    write_json("signals_social.json", run())
