"""IPO 日历 → ipos.json + events.json（IPO 定价进事件）。

源：① Finnhub IPO calendar（免费 tier，需 FINNHUB_API_KEY）
    ② ipo_curated.CURATED —— 人工补录免费日历漏掉的大型/保密申报标的（如 SpaceX），均带 source。
合并：自动源为主，人工补录仅在自动源缺失该 ticker 时加入，且定价日已过自动剔除。
定位：列出可关注 / 可申购的 IPO（即将上市 / 定价区间 / 行业），不做实际申购对接。
"""
import os
from datetime import date, timedelta
from lib import http_get_json, safe, write_json
from ipo_curated import CURATED

FINNHUB_KEY = os.environ.get("FINNHUB_API_KEY")


def fetch():
    if not FINNHUB_KEY:
        raise RuntimeError("缺 FINNHUB_API_KEY")
    # https://finnhub.io/api/v1/calendar/ipo?from=..&to=..&token=..
    a = date.today().isoformat()
    b = (date.today() + timedelta(days=30)).isoformat()
    data = http_get_json(
        f"https://finnhub.io/api/v1/calendar/ipo?from={a}&to={b}&token={FINNHUB_KEY}")
    out = []
    for r in data.get("ipoCalendar", []):
        if not r.get("symbol"):
            continue
        status = (r.get("status") or "").lower()
        if status == "withdrawn":          # 已撤回 → 无法申购，跳过
            continue
        lo = float(r.get("price", "0").split("-")[0] or 0) if r.get("price") else 0
        hi = float(r.get("price", "0").split("-")[-1] or 0) if r.get("price") else 0
        out.append({"ticker": r["symbol"], "name": r.get("name", r["symbol"]),
                    "date": r.get("date", ""), "priceRange": [lo, hi],
                    "sector": "—", "exchange": r.get("exchange", "—"),
                    # status: expected（待定价，可申购）/ priced（已定价）/ filed（已申报）
                    "status": status or "expected"})
    return out


def _merge_curated(auto):
    """把人工补录（CURATED）并入自动源：仅当自动源缺该 ticker 时加入，
    且定价日已过 / 已撤回则剔除。这样 SpaceX 这类标的能在「现在可申购」出现。"""
    today = date.today().isoformat()
    have = {(r.get("ticker") or "").upper() for r in auto}
    have_names = {(r.get("name") or "").lower() for r in auto}
    merged = list(auto)
    for c in CURATED:
        tk = (c.get("ticker") or "").upper()
        if c.get("status") == "withdrawn":
            continue
        if c.get("date") and c["date"] < today:       # 定价日已过 → 不再可申购
            continue
        if tk in have or (c.get("name") or "").lower() in have_names:
            continue                                    # 自动源已覆盖，避免重复
        merged.append(c)
    return merged


def run():
    # 无密钥 / 抓不到 → 自动源为空，但仍并入人工补录（无假数据：均带 source）
    auto = safe(fetch, "Finnhub IPO calendar", lambda: [])
    return _merge_curated(auto)


if __name__ == "__main__":
    write_json("ipos.json", run())
