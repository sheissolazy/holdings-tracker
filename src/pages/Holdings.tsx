import { useState, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useData } from '../data/DataProvider'
import type { Signal } from '../data/types'
import { Card, SectionTitle, Avatar } from '../components/ui'
import { cx, fmtMoney, fmtPct } from '../lib/format'

const TYPE_LABEL: Record<string, string> = { '13f': '13F', options: '期权', ptr: 'Congress', social: '社交', statement: '言论', wechat: '公众号' }
type SortKey = 'ticker' | 'notional' | 'weightPct' | 'asOf'

export default function Holdings() {
  const { id } = useParams()
  const { peopleById, signalsByPerson } = useData()
  const p = id ? peopleById[id] : undefined
  const all = id ? signalsByPerson(id) : []
  const types = useMemo(() => ['全部', ...Array.from(new Set(all.map((s) => s.type)))], [all])
  const [type, setType] = useState('全部')
  const [sort, setSort] = useState<SortKey>('notional')
  const [asc, setAsc] = useState(false)

  if (!p) return <div className="py-16 text-center text-muted">未找到该人物</div>

  const rows = all
    .filter((s) => (type === '全部' ? true : s.type === type))
    .sort((a, b) => {
      let av: number | string = 0, bv: number | string = 0
      if (sort === 'ticker') { av = a.ticker; bv = b.ticker }
      else if (sort === 'asOf') { av = a.asOf; bv = b.asOf }
      else { av = (a[sort] as number) ?? -1; bv = (b[sort] as number) ?? -1 }
      const r = av < bv ? -1 : av > bv ? 1 : 0
      return asc ? r : -r
    })

  const toggleSort = (k: SortKey) => {
    if (k === sort) setAsc((v) => !v)
    else { setSort(k); setAsc(false) }
  }
  const arrow = (k: SortKey) => (k === sort ? (asc ? ' ↑' : ' ↓') : '')

  const totalNotional = all.reduce((sum, s) => sum + (s.notional ?? 0), 0)

  return (
    <div>
      <Link to={`/person/${p.id}`} className="text-sm text-muted hover:text-brand">← {p.name}</Link>

      <div className="flex items-center gap-3 mt-3">
        <Avatar id={p.id} size={48} />
        <div>
          <h1 className="text-2xl font-extrabold leading-tight">完整持仓 / 信号</h1>
          <p className="text-sm text-muted">{p.name} · {p.org}</p>
        </div>
      </div>

      {/* 汇总 */}
      <div className="grid grid-cols-3 gap-3 mt-4">
        <Card className="p-3"><div className="text-[11px] text-muted">条目</div><div className="text-lg font-bold tnum mt-0.5">{all.length}</div></Card>
        <Card className="p-3"><div className="text-[11px] text-muted">涉及标的</div><div className="text-lg font-bold tnum mt-0.5">{new Set(all.map((s) => s.ticker)).size}</div></Card>
        <Card className="p-3"><div className="text-[11px] text-muted">名义合计</div><div className="text-lg font-bold tnum mt-0.5">{fmtMoney(totalNotional)}</div></Card>
      </div>

      {/* 类型筛选 */}
      <div className="flex gap-2 overflow-x-auto no-sb mt-4 -mx-1 px-1">
        {types.map((t) => (
          <button key={t} onClick={() => setType(t)}
            className={cx('shrink-0 text-xs font-semibold px-3 py-1.5 rounded-full border',
              t === type ? 'bg-brand text-white border-brand' : 'bg-white text-muted border-line hover:bg-canvas')}>
            {t === '全部' ? '全部' : TYPE_LABEL[t] ?? t}
          </button>
        ))}
      </div>

      <SectionTitle>持仓表</SectionTitle>
      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[11px] text-muted border-b border-line">
              <Th onClick={() => toggleSort('ticker')}>标的{arrow('ticker')}</Th>
              <Th>类型</Th>
              <Th>方向 / 变动</Th>
              <Th onClick={() => toggleSort('notional')} right>名义{arrow('notional')}</Th>
              <Th onClick={() => toggleSort('weightPct')} right>占比{arrow('weightPct')}</Th>
              <Th onClick={() => toggleSort('asOf')} right>日期{arrow('asOf')}</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s, i) => <Row key={i} s={s} />)}
          </tbody>
        </table>
        {rows.length === 0 && <p className="text-sm text-muted text-center py-8">无匹配条目</p>}
      </Card>
      <p className="text-[11px] text-muted mt-2">点击表头排序 · 13F 有 ~45 天申报延迟，期权/Congress 披露亦有时滞。</p>
    </div>
  )
}

const Th = ({ children, onClick, right }: { children: React.ReactNode; onClick?: () => void; right?: boolean }) => (
  <th className={cx('font-semibold px-3 py-2 whitespace-nowrap', right ? 'text-right' : 'text-left', onClick && 'cursor-pointer hover:text-ink select-none')} onClick={onClick}>
    {children}
  </th>
)

function Row({ s }: { s: Signal }) {
  const dir = s.direction
    ? <span className={cx('font-bold', s.direction === 'put' ? 'text-neg' : s.direction === 'call' ? 'text-pos' : 'text-ink')}>{s.direction.toUpperCase()}</span>
    : null
  const chg = s.change ? <span className="text-muted">{({ new: '新建', add: '加仓', trim: '减仓', exit: '清仓', hold: '不变' } as Record<string, string>)[s.change]}{s.changePct != null ? ` ${fmtPct(s.changePct)}` : ''}</span> : null
  return (
    <tr className="border-b border-line/60 last:border-0 hover:bg-canvas">
      <td className="px-3 py-2.5">
        <Link to={`/stock/${s.ticker}`} className="font-bold text-brand hover:underline">{s.ticker}</Link>
      </td>
      <td className="px-3 py-2.5 text-xs text-muted">{TYPE_LABEL[s.type] ?? s.type}</td>
      <td className="px-3 py-2.5 text-xs">{dir} {dir && (chg || s.strike) ? ' ' : ''}{s.strike != null && <span className="text-muted">${s.strike}</span>} {chg}</td>
      <td className="px-3 py-2.5 text-right tnum">{s.notional != null ? fmtMoney(s.notional) : '—'}</td>
      <td className="px-3 py-2.5 text-right tnum">{s.weightPct != null ? `${s.weightPct}%` : '—'}</td>
      <td className="px-3 py-2.5 text-right tnum text-muted">{s.asOf.slice(5)}</td>
    </tr>
  )
}
