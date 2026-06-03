"""股价 OHLC → 每个关注 ticker 的价格序列。

源：stooq（免费、无密钥 CSV）：https://stooq.com/q/d/l/?s=nvda.us&i=d
免费源有频率限制 → 只拉关注列表的票。
"""
import csv
import io
from lib import http_get, safe, gen_prices
from config import TICKERS

# 不同标的的兜底起始价（mock gen_prices 用）
SEED_START = {"NVDA": (101, 88), "MRVL": (202, 72), "BE": (303, 96),
              "AAPL": (404, 195), "SMH": (505, 200)}


def fetch(ticker, days=120):
    url = f"https://stooq.com/q/d/l/?s={ticker.lower()}.us&i=d"
    text = http_get(url)
    rows = list(csv.DictReader(io.StringIO(text)))
    bars = [{"t": r["Date"], "o": float(r["Open"]), "h": float(r["High"]),
             "l": float(r["Low"]), "c": float(r["Close"])}
            for r in rows if r.get("Close") not in (None, "", "N/D")]
    if not bars:
        raise ValueError("空数据")
    return bars[-(days + 1):]


def run():
    out = {}
    for t in TICKERS:
        seed, start = SEED_START.get(t, (1, 100))
        out[t] = safe(lambda t=t: fetch(t), f"price {t}",
                      lambda seed=seed, start=start: gen_prices(seed, start))
    return out


if __name__ == "__main__":
    from lib import write_json
    prices = run()
    for t, bars in prices.items():
        write_json(f"prices/{t}.json", bars)
