import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useData } from '../data/DataProvider'
import { useJson } from '../data/useJson'
import type { Stock } from '../data/types'
import { Card, SectionTitle, SignalCard } from '../components/ui'
import { cx } from '../lib/format'

export default function Analysis() {
  const { ticker } = useParams()
  const { signalsByTicker } = useData()
  const { data: s } = useJson<Stock | null>(`stocks/${ticker}.json`, null)
  const [regenAt, setRegenAt] = useState<string | null>(null)
  const [regenerating, setRegenerating] = useState(false)

  if (!s) return (
    <div className="py-16 text-center">
      <p className="text-sm text-muted">未找到 {ticker} 的分析数据</p>
      <Link to="/" className="text-sm text-brand mt-4 inline-block">← 返回</Link>
    </div>
  )

  const t = s.thesis
  const sigs = signalsByTicker(s.ticker)
  const hasThesis = t.bull.length > 0 || t.bear.length > 0 || t.watch.length > 0 || (t.sections?.length ?? 0) > 0

  // 「重新生成」在静态站只是 UI 演示：真实重生成在构建时由 Claude API 完成
  const regenerate = () => {
    setRegenerating(true)
    setTimeout(() => { setRegenerating(false); setRegenAt(new Date().toISOString().slice(0, 16).replace('T', ' ')) }, 1200)
  }

  return (
    <div>
      <Link to={`/stock/${s.ticker}`} className="text-sm text-muted hover:text-brand">← {s.ticker} 详情</Link>

      <div className="flex items-start justify-between mt-3 gap-4">
        <div>
          <h1 className="text-2xl font-extrabold">{s.ticker} · AI 完整分析</h1>
          <p className="text-sm text-muted">{s.name} · {s.sector}</p>
        </div>
        <button onClick={regenerate} disabled={regenerating}
          className={cx('text-sm font-semibold rounded-lg px-3 py-2 shrink-0', regenerating ? 'bg-canvas text-muted' : 'bg-brand text-white hover:opacity-90')}>
          {regenerating ? '生成中…' : '↻ 重新生成'}
        </button>
      </div>

      {hasThesis ? (
        <div className="mt-3 rounded-xl bg-amber-soft border border-amber/40 text-amber-700 text-xs px-3 py-2">
          ⚠️ 由 {t.model} 基于公开数据生成于 {regenAt ?? t.generatedAt?.slice(0, 16).replace('T', ' ')}，非投资建议。静态站「重新生成」为演示；真实重生成在构建时（GitHub Actions）调用 Claude 完成。
        </div>
      ) : (
        <div className="mt-3 rounded-xl bg-canvas border border-line text-muted text-sm px-3 py-3">
          AI 分析暂不可用 —— 下次数据管道运行（GitHub Actions）成功调用 Claude 后会自动生成。
        </div>
      )}

      {/* 多空 / 关注 速览 */}
      {hasThesis && (
        <div className="grid sm:grid-cols-3 gap-3 mt-5">
          <Box title="看多" color="pos" items={t.bull} />
          <Box title="看空" color="neg" items={t.bear} />
          <Box title="关注点" color="amber" items={t.watch} />
        </div>
      )}

      {/* 分段长文 */}
      {t.sections && t.sections.length > 0 && (
        <>
          <SectionTitle>完整论述</SectionTitle>
          <Card className="p-5 space-y-4">
            {t.sections.map((sec, i) => (
              <section key={i}>
                <h3 className="text-sm font-bold text-ink mb-1">{i + 1}. {sec.heading}</h3>
                <p className="text-sm text-muted leading-relaxed">{sec.body}</p>
              </section>
            ))}
          </Card>
        </>
      )}

      {/* 跟踪者动向 */}
      {sigs.length > 0 && (
        <>
          <SectionTitle>跟踪者动向 · {s.ticker}</SectionTitle>
          <div className="grid sm:grid-cols-2 gap-3">
            {sigs.map((sig, i) => <SignalCard key={i} s={sig} showPerson />)}
          </div>
        </>
      )}

      {/* 可比公司 */}
      {t.comparables && t.comparables.length > 0 && (
        <>
          <SectionTitle>可比公司</SectionTitle>
          <div className="grid sm:grid-cols-2 gap-3">
            {t.comparables.map((c) => (
              <Link key={c.ticker} to={`/stock/${c.ticker}`} className="block">
                <Card className="p-3 hover:bg-canvas flex items-center gap-3">
                  <div className="font-bold text-brand w-16">{c.ticker}</div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold truncate">{c.name}</div>
                    <div className="text-[11px] text-muted truncate">{c.note}</div>
                  </div>
                  <span className="ml-auto text-muted">→</span>
                </Card>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

const Box = ({ title, color, items }: { title: string; color: 'pos' | 'neg' | 'amber'; items: string[] }) => {
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
