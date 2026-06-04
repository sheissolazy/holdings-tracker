"""基本面 → 每个关注 ticker 的市值 / PE / 营收（真实）。

源：Finnhub（免费 tier，需 FINNHUB_API_KEY）：
  - /stock/profile2 → marketCapitalization（单位：百万美元）
  - /stock/metric?metric=all → peTTM、revenuePerShareTTM 等
无密钥 / 抓不到 → 字段为 None / "—"，前端显示「—」（无假数据原则）。
"""
import os
from lib import http_get_json, safe
from config import TICKERS

FINNHUB_KEY = os.environ.get("FINNHUB_API_KEY")


def _fmt_cap(m_usd_millions):
    if not m_usd_millions:
        return "—"
    v = m_usd_millions * 1e6
    if v >= 1e12:
        return f"${v / 1e12:.2f}T"
    if v >= 1e9:
        return f"${v / 1e9:.1f}B"
    return f"${v / 1e6:.0f}M"


def fetch(ticker):
    if not FINNHUB_KEY:
        raise RuntimeError("缺 FINNHUB_API_KEY")
    prof = http_get_json(
        f"https://finnhub.io/api/v1/stock/profile2?symbol={ticker}&token={FINNHUB_KEY}")
    met = http_get_json(
        f"https://finnhub.io/api/v1/stock/metric?symbol={ticker}&metric=all&token={FINNHUB_KEY}")
    m = met.get("metric") or {}
    cap = prof.get("marketCapitalization")
    pe = m.get("peTTM")
    growth = m.get("revenueGrowthTTMYoy")
    return {
        "marketCap": _fmt_cap(cap),
        "pe": round(pe, 1) if isinstance(pe, (int, float)) else None,
        "revenue": "—",  # Finnhub 免费档无直接营收总额，留空不编造
        "revenueYoYPct": round(growth) if isinstance(growth, (int, float)) else None,
    }


def run():
    out = {}
    for t in TICKERS:
        out[t] = safe(lambda t=t: fetch(t), f"fundamentals {t}",
                      lambda: {"marketCap": "—", "pe": None, "revenue": "—", "revenueYoYPct": None})
    return out


if __name__ == "__main__":
    import json
    print(json.dumps(run(), ensure_ascii=False, indent=2))
