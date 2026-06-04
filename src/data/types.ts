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
export interface Signal {
  personId: string
  type: SignalType
  ticker: string
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
export interface TradePlan {
  forDate: string
  generatedAt: string
  model: string
  catalysts: CalendarEvent[]
  pendingSignals: { personId: string; ticker: string; note: string }[]
  draftActions: DraftAction[]   // AI 用今天的信息起草，用户可改
}

export interface IPOItem {
  ticker: string
  name: string
  date: string
  priceRange: [number, number]
  sector: string
  exchange: string
}
