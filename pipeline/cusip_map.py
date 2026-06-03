"""CUSIP → ticker 映射（13F 信息表只有 CUSIP，没有 ticker）。

用 OpenFIGI 免费 API（无 key：10 jobs/请求、25 请求/分钟；
配 OPENFIGI_API_KEY 环境变量则放宽到 100 jobs/请求、更高频）。
结果落盘到 cusip_cache.json 并提交，避免重复查询、离线也能复用。
"""
import os
import re
import json
import time

from lib import http_post_json

_CACHE_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "cusip_cache.json")
_OPENFIGI_URL = "https://api.openfigi.com/v3/mapping"


def _load_cache():
    if os.path.exists(_CACHE_PATH):
        try:
            with open(_CACHE_PATH, encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return {}
    return {}


def _save_cache(cache):
    with open(_CACHE_PATH, "w", encoding="utf-8") as f:
        json.dump(cache, f, ensure_ascii=False, indent=2, sort_keys=True)


def _chunks(seq, n):
    for i in range(0, len(seq), n):
        yield seq[i:i + n]


def resolve(cusips):
    """传入 CUSIP 列表，返回 {cusip: ticker}（查不到的不包含）。优先读缓存。"""
    cache = _load_cache()
    uniq = [c for c in dict.fromkeys(cusips) if c]            # 去重保序
    missing = [c for c in uniq if c not in cache]

    if missing:
        api_key = os.environ.get("OPENFIGI_API_KEY", "").strip()
        headers = {"X-OPENFIGI-APIKEY": api_key} if api_key else {}
        batch = 100 if api_key else 10   # 无 key：10 jobs/请求；有 key：100
        for group in _chunks(missing, batch):
            jobs = [{"idType": "ID_CUSIP", "idValue": c, "exchCode": "US"} for c in group]
            try:
                res = http_post_json(_OPENFIGI_URL, jobs, headers)
            except Exception as e:  # noqa
                print(f"  [warn] OpenFIGI 批查失败：{e}")
                break
            for c, item in zip(group, res):
                data = item.get("data") or []
                cache[c] = data[0]["ticker"] if data else None   # None = 查无，避免反复查
            if not api_key:
                time.sleep(2.5)   # 无 key 限速：25 请求/分钟
        _save_cache(cache)

    return {c: cache[c] for c in uniq if cache.get(c)}


# 规范化 OpenFIGI ticker（去掉类似 "BRK/B" 的斜杠等，按需扩展）
def norm(ticker):
    return re.sub(r"[^A-Z0-9.]", "", (ticker or "").upper())
