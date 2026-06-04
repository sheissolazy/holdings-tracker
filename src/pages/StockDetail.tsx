import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useData } from '../data/DataProvider'
import { useJson } from '../data/useJson'
import type { Stock } from '../data/types'
import { Card, SectionTitle, Pct, SignalCard, NewsRow } from '../components/ui'
import KLine from '../components/KLine'
import { cx } from '../lib/format'

const RANGES: Record<string, number> = { '1M': 22, '3M': 66, '6M': 120, '1Y': 121 }

export default function StockDetail() {
  const { ticker } = useParams()
  const { signalsByTicker, ipos } = useData()
  const [range, setRange] = useState('3M')
  const { data: s } = useJson<Stock | null>(`stocks/${ticker}.json`, null)

  // IPO 票可能还没有完整 stock 数据
  if (!s) {
    const ipo = ipos.find((i) => i.ticker === ticker)
    return (
      <div className="py-16 text-center">
        <h1 className="text-xl font-bold">{ticker}{ipo ? ` · ${ipo.name}` : ''}</h1>
        {ipo
          ? <p className="text-sm text-muted mt-2">即将于 {ipo.date} 上市（{ipo.sector}）· 定价区间 ${ipo.priceRange[0]}–{ipo.priceRange[1]}。上市后接入完整数据。</p>
          : <p className="text-sm text-muted mt-2">未找到该股票数据</p>}
        <Link to="/" className="text-sm text-brand mt-4 inline-block">← 返回</Link>
      </div>
    )
  }

  const sigs = signalsByTicker(s.ticker)
  const bars = s.prices.slice(-RANGES[range])

  return (
    <div>
      <Link to="/" className="text-sm text-muted hover:text-brand">← 返回</Link>

      {/* Hero */}
      <div className="flex items-start justify-between mt-3 gap-4">
        <div>
          <h1 className="text-2xl font-extrabold">{s.ticker}</h1>
          <p className="text-sm text-muted">{s.name}</p>
          <p className="text-[11px] text-muted">{s.exchange} · {s.sector} · {s.marketCap}</p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-extrabold tnum">${s.price}</div>
          <div className="text-xs flex gap-2 justify-end"><span className="text-muted">5D</span><Pct n={s.change5dPct} /></div>
          <div className="text-xs flex gap-2 justify-end"><span className="text-muted">YTD</span><Pct n={s.changeYtdPct} /></div>
        </div>
      </div>

      {/* K线 */}
      <SectionTitle action={
        <div className="flex gap-1">
          {Object.keys(RANGES).map((r) => (
            <button key={r} onClick={() => setRange(r)}
              className={cx('text-xs px-2 py-1 rounded-md font-medium', r === range ? 'bg-brand text-white' : 'text-muted hover:bg-canvas')}>{r}</button>
          ))}
        </div>
      }>价格走势</SectionTitle>
      <Card className="p-2"><KLine bars={bars} /></Card>

      {/* 基本面 */}
      <SectionTitle>关键基本面</SectionTitle>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Fund label="市值" v={s.marketCap || '—'} />
        <Fund label="PE" v={s.pe == null ? '—' : s.pe.toFixed(1)} />
        <Fund label="营收(TTM)" v={s.revenue || '—'} />
        <Fund
          label="营收 YoY"
          v={s.revenueYoYPct == null ? '—' : `${s.revenueYoYPct >= 0 ? '+' : ''}${s.revenueYoYPct}%`}
          pos={s.revenueYoYPct != null && s.revenueYoYPct >= 0}
        />
      </div>

      {/* 你跟踪的人 */}
      <SectionTitle>你跟踪的人 · {s.ticker}</SectionTitle>
      {sigs.length ? (
        <div className="grid sm:grid-cols-2 gap-3">
          {sigs.map((sig, i) => <SignalCard key={i} s={sig} showPerson />)}
        </div>
      ) : <p className="text-sm text-muted">暂无跟踪者持有/提及。</p>}

      {/* AI 论点 */}
      <SectionTitle action={<Link to={`/analysis/${s.ticker}`} className="text-xs text-brand">完整分析 →</Link>}>AI 投资论点摘要</SectionTitle>
      {(s.thesis.bull.length || s.thesis.bear.length || s.thesis.watch.length) ? (
        <>
          <div className="grid sm:grid-cols-3 gap-3">
            <Thesis title="看多" color="pos" items={s.thesis.bull} />
            <Thesis title="看空" color="neg" items={s.thesis.bear} />
            <Thesis title="关注点" color="amber" items={s.thesis.watch} />
          </div>
          <p className="text-[11px] text-muted mt-2">由 {s.thesis.model} 生成于 {s.thesis.generatedAt?.slice(0, 10)} · 非投资建议</p>
        </>
      ) : (
        <Card className="p-4"><p className="text-sm text-muted">AI 分析暂不可用（下次数据管道运行后生成）。</p></Card>
      )}

      {/* 新闻 */}
      <SectionTitle>{s.ticker} 相关新闻</SectionTitle>
      <Card className="px-4 divide-y divide-line">
        {s.news.length
          ? s.news.map((n) => <NewsRow key={n.id} n={n} />)
          : <p className="text-sm text-muted py-4">暂无相关新闻。</p>}
      </Card>
    </div>
  )
}

const Fund = ({ label, v, pos }: { label: string; v: string; pos?: boolean }) => (
  <Card className="p-3">
    <div className="text-[11px] text-muted">{label}</div>
    <div className={cx('text-lg font-bold tnum mt-0.5', pos && 'text-pos')}>{v}</div>
  </Card>
)

const Thesis = ({ title, color, items }: { title: string; color: 'pos' | 'neg' | 'amber'; items: string[] }) => {
  const head = { pos: 'text-pos', neg: 'text-neg', amber: 'text-amber-700' }[color]
  const dot = { pos: 'bg-pos', neg: 'bg-neg', amber: 'bg-amber' }[color]
  return (
    <Card className="p-3">
      <div className={cx('text-sm font-bold mb-2', head)}>{title}</div>
      <ul className="space-y-1.5">
        {items.map((it, i) => (
          <li key={i} className="flex gap-2 text-xs leading-snug">
            <span className={cx('mt-1.5 w-1.5 h-1.5 rounded-full shrink-0', dot)} />{it}
          </li>
        ))}
      </ul>
    </Card>
  )
}
