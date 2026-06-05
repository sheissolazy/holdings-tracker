"""共享工具：HTTP、JSON 写出、日期、确定性价格生成。

只用标准库，--mock 模式下无需任何外部依赖即可跑通，生成 schema 正确的 JSON。
真实抓取也用 urllib，无需 requests；如已安装 requests 会更稳但非必需。
"""
import json
import os
import sys
import gzip
import datetime as dt
import urllib.request
import urllib.error

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(ROOT, "public", "data")

MOCK = "--mock" in sys.argv  # 缺网络/密钥时用占位数据，验证管道结构

TODAY = dt.date.today()  # 真实当前日期；freshness/sparkline 日期计算均依赖它


def ensure_dirs():
    os.makedirs(DATA_DIR, exist_ok=True)
    os.makedirs(os.path.join(DATA_DIR, "stocks"), exist_ok=True)


def write_json(rel_path, obj):
    ensure_dirs()
    path = os.path.join(DATA_DIR, rel_path)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, indent=2)
    print(f"  ✓ wrote {os.path.relpath(path, ROOT)} ({_size(obj)})")


def read_json(rel_path, default=None):
    path = os.path.join(DATA_DIR, rel_path)
    if not os.path.exists(path):
        return default
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def _size(obj):
    n = len(obj) if isinstance(obj, (list, dict)) else 1
    return f"{n} items"


def http_get(url, headers=None, timeout=20):
    req = urllib.request.Request(url, headers=headers or {"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        raw = r.read()
        if r.headers.get("Content-Encoding") == "gzip" or raw[:2] == b"\x1f\x8b":
            raw = gzip.decompress(raw)
    return raw.decode("utf-8", "replace")


def http_get_json(url, headers=None, timeout=20):
    return json.loads(http_get(url, headers, timeout))


def http_post_json(url, payload, headers=None, timeout=25):
    body = json.dumps(payload).encode()
    h = {"Content-Type": "application/json"}
    h.update(headers or {})
    req = urllib.request.Request(url, data=body, headers=h)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        raw = r.read()
        if r.headers.get("Content-Encoding") == "gzip" or raw[:2] == b"\x1f\x8b":
            raw = gzip.decompress(raw)
    return json.loads(raw.decode("utf-8", "replace"))


def iso(d):
    return d.isoformat()


def days_between(a_iso, b_iso=None):
    b = dt.date.fromisoformat(b_iso) if b_iso else TODAY
    return (dt.date.fromisoformat(a_iso) - b).days


def gen_prices(seed, start, days=120):
    """确定性 OHLC（与前端 mock.genPrices 同算法），用于演示/兜底。"""
    x = seed
    def rand():
        nonlocal x
        x = (x * 1103515245 + 12345) & 0x7FFFFFFF
        return x / 0x7FFFFFFF
    bars = []
    c = float(start)
    for i in range(days, -1, -1):
        d = TODAY - dt.timedelta(days=i)
        drift = (rand() - 0.48) * start * 0.02
        o = c
        c = max(1.0, o + drift)
        h = max(o, c) * (1 + rand() * 0.012)
        l = min(o, c) * (1 - rand() * 0.012)
        bars.append({"t": d.isoformat(), "o": round(o, 2), "h": round(h, 2),
                     "l": round(l, 2), "c": round(c, 2)})
    return bars


def safe(fn, label, fallback):
    """跑某个抓取步骤；失败则告警并用 fallback，保证整条管道不中断。"""
    if MOCK:
        print(f"  [mock] {label}")
        return fallback() if callable(fallback) else fallback
    try:
        return fn()
    except Exception as e:  # noqa
        print(f"  [warn] {label} 失败：{e} → 用兜底", file=sys.stderr)
        return fallback() if callable(fallback) else fallback
