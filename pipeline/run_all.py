"""管道总入口：抓取 → 组装 → 写 public/data/*.json（前端只读这些）。

用法：
  python run_all.py            # 真实抓取（缺源/密钥的步骤自动回落兜底，不中断）
  python run_all.py --mock     # 全程兜底数据，验证管道与 JSON 结构

输出（与前端 src/data/types.ts 对应）：
  people.json  signals.json  news.json  articles.json  ipos.json
  events.json  tradeplan.json  meta.json  stocks/{T}.json  prices/{T}.json
"""
import datetime as dt
from lib import write_json, MOCK, TODAY
from config import PEOPLE, TICKERS, TICKER_META
import fetch_13f, fetch_congress, fetch_social, fetch_prices, fetch_news, fetch_ipos
import gen_ai

# 关注标的的兜底基本面（真实可由财报 API 补全）
FUNDAMENTALS = {
    "NVDA": {"marketCap": "$2.41T", "pe": 48.2, "revenue": "$130.5B", "revenueYoYPct": 78},
    "MRVL": {"marketCap": "$76.2B", "pe": 39.7, "revenue": "$6.1B", "revenueYoYPct": 34},
    "BE":   {"marketCap": "$31.0B", "pe": None, "revenue": "$1.6B", "revenueYoYPct": 27},
    "AAPL": {"marketCap": "$3.15T", "pe": 32.1, "revenue": "$391B", "revenueYoYPct": 4},
    "SMH":  {"marketCap": "—", "pe": None, "revenue": "—", "revenueYoYPct": 0},
}


def pct(a, b):
    return round((a - b) / b * 100, 1) if b else 0.0


def build_stock(ticker, bars, signals, ai):
    meta = TICKER_META.get(ticker, {"name": ticker, "exchange": "—", "sector": "—"})
    fund = FUNDAMENTALS.get(ticker, {"marketCap": "—", "pe": None, "revenue": "—", "revenueYoYPct": 0})
    last = bars[-1]["c"] if bars else 0
    c5 = bars[-6]["c"] if len(bars) > 6 else last
    cytd = bars[0]["c"] if bars else last
    tnews = [{"id": f"{ticker}-n{i}", "title": t, "source": s, "publishedAt": d,
              "url": "#", "tags": [ticker, tag]}
             for i, (t, s, d, tag) in enumerate([
                 (f"{ticker} 季度业绩超预期，数据中心营收创新高", "Reuters", "2026-05-30", "财报"),
                 (f"分析师上调 {ticker} 目标价", "Bloomberg", "2026-05-28", "评级"),
                 (f"{ticker} 与超大规模厂商签订多年供应协议", "WSJ", "2026-05-25", "合作"),
             ], 1)]
    return {
        "ticker": ticker, "name": meta["name"], "exchange": meta["exchange"],
        "sector": meta["sector"], "price": round(last, 2),
        "change5dPct": pct(last, c5), "changeYtdPct": pct(last, cytd),
        **fund, "prices": bars, "thesis": ai, "news": tnews,
    }


def main():
    mode = "MOCK 兜底" if MOCK else "真实抓取（失败步骤自动回落）"
    print(f"== 数据管道开始 · {mode} · {TODAY} ==")

    print("[1/7] 13F 持仓…");      s13 = fetch_13f.run()
    print("[2/7] Congress…");      sc = fetch_congress.run()
    print("[3/7] 社交/言论…");     ss = fetch_social.run()
    print("[4/7] 股价…");          prices = fetch_prices.run()
    print("[5/7] 新闻/公众号…");   news, articles = fetch_news.run()
    print("[6/7] IPO…");           ipos = fetch_ipos.run()

    signals = s13 + sc + ss
    write_json("people.json", PEOPLE)
    write_json("signals.json", signals)
    write_json("articles.json", articles)
    write_json("ipos.json", ipos)
    # 大盘速览（真实可由指数 API 补全，现为兜底）
    write_json("market.json", [
        {"label": "SPY", "value": "548.2", "chg": "+0.4%", "pos": True},
        {"label": "Gold", "value": "$2,418", "chg": "+0.9%", "pos": True},
        {"label": "10Y Yield", "value": "4.31%", "chg": "-3bp", "pos": False},
    ])

    print("[7/7] AI 分析 + 组装股票…")
    all_news = list(news)  # 全局新闻流 = 头条 + 各标的新闻（前端 News/Briefing 读它）
    index = []              # 轻量股票索引（前端搜索/列表用，不含 prices/thesis）
    for t in TICKERS:
        bars = prices.get(t, [])
        write_json(f"prices/{t}.json", bars)
        tsigs = [s for s in signals if s.get("ticker") == t]
        ai = gen_ai.run(t, TICKER_META.get(t, {}).get("name", t), tsigs, news)
        stock = build_stock(t, bars, tsigs, ai)
        write_json(f"stocks/{t}.json", stock)
        all_news += stock["news"]
        index.append({k: stock[k] for k in
                      ("ticker", "name", "exchange", "sector", "price", "change5dPct", "changeYtdPct")})
    write_json("news.json", all_news)
    write_json("stocks_index.json", index)

    # 事件 / 明日交易计划
    events = [
        {"date": "2026-06-02", "label": "MRVL 财报（盘后）", "kind": "earnings", "impact": "high", "tickers": ["MRVL"]},
        {"date": "2026-06-02", "label": "ISM 制造业 PMI", "kind": "econ", "impact": "med"},
        {"date": "2026-06-03", "label": "FOMC 会议纪要", "kind": "econ", "impact": "high"},
        {"date": "2026-06-04", "label": "Cerebras IPO 定价", "kind": "ipo", "impact": "med", "tickers": ["CBRS"]},
        {"date": "2026-06-05", "label": "非农就业（NFP）", "kind": "econ", "impact": "high"},
    ]
    write_json("events.json", events)
    write_json("tradeplan.json", {
        "forDate": "2026-06-02", "generatedAt": dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "model": gen_ai.MODEL if not MOCK and gen_ai.active() else "claude-mock",
        "catalysts": [e for e in events if e["date"] == "2026-06-02"],
        "pendingSignals": [
            {"personId": "serenity", "ticker": "MRVL", "note": "Serenity 喊单 MRVL，叠加黄仁勋背书 + 明日财报"},
            {"personId": "leopold", "ticker": "NVDA", "note": "Leopold 大额 NVDA put 仍在，半导体风向标"},
        ],
        "draftActions": [
            {"id": "a1", "action": "盯 MRVL 盘后财报，先不动", "reason": "三重催化但已涨 6%，避免追高"},
            {"id": "a2", "action": "关注 SMH/NVDA 板块方向", "reason": "财报外溢 + Leopold put 对冲情绪"},
            {"id": "a3", "action": "FOMC 纪要/非农前控制仓位", "reason": "本周宏观事件密集"},
            {"id": "a4", "action": "留意 Cerebras IPO 定价", "reason": "AI 芯片新股，板块情绪参考"},
        ],
    })
    write_json("meta.json", {
        "generatedAt": dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "mode": "mock" if MOCK else "live",
        "sources": {
            "13f": "SEC EDGAR", "congress": "house-stock-watcher",
            "social": "Truth Social / RSSHub", "prices": "stooq",
            "news": "RSS + Wechat2RSS", "ipos": "Finnhub", "ai": gen_ai.MODEL,
        },
        "tickers": list(TICKERS),
        "counts": {"people": len(PEOPLE), "signals": len(signals),
                   "news": len(all_news), "ipos": len(ipos), "stocks": len(TICKERS)},
        "disclaimer": "AI 分析基于公开数据生成，非投资建议。13F 有 ~45 天延迟；社交信号为最佳努力。",
    })
    print("== 完成。前端可读 public/data/*.json ==")


if __name__ == "__main__":
    main()
