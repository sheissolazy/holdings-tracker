"""跟踪名单与标的配置 —— 数据管道的单一事实来源。

与前端 src/data/types.ts 的 Person / Signal / Stock 结构对应。
新增一个跟踪对象，只改这里。
"""

# 跟踪的人物 / 源（统一抽象；signalTypes 决定详情页区块）
PEOPLE = [
    {
        "id": "buffett", "name": "Warren Buffett", "org": "Berkshire Hathaway",
        "avatarColor": "#7c5cff", "signalTypes": ["13f", "options"],
        "cik": "0001067983", "style": "价值投资 · 长期持有 · 重护城河",
    },
    {
        "id": "leopold", "name": "Leopold Aschenbrenner", "org": "Situational Awareness LP",
        "avatarColor": "#3b6cf6", "signalTypes": ["13f", "options"],
        "cik": "0002045724", "style": "AI 主题 · 集中下注 · 大量芯片股 put 对冲",
    },
    {
        "id": "pelosi", "name": "Nancy Pelosi", "org": "US Congress (House)",
        "avatarColor": "#16a34a", "signalTypes": ["ptr", "options"],
        "style": "科技股 · 长期看多 · 多用 LEAPS call",
    },
    {
        "id": "jensen", "name": "黄仁勋 Jensen Huang", "org": "NVIDIA (CEO)",
        "avatarColor": "#f59e0b", "signalTypes": ["statement"],
        "style": "公开言论 / 背书 · 非交易披露",
    },
    {
        "id": "trump", "name": "Donald Trump", "org": "X / @realDonaldTrump",
        "avatarColor": "#ef4444", "signalTypes": ["social"],
        "social": {"platform": "x", "handle": "realDonaldTrump"},
    },
    {
        "id": "musk", "name": "Elon Musk", "org": "X / Tesla",
        "avatarColor": "#0ea5e9", "signalTypes": ["social"],
        "social": {"platform": "x", "handle": "elonmusk"},
    },
    {
        "id": "serenity", "name": "Serenity", "org": "X influencer",
        "avatarColor": "#a855f7", "signalTypes": ["social"],
        "social": {"platform": "x", "handle": "aleabitoreddit"},
    },
    {
        "id": "maobidao", "name": "猫笔刀", "org": "微信公众号 · 每日更新",
        "avatarColor": "#7c5cff", "signalTypes": ["wechat"],
        "style": "每日复盘 / 市场杂谈 · 经 X 同步接入",
        # 接入方式优先级：X 文章号（猫笔刀在 X 上每日同步发文）> Wechat2RSS。
        #   x_handle 走已有的 X cookie 通道，拉「文章流」(标题+摘要+原文链接)，不产 ticker 信号。
        "x_handle": "mooomoocat",
        # 备用：若改用微信公众号 RSS（Wechat2RSS / wewe-rss），把地址填这里即可。
        "rss": "",
    },
]

PEOPLE_BY_ID = {p["id"]: p for p in PEOPLE}

# 关注的标的（决定拉哪些股价 / 生成哪些 AI 分析）
TICKERS = ["NVDA", "MRVL", "BE", "AAPL", "SMH"]

# 标的基础信息（拉不到时的兜底；真实可由 fetch_prices 补全）
TICKER_META = {
    "NVDA": {"name": "NVIDIA Corporation", "exchange": "NASDAQ", "sector": "半导体"},
    "MRVL": {"name": "Marvell Technology", "exchange": "NASDAQ", "sector": "半导体"},
    "BE":   {"name": "Bloom Energy", "exchange": "NYSE", "sector": "清洁能源"},
    "AAPL": {"name": "Apple Inc.", "exchange": "NASDAQ", "sector": "消费电子"},
    "SMH":  {"name": "VanEck Semiconductor ETF", "exchange": "NASDAQ", "sector": "半导体 ETF"},
}

# 新闻 RSS 源（标题 + 外链，不抓正文）
NEWS_FEEDS = [
    # (来源名, RSS URL)
    ("Reuters Tech", "https://www.reutersagency.com/feed/?best-topics=tech"),
    # 微信公众号「猫笔刀」经 Wechat2RSS：订阅后把 RSS 地址填到 PEOPLE[maobidao].rss
]

SEC_UA = "holdings-tracker self-use contact: xiaoyizuw@gmail.com"  # SEC 要求 UA 带联系方式
