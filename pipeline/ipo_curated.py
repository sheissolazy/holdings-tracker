"""人工维护的「可申购 IPO」补录表 —— 免费 IPO 日历（Finnhub/Nasdaq）覆盖不到的
大型 / 保密申报（confidential S-1）标的，如 SpaceX。

为什么需要它：marquee IPO 往往在定价前几天才进入免费日历，且保密申报阶段
完全不出现。但这些恰恰是用户最想「现在就申购」的标的。

无假数据原则：本表每条都来自公开报道，必须带 `source`（可点击核实）与 `as_of`。
不是凭空捏造，而是把券商/媒体已公布的真实事实结构化。维护者请只填有出处的数字，
ticker 未官宣时置 tickerPending=True 并在 note 注明。

合并逻辑见 fetch_ipos._merge：自动源已有同 ticker 时不覆盖；定价日已过则自动剔除。
"""

# 每条 = 一只「现在可申购」的大型标的（IPOItem 形态 + 补充字段）
CURATED = [
    {
        "ticker": "SPCX",            # Seeking Alpha 标注 SPCX:Pending（拟用，未官宣）
        "tickerPending": True,
        "name": "SpaceX",
        "date": "2026-06-12",        # 媒体普遍报道的目标上市日（Nasdaq）
        "priceRange": [135.0, 135.0],  # 路演固定发行价 $135/股（Fortune 2026-06-03）
        "sector": "航天 / 卫星互联网",
        "exchange": "Nasdaq",
        "status": "expected",        # 待定价，可申购
        "valuation": "约 $1.77T",     # 555.6M A 类股 × $135（Fortune 路演报道）
        "brokers": ["Robinhood", "Fidelity", "Schwab", "SoFi"],  # 零售配额约 30%
        "note": "保密申报(4/1)，路演固定价 $135；约 30% 配售零售，券商需符合各自资格",
        "source": "https://fortune.com/2026/06/03/spacex-ipo-share-price-index-funds-valuation-public/",
        "as_of": "2026-06-03",
        "curated": True,
    },
]
