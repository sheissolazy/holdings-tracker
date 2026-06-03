"""Congress 交易 → ptr 信号（Pelosi）。

源：house-stock-watcher 开源数据集（已解析好的 JSON，免费无密钥）。
  https://house-stock-watcher-data.s3-us-west-2.amazonaws.com/data/all_transactions.json
字段：representative, ticker, type(purchase/sale), amount(区间), transaction_date, disclosure_date
延迟：法规允许成交后最多 ~45 天披露。
"""
from lib import http_get_json, safe, write_json, days_between

HOUSE_URL = ("https://house-stock-watcher-data.s3-us-west-2.amazonaws.com"
             "/data/all_transactions.json")
WATCH = {"Pelosi": "pelosi"}  # 名字关键词 → person id


def fetch():
    rows = http_get_json(HOUSE_URL)
    out = []
    for r in rows:
        rep = (r.get("representative") or "")
        pid = next((v for k, v in WATCH.items() if k in rep), None)
        if not pid or not r.get("ticker") or r["ticker"] in ("--", "N/A"):
            continue
        is_buy = "purchase" in (r.get("type") or "").lower()
        out.append({
            "personId": pid, "type": "ptr", "ticker": r["ticker"].upper(),
            "asOf": r.get("disclosure_date") or r.get("transaction_date"),
            "direction": "long" if is_buy else "exit",
            "sentiment": "bull" if is_buy else "bear",
            "change": "new" if is_buy else "trim",
        })
    return out[:50]


def mock():
    return [{
        "personId": "pelosi", "type": "ptr", "ticker": "NVDA", "asOf": "2026-05-12",
        "direction": "call", "strike": 100, "expiration": "2027-01-15", "daysToExp": 248,
        "avgPriceRange": [50000, 100000], "sentiment": "bull", "change": "new",
    }]


def run():
    return safe(fetch, "Congress house-stock-watcher", mock)


if __name__ == "__main__":
    write_json("signals_congress.json", run())
