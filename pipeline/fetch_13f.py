"""SEC EDGAR 13F-HR → 持仓/期权信号（Buffett, Leopold/Situational Awareness）。

真实流程：
  1. data.sec.gov/submissions/CIK{10位}.json → 找最近一份 13F-HR 的 accession
  2. 取该 filing 的 information table XML → 解析每条 infoTable
     (nameOfIssuer, value(千美元), sshPrnamt, putCall)
  3. CUSIP → ticker 映射（infoTable 只有 CUSIP，没有 ticker，是真实痛点）
     → 需要一张 CUSIP→ticker 表（可用 SEC company_tickers + 第三方表补全）

13F 局限（如实标注到 UI）：
  - 季度披露，结算后最多 ~45 天延迟
  - 只含 13(f) 类多头证券；Berkshire 的部分 put 历史上不在 13F 体现
  - Leopold/Situational Awareness 的 put 在 13F 里【有】体现（CIK 0002045724）
"""
import sys
from lib import http_get_json, safe, write_json, MOCK
from config import PEOPLE_BY_ID, SEC_UA

SEC_HEADERS = {"User-Agent": SEC_UA, "Accept-Encoding": "gzip, deflate"}


def latest_13f_accession(cik):
    cik10 = str(cik).zfill(10)
    data = http_get_json(f"https://data.sec.gov/submissions/CIK{cik10}.json", SEC_HEADERS)
    recent = data["filings"]["recent"]
    for form, acc, date in zip(recent["form"], recent["accessionNumber"], recent["filingDate"]):
        if form.startswith("13F-HR"):
            return acc.replace("-", ""), date
    return None, None


def fetch_for(person):
    """真实抓取一个 CIK 的最近 13F。返回 signal 列表。
    注：CUSIP→ticker 映射未内置完整表，这里返回原始持仓需后处理；
    生产中应接一张映射表。失败时上层会回落到 mock。
    """
    cik = person.get("cik")
    if not cik:
        return []
    acc, date = latest_13f_accession(cik)
    if not acc:
        return []
    # 这里应：GET filing index → 找 infotable xml → 解析。
    # 因 CUSIP→ticker 映射依赖外部表，留作 TODO，先抛出让其回落 mock。
    raise NotImplementedError(
        f"{person['id']}: 找到 13F accession {acc} ({date})，"
        f"但 CUSIP→ticker 映射表未配置，回落 mock。"
    )


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
        sigs = safe(lambda: fetch_for(PEOPLE_BY_ID[pid]),
                    f"13F {pid}",
                    lambda pid=pid: [s for s in mock_signals() if s["personId"] == pid])
        out.extend(sigs)
    return out


if __name__ == "__main__":
    write_json("signals_13f.json", run())
