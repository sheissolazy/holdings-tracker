"""SEC EDGAR 13F-HR → 持仓/期权信号（Buffett, Leopold/Situational Awareness）。

真实流程：
  1. data.sec.gov/submissions/CIK{10位}.json → 找最近两份 13F-HR 的 accession
     （取两份是为了和上季度比对，得出 new/add/trim/hold）
  2. Archives/.../{accession}/index.json → 定位 information table XML 与 primary_doc.xml
  3. 解析每条 <infoTable>（nameOfIssuer / cusip / value(美元) / sshPrnamt / putCall）
     按 (cusip, putCall) 聚合
  4. CUSIP → ticker：用 cusip_map.resolve()（OpenFIGI 免费 API + 本地缓存）
  5. 组装成前端 Signal（type=options 当有 putCall，否则 13f）

13F 局限（已如实标注到 UI）：
  - 季度披露，结算后最多 ~45 天延迟
  - 只含 13(f) 类多头证券；Berkshire 的部分 put 历史上不在 13F 体现
  - Leopold/Situational Awareness 的芯片股 put 在 13F 里【有】体现（CIK 0002045724）
"""
import re
import datetime as dt

import cusip_map
from lib import http_get, http_get_json, safe, write_json
from config import PEOPLE_BY_ID, SEC_UA

SEC_HEADERS = {"User-Agent": SEC_UA, "Accept-Encoding": "gzip, deflate"}

TOP_N = 15  # 每人保留前 N 大持仓（按市值），避免长尾噪声


# ---------- SEC 拉取 ----------

def _two_latest_13f(cik):
    """返回最近两份 13F-HR 的 (accession_nodash, filingDate)，最新在前。"""
    cik10 = str(cik).zfill(10)
    data = http_get_json(f"https://data.sec.gov/submissions/CIK{cik10}.json", SEC_HEADERS)
    recent = data["filings"]["recent"]
    out = []
    for form, acc, date in zip(recent["form"], recent["accessionNumber"], recent["filingDate"]):
        if form.startswith("13F-HR"):
            out.append((acc.replace("-", ""), date))
            if len(out) == 2:
                break
    return out


def _filing_index(cik, acc_nodash):
    url = f"https://www.sec.gov/Archives/edgar/data/{int(cik)}/{acc_nodash}/index.json"
    return http_get_json(url, SEC_HEADERS)


def _file_url(cik, acc_nodash, name):
    return f"https://www.sec.gov/Archives/edgar/data/{int(cik)}/{acc_nodash}/{name}"


def _period_of_report(cik, acc_nodash, names):
    """从 primary_doc.xml 取 periodOfReport（MM-DD-YYYY）→ ISO。"""
    if "primary_doc.xml" not in names:
        return None
    try:
        xml = http_get(_file_url(cik, acc_nodash, "primary_doc.xml"), SEC_HEADERS)
        m = re.search(r"<periodOfReport>(.*?)</periodOfReport>", xml)
        if m:
            mm, dd, yyyy = m.group(1).strip().split("-")
            return f"{yyyy}-{mm}-{dd}"
    except Exception:  # noqa
        pass
    return None


_TBL_RE = re.compile(r"<(?:\w+:)?infoTable\b[^>]*>(.*?)</(?:\w+:)?infoTable>", re.S | re.I)


def _tag(block, tag):
    m = re.search(rf"<(?:\w+:)?{tag}\b[^>]*>(.*?)</(?:\w+:)?{tag}>", block, re.S | re.I)
    return m.group(1).strip() if m else ""


def _parse_info_table(xml):
    """解析 info table XML → 按 (cusip, putCall) 聚合 {key: {...}}。"""
    agg = {}
    for block in _TBL_RE.findall(xml):
        cusip = _tag(block, "cusip").upper()
        if not cusip:
            continue
        put_call = _tag(block, "putCall").strip().lower()   # ''|'put'|'call'
        name = _tag(block, "nameOfIssuer")
        try:
            value = float(_tag(block, "value") or 0)        # 2023 后为美元
        except ValueError:
            value = 0.0
        try:
            shares = float(_tag(block, "sshPrnamt") or 0)
        except ValueError:
            shares = 0.0
        key = (cusip, put_call)
        a = agg.setdefault(key, {"cusip": cusip, "putCall": put_call,
                                 "name": name, "value": 0.0, "shares": 0.0})
        a["value"] += value
        a["shares"] += shares
        if name and not a["name"]:
            a["name"] = name
    return agg


def _load_quarter(cik, acc_nodash):
    """拉一份 13F 的聚合持仓 + periodOfReport。"""
    idx = _filing_index(cik, acc_nodash)
    names = [it["name"] for it in idx.get("directory", {}).get("item", [])]
    xml_candidates = [n for n in names if n.lower().endswith(".xml") and n != "primary_doc.xml"]
    period = _period_of_report(cik, acc_nodash, names)
    for name in xml_candidates:
        try:
            xml = http_get(_file_url(cik, acc_nodash, name), SEC_HEADERS)
        except Exception:  # noqa
            continue
        if re.search(r"<(?:\w+:)?infoTable\b", xml, re.I):
            return _parse_info_table(xml), period
    return {}, period


# ---------- 组装 Signal ----------

def _change(cur_shares, prev_shares):
    if prev_shares is None:
        return "new", None
    if prev_shares <= 0:
        return ("new", None) if cur_shares > 0 else ("hold", 0)
    delta_pct = round((cur_shares - prev_shares) / prev_shares * 100)
    if cur_shares > prev_shares:
        return "add", delta_pct
    if cur_shares < prev_shares:
        return "trim", delta_pct
    return "hold", 0


def fetch_for(person):
    """真实抓取一个 CIK 的最近 13F，返回 signal 列表。失败时上层回落 mock。"""
    cik = person.get("cik")
    if not cik:
        return []
    filings = _two_latest_13f(cik)
    if not filings:
        return []

    cur_acc, _ = filings[0]
    cur, period = _load_quarter(cik, cur_acc)
    if not cur:
        return []
    prev = {}
    if len(filings) > 1:
        prev, _ = _load_quarter(cik, filings[1][0])

    total = sum(h["value"] for h in cur.values()) or 1.0

    # 解析 CUSIP → ticker（一次性批量，命中缓存即离线）
    tickers = cusip_map.resolve([h["cusip"] for h in cur.values()])

    rows = []
    for (cusip, put_call), h in cur.items():
        raw = tickers.get(cusip)
        ticker = cusip_map.norm(raw) if raw else None
        if not ticker:
            continue
        prev_shares = None
        prev_h = prev.get((cusip, put_call))
        if prev_h is not None:
            prev_shares = prev_h["shares"]
        chg, chg_pct = _change(h["shares"], prev_shares)

        is_opt = put_call in ("put", "call")
        sig = {
            "personId": person["id"],
            "type": "options" if is_opt else "13f",
            "ticker": ticker,
            "asOf": period or dt.date.today().isoformat(),
            "shares": int(h["shares"]),
            "notional": int(h["value"]),
            "weightPct": round(h["value"] / total * 100, 1),
            "direction": "put" if put_call == "put" else "call" if put_call == "call" else "long",
            "sentiment": "bear" if put_call == "put" else "bull",
            "change": chg,
        }
        if chg_pct is not None:
            sig["changePct"] = chg_pct
        rows.append((h["value"], sig))

    rows.sort(key=lambda r: r[0], reverse=True)
    return [sig for _, sig in rows[:TOP_N]]


def mock_signals():
    return [
        {"personId": "leopold", "type": "options", "ticker": "NVDA", "asOf": "2026-03-31",
         "direction": "put", "notional": 1_600_000_000, "strike": 95, "expiration": "2026-09-18",
         "daysToExp": 171, "sentiment": "bear", "change": "add"},
        {"personId": "leopold", "type": "options", "ticker": "SMH", "asOf": "2026-03-31",
         "direction": "put", "notional": 2_000_000_000, "strike": 210, "expiration": "2026-12-18",
         "daysToExp": 262, "sentiment": "bear", "change": "new"},
        {"personId": "leopold", "type": "13f", "ticker": "BE", "asOf": "2026-03-31",
         "shares": 6_500_000, "notional": 879_000_000, "weightPct": 6.4, "change": "add",
         "changePct": 18, "avgPriceRange": [118, 142], "direction": "long", "sentiment": "bull"},
        {"personId": "buffett", "type": "13f", "ticker": "AAPL", "asOf": "2026-03-31",
         "shares": 300_000_000, "notional": 62_000_000_000, "weightPct": 24.1, "change": "trim",
         "changePct": -8, "avgPriceRange": [165, 195], "direction": "long", "sentiment": "bull"},
    ]


def run():
    out = []
    for pid in ("buffett", "leopold"):
        sigs = safe(lambda pid=pid: fetch_for(PEOPLE_BY_ID[pid]),
                    f"13F {pid}", lambda: [])  # 抓不到 → 空，不编造持仓
        out.extend(sigs)
    return out


if __name__ == "__main__":
    write_json("signals_13f.json", run())
