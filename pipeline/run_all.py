"""管道总入口：抓取 → 组装 → 写 public/data/*.json（前端只读这些）。

用法：
  python run_all.py            # 真实抓取（缺源/密钥的步骤回落为「空」，不编造数据）
  python run_all.py --mock     # 仅用于验证管道结构（不写到生产）

无假数据原则：任何抓不到的数据一律为空/「—」，绝不用占位/编造值。
输出（与前端 src/data/types.ts 对应）：
  people.json  signals.json  news.json  articles.json  ipos.json
  events.json  tradeplan.json  market.json  meta.json  stocks/{T}.json  prices/{T}.json
"""
import datetime as dt
from lib import write_json, MOCK, TODAY
from config import PEOPLE, TICKERS, TICKER_META, PEOPLE_BY_ID
import fetch_13f, fetch_congress, fetch_social, fetch_prices, fetch_market
import fetch_news, fetch_ipos, fetch_fundamentals, fetch_fx, fetch_statements
import fetch_market_hist
import gen_ai


def pct(a, b):
    return round((a - b) / b * 100, 1) if b else 0.0


def build_stock(ticker, price_obj, fund, tnews, signals, ai):
    meta = TICKER_META.get(ticker, {"name": ticker, "exchange": "—", "sector": "—"})
    bars = price_obj["bars"] if price_obj else []
    last = price_obj["price"] if price_obj else (bars[-1]["c"] if bars else 0)
    c5 = bars[-6]["c"] if len(bars) > 6 else (bars[-1]["c"] if bars else last)
    cytd = bars[0]["c"] if bars else last
    return {
        "ticker": ticker, "name": meta["name"], "exchange": meta["exchange"],
        "sector": meta["sector"], "price": round(last, 2),
        "change5dPct": pct(last, c5), "changeYtdPct": pct(last, cytd),
        **fund, "prices": bars, "thesis": ai, "news": tnews,
    }


def main():
    mode = "MOCK 结构验证" if MOCK else "真实抓取（缺源回落为空）"
    print(f"== 数据管道开始 · {mode} · {TODAY} ==")

    print("[1/8] 13F 持仓…");      s13 = fetch_13f.run()
    print("[2/8] Congress…");      sc = fetch_congress.run()
    print("[3/8] 社交/言论…");     ss = fetch_social.run()
    print("[3b] Jensen 言论…");    sj = fetch_statements.run()
    print("[4/8] 股价…");          prices = fetch_prices.run()
    print("[5/8] 大盘…");          market = fetch_market.run()
    print("[5b] 汇率历史…");        fx = fetch_fx.run()
    print("[5c] 大盘/商品历史…");   mkt = fetch_market_hist.run()
    print("[6/8] 新闻/公众号…");   news, ticker_news, articles = fetch_news.run()

    # 猫笔刀：优先用 X 文章号（mooomoocat，每日同步发文）→ 覆盖 fetch_news 的空 RSS 结果。
    #   走已有 X cookie 通道；鉴权失败则同样置 X_STATUS=expired，触发前端「cookie 过期」提示。
    mbd_handle = (PEOPLE_BY_ID.get("maobidao") or {}).get("x_handle")
    if mbd_handle and not MOCK:
        try:
            articles["maobidao"] = fetch_social.fetch_x_articles(mbd_handle)
            print(f"    猫笔刀 X 文章：{len(articles['maobidao'])} 篇", flush=True)
        except Exception as e:  # noqa
            if fetch_social._is_auth_error(e):
                fetch_social.X_STATUS = "expired"
            print(f"  [warn] 猫笔刀 X 文章抓取失败：{e}", flush=True)
            articles.setdefault("maobidao", [])

    print("[7/8] IPO…");           ipos = fetch_ipos.run()
    print("[7b] 基本面…");          funds = fetch_fundamentals.run()

    signals = s13 + sc + ss + sj
    write_json("people.json", PEOPLE)
    write_json("signals.json", signals)
    write_json("articles.json", articles)
    write_json("ipos.json", ipos)
    write_json("market.json", market)  # 抓不到则为 []，前端隐藏
    for code, payload in fx.items():    # 汇率 5 年日线 → 前端右栏迷你图按区间切片
        write_json(f"fx/{code}.json", payload)
    for code, payload in mkt.items():   # 大盘/商品 5 年日线 → 同款迷你图
        write_json(f"mkt/{code}.json", payload)

    print("[8/8] AI 分析 + 组装股票…")
    all_news = list(news)   # 全局新闻流（前端 News/Briefing）= 各 ticker 真实新闻汇总
    index = []
    for t in TICKERS:
        po = prices.get(t)
        write_json(f"prices/{t}.json", po["bars"] if po else [])
        tsigs = [s for s in signals if s.get("ticker") == t]
        tnews = ticker_news.get(t, [])
        fund = funds.get(t, {"marketCap": "—", "pe": None, "revenue": "—", "revenueYoYPct": None})
        ai = gen_ai.run(t, TICKER_META.get(t, {}).get("name", t), tsigs, news)
        stock = build_stock(t, po, fund, tnews, tsigs, ai)
        write_json(f"stocks/{t}.json", stock)
        index.append({k: stock[k] for k in
                      ("ticker", "name", "exchange", "sector", "price", "change5dPct", "changeYtdPct")})
    write_json("news.json", all_news)
    write_json("stocks_index.json", index)

    # 事件：暂无可靠的免费日历源 → 空（不编造）。后续接入真实财经日历再补。
    events = []
    write_json("events.json", events)

    # 明日交易计划：催化剂取真实事件（现为空）；待办/草案不编造 → 空，前端显示空状态。
    write_json("tradeplan.json", {
        "forDate": (TODAY + dt.timedelta(days=1)).isoformat(),
        "generatedAt": dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "model": gen_ai.MODEL if not MOCK and gen_ai.active() else "claude-mock",
        "catalysts": events,
        "pendingSignals": [],
        "draftActions": [],
    })
    # 猫笔刀新鲜度：他几乎每天发文，≥2 天无新帖 → 视为异常（cookie 失效 / 账号更名 / 停更），
    #   前端据此弹「该提醒你了」横幅。抓不到任何文章也按异常处理。
    mbd_dates = sorted({a["publishedAt"][:10] for a in articles.get("maobidao", [])
                        if a.get("publishedAt")}, reverse=True)
    mbd_last = mbd_dates[0] if mbd_dates else None
    mbd_days = (TODAY - dt.date.fromisoformat(mbd_last)).days if mbd_last else None
    mbd_stale = (mbd_days is None) or (mbd_days >= 2)

    write_json("meta.json", {
        "generatedAt": dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "mode": "mock" if MOCK else "live",
        "sources": {
            "13f": "SEC EDGAR", "congress": "House Clerk 官方披露",
            "social": "X 网页版（cookie 登录）", "prices": "Yahoo Finance",
            "market": "Yahoo Finance", "news": "Finnhub + 猫笔刀(X)",
            "ipos": "Finnhub", "fundamentals": "Finnhub", "ai": gen_ai.MODEL,
        },
        "tickers": list(TICKERS),
        # 数据源健康：前端据此提示（X 登录 cookie 过期、猫笔刀停更等）
        "health": {
            "x": fetch_social.X_STATUS,   # unconfigured | ok | expired
            "checkedAt": dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "maobidao": {"lastPost": mbd_last, "daysSince": mbd_days, "stale": mbd_stale},
        },
        "counts": {"people": len(PEOPLE), "signals": len(signals),
                   "news": len(all_news), "ipos": len(ipos), "stocks": len(TICKERS)},
        "disclaimer": "AI 分析基于公开数据生成，非投资建议。13F 有 ~45 天延迟。无真实来源的数据均留空。",
    })
    print("== 完成。前端可读 public/data/*.json ==")


if __name__ == "__main__":
    main()
