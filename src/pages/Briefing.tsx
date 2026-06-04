import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useData } from '../data/DataProvider'
import { Card, SectionTitle, Avatar, Sparkline, SentPill } from '../components/ui'
import { FxPanel } from '../components/FxPanel'
import { cx } from '../lib/format'
import type { Signal } from '../data/types'

const IMPACT = { high: 'bg-amber-soft text-amber-700 border-amber/40', med: 'bg-canvas text-muted border-line', low: 'bg-canvas text-muted border-line' }

// 真实信号的多空倾向（用于「共识 / 分歧」推导，不编造）
function bias(s: Signal): 'bull' | 'bear' | null {
  if (s.sentiment === 'bull') return 'bull'
  if (s.sentiment === 'bear') return 'bear'
  if (s.direction === 'put') return 'bear'
  if (s.direction === 'long' || s.direction === 'call') return 'bull'
  if (s.type === '13f') return 'bull'   // 13F 持仓 = 多头敞口
  return null
}

export default function Briefing() {
  const { people, signals, news: allNews, events, ipos, market, health, signalsByPerson, peopleById, articlesByPersonId } = useData()

  const today = new Date().toISOString().slice(0, 10)

  // 从真实信号推导「共识」：同一 ticker 被 ≥2 个不同的人持有/提及
  const consensus = useMemo(() => {
    const byTicker = new Map<string, Signal[]>()
    for (const s of signals) {
      if (!s.ticker) continue
      const arr = byTicker.get(s.ticker) ?? []
      arr.push(s)
      byTicker.set(s.ticker, arr)
    }
    let best: { ticker: string; sigs: Signal[]; people: number } | null = null
    for (const [ticker, sigs] of byTicker) {
      const distinct = new Set(sigs.map((s) => s.personId)).size
      if (distinct >= 2 && (!best || distinct > best.people)) best = { ticker, sigs, people: distinct }
    }
    return best
  }, [signals])

  // 从真实信号推导「分歧」：同一 ticker 同时存在多头与空头倾向
  const divergence = useMemo(() => {
    const byTicker = new Map<string, Signal[]>()
    for (const s of signals) {
      if (!s.ticker) continue
      const arr = byTicker.get(s.ticker) ?? []
      arr.push(s)
      byTicker.set(s.ticker, arr)
    }
    for (const [ticker, sigs] of byTicker) {
      const biases = new Set(sigs.map(bias).filter(Boolean))
      if (biases.has('bull') && biases.has('bear')) return { ticker, sigs }
    }
    return null
  }, [signals])

  const exportPdf = () => {
    const prev = document.title
    document.title = `今日Briefing_${today}`
    window.print()
    setTimeout(() => { document.title = prev }, 800)
  }

  // 合并「事件」与「新闻」为一条以今天为中心的时间线（均为真实数据，缺则空）
  const upcoming = [...events].filter((e) => e.date >= today).sort((a, b) => a.date.localeCompare(b.date))
  const recent = [...allNews].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)).slice(0, 8)

  // 今日要点：从真实数据派生（无数据则不显示该卡）
  const highlights: { t: string; d: string; c: string }[] = []
  if (consensus) highlights.push({ t: '共识持仓', d: `${consensus.people} 位跟踪者持有 ${consensus.ticker}`, c: 'amber' })
  if (divergence) highlights.push({ t: '多空分歧', d: `${divergence.ticker} 多空并存`, c: 'coral' })
  if (upcoming[0]) highlights.push({ t: '即将事件', d: `${upcoming[0].date.slice(5)} ${upcoming[0].label}`, c: 'brand' })
  if (recent[0]) highlights.push({ t: '最新动态', d: recent[0].title, c: 'detail' })
  const cards = highlights.slice(0, 4)

  return (
    <div>
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-extrabold">今日 Briefing</h1>
          <p className="text-sm text-muted">{today} · 数据每日由管道更新</p>
        </div>
        <div className="flex gap-2 no-print">
          <button onClick={exportPdf} className="text-sm font-semibold border border-line bg-white text-ink rounded-lg px-3 py-2 hover:bg-canvas">
            导出 PDF
          </button>
          <Link to="/plan" className="text-sm font-semibold bg-brand text-white rounded-lg px-3 py-2">看明日计划 →</Link>
        </div>
      </div>

      {/* X 登录失效提示：cookie 过期 → 社交信号暂停更新，需手动刷新 cookie */}
      {health.x === 'expired' && (
        <div className="mt-3 rounded-xl border border-amber/40 bg-amber-soft px-4 py-2.5 flex items-start gap-2 no-print">
          <span className="text-amber-700 font-bold">⚠️</span>
          <p className="text-[13px] text-amber-700 leading-snug">
            X（Twitter）登录已过期，<b>社交信号（Musk / Serenity）暂停更新</b>。
            请在浏览器重新登录 x.com，复制新的 <code className="font-mono">auth_token</code> 与
            <code className="font-mono"> ct0</code> cookie 更新到 GitHub Secrets。
            <Link to="/settings" className="underline ml-1">前往设置查看 →</Link>
          </p>
        </div>
      )}

      {/* 今日要点（真实派生，空则隐藏） */}
      {cards.length > 0 && (
        <>
          <SectionTitle>今日要点</SectionTitle>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {cards.map((k) => (
              <Card key={k.t} className={cx('p-3 border-l-4', k.c === 'detail' && 'border-l-detail', k.c === 'coral' && 'border-l-coral', k.c === 'amber' && 'border-l-amber', k.c === 'brand' && 'border-l-brand')}>
                <div className="text-[11px] font-bold text-muted">{k.t}</div>
                <div className="text-sm font-medium mt-1 leading-snug line-clamp-2">{k.d}</div>
              </Card>
            ))}
          </div>
        </>
      )}

      <div className="grid lg:grid-cols-3 gap-5 mt-2">
        {/* left/main */}
        <div className="lg:col-span-2">
          <SectionTitle action={<Link to="/settings" className="text-xs text-brand">管理 →</Link>}>你跟踪的人</SectionTitle>
          <Card className="divide-y divide-line">
            {people.map((p) => {
              const isSource = p.signalTypes.includes('wechat')
              const last = signalsByPerson(p.id)[0]
              const lastArticle = isSource ? articlesByPersonId(p.id)[0] : undefined
              return (
                <Link key={p.id} to={`/person/${p.id}`} className="flex items-center gap-3 p-3 hover:bg-canvas">
                  <Avatar id={p.id} />
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-sm truncate">{p.name}</div>
                    <div className="text-[11px] text-muted truncate">{p.org} · {p.signalTypes.join(' / ')}</div>
                  </div>
                  {(() => {
                    const when = isSource ? lastArticle?.publishedAt : last?.asOf
                    return when ? (
                      <div className="hidden sm:block text-[11px] text-muted text-right">
                        最近：<span className="font-semibold text-ink">{when.slice(5)}</span>
                      </div>
                    ) : null
                  })()}
                  <Sparkline data={p.sparkline ?? []} color={p.avatarColor} />
                </Link>
              )
            })}
          </Card>

          {/* 共识 / 分歧（仅在真实推导出时显示） */}
          {(consensus || divergence) && (
            <>
              <SectionTitle>共识 & 分歧</SectionTitle>
              <div className="grid sm:grid-cols-2 gap-3">
                {consensus && (
                  <Card className="p-3 bg-amber-soft border-amber/40">
                    <div className="text-xs font-bold text-amber-700 mb-2">🤝 共识持仓 · <Link to={`/stock/${consensus.ticker}`} className="underline">{consensus.ticker}</Link></div>
                    <div className="space-y-1.5">
                      {dedupePeople(consensus.sigs).map((s, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs">
                          <Avatar id={s.personId} size={20} />
                          <span className="font-medium">{peopleById[s.personId]?.name}</span>
                          {s.sentiment && <SentPill s={s.sentiment} />}
                        </div>
                      ))}
                    </div>
                  </Card>
                )}
                {divergence && (
                  <Card className="p-3 bg-coral-soft border-coral/40">
                    <div className="text-xs font-bold text-coral mb-2">⚔️ 多空分歧 · <Link to={`/stock/${divergence.ticker}`} className="underline">{divergence.ticker}</Link></div>
                    <div className="space-y-1.5">
                      {divergence.sigs.map((s, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs">
                          <Avatar id={s.personId} size={20} />
                          <span className="font-medium">{peopleById[s.personId]?.name}</span>
                          {s.sentiment && <SentPill s={s.sentiment} />}
                          <span className="text-muted ml-auto">{s.type === 'options' ? `${s.direction?.toUpperCase()} ${s.strike ?? ''}` : s.type}</span>
                        </div>
                      ))}
                    </div>
                  </Card>
                )}
              </div>
            </>
          )}

          {/* 动态：事件 + 新闻合并时间线 */}
          <SectionTitle action={<Link to="/news" className="text-xs text-brand">全部 →</Link>}>动态 · 事件与新闻</SectionTitle>
          <Card className="px-4 divide-y divide-line">
            {upcoming.map((e, i) => (
              <div key={`e${i}`} className="flex items-center gap-3 py-2.5">
                <DateChip date={e.date} />
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-soft text-amber-700 shrink-0">事件</span>
                <div className="flex-1 text-sm">{e.label}</div>
                <span className={cx('text-[10px] font-bold px-1.5 py-0.5 rounded border', IMPACT[e.impact])}>{e.impact}</span>
              </div>
            ))}
            {recent.map((n) => {
              const hasUrl = !!n.url && n.url !== '#'
              const body = (
                <>
                  <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-brand-soft text-brand">新闻</span>
                    {n.tags.map((t) => (
                      <span key={t} className={cx('text-[10px] font-semibold px-1.5 py-0.5 rounded border',
                        t === '猫笔刀' ? 'bg-detail-soft text-detail border-detail/30' : 'bg-canvas text-muted border-line')}>{t}</span>
                    ))}
                    <span className="text-[11px] text-muted ml-auto">{n.source}</span>
                  </div>
                  <p className="text-sm leading-snug group-hover:text-brand">{n.title} {hasUrl && <span className="text-muted">↗</span>}</p>
                </>
              )
              return (
                <div key={n.id} className="flex gap-3 py-2.5">
                  <DateChip date={n.publishedAt} />
                  {hasUrl
                    ? <a href={n.url} target="_blank" rel="noreferrer" className="flex-1 min-w-0 group">{body}</a>
                    : <div className="flex-1 min-w-0 group">{body}</div>}
                </div>
              )
            })}
            {upcoming.length === 0 && recent.length === 0 && (
              <p className="text-sm text-muted py-4">暂无事件或新闻。</p>
            )}
          </Card>
        </div>

        {/* right rail */}
        <div>
          <SectionTitle action={<Link to="/ipos" className="text-xs text-brand">更多</Link>}>本周打新 IPO</SectionTitle>
          <Card className="p-2 divide-y divide-line">
            {ipos.length ? ipos.map((ipo) => (
              <Link key={ipo.ticker} to={`/stock/${ipo.ticker}`} className="flex items-center gap-2 p-2 hover:bg-canvas rounded-lg">
                <div className="flex-1">
                  <div className="text-sm font-semibold">{ipo.name}</div>
                  <div className="text-[11px] text-muted">{ipo.sector} · {ipo.exchange}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs tnum">${ipo.priceRange[0]}–{ipo.priceRange[1]}</div>
                  <div className="text-[11px] text-muted">{ipo.date.slice(5)}</div>
                </div>
              </Link>
            )) : <p className="text-sm text-muted p-3">近期暂无 IPO。</p>}
          </Card>

          {market.length > 0 && (
            <>
              <SectionTitle>市场背景 · 商品 · 汇率</SectionTitle>
              {['大盘', '商品'].map((g) => {
                const items = market.filter((m) => (m.group ?? '大盘') === g)
                if (!items.length) return null
                return (
                  <div key={g} className="mb-3">
                    <div className="text-[11px] font-bold text-muted mb-1.5">{g}</div>
                    <div className="grid grid-cols-3 gap-2">
                      {items.map((m) => (
                        <Card key={m.label} className="p-2.5 text-center">
                          <div className="text-[11px] text-muted truncate">{m.label}</div>
                          <div className="text-sm font-bold tnum mt-0.5">{m.value}</div>
                          <div className={cx('text-[11px] font-semibold tnum', m.pos ? 'text-pos' : 'text-neg')}>{m.chg}</div>
                        </Card>
                      ))}
                    </div>
                  </div>
                )
              })}
              <FxPanel items={market.filter((m) => (m.group ?? '大盘') === '汇率')} />
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// 同一个人在某 ticker 可能有多条信号 → 共识列表里每人只显示一次
function dedupePeople(sigs: Signal[]): Signal[] {
  const seen = new Set<string>()
  const out: Signal[] = []
  for (const s of sigs) {
    if (seen.has(s.personId)) continue
    seen.add(s.personId)
    out.push(s)
  }
  return out
}

function DateChip({ date }: { date: string }) {
  return (
    <div className="w-10 shrink-0 text-center pt-0.5">
      <div className="text-[11px] font-semibold tnum text-muted">{date.slice(5)}</div>
    </div>
  )
}
