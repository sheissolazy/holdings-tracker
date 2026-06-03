import type {
  Person, Signal, Stock, NewsItem, CalendarEvent, TradePlan, IPOItem, PriceBar,
} from './types'

// ---- helpers ----
// 用简单确定性伪随机生成 OHLC，避免巨型字面量数组
function genPrices(seed: number, start: number, days = 120): PriceBar[] {
  let x = seed
  const rand = () => {
    x = (x * 1103515245 + 12345) & 0x7fffffff
    return x / 0x7fffffff
  }
  const bars: PriceBar[] = []
  let c = start
  const today = new Date('2026-06-01')
  for (let i = days; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const drift = (rand() - 0.48) * start * 0.02
    const o = c
    c = Math.max(1, o + drift)
    const h = Math.max(o, c) * (1 + rand() * 0.012)
    const l = Math.min(o, c) * (1 - rand() * 0.012)
    bars.push({
      t: d.toISOString().slice(0, 10),
      o: +o.toFixed(2), h: +h.toFixed(2), l: +l.toFixed(2), c: +c.toFixed(2),
    })
  }
  return bars
}
const spark = (s: number, n = 12) => {
  let x = s
  return Array.from({ length: n }, () => {
    x = (x * 48271) % 2147483647
    return 40 + (x % 60)
  })
}

// ---- People（统一抽象，signalTypes 决定详情页区块） ----
export const people: Person[] = [
  {
    id: 'buffett', name: 'Warren Buffett', org: 'Berkshire Hathaway',
    avatarColor: '#7c5cff', signalTypes: ['13f', 'options'], cik: '0001067983',
    style: '价值投资 · 长期持有 · 重护城河', sparkline: spark(11),
  },
  {
    id: 'leopold', name: 'Leopold Aschenbrenner', org: 'Situational Awareness LP',
    avatarColor: '#3b6cf6', signalTypes: ['13f', 'options'], cik: '0002045724',
    style: 'AI 主题 · 集中下注 · 大量芯片股 put 对冲', sparkline: spark(7),
  },
  {
    id: 'pelosi', name: 'Nancy Pelosi', org: 'US Congress (House)',
    avatarColor: '#16a34a', signalTypes: ['ptr', 'options'],
    style: '科技股 · 长期看多 · 多用 LEAPS call', sparkline: spark(23),
  },
  {
    id: 'jensen', name: '黄仁勋 Jensen Huang', org: 'NVIDIA (CEO)',
    avatarColor: '#f59e0b', signalTypes: ['statement'],
    style: '公开言论 / 背书 · 非交易披露', sparkline: spark(5),
  },
  {
    id: 'trump', name: 'Donald Trump', org: 'Truth Social',
    avatarColor: '#ef4444', signalTypes: ['social'],
    social: { platform: 'truthsocial', handle: 'realDonaldTrump' }, sparkline: spark(3),
  },
  {
    id: 'musk', name: 'Elon Musk', org: 'X / Tesla',
    avatarColor: '#0ea5e9', signalTypes: ['social'],
    social: { platform: 'x', handle: 'elonmusk' }, sparkline: spark(9),
  },
  {
    id: 'serenity', name: 'Serenity', org: 'X influencer',
    avatarColor: '#a855f7', signalTypes: ['social'],
    social: { platform: 'x', handle: 'serenity' }, sparkline: spark(17),
  },
  // 微信公众号「猫笔刀」—— 作为「跟踪源」纳入，详情页展示文章列表（最新 + 历史）
  {
    id: 'maobidao', name: '猫笔刀', org: '微信公众号 · 每日更新',
    avatarColor: '#7c5cff', signalTypes: ['wechat'],
    style: '每日复盘 / 市场杂谈 · 经 Wechat2RSS 接入', sparkline: spark(13),
  },
]

export const peopleById = Object.fromEntries(people.map((p) => [p.id, p]))

// ---- 跟踪源的文章流（wechat 等无持仓的「源」人物，详情页读这个） ----
// 注意：以下文章为占位 mock，非真实抓取。真实接入走 Wechat2RSS / wewe-rss / RSSHub。
export const articlesByPerson: Record<string, NewsItem[]> = {
  maobidao: [
    { id: 'mbd1', title: '每日复盘：半导体分歧加大，普涨退潮', source: '猫笔刀',
      publishedAt: '2026-06-01', url: '#', tags: ['复盘', '半导体'] },
    { id: 'mbd2', title: '聊聊 AI 算力链的二阶受益者', source: '猫笔刀',
      publishedAt: '2026-05-30', url: '#', tags: ['AI', 'MRVL'] },
    { id: 'mbd3', title: '周末杂谈：当大家都在等回调', source: '猫笔刀',
      publishedAt: '2026-05-25', url: '#', tags: ['杂谈', '情绪'] },
    { id: 'mbd4', title: '复盘：电力与算力，谁先见顶', source: '猫笔刀',
      publishedAt: '2026-05-22', url: '#', tags: ['复盘', 'BE', '电力'] },
    { id: 'mbd5', title: '一个关于仓位管理的老问题', source: '猫笔刀',
      publishedAt: '2026-05-19', url: '#', tags: ['仓位', '方法'] },
  ],
}
export const articlesByPersonId = (id: string) => articlesByPerson[id] ?? []

// ---- Signals（谁对哪个 ticker 做了什么） ----
export const signals: Signal[] = [
  // Leopold — NVDA put（命中「持仓 + put」）
  { personId: 'leopold', type: 'options', ticker: 'NVDA', asOf: '2026-03-31',
    direction: 'put', notional: 1_600_000_000, strike: 95, expiration: '2026-09-18',
    daysToExp: 171, sentiment: 'bear', change: 'add' },
  { personId: 'leopold', type: 'options', ticker: 'SMH', asOf: '2026-03-31',
    direction: 'put', notional: 2_000_000_000, strike: 210, expiration: '2026-12-18',
    daysToExp: 262, sentiment: 'bear', change: 'new' },
  { personId: 'leopold', type: '13f', ticker: 'BE', asOf: '2026-03-31',
    shares: 6_500_000, notional: 879_000_000, weightPct: 6.4, change: 'add',
    changePct: 18, avgPriceRange: [118, 142], direction: 'long', sentiment: 'bull' },
  // Buffett
  { personId: 'buffett', type: '13f', ticker: 'AAPL', asOf: '2026-03-31',
    shares: 300_000_000, notional: 62_000_000_000, weightPct: 24.1, change: 'trim',
    changePct: -8, avgPriceRange: [165, 195], direction: 'long', sentiment: 'bull' },
  // Pelosi — NVDA LEAPS call
  { personId: 'pelosi', type: 'ptr', ticker: 'NVDA', asOf: '2026-05-12',
    direction: 'call', strike: 100, expiration: '2027-01-15', daysToExp: 248,
    avgPriceRange: [50000, 100000] as unknown as [number, number], sentiment: 'bull',
    change: 'new' },
  // Jensen — 公开背书 Marvell
  { personId: 'jensen', type: 'statement', ticker: 'MRVL', asOf: '2026-05-28',
    sentiment: 'bull', excerpt: '在 GTC 上点名 Marvell 的定制 AI 互连方案是「关键合作伙伴」。',
    postUrl: 'https://example.com/news/jensen-mrvl' },
  // Trump / Musk / Serenity social
  { personId: 'trump', type: 'social', ticker: 'NVDA', asOf: '2026-05-30',
    sentiment: 'bull', excerpt: 'AMERICAN CHIPS ARE THE BEST IN THE WORLD!',
    postUrl: 'https://truthsocial.com/@realDonaldTrump/123' },
  { personId: 'musk', type: 'social', ticker: 'TSLA', asOf: '2026-05-31',
    sentiment: 'bull', excerpt: 'Robotaxi network scaling faster than expected.',
    postUrl: 'https://x.com/elonmusk/456' },
  { personId: 'serenity', type: 'social', ticker: 'MRVL', asOf: '2026-05-29',
    sentiment: 'bull', excerpt: 'MRVL custom silicon ramp is underappreciated. Watching $90.',
    postUrl: 'https://x.com/serenity/789' },
]

export const signalsByTicker = (t: string) => signals.filter((s) => s.ticker === t)
export const signalsByPerson = (id: string) => signals.filter((s) => s.personId === id)

// ---- Stocks ----
function news(ticker: string): NewsItem[] {
  return [
    { id: `${ticker}-n1`, title: `${ticker} 季度业绩超预期，数据中心营收创新高`, source: 'Reuters',
      publishedAt: '2026-05-30', url: '#', tags: [ticker, '财报'] },
    { id: `${ticker}-n2`, title: `分析师上调 ${ticker} 目标价，看好 AI 需求持续`, source: 'Bloomberg',
      publishedAt: '2026-05-28', url: '#', tags: [ticker, '评级'] },
    { id: `${ticker}-n3`, title: `${ticker} 与超大规模厂商签订多年供应协议`, source: 'WSJ',
      publishedAt: '2026-05-25', url: '#', tags: [ticker, '合作'] },
  ]
}

export const stocks: Record<string, Stock> = {
  NVDA: {
    ticker: 'NVDA', name: 'NVIDIA Corporation', exchange: 'NASDAQ', sector: '半导体',
    price: 98.4, change5dPct: -3.2, changeYtdPct: 12.6, marketCap: '$2.41T',
    pe: 48.2, revenue: '$130.5B', revenueYoYPct: 78,
    prices: genPrices(101, 88), news: news('NVDA'),
    thesis: {
      bull: ['数据中心 GPU 仍供不应求', 'CUDA 生态护城河深', '主权 AI 与推理需求接力训练需求'],
      bear: ['估值已计入高增长预期', '定制 ASIC（含 Marvell/博通）分流份额', 'Leopold 等大资金建立大额 put 对冲'],
      watch: ['下季度数据中心毛利率', 'H20/出口管制变化', '大客户自研芯片进度'],
      model: 'claude-mock', generatedAt: '2026-06-01T20:00:00Z',
    },
  },
  MRVL: {
    ticker: 'MRVL', name: 'Marvell Technology', exchange: 'NASDAQ', sector: '半导体',
    price: 88.1, change5dPct: 6.4, changeYtdPct: 21.3, marketCap: '$76.2B',
    pe: 39.7, revenue: '$6.1B', revenueYoYPct: 34,
    prices: genPrices(202, 72), news: news('MRVL'),
    thesis: {
      bull: ['定制 AI 互连/ASIC 受益于超大规模厂商自研', '黄仁勋公开背书提升能见度', '光通信 DSP 份额领先'],
      bear: ['客户集中度高', '相对 NVDA 仍是二阶受益者', '周期性强'],
      watch: ['定制硅片订单兑现节奏', '数据中心营收占比', '与 NVDA 的竞合关系'],
      model: 'claude-mock', generatedAt: '2026-06-01T20:00:00Z',
    },
  },
  BE: {
    ticker: 'BE', name: 'Bloom Energy', exchange: 'NYSE', sector: '清洁能源',
    price: 135.2, change5dPct: 4.1, changeYtdPct: 58.0, marketCap: '$31.0B',
    pe: null, revenue: '$1.6B', revenueYoYPct: 27,
    prices: genPrices(303, 96), news: news('BE'),
    thesis: {
      bull: ['AI 数据中心供电缺口的非电网方案', 'Leopold 最大多头持仓背书', '订单加速'],
      bear: ['尚未稳定盈利', '政策补贴依赖', '估值波动大'],
      watch: ['毛利率转正路径', '数据中心订单兑现', '现金消耗'],
      model: 'claude-mock', generatedAt: '2026-06-01T20:00:00Z',
    },
  },
  AAPL: {
    ticker: 'AAPL', name: 'Apple Inc.', exchange: 'NASDAQ', sector: '消费电子',
    price: 207.5, change5dPct: 1.1, changeYtdPct: 5.4, marketCap: '$3.15T',
    pe: 32.1, revenue: '$391B', revenueYoYPct: 4,
    prices: genPrices(404, 195), news: news('AAPL'),
    thesis: {
      bull: ['服务业务高毛利增长', '装机量与生态粘性', '资本回报稳定'],
      bear: ['硬件增长乏力', 'AI 叙事落后', '中国市场承压'],
      watch: ['Apple Intelligence 落地', '大中华区营收', '服务增速'],
      model: 'claude-mock', generatedAt: '2026-06-01T20:00:00Z',
    },
  },
}
// ---- 完整分析（分段长文 + 可比公司）注入各 stock.thesis ----
const FULL_ANALYSIS: Record<string, { sections: { heading: string; body: string }[]; comparables: { ticker: string; name: string; note: string }[] }> = {
  NVDA: {
    sections: [
      { heading: '公司概览', body: 'NVIDIA 是 AI 计算的事实标准供应商，数据中心 GPU + CUDA 软件栈构成端到端护城河。当前营收结构高度集中于数据中心（训练 + 推理），游戏与专业可视化为辅。' },
      { heading: '增长驱动', body: '主权 AI、企业推理需求接棒超大规模厂商的训练 capex；Blackwell/后续架构的供货节奏与 ASP 提升是近两季的核心变量。CUDA 生态的迁移成本仍高，短期难被替代。' },
      { heading: '风险与分歧', body: '估值已计入高增长预期，任何 capex 放缓或交付延迟都会放大波动。定制 ASIC（Marvell、博通）正分流部分推理份额。Leopold/Situational Awareness 等大资金建立大额 NVDA/SMH put 对冲，是值得正视的空头信号。' },
      { heading: '跟踪者动向', body: 'Pelosi 新建 NVDA LEAPS call（看多）；Trump 社交端喊多美国芯片；与之相对，Leopold 持有约 $1.6B NVDA put + $2B SMH put。多空分歧是本票最大看点。' },
      { heading: '关键监测指标', body: '下季度数据中心毛利率、H20/出口管制变化、大客户自研芯片进度、Blackwell 出货爬坡。' },
      { heading: '结论', body: '基本面强劲但预期高、筹码分歧大。适合作为板块风向标跟踪，而非无脑追高；关注大资金 put 对冲的演变。' },
    ],
    comparables: [
      { ticker: 'MRVL', name: 'Marvell', note: '定制 AI 互连/ASIC，二阶受益者' },
      { ticker: 'BE', name: 'Bloom Energy', note: 'AI 数据中心供电缺口受益' },
    ],
  },
  MRVL: {
    sections: [
      { heading: '公司概览', body: 'Marvell 是定制硅片（ASIC）与光通信 DSP 的领先者，受益于超大规模厂商自研 AI 芯片的浪潮，是 NVIDIA 之外的「二阶受益者」。' },
      { heading: '增长驱动', body: '超大规模客户的定制 AI 加速器 + 互连需求；光 DSP 在 800G/1.6T 升级周期中份额领先。黄仁勋公开点名其为关键合作伙伴，提升了市场能见度。' },
      { heading: '风险与分歧', body: '客户集中度高、相对 NVDA 仍是二阶逻辑、半导体周期性强。涨幅已计入部分乐观预期（近 5 日 +6.4%）。' },
      { heading: '跟踪者动向', body: '黄仁勋（statement）公开背书；Serenity（社交）喊多并关注 $90 一线。叠加明日盘后财报，关注度高。' },
      { heading: '关键监测指标', body: '定制硅片订单兑现节奏、数据中心营收占比、与 NVDA 的竞合关系、本次财报指引。' },
      { heading: '结论', body: '强主题 + 多重催化，但已涨、预期偏高，财报是近期分水岭。适合事件驱动跟踪，避免盘前追高。' },
    ],
    comparables: [
      { ticker: 'NVDA', name: 'NVIDIA', note: 'AI 计算标准，竞合关系' },
    ],
  },
  BE: {
    sections: [
      { heading: '公司概览', body: 'Bloom Energy 提供固态燃料电池供电方案，定位为 AI 数据中心电网外的快速供电选项，踩中「算力缺电」主题。' },
      { heading: '增长驱动', body: 'AI 数据中心供电缺口 + 交付周期长于电网扩容，带来非电网方案需求；订单加速。Leopold 将其作为最大多头持仓，是重要背书。' },
      { heading: '风险与分歧', body: '尚未稳定盈利、依赖政策补贴、估值波动大、现金消耗较快。属于高 beta 主题股。' },
      { heading: '跟踪者动向', body: 'Leopold/Situational Awareness 13F 多头持仓 ~$879M（加仓 +18%），是其少数大额多头之一，与其芯片股 put 形成「多电力、空芯片」的组合表达。' },
      { heading: '关键监测指标', body: '毛利率转正路径、数据中心订单兑现、现金消耗与融资。' },
      { heading: '结论', body: '高赔率高波动的算力供电主题股，靠大资金多头背书 + 订单兑现驱动。仓位管理是关键。' },
    ],
    comparables: [
      { ticker: 'NVDA', name: 'NVIDIA', note: '算力需求的上游驱动' },
    ],
  },
  AAPL: {
    sections: [
      { heading: '公司概览', body: 'Apple 以硬件 + 高毛利服务的生态闭环著称，装机量与粘性提供稳定现金流与资本回报。' },
      { heading: '增长驱动', body: '服务业务高毛利增长、Apple Intelligence 落地带来的换机周期想象空间。' },
      { heading: '风险与分歧', body: '硬件增长乏力、AI 叙事相对落后、大中华区承压。' },
      { heading: '跟踪者动向', body: 'Buffett/Berkshire 仍是第一大重仓（占比 ~24%），但本季减仓 8%，是值得留意的边际变化。' },
      { heading: '关键监测指标', body: 'Apple Intelligence 落地节奏、大中华区营收、服务增速。' },
      { heading: '结论', body: '稳健现金牛 + 边际减仓信号。适合作为防御性底仓跟踪，关注 AI 落地能否重启增长叙事。' },
    ],
    comparables: [
      { ticker: 'NVDA', name: 'NVIDIA', note: 'AI 硬件对照' },
    ],
  },
}
for (const [t, fa] of Object.entries(FULL_ANALYSIS)) {
  if (stocks[t]) { stocks[t].thesis.sections = fa.sections; stocks[t].thesis.comparables = fa.comparables }
}

export const tickerList = Object.keys(stocks)

// ---- News（全局） ----
export const allNews: NewsItem[] = [
  ...stocks.NVDA.news, ...stocks.MRVL.news, ...stocks.BE.news,
  { id: 'g1', title: 'Situational Awareness 13F 曝光：~$8.5B 芯片股 put 对冲',
    source: 'Bloomberg', publishedAt: '2026-05-18', url: '#', tags: ['Leopold', '13F', 'NVDA'] },
  { id: 'g2', title: 'Pelosi 披露 NVDA LEAPS call 新仓', source: 'Capitol Trades',
    publishedAt: '2026-05-14', url: '#', tags: ['Pelosi', 'Congress', 'NVDA'] },
  // 注：猫笔刀文章只在「你跟踪的人 → 猫笔刀」详情页展示，不进全局新闻流。
]

// ---- Calendar / 明日催化剂 ----
export const events: CalendarEvent[] = [
  { date: '2026-06-02', label: 'MRVL 财报（盘后）', kind: 'earnings', impact: 'high', tickers: ['MRVL'] },
  { date: '2026-06-02', label: 'ISM 制造业 PMI', kind: 'econ', impact: 'med' },
  { date: '2026-06-03', label: 'FOMC 会议纪要', kind: 'econ', impact: 'high' },
  { date: '2026-06-05', label: '非农就业（NFP）', kind: 'econ', impact: 'high' },
  { date: '2026-06-04', label: 'Cerebras IPO 定价', kind: 'ipo', impact: 'med', tickers: ['CBRS'] },
]

// ---- 明日交易计划 ----
export const tradePlan: TradePlan = {
  forDate: '2026-06-02',
  generatedAt: '2026-06-01T21:00:00Z',
  model: 'claude-mock',
  catalysts: events.filter((e) => e.date === '2026-06-02'),
  pendingSignals: [
    { personId: 'serenity', ticker: 'MRVL', note: 'Serenity 喊单 MRVL，叠加黄仁勋背书 + 明日财报，关注度高' },
    { personId: 'leopold', ticker: 'NVDA', note: 'Leopold 大额 NVDA put 仍在，半导体板块风向标' },
  ],
  // AI 用今天的信息起草的简单行动清单，用户可直接编辑
  draftActions: [
    { id: 'a1', action: '盯 MRVL 盘后财报，先不动', reason: '黄仁勋背书 + Serenity 喊单 + 明日财报三重催化，但已涨 6%，预期偏高，避免盘前追高' },
    { id: 'a2', action: '关注 SMH/NVDA 板块方向', reason: 'MRVL 财报会外溢到 AI 半导体；Leopold 大额 NVDA put 提示下行对冲情绪' },
    { id: 'a3', action: 'FOMC 纪要/非农前控制仓位', reason: '本周宏观事件密集（6/3 纪要、6/5 非农），波动可能放大' },
    { id: 'a4', action: '留意 Cerebras IPO 定价', reason: '6/4 AI 芯片新股定价，区间 $22–26，可作板块情绪参考' },
  ],
}

// ---- IPO ----
export const ipos: IPOItem[] = [
  { ticker: 'CBRS', name: 'Cerebras Systems', date: '2026-06-04', priceRange: [22, 26], sector: 'AI 芯片', exchange: 'NASDAQ' },
  { ticker: 'DBX2', name: 'Databricks', date: '2026-06-11', priceRange: [70, 80], sector: '数据/AI', exchange: 'NASDAQ' },
  { ticker: 'CRWV', name: 'CoreWeave Tranche II', date: '2026-06-12', priceRange: [40, 48], sector: 'AI 云算力', exchange: 'NASDAQ' },
  { ticker: 'ANTH', name: 'Anthropic', date: '2026-06-18', priceRange: [55, 65], sector: 'AI 基础模型', exchange: 'NYSE' },
  { ticker: 'GRQ', name: 'Groq', date: '2026-06-25', priceRange: [18, 22], sector: 'AI 推理芯片', exchange: 'NASDAQ' },
]

export const market = [
  { label: 'SPY', value: '548.2', chg: '+0.4%', pos: true },
  { label: 'Gold', value: '$2,418', chg: '+0.9%', pos: true },
  { label: '10Y Yield', value: '4.31%', chg: '-3bp', pos: false },
]
