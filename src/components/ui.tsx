import { Link } from 'react-router-dom'
import type { Signal, NewsItem, SignalType } from '../data/types'
import { useData } from '../data/DataProvider'
import { cx, fmtPct, pctColor, fmtMoney } from '../lib/format'

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cx('rounded-2xl bg-white border border-line shadow-sm', className)}>
      {children}
    </div>
  )
}

export function SectionTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-3 mt-7">
      <h2 className="text-base font-bold">{children}</h2>
      {action}
    </div>
  )
}

export function Pct({ n }: { n: number }) {
  return <span className={cx('tnum font-semibold', pctColor(n))}>{fmtPct(n)}</span>
}

// 数据来源徽标：实时（管道生成的 JSON）/ 兜底（本地 mock）/ 加载中
export function DataBadge({ status }: { status: 'loading' | 'live' | 'fallback' }) {
  const meta = {
    loading: { label: '加载中…', cls: 'bg-canvas text-muted border-line' },
    live: { label: '实时数据', cls: 'bg-emerald-50 text-emerald-600 border-emerald-200' },
    fallback: { label: '本地兜底', cls: 'bg-amber-50 text-amber-600 border-amber-200' },
  }[status]
  return (
    <span className={cx('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium', meta.cls)}>
      <span className={cx('w-1.5 h-1.5 rounded-full', status === 'live' ? 'bg-emerald-500' : status === 'fallback' ? 'bg-amber-500' : 'bg-slate-400')} />
      {meta.label}
    </span>
  )
}

export function Avatar({ id, size = 36 }: { id: string; size?: number }) {
  const { peopleById } = useData()
  const p = peopleById[id]
  const initials = p?.name?.replace(/[^A-Za-z一-龥]/g, '').slice(0, 2) || '?'
  return (
    <div
      className="flex items-center justify-center rounded-full text-white font-bold shrink-0"
      style={{ width: size, height: size, background: p?.avatarColor ?? '#999', fontSize: size * 0.36 }}
    >
      {initials}
    </div>
  )
}

export function Sparkline({ data, color = '#64748b', w = 80, h = 24 }: { data: number[]; color?: string; w?: number; h?: number }) {
  if (!data?.length) return null
  const min = Math.min(...data), max = Math.max(...data)
  const span = max - min || 1
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / span) * h}`).join(' ')
  return (
    <svg width={w} height={h} className="overflow-visible">
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.6} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

const TYPE_META: Record<SignalType, { label: string; ring: string; bg: string; text: string }> = {
  '13f':       { label: '13F 持仓', ring: 'border-detail/40', bg: 'bg-detail-soft', text: 'text-detail' },
  options:     { label: '期权',     ring: 'border-amber/40',  bg: 'bg-amber-soft',  text: 'text-amber-700' },
  ptr:         { label: 'Congress', ring: 'border-coral/50',  bg: 'bg-coral-soft',  text: 'text-coral' },
  social:      { label: '社交喊单', ring: 'border-brand/40',  bg: 'bg-brand-soft',  text: 'text-brand' },
  statement:   { label: '公开言论', ring: 'border-amber/40',  bg: 'bg-amber-soft',  text: 'text-amber-700' },
  wechat:      { label: '公众号',   ring: 'border-detail/40', bg: 'bg-detail-soft', text: 'text-detail' },
}

const CHANGE_LABEL: Record<string, string> = { new: '新建', add: '加仓', trim: '减仓', exit: '清仓', hold: '不变' }

// 核心：按 signal.type 差异化展示「谁对这只票做了什么」
export function SignalCard({ s, showPerson = true, showTicker = false }: { s: Signal; showPerson?: boolean; showTicker?: boolean }) {
  const { peopleById } = useData()
  const m = TYPE_META[s.type]
  const p = peopleById[s.personId]
  return (
    <div className={cx('rounded-xl border p-3', m.ring, m.bg)}>
      <div className="flex items-center gap-2 mb-1.5">
        {showPerson && <Avatar id={s.personId} size={28} />}
        <div className="min-w-0 flex-1">
          {showPerson && (
            <Link to={`/person/${s.personId}`} className="font-semibold text-sm hover:underline truncate block">
              {p?.name}
            </Link>
          )}
          {showTicker && (
            <Link to={`/stock/${s.ticker}`} className="font-bold text-sm hover:underline">{s.ticker}</Link>
          )}
        </div>
        <span className={cx('text-[11px] font-bold px-2 py-0.5 rounded-full bg-white/70', m.text)}>{m.label}</span>
      </div>

      {/* 类型专属字段 */}
      {(s.type === '13f') && (
        <div className="text-xs text-muted flex flex-wrap gap-x-3 gap-y-0.5 tnum">
          {s.weightPct != null && <span>占比 <b className="text-ink">{s.weightPct}%</b></span>}
          {s.notional != null && <span>名义 <b className="text-ink">{fmtMoney(s.notional)}</b></span>}
          {s.avgPriceRange && <span>均价 ${s.avgPriceRange[0]}–{s.avgPriceRange[1]}</span>}
          {s.change && <span className="font-semibold text-ink">{CHANGE_LABEL[s.change]}{s.changePct != null ? ` ${fmtPct(s.changePct)}` : ''}</span>}
        </div>
      )}
      {(s.type === 'options' || s.type === 'ptr') && (
        <div className="text-xs text-muted flex flex-wrap gap-x-3 gap-y-0.5 tnum">
          {s.direction && <span className={cx('font-bold', s.direction === 'put' ? 'text-neg' : 'text-pos')}>{s.direction.toUpperCase()}</span>}
          {s.strike != null && <span>行权 <b className="text-ink">${s.strike}</b></span>}
          {s.expiration && <span>到期 {s.expiration}{s.daysToExp != null ? `（${s.daysToExp}d）` : ''}</span>}
          {s.notional != null && <span>名义 <b className="text-ink">{fmtMoney(s.notional)}</b></span>}
        </div>
      )}
      {(s.type === 'social' || s.type === 'statement') && (
        <div className="text-xs text-muted">
          {s.excerpt && <p className="text-ink/80 italic leading-snug mb-1">“{s.excerpt}”</p>}
          <div className="flex items-center gap-2">
            {s.sentiment && <SentPill s={s.sentiment} />}
            <span>{s.asOf}</span>
            {s.postUrl && <a href={s.postUrl} target="_blank" rel="noreferrer" className="text-brand hover:underline ml-auto">原文 ↗</a>}
          </div>
        </div>
      )}
    </div>
  )
}

export function SentPill({ s }: { s: 'bull' | 'bear' | 'watch' }) {
  const map = { bull: ['看多', 'bg-pos/10 text-pos'], bear: ['看空', 'bg-neg/10 text-neg'], watch: ['关注', 'bg-amber/15 text-amber-700'] } as const
  return <span className={cx('text-[11px] font-bold px-1.5 py-0.5 rounded', map[s][1])}>{map[s][0]}</span>
}

export function NewsRow({ n }: { n: NewsItem }) {
  const hasUrl = !!n.url && n.url !== '#'
  const Inner = (
    <>
      <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
        {n.tags.map((t) => (
          <span key={t} className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-canvas border border-line text-muted">{t}</span>
        ))}
        <span className="text-[11px] text-muted ml-auto">{n.source} · {n.publishedAt}</span>
      </div>
      <p className="text-sm leading-snug group-hover:text-brand">{n.title} {hasUrl && <span className="text-muted">↗</span>}</p>
    </>
  )
  return hasUrl
    ? <a href={n.url} target="_blank" rel="noreferrer" className="block py-2.5 group">{Inner}</a>
    : <div className="block py-2.5 group">{Inner}</div>
}
