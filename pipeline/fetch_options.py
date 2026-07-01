"""期权链快照（Cboe 官方延迟行情，免费无 key）→ options.json。

「期权收租」页数据源：备兑看涨（Covered Call）/ 现金担保看跌（CSP）的真实报价。
  - 来源：https://cdn.cboe.com/api/global/delayed_quotes/options/{SYM}.json
    （Cboe 交易所自己算的希腊值 delta/IV，15 分钟延迟，比自己套 BS 公式更可信）
  - 按 DTE 三档取快照：7–14 / 14–30 / 30–45 天（收租常用窗口），每档取最接近
    档位中点的一个到期日，只留 bid>0（真能卖出去）且行权价在现价附近的合约。
无假数据原则：某标的抓不到 → 该标的缺席；全挂 → tickers 为空，前端显示空态。
"""
import re
import datetime as dt
from lib import http_get_json, safe, TODAY
from config import TICKERS

CBOE = "https://cdn.cboe.com/api/global/delayed_quotes/options/{sym}.json"

# 合约代码如 NVDA260710C00200000 → 标的 + YYMMDD + C/P + 行权价×1000（8 位）
_OSI = re.compile(r"^(.+?)(\d{6})([CP])(\d{8})$")

# DTE 三档：(key, 最小, 最大, 中点)——每档挑最接近中点的到期日
BUCKETS = [("7-14", 7, 14, 10.5), ("14-30", 15, 30, 22.0), ("30-45", 31, 45, 38.0)]


def _parse_osi(code):
    m = _OSI.match(code or "")
    if not m:
        return None
    yymmdd, cp, k = m.group(2), m.group(3), int(m.group(4)) / 1000.0
    try:
        exp = dt.date(2000 + int(yymmdd[:2]), int(yymmdd[2:4]), int(yymmdd[4:6]))
    except ValueError:
        return None
    return exp, cp, k


def _row(o, strike):
    bid, ask = float(o.get("bid") or 0), float(o.get("ask") or 0)
    return {
        "k": strike, "bid": round(bid, 2), "ask": round(ask, 2),
        "mid": round((bid + ask) / 2, 2),
        "delta": round(float(o.get("delta") or 0), 3),
        "iv": round(float(o.get("iv") or 0), 4),
        "oi": int(o.get("open_interest") or 0),
        "vol": int(o.get("volume") or 0),
    }


def fetch_chain(sym):
    """一个标的的期权快照：现价 + 三档 DTE，各含 OTM 附近的 calls/puts 真实报价。"""
    data = http_get_json(CBOE.format(sym=sym), headers={"User-Agent": "Mozilla/5.0"})
    d = data.get("data") or {}
    spot = float(d.get("current_price") or 0)
    if not spot or not d.get("options"):
        raise RuntimeError(f"{sym}: Cboe 无现价/合约")

    # 按到期日归堆（只留 5–50 天内、行权价在现价 ±35% 内、bid>0 的合约）
    by_exp = {}
    for o in d["options"]:
        parsed = _parse_osi(o.get("option"))
        if not parsed:
            continue
        exp, cp, k = parsed
        dte = (exp - TODAY).days
        if not (5 <= dte <= 50) or not (spot * 0.65 <= k <= spot * 1.35):
            continue
        # 收租视角的可交易性：bid ≥ $0.05（不然卖不出像样的价）且 |Δ| ≥ 0.02
        #   （彩票级深虚值合约点差离谱，年化数字好看但成交不了，反而误导初学者）
        if float(o.get("bid") or 0) < 0.05 or abs(float(o.get("delta") or 0)) < 0.02:
            continue
        by_exp.setdefault(exp, {"C": [], "P": []})[cp].append(_row(o, k))

    buckets = []
    for key, lo, hi, mid in BUCKETS:
        cands = [e for e in by_exp if lo <= (e - TODAY).days <= hi]
        if not cands:
            continue
        exp = min(cands, key=lambda e: abs((e - TODAY).days - mid))
        # 备兑看涨卖 OTM call（行权价 ≥ 现价附近）；担保看跌卖 OTM put（≤ 现价附近）
        calls = sorted([r for r in by_exp[exp]["C"] if r["k"] >= spot * 0.98], key=lambda r: r["k"])
        puts = sorted([r for r in by_exp[exp]["P"] if r["k"] <= spot * 1.02], key=lambda r: -r["k"])
        if not calls and not puts:
            continue
        buckets.append({"key": key, "expiry": exp.isoformat(), "dte": (exp - TODAY).days,
                        "calls": calls[:24], "puts": puts[:24]})
    if not buckets:
        raise RuntimeError(f"{sym}: 无符合窗口的合约")
    return {"spot": round(spot, 2), "quoteTime": data.get("timestamp") or "", "buckets": buckets}


def run():
    """返回 options.json 负载。逐标的抓取，失败的标的缺席（不编造）。"""
    tickers = {}
    for t in TICKERS:
        chain = safe(lambda t=t: fetch_chain(t), f"期权链 {t}", None)
        if chain:
            tickers[t] = chain
    return {
        "asOf": TODAY.isoformat(),
        "source": "Cboe 官方延迟行情（15 分钟），希腊值由交易所计算",
        "tickers": tickers,
    }


if __name__ == "__main__":
    from lib import write_json
    write_json("options.json", run())
