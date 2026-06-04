"""新闻 → news.json（全局流）+ per-ticker 新闻 + 公众号文章 articles.json。

源：
  - Finnhub company-news（免费 tier，需 FINNHUB_API_KEY）：每个关注 ticker 的真实新闻。
  - 公众号「猫笔刀」经 Wechat2RSS 桥接成 RSS（config.PEOPLE[maobidao].rss）。
无密钥 / 抓不到 → 返回空，绝不编造新闻（无假数据原则）。
"""
import os
import re
import datetime as dt
from html import unescape
from lib import http_get, http_get_json, safe, write_json
from config import PEOPLE_BY_ID, TICKERS

FINNHUB_KEY = os.environ.get("FINNHUB_API_KEY")
ITEM_RE = re.compile(r"<item>(.*?)</item>", re.S)


def _tag(block, name):
    m = re.search(rf"<{name}>(.*?)</{name}>", block, re.S)
    if not m:
        return ""
    val = m.group(1).strip()
    val = re.sub(r"<!\[CDATA\[(.*?)\]\]>", r"\1", val, flags=re.S)
    return unescape(val.strip())


def parse_rss(text, source, extra_tags=None):
    items = []
    for i, block in enumerate(ITEM_RE.findall(text)):
        title = _tag(block, "title")
        link = _tag(block, "link")
        date = (_tag(block, "pubDate") or "")[:16]
        if not title:
            continue
        items.append({"id": f"{source}-{i}", "title": title, "source": source,
                      "publishedAt": date or "", "url": link or "",
                      "tags": list(extra_tags or [])})
    return items


def fetch_ticker_news(ticker, days=14, limit=6):
    """Finnhub company-news：返回某 ticker 最近 N 天真实新闻。"""
    if not FINNHUB_KEY:
        raise RuntimeError("缺 FINNHUB_API_KEY")
    to = dt.date.today()
    frm = to - dt.timedelta(days=days)
    url = (f"https://finnhub.io/api/v1/company-news?symbol={ticker}"
           f"&from={frm.isoformat()}&to={to.isoformat()}&token={FINNHUB_KEY}")
    data = http_get_json(url)
    out = []
    seen = set()
    for r in sorted(data, key=lambda x: x.get("datetime", 0), reverse=True):
        title = (r.get("headline") or "").strip()
        url_ = (r.get("url") or "").strip()
        if not title or title in seen:
            continue
        seen.add(title)
        d = dt.date.fromtimestamp(r.get("datetime", 0)).isoformat() if r.get("datetime") else ""
        out.append({"id": f"{ticker}-{r.get('id', len(out))}", "title": title,
                    "source": r.get("source", "Finnhub"), "publishedAt": d,
                    "url": url_, "tags": [ticker]})
        if len(out) >= limit:
            break
    return out


def fetch_wechat(person):
    rss = person.get("rss")
    if not rss:
        raise RuntimeError("未配置猫笔刀 RSS（订阅 Wechat2RSS 后填 config）")
    return parse_rss(http_get(rss), person["name"], extra_tags=[person["name"]])


def run():
    """返回 (global_news, per_ticker_news, articles)。
    global_news: 各 ticker 真实新闻汇总（去重、按日期倒序）。
    per_ticker_news: {ticker: [...]}，供个股详情页。
    articles: {personId: [...]}（猫笔刀）。
    无密钥/抓不到 → 对应部分为空。"""
    per_ticker = {}
    for t in TICKERS:
        per_ticker[t] = safe(lambda t=t: fetch_ticker_news(t), f"Finnhub news {t}", lambda: [])

    # 全局流：合并各 ticker，按日期倒序，去重标题
    merged, seen = [], set()
    for t in TICKERS:
        for n in per_ticker[t]:
            if n["title"] in seen:
                continue
            seen.add(n["title"])
            merged.append(n)
    merged.sort(key=lambda n: n.get("publishedAt", ""), reverse=True)

    # 公众号文章流（猫笔刀）—— 只进 articles.json，不进全局新闻流
    articles = {}
    mbd = PEOPLE_BY_ID.get("maobidao")
    if mbd:
        articles["maobidao"] = safe(lambda: fetch_wechat(mbd), "WeChat 猫笔刀", lambda: [])
    return merged, per_ticker, articles


if __name__ == "__main__":
    news, per_ticker, articles = run()
    write_json("news.json", news)
    write_json("articles.json", articles)
