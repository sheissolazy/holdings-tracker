"""Congress 交易 → ptr 信号（Pelosi 等）。

源：美国众议院书记官办公室（House Clerk）官方财务披露数据 —— 权威、免费、无密钥。
  年度索引 ZIP：https://disclosures-clerk.house.gov/public_disc/financial-pdfs/{YEAR}FD.ZIP
    内含 {YEAR}FD.xml，列出每位议员的披露（FilingType=P 为 PTR 定期交易报告）。
  PTR 明细 PDF：https://disclosures-clerk.house.gov/public_disc/ptr-pdfs/{YEAR}/{DocID}.pdf
    自 2021 起多为电子申报（文本可抽取），用 pypdf 解析出 ticker / 买卖 / 日期。

延迟：STOCK Act 允许成交后最多 ~45 天披露。
抓不到 / 解析失败 → 空，绝不编造（无假数据原则）。

依赖：pypdf（见 requirements.txt）。--mock / 缺库时本步回落为空。
"""
import io
import re
import zipfile
import datetime as dt
from lib import http_get_json, safe, write_json  # noqa: F401 (http_get_json 仅为兼容旧导入)
import urllib.request

UA = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"}
INDEX_URL = "https://disclosures-clerk.house.gov/public_disc/financial-pdfs/{year}FD.ZIP"
PTR_URL = "https://disclosures-clerk.house.gov/public_disc/ptr-pdfs/{year}/{docid}.pdf"

# 关注的议员：姓氏关键词 → person id
WATCH = {"Pelosi": "pelosi"}

# 解析 PTR 文本里的一笔交易：(TICKER) [资产码] P/S(可含 partial) 交易日期
# 第 2 组 = 买卖方向(P/S)，第 3 组 = 是否 partial，第 4 组 = 交易日期
_ROW = re.compile(
    r"\(([A-Z]{1,5})\)\s*\[[A-Z]{1,3}\]\s*([PS])(\s*\(partial\))?\s*(\d{1,2}/\d{1,2}/\d{4})")


def _get(url, timeout=30):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()


def _tag(block, name):
    m = re.search(rf"<{name}>(.*?)</{name}>", block, re.S)
    return (m.group(1).strip() if m else "")


def _index_filings(year):
    """返回该年度索引里所有「关注议员的 PTR」: [(pid, docid, filing_date)]。"""
    raw = _get(INDEX_URL.format(year=year))
    xml = zipfile.ZipFile(io.BytesIO(raw)).read(f"{year}FD.xml").decode("utf-8", "replace")
    out = []
    for block in re.findall(r"<Member>(.*?)</Member>", xml, re.S):
        if _tag(block, "FilingType") != "P":
            continue
        last = _tag(block, "Last")
        pid = next((v for k, v in WATCH.items() if k in last), None)
        if not pid:
            continue
        docid = _tag(block, "DocID")
        if docid:
            out.append((pid, docid, _tag(block, "FilingDate")))
    return out


def _iso(mdy):
    try:
        return dt.datetime.strptime(mdy, "%m/%d/%Y").date().isoformat()
    except Exception:
        return mdy


def _parse_ptr(docid, year):
    """下载并解析一份 PTR PDF → [(ticker, 'P'|'S', txn_date_iso)]。"""
    from pypdf import PdfReader  # 惰性导入：缺库时由 safe() 回落为空
    raw = _get(PTR_URL.format(year=year, docid=docid))
    reader = PdfReader(io.BytesIO(raw))
    text = "\n".join(p.extract_text() or "" for p in reader.pages)
    return [(t, side, bool(partial), _iso(d))
            for t, side, partial, d in _ROW.findall(text)]


def fetch():
    years = [dt.date.today().year, dt.date.today().year - 1]
    out, seen = [], set()
    for year in years:
        filings = safe(lambda y=year: _index_filings(y),
                       f"House Clerk 索引 {year}", lambda: [])
        for pid, docid, fdate in filings:
            txns = safe(lambda d=docid, y=year: _parse_ptr(d, y),
                        f"PTR {docid}", lambda: [])
            for ticker, side, partial, txn_date in txns:
                key = (pid, ticker, side, partial, txn_date)
                if key in seen:
                    continue
                seen.add(key)
                is_buy = side == "P"
                out.append({
                    "personId": pid, "type": "ptr", "ticker": ticker.upper(),
                    "asOf": _iso(fdate) or txn_date, "txnDate": txn_date,
                    "direction": "long" if is_buy else "exit",
                    "sentiment": "bull" if is_buy else "bear",
                    # 买入→新建；部分卖出→减仓；全部卖出→清仓
                    "change": "new" if is_buy else ("trim" if partial else "exit"),
                    "sourceUrl": PTR_URL.format(year=year, docid=docid),
                })
    # 按申报日期倒序，最多 50 条
    out.sort(key=lambda s: s.get("txnDate", ""), reverse=True)
    return out[:50]


def run():
    # 抓不到 / 缺 pypdf → 空，不编造国会交易（无假数据原则）
    return safe(fetch, "Congress House Clerk", lambda: [])


if __name__ == "__main__":
    write_json("signals_congress.json", run())
