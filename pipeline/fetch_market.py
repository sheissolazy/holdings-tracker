"""大盘速览 → market.json（SPY / Gold / 10Y 国债收益率）。

源：Yahoo Finance chart API（免费、无密钥），取 meta 最新价 + 前收盘算涨跌。
抓不到 → 该项不进结果（无假数据原则）；前端对空数组做隐藏处理。
"""
from lib import http_get_json, safe

YH = "https://query1.finance.yahoo.com/v8/finance/chart/{sym}?range=5d&interval=1d"
YH2 = "https://query2.finance.yahoo.com/v8/finance/chart/{sym}?range=5d&interval=1d"
UA = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"}

# (展示名, Yahoo 符号, 是否收益率/百分比项)
ITEMS = [
    ("SPY", "SPY", False),
    ("Gold", "GLD", False),
    ("10Y Yield", "%5ETNX", True),  # ^TNX = 10年期国债收益率（已是百分数）
]


def _series(sym):
    """返回 (最新价, 上一交易日收盘) —— 用最近两根日 K 的收盘计算真实单日涨跌。"""
    try:
        data = http_get_json(YH.format(sym=sym), headers=UA)
    except Exception:
        data = http_get_json(YH2.format(sym=sym), headers=UA)
    result = (data.get("chart") or {}).get("result") or []
    if not result:
        raise ValueError("空数据")
    r = result[0]
    meta = r.get("meta") or {}
    closes = [c for c in (((r.get("indicators") or {}).get("quote") or [{}])[0].get("close") or [])
              if c is not None]
    if len(closes) < 2:
        raise ValueError("数据不足")
    price = meta.get("regularMarketPrice") or closes[-1]
    prev = closes[-2]
    return price, prev


def fetch_one(label, sym, is_yield):
    price, prev = _series(sym)
    if price is None or prev is None:
        raise ValueError("缺价格")
    diff = price - prev
    pos = diff >= 0
    if is_yield:
        value = f"{price:.2f}%"
        bp = round(diff * 100)  # 收益率变动用基点 bp
        chg = f"{'+' if pos else ''}{bp}bp"
    else:
        value = f"${price:,.2f}"
        pctv = diff / prev * 100 if prev else 0
        chg = f"{'+' if pos else ''}{pctv:.1f}%"
    return {"label": label, "value": value, "chg": chg, "pos": pos}


def run():
    out = []
    for label, sym, is_yield in ITEMS:
        res = safe(lambda l=label, s=sym, y=is_yield: fetch_one(l, s, y),
                   f"market {label}", lambda: None)
        if res:
            out.append(res)
    return out


if __name__ == "__main__":
    from lib import write_json
    write_json("market.json", run())
