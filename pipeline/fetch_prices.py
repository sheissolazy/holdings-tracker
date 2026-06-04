"""股价 OHLC + 当前价 → 每个关注 ticker 的真实价格序列。

源：Yahoo Finance chart API（免费、无密钥）：
  https://query1.finance.yahoo.com/v8/finance/chart/NVDA?range=6mo&interval=1d
返回真实 OHLC + meta.regularMarketPrice + meta.chartPreviousClose。
抓不到 → 返回空（[]），绝不编造价格（无假数据原则）。
"""
from lib import http_get_json, safe
from config import TICKERS

YH = "https://query1.finance.yahoo.com/v8/finance/chart/{sym}?range=6mo&interval=1d"
# Yahoo 偶尔对 query1 限流，query2 作为备援
YH2 = "https://query2.finance.yahoo.com/v8/finance/chart/{sym}?range=6mo&interval=1d"
UA = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"}


def _get(sym):
    try:
        return http_get_json(YH.format(sym=sym), headers=UA)
    except Exception:
        return http_get_json(YH2.format(sym=sym), headers=UA)


def fetch(ticker):
    """返回 {bars:[{t,o,h,l,c}], price, prevClose}；抓不到则抛错。"""
    data = _get(ticker)
    result = (data.get("chart") or {}).get("result") or []
    if not result:
        raise ValueError("空数据")
    r = result[0]
    meta = r.get("meta") or {}
    ts = r.get("timestamp") or []
    quote = ((r.get("indicators") or {}).get("quote") or [{}])[0]
    import datetime as dt
    bars = []
    o_, h_, l_, c_ = (quote.get(k) or [] for k in ("open", "high", "low", "close"))
    for i, t in enumerate(ts):
        c = c_[i] if i < len(c_) else None
        if c is None:
            continue
        o = o_[i] if i < len(o_) and o_[i] is not None else c
        h = h_[i] if i < len(h_) and h_[i] is not None else c
        l = l_[i] if i < len(l_) and l_[i] is not None else c
        bars.append({"t": dt.date.fromtimestamp(t).isoformat(),
                     "o": round(o, 2), "h": round(h, 2),
                     "l": round(l, 2), "c": round(c, 2)})
    if not bars:
        raise ValueError("无有效收盘价")
    price = meta.get("regularMarketPrice") or bars[-1]["c"]
    prev = meta.get("chartPreviousClose") or (bars[-2]["c"] if len(bars) > 1 else price)
    return {"bars": bars, "price": round(price, 2), "prevClose": round(prev, 2)}


def run():
    """返回 {ticker: {bars, price, prevClose}}；抓不到的 ticker 不进结果（无假数据）。"""
    out = {}
    for t in TICKERS:
        res = safe(lambda t=t: fetch(t), f"price {t}", lambda: None)
        if res:
            out[t] = res
    return out


if __name__ == "__main__":
    from lib import write_json
    prices = run()
    for t, d in prices.items():
        write_json(f"prices/{t}.json", d["bars"])
