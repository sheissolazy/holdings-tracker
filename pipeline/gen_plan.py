"""明日行动建议（确定性，基于真实价格历史 + 风险计 + 日历规则；不编造任何数字）。

数据现实（务必诚实）：
  - 13F 不披露成本价，只有股数/市值/占比/季度末日期 → 不能显示「某人的成本」。
  - 我们的期权信号没有行权价/到期日（13F 常不含）→ 不能显示「某人的 put 行权价」。
  - 暂无免费事件日历 → 不能把到期日挂到真实财报/FOMC。
所以「加仓位 / 卖出位 / put 行权价 / 到期」全部来自可核对的真实来源：
  · 加仓位 = 真实价格历史算出的支撑（近 30 日摆动低点 / 50 日均线）
  · 卖出位 = 真实价格历史算出的阻力（近 30 日摆动高点）
  · put 行权价 = 现价下方最近支撑
  · 到期 = 确定性日历规则（下一个月度 OPEX = 第三个周五，约 30–45 天）
  · 是否对冲 = 风险计（真实大盘数据）
  · 仓位 = 组合百分比（绝不编造美元数；具体金额由前端用户自填本地计算）
每条建议都带 basis[]（依据的真实数据点），并标注为体制/技术位参考、非买卖指令。
"""
from __future__ import annotations
import datetime as dt


# ---- 技术位：仅用真实价格 bars 计算（OHLC 日线）----
def _levels(bars: list[dict]) -> dict | None:
    if not bars or len(bars) < 20:
        return None
    closes = [b["c"] for b in bars]
    win = bars[-30:]
    support = round(min(b.get("l", b["c"]) for b in win), 2)   # 近 30 日摆动低点
    resistance = round(max(b.get("h", b["c"]) for b in win), 2)  # 近 30 日摆动高点
    ma50 = round(sum(closes[-50:]) / min(50, len(closes)), 2)
    return {"current": round(closes[-1], 2), "support": support,
            "resistance": resistance, "ma50": ma50}


# ---- 下一个月度期权到期日（第三个周五）：纯日历事实 ----
def next_opex(today: dt.date) -> str:
    def third_friday(y, m):
        d = dt.date(y, m, 1)
        # 第一个周五
        d += dt.timedelta(days=(4 - d.weekday()) % 7)
        return d + dt.timedelta(days=14)
    tf = third_friday(today.year, today.month)
    if (tf - today).days < 7:  # 太近 → 用下个月
        ny, nm = (today.year + (today.month == 12), today.month % 12 + 1)
        tf = third_friday(ny, nm)
    return tf.isoformat()


CHANGE_CN = {"new": "新建", "add": "加仓", "trim": "减仓", "exit": "清仓", "hold": "持平"}


def _holders(sigs: list[dict], people_by_id: dict) -> tuple[list[str], int]:
    """返回 (人读持有人摘要, 不同持有人数)。"""
    by_person: dict[str, dict] = {}
    for s in sigs:
        by_person.setdefault(s["personId"], s)
    parts = []
    for pid, s in by_person.items():
        name = (people_by_id.get(pid) or {}).get("name", pid)
        chg = CHANGE_CN.get(s.get("change") or "", "")
        parts.append(f"{name}{('·' + chg) if chg else ''}")
    return parts, len(by_person)


def run(signals: list[dict], prices: dict, risk: dict, people_by_id: dict,
        spx_bars: list[dict] | None, today: dt.date) -> dict:
    """signals: 全部信号；prices: {ticker: price_obj{bars}}；risk: gen_risk.run() 结果。"""
    opex = next_opex(today)
    suggestions: list[dict] = []

    # 只对「跟踪者真实多头持有」的票给技术位参考（13F / ptr-long / call）
    long_types = {"13f", "ptr", "options"}
    tickers = sorted({s["ticker"] for s in signals
                      if s.get("ticker") and s["type"] in long_types
                      and s.get("direction") not in ("put",)})

    for t in tickers:
        po = prices.get(t)
        bars = po.get("bars") if po else None
        lv = _levels(bars) if bars else None
        if not lv:
            continue
        tsigs = [s for s in signals if s.get("ticker") == t and s["type"] in long_types
                 and s.get("direction") not in ("put",)]
        holders, n = _holders(tsigs, people_by_id)
        cur, sup, res, ma50 = lv["current"], lv["support"], lv["resistance"], lv["ma50"]

        # 现价相对支撑/阻力的位置 → 决定建议类型
        near_sup = cur <= sup * 1.05
        near_res = cur >= res * 0.97
        kind = "add" if near_sup else ("trim" if near_res else "watch")
        conf = "high" if n >= 2 else "med"

        add_below = round(max(sup, min(ma50, cur)), 2)  # 加仓参考：支撑与 50 线中更贴近现价的
        if kind == "add":
            headline = f"{t} · 回踩加仓参考位"
            reason = (f"现价 ${cur} 已靠近支撑带 ${sup}（近 30 日低点）/ 50 日线 ${ma50}；"
                      f"如回踩 ${add_below} 附近可分批考虑。止损参考跌破 ${round(sup * 0.95, 2)}。")
        elif kind == "trim":
            headline = f"{t} · 逼近阻力减仓参考位"
            reason = (f"现价 ${cur} 逼近阻力 ${res}（近 30 日高点）；"
                      f"突破不站稳可考虑分批减仓，回踩 ${add_below} 再评估。")
        else:
            headline = f"{t} · 区间观察"
            reason = (f"现价 ${cur} 处于支撑 ${sup} 与阻力 ${res} 之间；"
                      f"回踩 ${add_below} 偏积极，逼近 ${res} 偏谨慎。")

        suggestions.append({
            "id": f"{t.lower()}-{kind}", "kind": kind, "ticker": t,
            "instrument": "stock", "refPrice": cur,
            "addBelow": add_below if kind != "trim" else None,
            "trimAbove": res if kind != "add" else None,
            "stop": round(sup * 0.95, 2),
            "confidence": conf, "headline": headline, "reason": reason,
            "basis": [
                f"{n} 位跟踪者 13F 持有：{'、'.join(holders)}",
                f"近 30 日支撑 ${sup} / 阻力 ${res} / 50 日线 ${ma50}（真实价格历史）",
                f"现价 ${cur}，距支撑 {round((cur - sup) / cur * 100, 1):+}% · 距阻力 {round((res - cur) / cur * 100, 1):+}%",
            ],
        })

    # 排序：加仓 > 观察 > 减仓，再按置信度
    order = {"add": 0, "watch": 1, "trim": 2, "hedge": -1}
    suggestions.sort(key=lambda s: (order.get(s["kind"], 9),
                                    {"high": 0, "med": 1, "low": 2}.get(s["confidence"], 9)))

    # ---- 对冲建议：仅当风险计为「偏高/高」时触发（现在低风险 → 不给，诚实）----
    if risk.get("available") and risk.get("level") in ("偏高", "高") and spx_bars:
        slv = _levels(spx_bars)
        if slv:
            strike = slv["support"]
            suggestions.insert(0, {
                "id": "hedge-spy-put", "kind": "hedge", "ticker": "SPY",
                "instrument": "put", "refPrice": slv["current"],
                "strike": strike, "expiration": opex, "sizingHint": "组合 1–3%",
                "confidence": "med",
                "headline": "对冲：买入 SPY Put（风险体制偏高）",
                "reason": (f"风险计为「{risk['level']}」。考虑买入 SPY Put 对冲：行权价 ≈ ${strike}"
                           f"（现价 ${slv['current']} 下方最近支撑），到期 {opex}（下一月度 OPEX）。"
                           f"仓位建议占组合 1–3%，按你自己的风险承受调整。"),
                "basis": [
                    f"风险计：{risk.get('label')}（{', '.join(i['name'] for i in risk.get('inputs', []) if i['contribution'] < 0) or '多项指标'}转弱）",
                    f"SPY 现价 ${slv['current']}，下方支撑 ${strike}（近 30 日低点）",
                    f"到期 {opex} 为确定性月度 OPEX（第三个周五）",
                ],
            })

    return {
        "model": "确定性技术位 + 风险计（无 AI、无编造）",
        "opex": opex,
        "suggestions": suggestions,
    }
