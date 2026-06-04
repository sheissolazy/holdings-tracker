"""IPO 日历 → ipos.json + events.json（IPO 定价进事件）。

源：Finnhub IPO calendar（免费 tier，需 FINNHUB_API_KEY）或 Nasdaq IPO 日历。
定位：列出可关注的 IPO（即将上市 / 定价区间 / 行业），不做实际申购对接。
"""
import os
from lib import http_get_json, safe, write_json

FINNHUB_KEY = os.environ.get("FINNHUB_API_KEY")


def fetch():
    if not FINNHUB_KEY:
        raise RuntimeError("缺 FINNHUB_API_KEY")
    # https://finnhub.io/api/v1/calendar/ipo?from=..&to=..&token=..
    from datetime import date, timedelta
    a = date.today().isoformat()
    b = (date.today() + timedelta(days=30)).isoformat()
    data = http_get_json(
        f"https://finnhub.io/api/v1/calendar/ipo?from={a}&to={b}&token={FINNHUB_KEY}")
    out = []
    for r in data.get("ipoCalendar", []):
        if not r.get("symbol"):
            continue
        lo = float(r.get("price", "0").split("-")[0] or 0) if r.get("price") else 0
        hi = float(r.get("price", "0").split("-")[-1] or 0) if r.get("price") else 0
        out.append({"ticker": r["symbol"], "name": r.get("name", r["symbol"]),
                    "date": r.get("date", ""), "priceRange": [lo, hi],
                    "sector": "—", "exchange": r.get("exchange", "—")})
    return out


def run():
    # 无密钥 / 抓不到 → 返回空，不编造 IPO（无假数据原则）
    return safe(fetch, "Finnhub IPO calendar", lambda: [])


if __name__ == "__main__":
    write_json("ipos.json", run())
