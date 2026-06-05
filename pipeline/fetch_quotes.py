"""轻量行情：给「抄作业」视图用——所有信号涉及的 ticker 的最新价 + 当日涨跌。

与 fetch_prices 不同：不取完整 OHLC 序列，只取最新价（range=5d），覆盖全部跟踪者
持有/买入涉及的标的（约几十个），用于「现在买 = 比申报市值价 ±X%」对照。
源：Yahoo Finance chart API（免费、无密钥）。抓不到的 ticker 不进结果（无假数据）。
"""
import datetime as dt
from lib import http_get_json, safe

YH = "https://query1.finance.yahoo.com/v8/finance/chart/{sym}?range=5d&interval=1d"
YH2 = "https://query2.finance.yahoo.com/v8/finance/chart/{sym}?range=5d&interval=1d"
UA = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"}


def _get(sym):
    try:
        return http_get_json(YH.format(sym=sym), headers=UA)
    except Exception:
        return http_get_json(YH2.format(sym=sym), headers=UA)


def fetch(ticker):
    data = _get(ticker)
    result = (data.get("chart") or {}).get("result") or []
    if not result:
        raise ValueError("空数据")
    meta = result[0].get("meta") or {}
    price = meta.get("regularMarketPrice")
    prev = meta.get("chartPreviousClose") or price
    if price is None:
        raise ValueError("无最新价")
    chg = round((price - prev) / prev * 100, 2) if prev else 0.0
    return {"price": round(price, 2), "prevClose": round(prev, 2),
            "chgPct": chg, "asOf": dt.date.today().isoformat()}


def run(tickers):
    """tickers: 可迭代的 ticker 列表 → {ticker: {price, prevClose, chgPct, asOf}}。"""
    out = {}
    for t in sorted({t for t in tickers if t}):
        res = safe(lambda t=t: fetch(t), f"quote {t}", lambda: None)
        if res:
            out[t] = res
    return out


if __name__ == "__main__":
    import json
    print(json.dumps(run(["AAPL", "KO", "NVDA"]), ensure_ascii=False, indent=2))
