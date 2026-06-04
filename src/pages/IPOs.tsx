import { Link } from 'react-router-dom'
import { useJson } from '../data/useJson'
import { Card, SectionTitle, DataBadge } from '../components/ui'
import { cx } from '../lib/format'
import type { IPOItem } from '../data/types'

const TODAY = '2026-06-02'
const daysTo = (d: string) => Math.round((Date.parse(d) - Date.parse(TODAY)) / 86400000)

// 取该日期所在 ISO 周的周一作为分组键
function weekKey(d: string) {
  const dt = new Date(d)
  const day = (dt.getDay() + 6) % 7 // 周一=0
  dt.setDate(dt.getDate() - day)
  return dt.toISOString().slice(0, 10)
}

export default function IPOs() {
  const { data: ipos, status } = useJson<IPOItem[]>('ipos.json', [])
  const sorted = [...ipos].sort((a, b) => a.date.localeCompare(b.date))
  const weeks = new Map<string, typeof sorted>()
  for (const i of sorted) {
    const k = weekKey(i.date)
    const arr = weeks.get(k) ?? []
    arr.push(i)
    weeks.set(k, arr)
  }

  return (
    <div>
      <div className="flex items-center gap-2 flex-wrap">
        <h1 className="text-2xl font-extrabold">IPO 日历</h1>
        <DataBadge status={status} />
      </div>
      <p className="text-sm text-muted">即将上市 · 可关注的打新标的。上市后自动接入完整股票详情页。</p>

      <div className="mt-2 rounded-xl bg-canvas border border-line text-muted text-xs px-3 py-2">
        ℹ️ 美股散户打新门槛较高且与券商相关。本页定位为「列出可关注的 IPO」，不做实际申购对接。
      </div>

      {Array.from(weeks.entries()).map(([wk, items]) => (
        <div key={wk}>
          <SectionTitle>{wk} 当周</SectionTitle>
          <Card className="p-2 divide-y divide-line">
            {items.map((ipo) => {
              const d = daysTo(ipo.date)
              return (
                <Link key={ipo.ticker} to={`/stock/${ipo.ticker}`} className="flex items-center gap-3 p-3 hover:bg-canvas rounded-lg">
                  <div className="w-12 shrink-0 text-center">
                    <div className="text-[11px] text-muted">{ipo.date.slice(5)}</div>
                    <div className={cx('text-[10px] font-bold', d <= 3 ? 'text-coral' : 'text-muted')}>
                      {d <= 0 ? '今日' : `${d}天后`}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold truncate">{ipo.name} <span className="text-muted font-mono text-xs">{ipo.ticker}</span></div>
                    <div className="text-[11px] text-muted">{ipo.sector} · {ipo.exchange}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-bold tnum">${ipo.priceRange[0]}–{ipo.priceRange[1]}</div>
                    <div className="text-[11px] text-muted">定价区间</div>
                  </div>
                </Link>
              )
            })}
          </Card>
        </div>
      ))}

      {sorted.length === 0 && (
        <p className="text-sm text-muted text-center py-12">
          {status === 'loading' ? '加载中…' : '近期暂无可关注的 IPO。'}
        </p>
      )}
    </div>
  )
}
