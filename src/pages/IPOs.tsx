import { Link } from 'react-router-dom'
import { useJson } from '../data/useJson'
import { Card, SectionTitle, DataBadge } from '../components/ui'
import { cx } from '../lib/format'
import type { IPOItem } from '../data/types'

const TODAY = new Date().toISOString().slice(0, 10)
const daysTo = (d: string) => Math.round((Date.parse(d) - Date.parse(TODAY)) / 86400000)

// 「现在可申购」：尚未定价（status=expected/filed）且定价日 ≥ 今天的 IPO。
//   已定价(priced)/已撤回(withdrawn) → 无法再提交申购请求，排除。
const isRequestable = (i: IPOItem) =>
  i.status !== 'priced' && i.status !== 'withdrawn' && daysTo(i.date) >= 0

export default function IPOs() {
  const { data: ipos, status } = useJson<IPOItem[]>('ipos.json', [])
  const open = ipos
    .filter(isRequestable)
    .sort((a, b) => a.date.localeCompare(b.date))

  return (
    <div>
      <div className="flex items-center gap-2 flex-wrap">
        <h1 className="text-2xl font-extrabold">IPO 申购</h1>
        <DataBadge status={status} />
      </div>
      <p className="text-sm text-muted">现在可提交申购请求的标的（如 Robinhood IPO Access）。上市后自动接入完整股票详情页。</p>

      <div className="mt-2 rounded-xl bg-canvas border border-line text-muted text-xs px-3 py-2">
        ℹ️ 列出所有「尚未定价、当前可申购」的 IPO，按预计定价日排序。定价日临近会标红提醒；已定价 / 已撤回的不再显示。
      </div>

      <SectionTitle>现在可申购 · 共 {open.length} 只</SectionTitle>
      <Card className="p-2 divide-y divide-line">
        {open.map((ipo) => {
          const d = daysTo(ipo.date)
          const soon = d <= 3
          const head = (
            <>
              <div className="w-14 shrink-0 text-center">
                <div className="text-[11px] text-muted">{ipo.date.slice(5)}</div>
                <div className={cx('text-[10px] font-bold', soon ? 'text-coral' : 'text-muted')}>
                  {d <= 0 ? '今日定价' : `${d} 天后`}
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold truncate">
                  {ipo.name}{' '}
                  <span className="text-muted font-mono text-xs">{ipo.ticker}{ipo.tickerPending ? '（拟用）' : ''}</span>
                  {ipo.curated && <span className="ml-1.5 text-[9px] font-bold px-1 py-0.5 rounded bg-detail-soft text-detail align-middle">补录</span>}
                </div>
                <div className="text-[11px] text-muted">{ipo.sector !== '—' ? `${ipo.sector} · ` : ''}{ipo.exchange}</div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-sm font-bold tnum">${ipo.priceRange[0]}{ipo.priceRange[1] !== ipo.priceRange[0] ? `–${ipo.priceRange[1]}` : ''}</div>
                <div className="text-[11px] text-muted">{ipo.valuation ? `估值 ${ipo.valuation}` : '定价区间'}</div>
              </div>
            </>
          )
          // 补录条目（如 SpaceX）：尚无股票详情页 → 不跳转，改为展开券商 + 数据出处
          if (ipo.curated) {
            return (
              <div key={ipo.ticker} className="p-3">
                <div className="flex items-center gap-3">{head}</div>
                <div className="pl-[3.75rem] mt-1.5 space-y-1">
                  {ipo.brokers?.length ? (
                    <div className="flex flex-wrap items-center gap-1">
                      <span className="text-[10px] text-muted">可申购：</span>
                      {ipo.brokers.map((b) => (
                        <span key={b} className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-canvas border border-line text-ink">{b}</span>
                      ))}
                    </div>
                  ) : null}
                  {ipo.note && <div className="text-[11px] text-muted leading-snug">{ipo.note}</div>}
                  {ipo.source && (
                    <a href={ipo.source} target="_blank" rel="noreferrer" className="text-[11px] text-brand hover:underline">数据来源 ↗</a>
                  )}
                </div>
              </div>
            )
          }
          return (
            <Link key={ipo.ticker} to={`/stock/${ipo.ticker}`} className="flex items-center gap-3 p-3 hover:bg-canvas rounded-lg">
              {head}
            </Link>
          )
        })}

        {open.length === 0 && (
          <p className="text-sm text-muted text-center py-12">
            {status === 'loading' ? '加载中…' : '当前暂无可申购的 IPO。'}
          </p>
        )}
      </Card>
    </div>
  )
}
