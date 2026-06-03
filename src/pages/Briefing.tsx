import { Link } from 'react-router-dom'
import { useData } from '../data/DataProvider'
import { Card, SectionTitle, Avatar, Sparkline, NewsRow, Pct, SentPill } from '../components/ui'
import { cx } from '../lib/format'

const IMPACT = { high: 'bg-amber-soft text-amber-700 border-amber/40', med: 'bg-canvas text-muted border-line', low: 'bg-canvas text-muted border-line' }

export default function Briefing() {
  const { people, signals, news: allNews, events, ipos, market, signalsByPerson, peopleById, articlesByPersonId } = useData()
  const consensus = signals.filter((s) => s.ticker === 'MRVL')         // 共识：多人看多 MRVL
  const divergence = signals.filter((s) => s.ticker === 'NVDA')         // 分歧：Leopold put vs Pelosi/Trump 看多

  const exportPdf = () => {
    const prev = document.title
    document.title = '今日Briefing_2026-06-01'
    window.print()
    setTimeout(() => { document.title = prev }, 800)
  }

  // 合并「事件」与「新闻」为一条以今天为中心的时间线
  const TODAY = '2026-06-01'
  const upcoming = [...events].filter((e) => e.date > TODAY).sort((a, b) => a.date.localeCompare(b.date))
  const recent = [...allNews].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)).slice(0, 8)

  return (
    <div>
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-extrabold">今日 Briefing</h1>
          <p className="text-sm text-muted">2026-06-01 周一 · 数据每日由管道更新</p>
        </div>
        <div className="flex gap-2 no-print">
          <button onClick={exportPdf} className="text-sm font-semibold border border-line bg-white text-ink rounded-lg px-3 py-2 hover:bg-canvas">
            导出 PDF
          </button>
          <Link to="/plan" className="text-sm font-semibold bg-brand text-white rounded-lg px-3 py-2">看明日计划 →</Link>
        </div>
      </div>

      {/* 今日要点 */}
      <SectionTitle>今日要点</SectionTitle>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { t: '13F 申报', d: 'Situational Awareness 披露 ~$8.5B 芯片股 put', c: 'detail' },
          { t: 'Congress', d: 'Pelosi 新建 NVDA LEAPS call', c: 'coral' },
          { t: '本周关注', d: 'MRVL 财报（盘后）+ FOMC 纪要 + 非农', c: 'amber' },
          { t: '市场异动', d: 'MRVL +6.4%，黄仁勋背书发酵', c: 'brand' },
        ].map((k) => (
          <Card key={k.t} className={cx('p-3 border-l-4', k.c === 'detail' && 'border-l-detail', k.c === 'coral' && 'border-l-coral', k.c === 'amber' && 'border-l-amber', k.c === 'brand' && 'border-l-brand')}>
            <div className="text-[11px] font-bold text-muted">{k.t}</div>
            <div className="text-sm font-medium mt-1 leading-snug">{k.d}</div>
          </Card>
        ))}
      </div>

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

          {/* 共识 / 分歧 */}
          <SectionTitle>共识 & 分歧</SectionTitle>
          <div className="grid sm:grid-cols-2 gap-3">
            <Card className="p-3 bg-amber-soft border-amber/40">
              <div className="text-xs font-bold text-amber-700 mb-2">🤝 共识持仓 · <Link to="/stock/MRVL" className="underline">MRVL</Link></div>
              <div className="space-y-1.5">
                {consensus.map((s, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <Avatar id={s.personId} size={20} />
                    <span className="font-medium">{peopleById[s.personId]?.name}</span>
                    {s.sentiment && <SentPill s={s.sentiment} />}
                  </div>
                ))}
              </div>
            </Card>
            <Card className="p-3 bg-coral-soft border-coral/40">
              <div className="text-xs font-bold text-coral mb-2">⚔️ 多空分歧 · <Link to="/stock/NVDA" className="underline">NVDA</Link></div>
              <div className="space-y-1.5">
                {divergence.map((s, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <Avatar id={s.personId} size={20} />
                    <span className="font-medium">{peopleById[s.personId]?.name}</span>
                    {s.sentiment && <SentPill s={s.sentiment} />}
                    <span className="text-muted ml-auto">{s.type === 'options' ? `${s.direction?.toUpperCase()} ${s.strike}` : s.type}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* 动态：事件 + 新闻合并时间线 */}
          <SectionTitle action={<Link to="/news" className="text-xs text-brand">全部 →</Link>}>动态 · 事件与新闻</SectionTitle>
          <Card className="px-4 divide-y divide-line">
            {/* 即将到来的事件 */}
            {upcoming.map((e, i) => (
              <div key={`e${i}`} className="flex items-center gap-3 py-2.5">
                <DateChip date={e.date} />
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-soft text-amber-700 shrink-0">事件</span>
                <div className="flex-1 text-sm">{e.label}</div>
                <span className={cx('text-[10px] font-bold px-1.5 py-0.5 rounded border', IMPACT[e.impact])}>{e.impact}</span>
              </div>
            ))}
            {/* 今天分隔线 */}
            <div className="flex items-center gap-2 py-2">
              <div className="h-px bg-line flex-1" />
              <span className="text-[11px] font-semibold text-muted">今天 · 06-01</span>
              <div className="h-px bg-line flex-1" />
            </div>
            {/* 最近新闻（含公众号「猫笔刀」） */}
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
          </Card>
        </div>

        {/* right rail */}
        <div>
          <SectionTitle action={<Link to="/ipos" className="text-xs text-brand">更多</Link>}>本周打新 IPO</SectionTitle>
          <Card className="p-2 divide-y divide-line">
            {ipos.map((ipo) => (
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
            ))}
          </Card>

          <SectionTitle>市场背景</SectionTitle>
          <div className="grid grid-cols-3 gap-2">
            {market.map((m) => (
              <Card key={m.label} className="p-2.5 text-center">
                <div className="text-[11px] text-muted">{m.label}</div>
                <div className="text-sm font-bold tnum mt-0.5">{m.value}</div>
                <div className={cx('text-[11px] font-semibold tnum', m.pos ? 'text-pos' : 'text-neg')}>{m.chg}</div>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function DateChip({ date }: { date: string }) {
  return (
    <div className="w-10 shrink-0 text-center pt-0.5">
      <div className="text-[11px] font-semibold tnum text-muted">{date.slice(5)}</div>
    </div>
  )
}
