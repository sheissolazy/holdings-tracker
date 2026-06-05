"""黄仁勋 Jensen Huang → statement 信号（经真实新闻归因）。

Jensen 不发交易帖、也没有个人社媒账号；他对市场的影响是通过【新闻报道】
传导的——例如"Nvidia CEO 称 Marvell 将成为下一个万亿美元公司"。

本模块从 Finnhub 真实公司新闻里，挑出【明确归因到 Jensen / Nvidia CEO】
且命中关注 ticker 的头条，产 statement 信号：
  - excerpt = 真实新闻头条（原文链接为证）
  - sentiment 一律 'watch'（不替他下多空结论，只标「关注」）
只用字面命中的真实头条，绝不编造他的观点（无假数据原则）。
抓不到 / 无 key → 返回空。
"""
import os
import re
import datetime as dt
from lib import http_get_json, safe
from config import TICKERS

FINNHUB_KEY = os.environ.get("FINNHUB_API_KEY")

# 归因关键词：头条须提到 Jensen 本人 / Nvidia CEO，才算「他的言论 / 背书」
_ATTRIB = ["jensen", "huang", "nvidia ceo", "nvidia's ceo", "nvidia chief"]

# 关注 ticker 在头条里的别名（词边界命中即绑定）。
#   NVDA 单列：Jensen 谈自家公司不算「跨标的背书」，仅在没有其它关注标的时
#   作为一般言论（ticker=''）收录，避免和 NVDA 自身新闻重复刷屏。
_CROSS_ALIASES = {
    "MRVL": ["marvell"], "AAPL": ["apple"], "BE": ["bloom energy"],
    "SMH": ["semiconductor etf"],
}
_NVDA_ALIASES = ["nvidia"]
_CASHTAG = re.compile(r"\$([A-Za-z]{1,5})\b")


def _match_cross(headline):
    """头条里命中的关注 ticker（NVDA 除外），命中即绑定。"""
    low = headline.lower()
    out = []
    for m in _CASHTAG.findall(headline):
        u = m.upper()
        if u in TICKERS and u != "NVDA":
            out.append(u)
    for tk, names in _CROSS_ALIASES.items():
        if tk in TICKERS and any(re.search(rf"\b{re.escape(n)}\b", low) for n in names):
            out.append(tk)
    seen, res = set(), []
    for t in out:
        if t not in seen:
            seen.add(t)
            res.append(t)
    return res


def fetch_jensen(pid="jensen", days=30, limit=8):
    if not FINNHUB_KEY:
        raise RuntimeError("缺 FINNHUB_API_KEY")
    to = dt.date.today()
    frm = to - dt.timedelta(days=days)
    # Jensen 相关报道几乎都挂在 NVDA 公司新闻下，用它作主来源。
    url = (f"https://finnhub.io/api/v1/company-news?symbol=NVDA"
           f"&from={frm.isoformat()}&to={to.isoformat()}&token={FINNHUB_KEY}")
    data = http_get_json(url)
    out, seen_titles, n_general = [], set(), 0
    for r in sorted(data, key=lambda x: x.get("datetime", 0), reverse=True):
        h = (r.get("headline") or "").strip()
        low = h.lower()
        if not h or h in seen_titles:
            continue
        if not any(a in low for a in _ATTRIB):     # 必须归因到 Jensen / Nvidia CEO
            continue
        d = dt.date.fromtimestamp(r["datetime"]).isoformat() if r.get("datetime") else ""
        url_ = (r.get("url") or "").strip()
        cross = _match_cross(h)
        base = {"personId": pid, "type": "statement",
                "asOf": d or to.isoformat(), "sentiment": "watch",
                "excerpt": h[:240], "postUrl": url_, "topics": []}
        if cross:
            seen_titles.add(h)
            for tk in cross:                        # 跨标的背书：每个关注标的一条
                out.append({**base, "ticker": tk})
        elif any(a in low for a in _NVDA_ALIASES) and n_general < 2:
            # 没提别的关注标的、只谈 NVIDIA → 作一般言论收录（限量，避免刷屏）
            seen_titles.add(h)
            out.append({**base, "ticker": ""})
            n_general += 1
        if len(out) >= limit:
            break
    return out


def run():
    """返回 Jensen 的 statement 信号（无 key / 抓不到 → 空）。"""
    return safe(fetch_jensen, "Jensen 言论（新闻归因）", lambda: [])


if __name__ == "__main__":
    from lib import write_json
    write_json("signals_statements.json", run())
