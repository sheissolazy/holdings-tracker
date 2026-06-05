"""社交喊单 → social 信号（Musk / Serenity / Trump 均经 X）。

「第三条路」：非付费 API、非手动。
  - X 网页版 GraphQL，带【你自己的登录 cookie】(X_AUTH_TOKEN / X_CT0)
        UserByScreenName 解析 handle→id，再 UserTweets 拉最近推文。零成本、脆弱、有账号风险。
        跟踪对象由 config.PEOPLE 里 social.platform=='x' 决定（Musk / Serenity / Trump）。
  - 黄仁勋 → 不发交易帖，走新闻管道（此处不产 social）。

产信号的两种命中（均为「字面命中」，绝不臆造）：
  1) ticker 命中：推文里出现 $现金标签 或公司别名 → 绑定到具体 ticker（可上首页共识/分歧）。
  2) 市场主题命中：推文谈到关税 / 美联储 / 利率 / 通胀 / IPO / 加密 / 中美贸易等
     **可能影响股市**的宏观·政策·金融话题 → 产一条「无 ticker」的市场评论信号，
     只打主题标签（topics），不强行绑定某只股票。

无假数据原则：
  - 只对**字面命中**的 ticker / 主题产信号；纯无关内容（如电影宣传）直接丢弃。
  - 不臆测多空：sentiment 一律 'watch'（关注），原文链接为证。抓不到/缺 cookie → 空。
"""
import os
import re
import html
import json
import datetime as dt
import urllib.request
import urllib.parse
import urllib.error
from lib import safe, write_json, http_get
from config import PEOPLE_BY_ID, TICKERS

MAX_TICKERS_PER_POST = 4   # 一条推文最多产几条信号，防止「11 个 ticker → 11 张卡」刷屏

X_AUTH = os.environ.get("X_AUTH_TOKEN")
X_CT0 = os.environ.get("X_CT0")

# X 登录健康状态，供 run_all 写入 meta.json，前端据此提示「cookie 过期」。
#   unconfigured=未配置 cookie / ok=本次抓取成功 / expired=cookie 失效（需更新）
X_STATUS = "unconfigured"

# 展示时区：你在西雅图（太平洋时区）。X / Truth 的时间戳是 UTC，
#   直接对 UTC 取日期会比你在 X 上看到的本地日期差一天（如 7:31 PM PDT Jun 4 = 02:31 UTC Jun 5）。
#   统一换算到太平洋时区再取日期，确保与你看到的原帖时间一致。
try:
    from zoneinfo import ZoneInfo
    DISPLAY_TZ = ZoneInfo("America/Los_Angeles")
except Exception:  # noqa  极少数无 tzdata 环境兜底（夏令时 PDT=UTC-7；非完美但好过 UTC）
    DISPLAY_TZ = dt.timezone(dt.timedelta(hours=-7))


def _today_local():
    """太平洋时区「今天」——与帖子日期同口径，避免跨日 cutoff 误差。"""
    return dt.datetime.now(DISPLAY_TZ).date()


def _is_auth_error(exc):
    """判断异常是否为 X 登录失效（cookie 过期）而非普通网络/解析错误。"""
    if isinstance(exc, urllib.error.HTTPError) and exc.code in (401, 403):
        return True
    msg = str(exc).lower()
    return "authenticate" in msg or "unauthorized" in msg or "forbidden" in msg
# X 网页版公共 bearer（非私密；浏览器同样使用）
X_BEARER = ("AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs"
            "%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA")

# ticker 命中表：现金标签直接取；公司别名（小写、词边界）映射到 ticker。
# 只收录主流、歧义低的名字，避免误报（无假数据原则下宁缺毋滥）。
TICKER_ALIASES = {
    "NVDA": ["nvidia"], "AAPL": ["apple"], "TSLA": ["tesla"], "MRVL": ["marvell"],
    "BE": ["bloom energy"], "AVGO": ["broadcom"], "AMZN": ["amazon"],
    "GOOGL": ["alphabet"], "MSFT": ["microsoft"], "META": ["meta platforms"],
    "PLTR": ["palantir"], "AMD": ["advanced micro devices"],
    "MSTR": ["microstrategy"], "TSM": ["tsmc", "taiwan semiconductor"],
    "INTC": ["intel corp", "intel corporation"],  # 不用裸 "intel"：易误命中 "intel official"=情报官员
    "SMCI": ["supermicro", "super micro"], "BA": ["boeing"],
}
_CASHTAG = re.compile(r"\$([A-Za-z]{1,5})\b")
_VALID_CASHTAG = re.compile(r"^[A-Z]{1,5}$")

# 市场主题命中表：可能影响股市的宏观 / 政策 / 金融话题（字面命中关键词才打标签）。
#   面向 Trump / Musk 这类「多发宏观·政策、少发具体 ticker」的账号——
#   既不漏掉影响大盘的发言，又不编造它跟某只股票的因果。
#   关键词刻意收窄到「有市场含义」的词，避免把纯政治/八卦也算进来。
MARKET_TOPICS = {
    "关税/贸易": ["tariff", "tariffs", "trade war", "trade deal", "trade agreement",
                  "trade deficit", "import tax", "customs duty"],
    "美联储/利率": ["federal reserve", "the fed", "interest rate", "interest rates",
                    "rate cut", "rate hike", "jerome powell", "powell", "monetary policy"],
    "通胀": ["inflation", "cpi", "consumer price"],
    "大盘/宏观": ["stock market", "stock markets", "s&p 500", "s&p500", "nasdaq",
                  "dow jones", "all-time high", "record high", "market crash",
                  "recession", "bear market", "bull market", "soft landing"],
    "经济数据": ["jobs report", "unemployment rate", "gdp", "nonfarm", "payrolls"],
    "加密": ["bitcoin", "ethereum", "cryptocurrency", "stablecoin", "btc", "crypto"],
    "能源/油价": ["oil price", "crude oil", "opec", "gas prices", "gasoline price"],
    "AI/芯片": ["artificial intelligence", "semiconductor", "chips act", "chip act",
                "export control", "data center", "a.i."],
    "财政/税收": ["tax cut", "tax cuts", "corporate tax", "income tax", "stimulus",
                  "debt ceiling", "government shutdown", "budget deficit"],
    "IPO/财报": ["ipo", "earnings report", "quarterly earnings"],
    "中美/制裁": ["china trade", "sanction", "sanctions", "export ban", "chips to china"],
}


def _match_tickers(text):
    """从推文文本里抽取命中的 ticker 集合（现金标签 + 公司别名）。"""
    found = set()
    for m in _CASHTAG.findall(text):
        u = m.upper()
        if _VALID_CASHTAG.match(u):
            found.add(u)
    low = text.lower()
    for tk, names in TICKER_ALIASES.items():
        if any(re.search(rf"\b{re.escape(n)}\b", low) for n in names):
            found.add(tk)
    # 优先保留你跟踪的 ticker，其余按字母序；每条推文最多取 MAX_TICKERS_PER_POST 个
    tracked = set(TICKERS)
    ordered = sorted(found, key=lambda t: (t not in tracked, t))
    return ordered[:MAX_TICKERS_PER_POST]


def _match_topics(text):
    """抽取推文命中的市场主题标签（字面命中关键词），用于无 ticker 的市场评论信号。"""
    low = text.lower()
    hits = []
    for label, kws in MARKET_TOPICS.items():
        if any(re.search(rf"\b{re.escape(k)}\b", low) for k in kws):
            hits.append(label)
    return hits


# ---------------- X (Twitter) ----------------

def _x_headers():
    return {
        "Authorization": "Bearer " + X_BEARER,
        "x-csrf-token": X_CT0,
        "x-twitter-auth-type": "OAuth2Session",
        "x-twitter-active-user": "yes",
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        "Cookie": f"auth_token={X_AUTH}; ct0={X_CT0}",
    }


def _x_get(path, variables, features):
    url = (f"https://x.com/i/api/graphql/{path}"
           f"?variables={urllib.parse.quote(json.dumps(variables))}"
           f"&features={urllib.parse.quote(json.dumps(features))}")
    req = urllib.request.Request(url, headers=_x_headers())
    with urllib.request.urlopen(req, timeout=25) as r:
        return json.loads(r.read().decode("utf-8", "replace"))


_USER_FEAT = {
    "hidden_profile_likes_enabled": True, "hidden_profile_subscriptions_enabled": True,
    "responsive_web_graphql_exclude_directive_enabled": True, "verified_phone_label_enabled": False,
    "subscriptions_verification_info_is_identity_verified_enabled": True,
    "subscriptions_verification_info_verified_since_enabled": True,
    "highlights_tweets_tab_ui_enabled": True, "responsive_web_twitter_article_notes_tab_enabled": True,
    "creator_subscriptions_tweet_preview_api_enabled": True,
    "responsive_web_graphql_skip_user_profile_image_extensions_enabled": False,
    "responsive_web_graphql_timeline_navigation_enabled": True,
}
_TWEET_FEAT = {
    "rweb_tipjar_consumption_enabled": True, "responsive_web_graphql_exclude_directive_enabled": True,
    "verified_phone_label_enabled": False, "creator_subscriptions_tweet_preview_api_enabled": True,
    "responsive_web_graphql_timeline_navigation_enabled": True,
    "responsive_web_graphql_skip_user_profile_image_extensions_enabled": False,
    "communities_web_enable_tweet_community_results_fetch": True,
    "c9s_tweet_anatomy_moderator_badge_enabled": True, "articles_preview_enabled": True,
    "responsive_web_edit_tweet_api_enabled": True,
    "graphql_is_translatable_rweb_tweet_is_translatable_enabled": True,
    "view_counts_everywhere_api_enabled": True, "longform_notetweets_consumption_enabled": True,
    "responsive_web_twitter_article_tweet_consumption_enabled": True,
    "tweet_awards_web_tipping_enabled": False,
    "creator_subscriptions_quote_tweet_preview_enabled": False,
    "freedom_of_speech_not_reach_fetch_enabled": True, "standardized_nudges_misinfo": True,
    "tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled": True,
    "rweb_video_timestamps_enabled": True, "longform_notetweets_rich_text_read_enabled": True,
    "longform_notetweets_inline_media_enabled": True, "responsive_web_enhance_cards_enabled": False,
}


def _x_user_id(handle):
    d = _x_get("G3KGOASz96M-Qu0nwmGXNg/UserByScreenName",
               {"screen_name": handle, "withSafetyModeUserFields": True}, _USER_FEAT)
    return d["data"]["user"]["result"]["rest_id"]


def _x_tweets_raw(uid, count=20):
    """拉时间线，产出每条推文的原始 (res, leg)，供上层各取所需（文本 / 文章 / 媒体）。"""
    d = _x_get("E3opETHurmVJflFsUBVuUQ/UserTweets",
               {"userId": uid, "count": count, "includePromotedContent": False,
                "withQuickPromoteEligibilityTweetFields": True, "withVoice": True,
                "withV2Timeline": True}, _TWEET_FEAT)
    insts = d["data"]["user"]["result"]["timeline_v2"]["timeline"]["instructions"]
    out = []
    for inst in insts:
        for e in inst.get("entries", []):
            c = e.get("content", {})
            if c.get("entryType") != "TimelineTimelineItem":
                continue
            res = c.get("itemContent", {}).get("tweet_results", {}).get("result", {})
            if res.get("__typename") == "TweetWithVisibilityResults":
                res = res.get("tweet", {})
            leg = res.get("legacy", {})
            if not leg:
                continue
            out.append({"res": res, "leg": leg})
    return out


def _x_tweets(uid, count=20):
    out = []
    for tw in _x_tweets_raw(uid, count):
        res, leg = tw["res"], tw["leg"]
        text = (leg.get("full_text") or "").strip()
        note = (res.get("note_tweet", {}).get("note_tweet_results", {})
                .get("result", {}).get("text"))
        if note:
            text = note.strip()
        text = html.unescape(text)   # &gt; &amp; → > & 等，避免原文显示转义实体
        out.append({"id": leg.get("id_str"), "text": text,
                    "created": leg.get("created_at", "")})
    return out


def _parse_created(s):
    """X 时间 'Wed Jun 04 19:14:00 +0000 2026'(UTC) → 太平洋时区日期（与你在 X 上看到的一致）。"""
    try:
        utc = dt.datetime.strptime(s, "%a %b %d %H:%M:%S %z %Y")
        return utc.astimezone(DISPLAY_TZ).date().isoformat()
    except Exception:
        return ""


def fetch_x(pid, handle, days=7):
    """拉某 X 账号最近 days 天的【全部原创帖】→ social 信号（不再只保留命中 ticker/主题的）。

    你的要求：像 Serenity 这类影响者，展示其最近 7 天的所有原创发帖（含未命中关注标的的，
    如 A 股 LeaderDrive 推介），而非只挑 8 条。仍遵守无假数据原则：只用原文，绝不臆测多空
    （sentiment 一律 'watch'，原文链接为证）。
      - 命中 ticker：照旧每个 ticker 一条（驱动首页「共识 / 分歧」）。
      - 仅命中市场主题：打主题标签的「无 ticker」信号。
      - 两者都没命中：仍产一条「无 ticker」原创帖信号（这就是用户想看到的「全部发帖」）。
    转推(RT) / 纯图片无正文 → 跳过（非本人内容 / 无可读文本）。
    """
    if not (X_AUTH and X_CT0):
        raise RuntimeError("缺 X_AUTH_TOKEN / X_CT0")
    uid = _x_user_id(handle)
    cutoff = _today_local() - dt.timedelta(days=days)
    out = []
    for tw in _x_tweets(uid, count=40):   # 拉够 7 天的量（无硬性条数上限）
        text = tw["text"]
        if text.startswith("RT @"):   # 转推不算本人内容
            continue
        if not text:                  # 纯图片/纯链接、无正文 → 无可读内容，跳过
            continue
        date = _parse_created(tw["created"])
        if date and dt.date.fromisoformat(date) < cutoff:
            continue
        tickers = _match_tickers(text)
        topics = _match_topics(text)
        asof = date or _today_local().isoformat()
        post = f"https://x.com/{handle}/status/{tw['id']}"
        base = {"personId": pid, "type": "social", "asOf": asof,
                "sentiment": "watch",   # 不臆测多空，只标「关注」，原文为证
                "excerpt": text[:240], "postUrl": post}
        if tickers:
            # 命中具体 ticker：每个 ticker 一条（已按「跟踪优先」排序并截断）；附带主题供上下文
            for tk in tickers:
                out.append({**base, "ticker": tk, "topics": topics})
        else:
            # 无 ticker（无论是否命中主题）：产一条原创帖信号，附带命中的主题标签（可能为空）
            out.append({**base, "ticker": "", "topics": topics})
    return out


# ---------------- Truth Social（经 trumpstruth.org 公开 RSS 镜像） ----------------

_HTML_TAG = re.compile(r"<[^>]+>")


def _strip_html(s):
    """RSS description 里的 <p>…</p> → 纯文本（去标签 + 解码实体 + 合并空白）。"""
    txt = _HTML_TAG.sub(" ", s or "")
    txt = html.unescape(txt)
    return re.sub(r"\s+", " ", txt).strip()


def _parse_rfc822(s):
    """RSS pubDate 'Fri, 05 Jun 2026 03:36:12 +0000'(UTC) → 太平洋时区日期（与原帖一致）。"""
    for fmt in ("%a, %d %b %Y %H:%M:%S %z", "%a, %d %b %Y %H:%M:%S %Z"):
        try:
            d = dt.datetime.strptime(s.strip(), fmt)
            return d.astimezone(DISPLAY_TZ).date().isoformat()
        except Exception:
            continue
    return ""


def fetch_truth_rss(pid, url, days=30, limit=8):
    """从 trumpstruth.org RSS 镜像拉某人的 Truth Social 帖 → social 信号。

    与 fetch_x 同款「字面命中」逻辑：只对命中 ticker / 市场主题的帖产信号，
    sentiment 一律 'watch'，postUrl 指向 Truth Social 原帖（item.originalUrl）。
    纯图片 / 无正文 / 不相关的帖直接丢弃（无假数据原则）。
    """
    import xml.etree.ElementTree as ET
    raw = http_get(url, headers={"User-Agent": "Mozilla/5.0"}, timeout=20)
    root = ET.fromstring(raw)
    cutoff = _today_local() - dt.timedelta(days=days)
    out = []
    for it in root.findall(".//item"):
        desc = it.findtext("description") or ""
        text = _strip_html(desc)
        if not text:                       # [No Title] 类纯媒体帖，无正文
            continue
        date = _parse_rfc822(it.findtext("pubDate") or "")
        if date and dt.date.fromisoformat(date) < cutoff:
            continue
        tickers = _match_tickers(text)
        topics = _match_topics(text)
        if not tickers and not topics:     # 既没 ticker 也没市场主题 → 纯政治/八卦，丢弃
            continue
        # 原帖永久链接：优先 Truth Social 原文（originalUrl，可能带命名空间），回落到镜像页
        orig = ""
        for ch in it:
            if ch.tag.split("}")[-1] == "originalUrl" and (ch.text or "").strip():
                orig = ch.text.strip()
                break
        if not orig:
            orig = (it.findtext("link") or "").strip()
        asof = date or _today_local().isoformat()
        base = {"personId": pid, "type": "social", "asOf": asof,
                "sentiment": "watch", "excerpt": text[:240], "postUrl": orig}
        if tickers:
            for tk in tickers:
                out.append({**base, "ticker": tk, "topics": topics})
        else:
            out.append({**base, "ticker": "", "topics": topics})
        if len(out) >= limit:
            break
    return out


def _truth_people():
    """config 里配了 truth_rss 的跟踪对象 → [(pid, rss_url)]。"""
    out = []
    for pid, p in PEOPLE_BY_ID.items():
        rss = p.get("truth_rss")
        if rss:
            out.append((pid, rss))
    return out


def _x_people():
    """config 里所有 social.platform=='x' 且有 handle 的跟踪对象 → [(pid, handle)]。"""
    out = []
    for pid, p in PEOPLE_BY_ID.items():
        soc = p.get("social") or {}
        if soc.get("platform") == "x" and soc.get("handle"):
            out.append((pid, soc["handle"]))
    return out


# ---------------- X 文章流（猫笔刀等「在 X 上每日发文」的来源） ----------------

_TCO = re.compile(r"https://t\.co/\S+")


def _clean_post_text(leg, res):
    """取推文正文（优先 note_tweet 长文），去掉末尾 t.co 短链，解码 HTML 实体。"""
    text = (leg.get("full_text") or "")
    note = (res.get("note_tweet", {}).get("note_tweet_results", {})
            .get("result", {}).get("text"))
    if note:
        text = note
    text = _TCO.sub("", text).strip()
    return html.unescape(text)


def fetch_x_articles(handle, days=21, limit=30):
    """把某 X 账号的「文章 + 原创短帖」抓成文章流（NewsItem 形状），用于来源页。

    与 fetch_x（产 ticker 信号）不同：这里**不解析 ticker、不产信号**，只做内容流——
    标题 + 摘要 + 原文链接，对应前端「公众号文章流」区块。
      - X Article（长文，x.com/i/article/…）→ 标题取文章标题，摘要取 preview_text。
      - 原创短帖（有正文）→ 标题取首行，摘要取正文。
      - 转推（RT）/ 纯链接无正文 → 跳过（不是本人内容 / 无可读文本）。
    """
    if not (X_AUTH and X_CT0):
        raise RuntimeError("缺 X_AUTH_TOKEN / X_CT0")
    uid = _x_user_id(handle)
    cutoff = _today_local() - dt.timedelta(days=days)
    out = []
    for tw in _x_tweets_raw(uid, count=40):
        res, leg = tw["res"], tw["leg"]
        full = leg.get("full_text") or ""
        if full.startswith("RT @"):          # 转推不是本人内容
            continue
        date = _parse_created(leg.get("created_at", ""))
        if date and dt.date.fromisoformat(date) < cutoff:
            continue
        tid = leg.get("id_str")
        url = f"https://x.com/{handle}/status/{tid}"
        art = (res.get("article", {}).get("article_results", {}).get("result", {}))
        if art and art.get("title"):
            title = html.unescape(art["title"].strip())
            summary = html.unescape((art.get("preview_text") or "").strip())[:200]
        else:
            text = _clean_post_text(leg, res)
            if not text:                      # 纯图片/纯链接、无正文 → 跳过
                continue
            first = text.split("\n", 1)[0].strip()
            title = first[:42] + ("…" if len(first) > 42 else "")
            summary = text[:200]
        out.append({
            "id": f"mbd-{tid}", "title": title or "（无标题）",
            "source": f"猫笔刀 · X @{handle}", "publishedAt": date or "",
            "url": url, "tags": ["猫笔刀"], "summary": summary,
        })
        if len(out) >= limit:
            break
    return out


def run():
    global X_STATUS
    sigs = []

    # 1) Truth Social（trumpstruth.org RSS 镜像）—— 无需 cookie，独立于 X 健康
    for pid, rss in _truth_people():       # Trump
        try:
            got = fetch_truth_rss(pid, rss)
            sigs += got
            print(f"  Truth Social @{pid}: {len(got)} 条信号", flush=True)
        except Exception as e:  # noqa
            print(f"  [warn] Truth RSS ({pid}) 失败：{e} → 跳过", flush=True)

    # 2) X 网页版（cookie 登录）—— Musk / Serenity
    if not (X_AUTH and X_CT0):
        X_STATUS = "unconfigured"
        return sigs

    X_STATUS = "ok"  # 乐观初值；遇到鉴权失败则置为 expired
    for pid, handle in _x_people():   # Musk / Serenity（Trump 已改走 Truth Social）
        try:
            sigs += fetch_x(pid, handle)
        except Exception as e:  # noqa
            if _is_auth_error(e):
                X_STATUS = "expired"
                print(f"  [warn] X cookie 失效（{pid}）：{e} → 社交信号暂停，请更新 cookie",
                      flush=True)
            else:
                print(f"  [warn] X timeline ({pid}) 失败：{e} → 用兜底", flush=True)
    return sigs


if __name__ == "__main__":
    write_json("signals_social.json", run())
