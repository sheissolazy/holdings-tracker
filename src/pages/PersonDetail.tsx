import { useParams, Link } from 'react-router-dom'
import { useData } from '../data/DataProvider'
import { Card, SectionTitle, Avatar, Sparkline, SignalCard, NewsRow } from '../components/ui'
import { cx } from '../lib/format'

export default function PersonDetail() {
  const { id } = useParams()
  const { peopleById, signalsByPerson, news: allNews } = useData()
  const p = id ? peopleById[id] : undefined
  if (!p) return <div className="py-16 text-center text-muted">未找到该人物</div>

  // 跟踪源（微信公众号等）—— 没有持仓/信号，只有文章流
  const isSource = p.signalTypes.includes('wechat')
  if (isSource) return <SourceDetail p={p} />

  const sigs = signalsByPerson(p.id)
  const isSocial = p.signalTypes.every((t) => t === 'social' || t === 'statement')
  const tickers = [...new Set(sigs.map((s) => s.ticker).filter(Boolean))]
  const relNews = allNews.filter((n) => n.tags.includes(p.name.split(' ')[0]) || tickers.some((t) => n.tags.includes(t)))

  const stats = isSocial
    ? [['喊单/言论', String(sigs.length)], ['提及标的', String(tickers.length)], ['平台', p.social?.platform.toUpperCase() ?? '—'], ['最近', sigs[0]?.asOf.slice(5) ?? '—']]
    : [['持仓/信号', String(sigs.length)], ['涉及标的', String(tickers.length)], ['CIK', p.cik ?? '—'], ['最近申报', sigs[0]?.asOf ?? '—']]

  return (
    <div>
      <Link to="/" className="text-sm text-muted hover:text-brand">← 返回</Link>

      {/* Hero */}
      <div className="flex items-center gap-4 mt-3">
        <Avatar id={p.id} size={64} />
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-extrabold leading-tight">{p.name}</h1>
          <p className="text-sm text-muted">{p.org}</p>
          <p className="text-xs text-muted mt-0.5">{p.style}</p>
        </div>
        <Sparkline data={p.sparkline ?? []} color={p.avatarColor} w={96} h={36} />
      </div>
      <div className="flex flex-wrap gap-1.5 mt-2">
        {p.signalTypes.map((t) => (
          <span key={t} className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-detail-soft text-detail">{t}</span>
        ))}
      </div>

      {/* stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
        {stats.map(([label, v]) => (
          <Card key={label} className="p-3">
            <div className="text-[11px] text-muted">{label}</div>
            <div className="text-lg font-bold tnum mt-0.5 truncate">{v}</div>
          </Card>
        ))}
      </div>

      {/* signals */}
      <SectionTitle action={!isSocial && sigs.length > 0 ? <Link to={`/holdings/${p.id}`} className="text-xs text-brand">完整持仓 →</Link> : undefined}>
        {isSocial ? '近期喊单 / 言论' : '本季度操作 / 持仓'}
      </SectionTitle>
      <div className="grid sm:grid-cols-2 gap-3">
        {sigs.map((s, i) => <SignalCard key={i} s={s} showPerson={false} showTicker />)}
      </div>

      {/* news */}
      <SectionTitle>相关新闻</SectionTitle>
      <Card className="px-4 divide-y divide-line">
        {(relNews.length ? relNews : allNews.slice(0, 3)).map((n) => <NewsRow key={n.id} n={n} />)}
      </Card>
    </div>
  )
}

// ---- 跟踪源详情页（微信公众号「猫笔刀」等）：文章列表（最新 + 历史） ----
import type { Person } from '../data/types'
function SourceDetail({ p }: { p: Person }) {
  const { articlesByPersonId } = useData()
  const articles = [...articlesByPersonId(p.id)].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
  const latest = articles[0]
  const past = articles.slice(1)
  const stats = [
    ['文章数', String(articles.length)],
    ['最近更新', latest?.publishedAt.slice(5) ?? '—'],
    ['类型', '微信公众号'],
    ['接入', 'X 同步'],
  ]

  return (
    <div>
      <Link to="/" className="text-sm text-muted hover:text-brand">← 返回</Link>

      {/* Hero */}
      <div className="flex items-center gap-4 mt-3">
        <Avatar id={p.id} size={64} />
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-extrabold leading-tight">{p.name}</h1>
          <p className="text-sm text-muted">{p.org}</p>
          <p className="text-xs text-muted mt-0.5">{p.style}</p>
        </div>
        <Sparkline data={p.sparkline ?? []} color={p.avatarColor} w={96} h={36} />
      </div>
      <div className="flex flex-wrap gap-1.5 mt-2">
        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-detail-soft text-detail">公众号</span>
      </div>

      {/* stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
        {stats.map(([label, v]) => (
          <Card key={label} className="p-3">
            <div className="text-[11px] text-muted">{label}</div>
            <div className="text-lg font-bold tnum mt-0.5 truncate">{v}</div>
          </Card>
        ))}
      </div>

      {/* 最新一篇 */}
      {latest && (
        <>
          <SectionTitle>最新文章</SectionTitle>
          <a href={latest.url} target="_blank" rel="noreferrer" className="block group">
            <Card className="p-4 border-l-4 border-l-detail hover:bg-canvas">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-detail-soft text-detail">新</span>
                <span className="text-[11px] text-muted">{latest.publishedAt}</span>
              </div>
              <p className="text-base font-semibold leading-snug group-hover:text-brand">{latest.title} <span className="text-muted">↗</span></p>
              {latest.summary && <p className="text-sm text-muted mt-1 leading-snug line-clamp-3">{latest.summary}</p>}
              <div className="flex flex-wrap gap-1.5 mt-2">
                {latest.tags.map((t) => (
                  <span key={t} className="text-[10px] font-semibold px-1.5 py-0.5 rounded border bg-canvas text-muted border-line">{t}</span>
                ))}
              </div>
            </Card>
          </a>
        </>
      )}

      {/* 历史文章 */}
      <SectionTitle>历史文章</SectionTitle>
      <Card className="px-4 divide-y divide-line">
        {past.length === 0 && <p className="text-sm text-muted py-4 text-center">暂无更早文章</p>}
        {past.map((n) => (
          <a key={n.id} href={n.url} target="_blank" rel="noreferrer" className="flex gap-3 py-3 group">
            <div className="w-12 shrink-0 text-[11px] font-semibold tnum text-muted pt-0.5">{n.publishedAt.slice(5)}</div>
            <div className="flex-1 min-w-0">
              <p className="text-sm leading-snug group-hover:text-brand">{n.title} <span className="text-muted">↗</span></p>
              {n.summary && <p className="text-xs text-muted mt-0.5 leading-snug line-clamp-2">{n.summary}</p>}
              <div className="flex flex-wrap gap-1.5 mt-1">
                {n.tags.map((t) => (
                  <span key={t} className={cx('text-[10px] font-semibold px-1.5 py-0.5 rounded border bg-canvas text-muted border-line')}>{t}</span>
                ))}
              </div>
            </div>
          </a>
        ))}
      </Card>

      <p className="text-[11px] text-muted mt-4">
        文章经微信公众号 → RSS 桥（Wechat2RSS / wewe-rss）接入，约 6–24h 延迟，外链原文。
      </p>
    </div>
  )
}
