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
    out, seen_titles = [], set()
    for r in sorted(data, key=lambda x: x.get("datetime", 0), reverse=True):
        h = (r.get("headline") or "").strip()
        low = h.lower()
        if not h or h in seen_titles:
            continue
        if not any(a in low for a in _ATTRIB):     # 必须归因到 Jensen / Nvidia CEO
            continue
        cross = _match_cross(h)
        if not cross:
            # 只收「点名其它关注标的」的真实背书（如 Jensen 力挺 Marvell）；
            #   纯 NVDA 新闻、或只是「关于他」的报道（被传唤 / 抵达某地）都不算他的言论，跳过。
            continue
        d = dt.date.fromtimestamp(r["datetime"]).isoformat() if r.get("datetime") else ""
        url_ = (r.get("url") or "").strip()
        base = {"personId": pid, "type": "statement",
                "asOf": d or to.isoformat(), "sentiment": "watch",
                "excerpt": h[:240], "postUrl": url_, "topics": []}
        seen_titles.add(h)
        for tk in cross:                            # 跨标的背书：每个关注标的一条
            out.append({**base, "ticker": tk})
        if len(out) >= limit:
            break
    return out


def _merge_archive(fresh, keep_days=180):
    """把本次抓到的真实言论与历史存档合并去重，再写回存档。

    背景：Finnhub 的 company-news 只回最近 ~1–2 天的新闻，名人背书（如「Jensen 称
    Marvell 将成下一个万亿公司」）很快从源头消失，导致信号「又没了」。这里把**真实抓到过**
    的头条（真实 URL / 日期）累积存档，后续即使源头删了也不丢。仍是无假数据——只存真抓到的，
    不编造；超过 keep_days 的按其真实日期自然淘汰。
    """
    from lib import read_json, write_json, MOCK, TODAY
    if MOCK:
        return fresh
    archive = read_json("statements_archive.json", []) or []
    merged = {}
    for s in archive + fresh:   # fresh 在后 → 同一条（URL+ticker）用最新抓取覆盖
        key = f"{s.get('postUrl') or (s.get('excerpt') or '')[:80]}|{s.get('ticker') or ''}"
        merged[key] = s
    cutoff = (TODAY - dt.timedelta(days=keep_days)).isoformat()
    rows = [s for s in merged.values() if (s.get("asOf") or "") >= cutoff]
    rows.sort(key=lambda s: s.get("asOf") or "", reverse=True)
    write_json("statements_archive.json", rows)
    return rows


def run():
    """返回 Jensen 的 statement 信号（含历史存档；无 key / 抓不到时回落为存档/空）。"""
    fresh = safe(fetch_jensen, "Jensen 言论（新闻归因）", lambda: [])
    return _merge_archive(fresh)


if __name__ == "__main__":
    from lib import write_json
    write_json("signals_statements.json", run())
