// ---- Core domain types (the "人物 → 信号 → 股票" spine) ----

export type SignalType = '13f' | 'options' | 'ptr' | 'social' | 'statement' | 'wechat'

export interface Person {
  id: string
  name: string
  org?: string
  avatarColor: string          // 跟踪源配色
  signalTypes: SignalType[]    // 决定人物详情页渲染哪些区块
  cik?: string
  style?: string               // 投资风格简述
  social?: { platform: 'x' | 'truthsocial'; handle: string }
  sparkline?: number[]         // 组合价值/活跃度迷你走势
}

// 一条信号 = 某人对某 ticker 的一个动作/持仓/言论
// 社交信号特例：ticker 可为 ''（空）——表示「无具体标的的市场评论」，仅由 topics 描述主题。
export interface Signal {
  personId: string
  type: SignalType
  ticker: string               // 社交「市场评论」类可为 ''（无具体标的）
  topics?: string[]            // 市场主题标签（关税/美联储/IPO…），social 类专用
  // 通用
  asOf: string                 // 日期 ISO
  // 13f / options
  shares?: number
  notional?: number            // 名义金额（含 put 用负向语义由 direction 表达）
  weightPct?: number           // 占组合比例
  change?: 'new' | 'add' | 'trim' | 'exit' | 'hold'
  changePct?: number
  avgPriceRange?: [number, number]
  direction?: 'long' | 'put' | 'call'
  strike?: number
  expiration?: string
  daysToExp?: number
  // social / statement
  postUrl?: string
  excerpt?: string
  sentiment?: 'bull' | 'bear' | 'watch'
}

export interface PriceBar { t: string; o: number; h: number; l: number; c: number }

export interface AIThesis {
  bull: string[]
  bear: string[]
  watch: string[]
  model?: string
  generatedAt?: string | null
  unavailable?: boolean        // 生成失败/无 key 时为 true，前端显示「暂不可用」
  // 完整分析页用：分段长文 + 可比公司
  sections?: { heading: string; body: string }[]
  comparables?: { ticker: string; name: string; note: string }[]
}

export interface Stock {
  ticker: string
  name: string
  exchange: string
  sector: string
  price: number
  change5dPct: number
  changeYtdPct: number
  marketCap: string
  pe: number | null
  revenue: string
  revenueYoYPct: number | null
  isIPO?: boolean
  prices: PriceBar[]
  thesis: AIThesis
  news: NewsItem[]
}

export interface NewsItem {
  id: string
  title: string
  source: string
  publishedAt: string
  url: string
  tags: string[]               // 人物 / ticker / 主题
  summary?: string             // 摘要 / 开头节选（猫笔刀文章流用）
}

export interface CalendarEvent {
  date: string
  label: string
  kind: 'earnings' | 'econ' | 'ipo' | 'opex' | 'other'
  impact: 'high' | 'med' | 'low'
  tickers?: string[]
}

// 明日交易计划 —— 简化为可编辑的「动作 + 原因」清单
export interface DraftAction {
  id: string
  action: string        // 要做的事（简短）
  reason: string        // 为什么（来自今天的信息）
  done?: boolean
}

// ---- 透明风险计（确定性，每个输入暴露真实值 + 贡献）----
export interface RiskInput {
  name: string
  value: string
  detail?: string
  contribution: number   // 正=risk-on/平静，负=risk-off/风险升高
  note?: string
}
export interface RiskGauge {
  available: boolean
  asOf?: string
  score?: number
  level?: '低' | '中' | '偏高' | '高'
  label?: string
  inputs?: RiskInput[]
  note?: string
}

// ---- 行动建议（确定性技术位 + 风险计；每条带 basis 真实依据）----
export interface ActionSuggestion {
  id: string
  kind: 'add' | 'trim' | 'watch' | 'hedge'
  ticker: string
  instrument: 'stock' | 'put'
  refPrice: number
  addBelow?: number | null     // 加仓参考位（支撑/50日线）
  trimAbove?: number | null    // 减仓参考位（阻力）
  stop?: number                // 止损参考
  strike?: number              // put 行权价（现价下方支撑）
  expiration?: string          // 到期（月度 OPEX 规则）
  sizingHint?: string          // 仓位提示（% 组合，不给美元）
  confidence: 'high' | 'med' | 'low'
  headline: string
  reason: string
  basis: string[]              // 依据的真实数据点（可核对）
}

export interface TradePlan {
  forDate: string
  generatedAt: string
  model: string
  catalysts: CalendarEvent[]
  pendingSignals: { personId: string; ticker: string; note: string }[]
  draftActions: DraftAction[]   // 用户可编辑的清单
  risk?: RiskGauge              // 当日风险体制（确定性）
  suggestions?: ActionSuggestion[]  // 行动建议（确定性技术位 + 风险计）
  opex?: string                 // 下一个月度期权到期日
}

export interface IPOItem {
  ticker: string
  name: string
  date: string
  priceRange: [number, number]
  sector: string
  exchange: string
  status?: string              // expected（待定价，可申购）/ priced（已定价）/ filed（已申报）
  // ---- 人工维护的大型/保密申报标的（如 SpaceX）专用，均带 source 引用 ----
  curated?: boolean            // true=人工补录（免费 IPO 日历未覆盖），前端标注来源
  valuation?: string           // 路演/最新估值，如 "约 $1.77T"
  brokers?: string[]           // 可申购券商：Robinhood / Fidelity / Schwab / SoFi
  note?: string                // 简短说明（保密申报、配额等）
  source?: string              // 数据出处 URL（可点击核实）
  tickerPending?: boolean      // ticker 为拟用/未官宣
}
