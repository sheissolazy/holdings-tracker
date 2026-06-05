import { createContext, useContext, useEffect, useState } from 'react'
import type {
  Person, Signal, NewsItem, CalendarEvent, TradePlan, IPOItem,
} from './types'
import { dataUrl } from './useJson'

// 无假数据原则：任何 JSON 缺失/抓取失败时，回落为「空」而非编造数据。
const EMPTY_TRADEPLAN: TradePlan = {
  forDate: '', generatedAt: '', model: '—',
  catalysts: [], pendingSignals: [], draftActions: [],
}

export interface MarketItem { label: string; value: string; chg: string; pos: boolean; group?: string; code?: string; kind?: string }
export type SourceStatus = 'unconfigured' | 'ok' | 'expired'
export interface MaobidaoHealth { lastPost?: string | null; daysSince?: number | null; stale?: boolean }
export interface MetaHealth { x: SourceStatus; checkedAt?: string; maobidao?: MaobidaoHealth }
export interface StockSummary {
  ticker: string; name: string; exchange: string; sector: string
  price: number; change5dPct: number; changeYtdPct: number
}

export interface DataSet {
  people: Person[]
  signals: Signal[]
  news: NewsItem[]
  articles: Record<string, NewsItem[]>
  events: CalendarEvent[]
  ipos: IPOItem[]
  tradePlan: TradePlan
  market: MarketItem[]
  tickers: string[]
  stockIndex: StockSummary[]
  health: MetaHealth
  // 派生 helper（替代 mock.ts 里的同名导出）
  peopleById: Record<string, Person>
  stockMetaById: Record<string, StockSummary>
  signalsByTicker: (t: string) => Signal[]
  signalsByPerson: (id: string) => Signal[]
  articlesByPersonId: (id: string) => NewsItem[]
  live: boolean
}

async function getJson<T>(path: string, fallback: T): Promise<{ value: T; ok: boolean }> {
  try {
    const r = await fetch(dataUrl(path), { cache: 'no-cache' })
    if (!r.ok) throw new Error(String(r.status))
    return { value: (await r.json()) as T, ok: true }
  } catch {
    return { value: fallback, ok: false }
  }
}

type RawData = Omit<DataSet, 'peopleById' | 'stockMetaById' | 'signalsByTicker' | 'signalsByPerson' | 'articlesByPersonId'>

function derive(d: RawData): DataSet {
  const peopleById = Object.fromEntries(d.people.map((p) => [p.id, p]))
  const stockMetaById = Object.fromEntries(d.stockIndex.map((s) => [s.ticker, s]))
  return {
    ...d,
    peopleById,
    stockMetaById,
    signalsByTicker: (t) => d.signals.filter((s) => s.ticker === t),
    signalsByPerson: (id) => d.signals.filter((s) => s.personId === id),
    articlesByPersonId: (id) => d.articles[id] ?? [],
  }
}

const DataContext = createContext<DataSet | null>(null)

export function useData(): DataSet {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useData 必须在 <DataProvider> 内使用')
  return ctx
}

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<DataSet | null>(null)

  useEffect(() => {
    let alive = true
    ;(async () => {
      const [people, signals, news, articles, events, ipos, tradePlan, market, stockIndex, meta] = await Promise.all([
        getJson<Person[]>('people.json', []),
        getJson<Signal[]>('signals.json', []),
        getJson<NewsItem[]>('news.json', []),
        getJson<Record<string, NewsItem[]>>('articles.json', {}),
        getJson<CalendarEvent[]>('events.json', []),
        getJson<IPOItem[]>('ipos.json', []),
        getJson<TradePlan>('tradeplan.json', EMPTY_TRADEPLAN),
        getJson<MarketItem[]>('market.json', []),
        getJson<StockSummary[]>('stocks_index.json', []),
        getJson<{ tickers?: string[]; health?: MetaHealth }>('meta.json', { tickers: [] }),
      ])
      if (!alive) return
      const parts = [people, signals, news, articles, events, ipos, tradePlan, market, stockIndex, meta]
      const live = parts.every((r) => r.ok)
      setData(derive({
        people: people.value,
        signals: signals.value,
        news: news.value,
        articles: articles.value,
        events: events.value,
        ipos: ipos.value,
        tradePlan: tradePlan.value,
        market: market.value,
        stockIndex: stockIndex.value,
        tickers: meta.value.tickers ?? [],
        health: meta.value.health ?? { x: 'unconfigured' },
        live,
      }))
    })()
    return () => { alive = false }
  }, [])

  if (!data) {
    return (
      <div className="min-h-screen grid place-items-center text-muted">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-line border-t-brand animate-spin" />
          <div className="text-sm">加载数据中…</div>
        </div>
      </div>
    )
  }
  return <DataContext.Provider value={data}>{children}</DataContext.Provider>
}
