"""透明风险计（确定性，无 AI、无编造）。

仅用已抓到的真实大盘历史（fetch_market_hist 产出的 mkt/*.json：SPX/DXY/TNX/GOLD 5 年日线）
计算一个「风险体制」读数。每个输入都暴露：真实数值 + 对总分的贡献 + 人读说明，
让用户能自行核对，而不是给一个黑盒分数。

约定：贡献为正 = 偏「risk-on / 平静」，为负 = 偏「risk-off / 风险升高」。
风险等级 = 总分的反向映射。抓不到所需序列 → 返回 available=False，前端隐藏。
"""
from __future__ import annotations


def _closes(payload):
    return [b["c"] for b in (payload or {}).get("bars", []) if b.get("c") is not None]


def _ma(vals, n):
    return sum(vals[-n:]) / n if len(vals) >= n else None


def _chg_n(vals, n):
    """最近 n 个交易日的变化（绝对）。"""
    if len(vals) <= n:
        return None
    return vals[-1] - vals[-1 - n]


def _pct_n(vals, n):
    if len(vals) <= n or not vals[-1 - n]:
        return None
    return (vals[-1] - vals[-1 - n]) / vals[-1 - n] * 100


def run(mkt: dict, as_of: str) -> dict:
    """mkt: {code: {code,label,sym,kind,bars:[{t,c}]}}（fetch_market_hist.run() 的返回）。"""
    spx = _closes(mkt.get("SPX"))
    dxy = _closes(mkt.get("DXY"))
    tnx = _closes(mkt.get("TNX"))   # 收益率（%）

    inputs = []
    score = 0

    # 1) 趋势：标普 vs 50/200 日均线（最常用的趋势体制判断）
    if len(spx) >= 200:
        last = spx[-1]
        ma50, ma200 = _ma(spx, 50), _ma(spx, 200)
        above50, above200 = last >= ma50, last >= ma200
        c = (1 if above50 else -1) + (1 if above200 else -1)  # +2 / 0 / -2
        score += c
        if above50 and above200:
            val, note = "位于 50/200 日线上方", "中长期趋势均健康（risk-on）"
        elif not above50 and not above200:
            val, note = "跌破 50/200 日线", "中长期趋势同时走弱（risk-off）"
        else:
            val, note = "处于 50/200 日线之间", "趋势转折区、方向未明"
        inputs.append({
            "name": "标普 · 趋势", "value": val,
            "detail": f"SPX {last:.1f} · 50DMA {ma50:.1f} · 200DMA {ma200:.1f}",
            "contribution": c, "note": note,
        })

    # 2) 动量：标普近 1 月涨跌（约 22 交易日）
    m = _pct_n(spx, 22)
    if m is not None:
        c = 1 if m > 1 else (-1 if m < -3 else 0)
        score += c
        inputs.append({
            "name": "标普 · 1月动量", "value": f"{m:+.1f}%",
            "detail": "近 22 个交易日累计涨跌",
            "contribution": c,
            "note": "上行动量延续" if c > 0 else ("快速回撤、波动放大" if c < 0 else "区间震荡"),
        })

    # 3) 利率：10 年美债近 1 月变化（bp）——利率上行压制风险资产估值
    bp = _chg_n(tnx, 22)
    if bp is not None:
        bp_v = bp * 100
        c = -1 if bp_v > 25 else (1 if bp_v < -25 else 0)
        score += c
        inputs.append({
            "name": "10年美债 · 1月", "value": f"{bp_v:+.0f}bp",
            "detail": f"当前 {tnx[-1]:.2f}%",
            "contribution": c,
            "note": "利率上行、压制估值" if c < 0 else ("利率回落、缓解压力" if c > 0 else "利率波动有限"),
        })

    # 4) 美元：DXY 近 1 月变化——强美元走高通常对应风险偏好下降
    dp = _pct_n(dxy, 22)
    if dp is not None:
        c = -1 if dp > 2 else (1 if dp < -2 else 0)
        score += c
        inputs.append({
            "name": "美元指数 · 1月", "value": f"{dp:+.1f}%",
            "detail": f"当前 DXY {dxy[-1]:.2f}",
            "contribution": c,
            "note": "美元走强、抽流动性" if c < 0 else ("美元走弱、利好风险资产" if c > 0 else "美元区间波动"),
        })

    if not inputs:
        return {"available": False}

    # 总分 → 风险等级（分数越低 = 风险越高）
    if score >= 3:
        level, label = "低", "风险偏低 · 趋势健康"
    elif score >= 1:
        level, label = "中", "风险中性"
    elif score >= -1:
        level, label = "偏高", "风险偏高 · 注意防守"
    else:
        level, label = "高", "风险高 · 防守优先"

    return {
        "available": True,
        "asOf": as_of,
        "score": score,
        "level": level,
        "label": label,
        "inputs": inputs,
        "note": "确定性规则，仅用真实大盘历史计算；为体制参考、非买卖指令。",
    }
