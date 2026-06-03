"""新闻 → news.json + 公众号文章 articles.json。

源：各家 RSS（只取标题 + 外链，不抓正文，避开付费墙）。
公众号「猫笔刀」经 Wechat2RSS 桥接成 RSS，同管道处理（config.PEOPLE[maobidao].rss）。
"""
import re
from html import unescape
from lib import http_get, safe, write_json
from config import NEWS_FEEDS, PEOPLE_BY_ID

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
        link = _tag(block, "link") or "#"
        date = (_tag(block, "pubDate") or "")[:16]
        if not title:
            continue
        items.append({"id": f"{source}-{i}", "title": title, "source": source,
                      "publishedAt": date or "", "url": link,
                      "tags": list(extra_tags or [])})
    return items


def fetch_feed(source, url):
    return parse_rss(http_get(url), source)


def fetch_wechat(person):
    rss = person.get("rss")
    if not rss:
        raise RuntimeError("未配置猫笔刀 RSS（订阅 Wechat2RSS 后填 config）")
    return parse_rss(http_get(rss), person["name"], extra_tags=[person["name"]])


def mock_news():
    return [
        {"id": "g1", "title": "Situational Awareness 13F 曝光：~$8.5B 芯片股 put 对冲",
         "source": "Bloomberg", "publishedAt": "2026-05-18", "url": "#",
         "tags": ["Leopold", "13F", "NVDA"]},
        {"id": "g2", "title": "Pelosi 披露 NVDA LEAPS call 新仓", "source": "Capitol Trades",
         "publishedAt": "2026-05-14", "url": "#", "tags": ["Pelosi", "Congress", "NVDA"]},
    ]


def mock_articles():
    return {
        "maobidao": [
            {"id": "mbd1", "title": "每日复盘：半导体分歧加大，普涨退潮", "source": "猫笔刀",
             "publishedAt": "2026-06-01", "url": "#", "tags": ["复盘", "半导体"]},
            {"id": "mbd2", "title": "聊聊 AI 算力链的二阶受益者", "source": "猫笔刀",
             "publishedAt": "2026-05-30", "url": "#", "tags": ["AI", "MRVL"]},
            {"id": "mbd3", "title": "周末杂谈：当大家都在等回调", "source": "猫笔刀",
             "publishedAt": "2026-05-25", "url": "#", "tags": ["杂谈", "情绪"]},
            {"id": "mbd4", "title": "复盘：电力与算力，谁先见顶", "source": "猫笔刀",
             "publishedAt": "2026-05-22", "url": "#", "tags": ["复盘", "BE", "电力"]},
            {"id": "mbd5", "title": "一个关于仓位管理的老问题", "source": "猫笔刀",
             "publishedAt": "2026-05-19", "url": "#", "tags": ["仓位", "方法"]},
        ]
    }


def run():
    news = []
    for source, url in NEWS_FEEDS:
        news += safe(lambda s=source, u=url: fetch_feed(s, u), f"RSS {source}", lambda: [])
    if not news:
        news = mock_news()

    # 公众号文章流（猫笔刀）—— 只进 articles.json（前端「跟踪的人 → 猫笔刀」详情页），不进全局新闻流
    articles = {}
    mbd = PEOPLE_BY_ID.get("maobidao")
    if mbd:
        articles["maobidao"] = safe(lambda: fetch_wechat(mbd), "WeChat 猫笔刀",
                                    lambda: mock_articles()["maobidao"])
    return news, articles


if __name__ == "__main__":
    news, articles = run()
    write_json("news.json", news)
    write_json("articles.json", articles)
