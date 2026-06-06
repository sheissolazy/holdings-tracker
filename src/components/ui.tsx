import { Link } from 'react-router-dom'
import type { Signal, NewsItem, SignalType, RiskGauge, ActionSuggestion } from '../data/types'
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
  social:      { label: '社交动态', ring: 'border-brand/40',  bg: 'bg-brand-soft',  text: 'text-brand' },
  statement:   { label: '公开言论', ring: 'border-amber/40',  bg: 'bg-amber-soft',  text: 'text-amber-700' },
  wechat:      { label: '公众号',   ring: 'border-detail/40', bg: 'bg-detail-soft', text: 'text-detail' },
}

const CHANGE_LABEL: Record<string, string> = { new: '新建', add: '加仓', trim: '减仓', exit: '清仓', hold: '不变' }

// 核心：按 signal.type 差异化展示「谁对这只票做了什么」
export function SignalCard({ s, showPerson = true, showTicker = false, tickers }: { s: Signal; showPerson?: boolean; showTicker?: boolean; tickers?: string[] }) {
  const { peopleById } = useData()
  const m = TYPE_META[s.type]
  const p = peopleById[s.personId]
  // 同一条帖子若提及多只股票，合并为一张卡：展示全部 ticker（而非每只一张重复卡）
  const tk = tickers && tickers.length > 0 ? tickers : (s.ticker ? [s.ticker] : [])
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
          {showTicker && tk.length > 0 && (
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              {tk.map((t) => (
                <Link key={t} to={`/stock/${t}`} className="font-bold text-sm text-brand hover:underline">{t}</Link>
              ))}
            </div>
          )}
          {showTicker && tk.length === 0 && (
            <span className="font-bold text-sm text-muted">市场评论</span>
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
          {s.direction && (() => {
            // 13F 仅披露多头 → put/call 均为「买入（long）」；ptr 为真实买/卖。
            const D: Record<string, { t: string; c: string }> = {
              put:  { t: 'Buy Put',  c: 'text-neg' },   // 13F 多头 PUT · 看空
              call: { t: 'Buy Call', c: 'text-pos' },   // 13F 多头 CALL · 看多
              long: { t: 'Buy',      c: 'text-pos' },
              exit: { t: 'Sell',     c: 'text-neg' },
            }
            const d = D[s.direction] ?? { t: s.direction.toUpperCase(), c: 'text-ink' }
            return <span className={cx('font-bold', d.c)}>{d.t}</span>
          })()}
          {s.strike != null && <span>行权 <b className="text-ink">${s.strike}</b></span>}
          {s.expiration && <span>到期 {s.expiration}{s.daysToExp != null ? `（${s.daysToExp}d）` : ''}</span>}
          {s.notional != null && <span>名义 <b className="text-ink">{fmtMoney(s.notional)}</b></span>}
        </div>
      )}
      {(s.type === 'social' || s.type === 'statement') && (
        <div className="text-xs text-muted">
          {s.excerpt && <p className="text-ink/80 italic leading-snug mb-1">“{s.excerpt}”</p>}
          {s.topics && s.topics.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-1">
              {s.topics.map((t) => (
                <span key={t} className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-canvas border border-line text-muted">{t}</span>
              ))}
            </div>
          )}
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

// ---- AI 可信度：基于「支撑该分析的真实信号/新闻数量」确定性评估（非模型自评）----
const CONF_META: Record<string, { label: string; cls: string; dot: string }> = {
  high: { label: '可信度 高', cls: 'bg-pos/10 text-pos border-pos/30', dot: 'bg-pos' },
  med:  { label: '可信度 中', cls: 'bg-amber-soft text-amber-700 border-amber/40', dot: 'bg-amber-500' },
  low:  { label: '可信度 低', cls: 'bg-coral-soft text-neg border-coral/40', dot: 'bg-neg' },
}

export function EvidencePanel(
  { people, signalCount, newsCount, signalTypes }:
  { people: number; signalCount: number; newsCount: number; signalTypes: string[] },
) {
  const conf: 'high' | 'med' | 'low' =
    people >= 2 && (signalCount >= 3 || newsCount >= 3) ? 'high'
    : people >= 1 || signalCount >= 1 || newsCount >= 2 ? 'med' : 'low'
  const m = CONF_META[conf]
  const TYPE_CN: Record<string, string> = { '13f': '13F 持仓', options: '期权', ptr: '国会交易', social: '社交动态', statement: '公开言论' }
  const types = [...new Set(signalTypes)].map((t) => TYPE_CN[t] ?? t)
  return (
    <Card className="p-3 mt-3">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs font-bold text-ink">分析依据 · 真实输入</span>
        <span className={cx('ml-auto inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full border', m.cls)}>
          <span className={cx('w-1.5 h-1.5 rounded-full', m.dot)} />{m.label}
        </span>
      </div>
      <div className="flex flex-wrap gap-2 text-xs">
        <span className="rounded-lg bg-canvas border border-line px-2 py-1">跟踪者信号 <b className="tnum text-ink">{signalCount}</b> 条</span>
        <span className="rounded-lg bg-canvas border border-line px-2 py-1">来自 <b className="tnum text-ink">{people}</b> 人</span>
        <span className="rounded-lg bg-canvas border border-line px-2 py-1">相关新闻 <b className="tnum text-ink">{newsCount}</b> 条</span>
        {types.length > 0 && <span className="rounded-lg bg-canvas border border-line px-2 py-1">类型：{types.join(' / ')}</span>}
      </div>
      <p className="text-[10px] text-muted mt-2 leading-snug">
        可信度按<b>支撑该结论的真实信号/新闻数量</b>确定性评估（非模型自评）。下方「跟踪者动向」即这些真实输入，可逐条核对。
      </p>
    </Card>
  )
}

// ---- 透明风险计：每个输入暴露真实值 + 对总分的贡献（确定性，可核对）----
const RISK_TONE: Record<string, { dot: string; text: string; bg: string; border: string }> = {
  '低':   { dot: 'bg-pos',     text: 'text-pos',       bg: 'bg-pos/5',    border: 'border-pos/30' },
  '中':   { dot: 'bg-slate-400', text: 'text-muted',   bg: 'bg-canvas',   border: 'border-line' },
  '偏高': { dot: 'bg-amber-500', text: 'text-amber-700', bg: 'bg-amber-soft', border: 'border-amber/40' },
  '高':   { dot: 'bg-neg',     text: 'text-neg',       bg: 'bg-coral-soft', border: 'border-coral/50' },
}

export function RiskCard({ risk, compact = false }: { risk?: RiskGauge; compact?: boolean }) {
  if (!risk?.available) return null
  const tone = RISK_TONE[risk.level ?? '中'] ?? RISK_TONE['中']
  return (
    <div className={cx('rounded-2xl border p-3', tone.bg, tone.border)}>
      <div className="flex items-center gap-2">
        <span className={cx('w-2.5 h-2.5 rounded-full', tone.dot)} />
        <div className="flex-1 min-w-0">
          <div className={cx('text-sm font-bold', tone.text)}>{risk.label}</div>
          <div className="text-[11px] text-muted">市场风险体制 · {risk.asOf}</div>
        </div>
        <div className={cx('text-2xl font-extrabold tnum', tone.text)}>{risk.level}</div>
      </div>
      {!compact && (
        <>
          <div className="mt-2.5 space-y-1.5">
            {(risk.inputs ?? []).map((inp) => (
              <div key={inp.name} className="flex items-center gap-2 text-xs">
                <span className={cx('w-1.5 h-1.5 rounded-full shrink-0',
                  inp.contribution > 0 ? 'bg-pos' : inp.contribution < 0 ? 'bg-neg' : 'bg-slate-300')} />
                <span className="font-semibold text-ink shrink-0">{inp.name}</span>
                <span className="tnum text-muted">{inp.value}</span>
                <span className="text-muted truncate hidden sm:inline">· {inp.note}</span>
                <span className={cx('ml-auto tnum font-bold shrink-0',
                  inp.contribution > 0 ? 'text-pos' : inp.contribution < 0 ? 'text-neg' : 'text-muted')}>
                  {inp.contribution > 0 ? `+${inp.contribution}` : inp.contribution}
                </span>
              </div>
            ))}
          </div>
          {risk.note && <p className="text-[10px] text-muted mt-2 leading-snug">{risk.note}</p>}
        </>
      )}
    </div>
  )
}

// ---- 行动建议卡：技术位/风险计推导，每条带「依据」真实数据点 + 可加入清单 ----
const KIND_META: Record<string, { label: string; border: string; chip: string }> = {
  add:   { label: '加仓参考', border: 'border-l-pos',   chip: 'bg-pos/10 text-pos' },
  trim:  { label: '减仓参考', border: 'border-l-amber', chip: 'bg-amber-soft text-amber-700' },
  watch: { label: '观察',     border: 'border-l-slate-300', chip: 'bg-canvas text-muted' },
  hedge: { label: '对冲',     border: 'border-l-neg',   chip: 'bg-coral-soft text-neg' },
}
const CONF_CN: Record<string, string> = { high: '高', med: '中', low: '低' }

function Level({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-lg bg-white/70 border border-line/70 px-2 py-1">
      <div className="text-[10px] text-muted">{label}</div>
      <div className={cx('text-sm font-bold tnum', tone)}>{value}</div>
    </div>
  )
}

export function ActionCard({ s, onAdopt }: { s: ActionSuggestion; onAdopt?: (s: ActionSuggestion) => void }) {
  const m = KIND_META[s.kind] ?? KIND_META.watch
  return (
    <div className={cx('rounded-xl border border-l-4 bg-white p-3', m.border, 'border-line')}>
      <div className="flex items-center gap-2 mb-1.5">
        <span className={cx('text-[11px] font-bold px-2 py-0.5 rounded-full', m.chip)}>{m.label}</span>
        <Link to={`/stock/${s.ticker}`} className="font-bold text-sm hover:underline">{s.ticker}</Link>
        <span className="text-[11px] text-muted">现价 <b className="tnum text-ink">${s.refPrice}</b></span>
        <span className="ml-auto text-[10px] text-muted">置信度 {CONF_CN[s.confidence] ?? s.confidence}</span>
      </div>

      {/* 关键位（全部来自真实价格历史 / 日历规则） */}
      <div className="flex flex-wrap gap-1.5 mb-2">
        {s.addBelow != null && <Level label="加仓位 ≤" value={`$${s.addBelow}`} tone="text-pos" />}
        {s.trimAbove != null && <Level label="减仓位 ≥" value={`$${s.trimAbove}`} tone="text-amber-700" />}
        {s.strike != null && <Level label="行权价" value={`$${s.strike}`} tone="text-neg" />}
        {s.expiration && <Level label="到期" value={s.expiration} />}
        {s.stop != null && s.instrument === 'stock' && <Level label="止损" value={`$${s.stop}`} tone="text-neg" />}
        {s.sizingHint && <Level label="仓位" value={s.sizingHint} />}
      </div>

      <p className="text-xs text-ink/80 leading-snug">{s.reason}</p>

      {/* 依据：真实数据点 */}
      <div className="mt-2 rounded-lg bg-canvas border border-line px-2.5 py-1.5">
        <div className="text-[10px] font-bold text-muted mb-0.5">依据（真实数据）</div>
        <ul className="space-y-0.5">
          {s.basis.map((b, i) => (
            <li key={i} className="text-[11px] text-muted leading-snug flex gap-1.5">
              <span className="text-brand shrink-0">·</span><span>{b}</span>
            </li>
          ))}
        </ul>
      </div>

      {onAdopt && (
        <button onClick={() => onAdopt(s)}
          className="mt-2 text-xs font-semibold text-brand hover:underline">+ 加入明日清单</button>
      )}
    </div>
  )
}
