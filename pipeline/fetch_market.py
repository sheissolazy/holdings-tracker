"""大盘 / 商品 / 汇率速览 → market.json。

源：Yahoo Finance chart API（免费、无密钥）。用最近两根日 K 收盘算真实单日涨跌。
抓不到 → 该项不进结果（无假数据原则）；前端对空做隐藏处理。

分三组（前端按 group 分区展示）：
  大盘  : 标普500(SPY)、10年美债收益率(^TNX)、美元指数(DXY)
  商品  : 黄金(GC=F)、原油WTI(CL=F)
  汇率  : 美元/人民币、美元/日元、美元/韩元、欧元/美元、美元/加元
"""
from lib import http_get_json, safe

YH = "https://query1.finance.yahoo.com/v8/finance/chart/{sym}?range=5d&interval=1d"
YH2 = "https://query2.finance.yahoo.com/v8/finance/chart/{sym}?range=5d&interval=1d"
UA = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"}

# (展示名, Yahoo 符号[已 URL 编码], 分组, 类型, [汇率 code])
# 类型 kind: usd=美元计价 / index=指数(无$) / yield=收益率(%,bp) / fx=汇率
# 汇率项带 code，与 fetch_fx.PAIRS 对应，前端据此加载 fx/{code}.json 迷你图。
ITEMS = [
    ("标普500",   "SPY",        "大盘", "usd",   "SPX"),
    ("10年美债",  "%5ETNX",     "大盘", "yield", "TNX"),
    ("美元指数",  "DX-Y.NYB",   "大盘", "index", "DXY"),
    ("黄金",      "GC%3DF",     "商品", "usd",   "GOLD"),
    ("原油WTI",   "CL%3DF",     "商品", "usd",   "WTI"),
    ("美元/人民币", "CNY%3DX",  "汇率", "fx",    "CNY"),
    ("美元/日元",  "JPY%3DX",   "汇率", "fx",    "JPY"),
    ("美元/韩元",  "KRW%3DX",   "汇率", "fx",    "KRW"),
    ("欧元/美元",  "EURUSD%3DX","汇率", "fx",    "EUR"),
    ("美元/加元",  "CAD%3DX",   "汇率", "fx",    "CAD"),
    # 人民币兑各国（1 人民币 = ? 外币）—— 单独成组，前端独立成「人民币兑换」图区
    ("人民币/美元", "CNYUSD%3DX", "人民币", "fx", "CNYUSD"),
    ("人民币/日元", "CNYJPY%3DX", "人民币", "fx", "CNYJPY"),
    ("人民币/欧元", "CNYEUR%3DX", "人民币", "fx", "CNYEUR"),
    ("人民币/港元", "CNYHKD%3DX", "人民币", "fx", "CNYHKD"),
    ("人民币/英镑", "CNYGBP%3DX", "人民币", "fx", "CNYGBP"),
]


def _series(sym):
    """返回 (最新价, 上一交易日收盘)。"""
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
    return price, closes[-2]


def _fmt_value(price, kind):
    if kind == "yield":
        return f"{price:.2f}%"
    if kind == "usd":
        return f"${price:,.2f}"
    if kind == "index":
        return f"{price:.2f}"
    # fx：按量级选小数位
    if price >= 100:
        return f"{price:,.2f}"
    return f"{price:.4f}"


def fetch_one(label, sym, group, kind, code=None):
    price, prev = _series(sym)
    if price is None or prev is None:
        raise ValueError("缺价格")
    diff = price - prev
    pos = diff >= 0
    if kind == "yield":
        bp = round(diff * 100)
        chg = f"{'+' if pos else ''}{bp}bp"
    else:
        pctv = diff / prev * 100 if prev else 0
        chg = f"{'+' if pos else ''}{pctv:.1f}%"
    item = {"label": label, "value": _fmt_value(price, kind),
            "chg": chg, "pos": pos, "group": group, "kind": kind}
    if code:
        # 前端据此加载迷你图历史：fx 组 → fx/{code}.json；大盘/商品 → mkt/{code}.json
        item["code"] = code
    return item


def run():
    out = []
    for label, sym, group, kind, code in ITEMS:
        res = safe(lambda l=label, s=sym, g=group, k=kind, c=code: fetch_one(l, s, g, k, c),
                   f"market {label}", lambda: None)
        if res:
            out.append(res)
    return out


if __name__ == "__main__":
    from lib import write_json
    write_json("market.json", run())
