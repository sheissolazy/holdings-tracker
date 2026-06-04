"""社交喊单 → social 信号（Musk / Serenity via X，Trump via Truth Social）。

「第三条路」：非付费 API、非手动。
  - Musk / Serenity → X 网页版 GraphQL，带【你自己的登录 cookie】(X_AUTH_TOKEN / X_CT0)
        UserByScreenName 解析 handle→id，再 UserTweets 拉最近推文。零成本、脆弱、有账号风险。
  - Trump → Truth Social（Mastodon 兼容）公开 API，免登录 lookup + statuses。
  - 黄仁勋 → 不发交易帖，走新闻管道（此处不产 social）。

无假数据原则：
  - 只在推文里**确实命中**某个 ticker（$ 现金标签 或 公司别名）时才产信号，绝不臆造关联。
  - 不臆测多空：sentiment 一律 'watch'（关注），原文链接为证。抓不到/缺 cookie → 空。
"""
import os
import re
import json
import datetime as dt
import urllib.request
import urllib.parse
import urllib.error
from lib import safe, write_json
from config import PEOPLE_BY_ID, TICKERS

MAX_TICKERS_PER_POST = 4   # 一条推文最多产几条信号，防止「11 个 ticker → 11 张卡」刷屏

X_AUTH = os.environ.get("X_AUTH_TOKEN")
X_CT0 = os.environ.get("X_CT0")

# X 登录健康状态，供 run_all 写入 meta.json，前端据此提示「cookie 过期」。
#   unconfigured=未配置 cookie / ok=本次抓取成功 / expired=cookie 失效（需更新）
X_STATUS = "unconfigured"


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
    "INTC": ["intel"], "SMCI": ["supermicro", "super micro"], "BA": ["boeing"],
}
_CASHTAG = re.compile(r"\$([A-Za-z]{1,5})\b")
_VALID_CASHTAG = re.compile(r"^[A-Z]{1,5}$")


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


def _x_tweets(uid, count=20):
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
            text = (leg.get("full_text") or "").strip()
            note = (res.get("note_tweet", {}).get("note_tweet_results", {})
                    .get("result", {}).get("text"))
            if note:
                text = note.strip()
            out.append({"id": leg.get("id_str"), "text": text,
                        "created": leg.get("created_at", "")})
    return out


def _parse_created(s):
    """X 时间 'Wed Jun 04 19:14:00 +0000 2026' → ISO 日期。"""
    try:
        return dt.datetime.strptime(s, "%a %b %d %H:%M:%S %z %Y").date().isoformat()
    except Exception:
        return ""


def fetch_x(pid, handle, days=30, limit=8):
    if not (X_AUTH and X_CT0):
        raise RuntimeError("缺 X_AUTH_TOKEN / X_CT0")
    uid = _x_user_id(handle)
    cutoff = dt.date.today() - dt.timedelta(days=days)
    out = []
    for tw in _x_tweets(uid):
        text = tw["text"]
        if text.startswith("RT @"):   # 转推不算本人喊单
            continue
        date = _parse_created(tw["created"])
        if date and dt.date.fromisoformat(date) < cutoff:
            continue
        tickers = _match_tickers(text)
        if not tickers:
            continue
        for tk in tickers:  # 已按「跟踪优先」排序并截断
            out.append({
                "personId": pid, "type": "social", "ticker": tk,
                "asOf": date or dt.date.today().isoformat(),
                "sentiment": "watch",   # 不臆测多空，只标「关注」，原文为证
                "excerpt": text[:240],
                "postUrl": f"https://x.com/{handle}/status/{tw['id']}",
            })
        if len(out) >= limit:
            break
    return out


# ---------------- Truth Social (Trump) ----------------

def fetch_trump(handle="realDonaldTrump", days=30, limit=8):
    ua = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
          "Accept": "application/json"}
    look = urllib.request.Request(
        f"https://truthsocial.com/api/v1/accounts/lookup?acct={handle}", headers=ua)
    with urllib.request.urlopen(look, timeout=25) as r:
        acct = json.loads(r.read().decode("utf-8", "replace"))
    aid = acct["id"]
    st = urllib.request.Request(
        f"https://truthsocial.com/api/v1/accounts/{aid}/statuses?limit=20&exclude_replies=true",
        headers=ua)
    with urllib.request.urlopen(st, timeout=25) as r:
        posts = json.loads(r.read().decode("utf-8", "replace"))
    cutoff = dt.date.today() - dt.timedelta(days=days)
    out = []
    for p in posts:
        text = re.sub(r"<[^>]+>", " ", p.get("content") or "").strip()
        text = re.sub(r"\s+", " ", text)
        date = (p.get("created_at") or "")[:10]
        if date and dt.date.fromisoformat(date) < cutoff:
            continue
        tickers = _match_tickers(text)
        if not tickers:
            continue
        for tk in tickers:  # 已按「跟踪优先」排序并截断
            out.append({
                "personId": "trump", "type": "social", "ticker": tk,
                "asOf": date or dt.date.today().isoformat(), "sentiment": "watch",
                "excerpt": text[:240], "postUrl": p.get("url") or "",
            })
        if len(out) >= limit:
            break
    return out


def run():
    global X_STATUS
    sigs = []
    sigs += safe(fetch_trump, "Truth Social (Trump)", lambda: [])

    if not (X_AUTH and X_CT0):
        X_STATUS = "unconfigured"
        return sigs

    X_STATUS = "ok"  # 乐观初值；遇到鉴权失败则置为 expired
    for pid in ("musk", "serenity"):
        p = PEOPLE_BY_ID.get(pid) or {}
        handle = (p.get("social") or {}).get("handle")
        if not handle:
            continue
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
