import { Link } from 'react-router-dom'
import { tradePlan, peopleById } from '../data/mock'
import type { DraftAction } from '../data/types'
import { Card, SectionTitle, Avatar } from '../components/ui'
import { useLocalStorage } from '../lib/useLocalStorage'
import { cx } from '../lib/format'

const KIND = { earnings: '📊 财报', econ: '🏦 经济数据', ipo: '🚀 IPO', opex: '⏳ 期权到期', other: '•' }

export default function TradePlan() {
  const p = tradePlan
  const [actions, setActions] = useLocalStorage<DraftAction[]>(`plan-${p.forDate}`, p.draftActions)

  const update = (id: string, patch: Partial<DraftAction>) =>
    setActions((xs) => xs.map((a) => (a.id === id ? { ...a, ...patch } : a)))
  const remove = (id: string) => setActions((xs) => xs.filter((a) => a.id !== id))
  const add = () => setActions((xs) => [...xs, { id: crypto.randomUUID(), action: '', reason: '' }])
  const reset = () => setActions(p.draftActions)

  return (
    <div>
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-extrabold">明日交易计划</h1>
        <span className="text-[11px] font-bold bg-brand-soft text-brand px-2 py-0.5 rounded-full">提前一天</span>
      </div>
      <p className="text-sm text-muted">面向 {p.forDate} · 由 {p.model} 用今天的信息起草，你可以直接编辑</p>

      <div className="mt-3 rounded-xl bg-amber-soft border border-amber/40 text-amber-700 text-xs px-3 py-2">
        ⚠️ AI 草稿仅供参考，非投资建议。下面每条都可改 / 删 / 加，自动存到本地。
      </div>

      {/* 行动清单（可编辑） */}
      <SectionTitle action={
        <div className="flex gap-2">
          <button onClick={reset} className="text-xs text-muted hover:text-ink">恢复 AI 草稿</button>
          <button onClick={add} className="text-xs font-semibold text-brand">+ 添加一条</button>
        </div>
      }>明日行动清单</SectionTitle>

      <div className="space-y-2">
        {actions.map((a) => (
          <Card key={a.id} className={cx('p-3 flex gap-3', a.done && 'opacity-55')}>
            <button onClick={() => update(a.id, { done: !a.done })}
              className={cx('mt-0.5 w-5 h-5 rounded-md border-2 shrink-0 flex items-center justify-center text-[12px]',
                a.done ? 'bg-pos border-pos text-white' : 'border-line')}>
              {a.done ? '✓' : ''}
            </button>
            <div className="flex-1 min-w-0">
              <input
                value={a.action}
                onChange={(e) => update(a.id, { action: e.target.value })}
                placeholder="要做的事…"
                className={cx('w-full font-semibold text-sm bg-transparent outline-none', a.done && 'line-through')}
              />
              <textarea
                value={a.reason}
                onChange={(e) => update(a.id, { reason: e.target.value })}
                placeholder="原因 / 依据…"
                rows={2}
                className="w-full text-xs text-muted bg-transparent outline-none resize-none mt-0.5"
              />
            </div>
            <button onClick={() => remove(a.id)} className="text-muted hover:text-neg text-sm shrink-0">✕</button>
          </Card>
        ))}
        {actions.length === 0 && (
          <p className="text-sm text-muted text-center py-6">清单为空 · 点「+ 添加一条」或「恢复 AI 草稿」</p>
        )}
      </div>

      {/* 起草依据：明日催化剂 + 待处理信号（只读，给编辑提供上下文） */}
      <SectionTitle>起草依据</SectionTitle>
      <div className="grid sm:grid-cols-2 gap-3">
        <Card className="p-3">
          <div className="text-xs font-bold text-muted mb-2">明日催化剂</div>
          <ul className="space-y-1.5">
            {p.catalysts.map((c, i) => (
              <li key={i} className="text-sm flex items-center gap-2">
                <span>{KIND[c.kind]}</span><span className="flex-1">{c.label}</span>
                <span className={cx('text-[10px] font-bold px-1.5 py-0.5 rounded border',
                  c.impact === 'high' ? 'bg-amber-soft text-amber-700 border-amber/40' : 'bg-canvas text-muted border-line')}>{c.impact}</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card className="p-3">
          <div className="text-xs font-bold text-muted mb-2">待处理信号</div>
          <ul className="space-y-2">
            {p.pendingSignals.map((s, i) => (
              <li key={i} className="flex items-start gap-2">
                <Avatar id={s.personId} size={22} />
                <div className="text-xs">
                  <span className="font-semibold">{peopleById[s.personId]?.name}</span> ·{' '}
                  <Link to={`/stock/${s.ticker}`} className="font-bold text-brand hover:underline">{s.ticker}</Link>
                  <p className="text-muted leading-snug">{s.note}</p>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  )
}
