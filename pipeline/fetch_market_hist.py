"""大盘 / 商品 历史 → public/data/mkt/{CODE}.json（供首页迷你折线图按区间切片）。

源：Yahoo Finance chart API（免费、无密钥），取 5 年日线收盘。
前端用同一份数据按区间切片：5日 / 1月 / 1年 / 5年（与汇率图一致）。
抓不到 → 不写该文件（无假数据原则）；前端对缺失静默隐藏迷你图。

输出格式（紧凑）：{"code","label","sym","kind","bars":[{"t","c"}, ...]}
code/kind 与 fetch_market.ITEMS 的大盘/商品项一一对应。
"""
from lib import http_get_json, safe, write_json

YH = "https://query1.finance.yahoo.com/v8/finance/chart/{sym}?range=5y&interval=1d"
YH2 = "https://query2.finance.yahoo.com/v8/finance/chart/{sym}?range=5y&interval=1d"
UA = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"}

# (code, 展示名, Yahoo 符号[已编码], kind) —— 与 fetch_market 大盘/商品组一致
SERIES = [
    ("SPX",  "标普500",  "SPY",       "usd"),
    ("TNX",  "10年美债", "%5ETNX",    "yield"),
    ("DXY",  "美元指数", "DX-Y.NYB",  "index"),
    ("GOLD", "黄金",     "GC%3DF",    "usd"),
    ("WTI",  "原油WTI",  "CL%3DF",    "usd"),
]


def fetch_series(code, label, sym, kind):
    try:
        data = http_get_json(YH.format(sym=sym), headers=UA)
    except Exception:
        data = http_get_json(YH2.format(sym=sym), headers=UA)
    result = (data.get("chart") or {}).get("result") or []
    if not result:
        raise ValueError("空数据")
    r = result[0]
    ts = r.get("timestamp") or []
    closes = (((r.get("indicators") or {}).get("quote") or [{}])[0].get("close") or [])
    bars = []
    import datetime as dt
    for t, c in zip(ts, closes):
        if c is None:
            continue
        bars.append({"t": dt.date.fromtimestamp(t).isoformat(), "c": round(c, 4)})
    if len(bars) < 2:
        raise ValueError("数据不足")
    return {"code": code, "label": label, "sym": sym, "kind": kind, "bars": bars}


def run():
    """返回 {code: payload}，并由调用方写出各 mkt/{code}.json。"""
    out = {}
    for code, label, sym, kind in SERIES:
        res = safe(lambda c=code, l=label, s=sym, k=kind: fetch_series(c, l, s, k),
                   f"mkt {label}", lambda: None)
        if res:
            out[code] = res
    return out


if __name__ == "__main__":
    for code, payload in run().items():
        write_json(f"mkt/{code}.json", payload)
