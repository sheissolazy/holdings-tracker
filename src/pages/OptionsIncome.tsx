import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useJson } from '../data/useJson'
import { Card, SectionTitle } from '../components/ui'
import { cx } from '../lib/format'

// ---- options.json（管道 fetch_options.py 产出，Cboe 真实延迟行情）----
interface OptRow { k: number; bid: number; ask: number; mid: number; delta: number; iv: number; oi: number; vol: number }
interface Bucket { key: string; expiry: string; dte: number; calls: OptRow[]; puts: OptRow[] }
interface Chain { spot: number; quoteTime: string; buckets: Bucket[] }
interface OptionsData { asOf: string; source: string; tickers: Record<string, Chain> }
const EMPTY: OptionsData = { asOf: '', source: '', tickers: {} }

// 风险档 → 目标 delta（≈到期时被行权的概率，收租者的核心标尺）
const RISK = [
  { label: '保守', delta: 0.10, note: '≈10% 被行权' },
  { label: '中性', delta: 0.20, note: '≈20% 被行权' },
  { label: '激进', delta: 0.30, note: '≈30% 被行权' },
] as const

type Strat = 'cc' | 'csp'
const BUCKET_LABEL: Record<string, string> = { '7-14': '7–14 天', '14-30': '14–30 天', '30-45': '30–45 天' }

// 每行合约的收租账本（全部由真实报价推导；年化为简单外推，仅供比较）
function economics(r: OptRow, strat: Strat, spot: number, dte: number) {
  const collateral = strat === 'cc' ? spot * 100 : r.k * 100
  const premium = r.mid * 100
  const yieldPct = collateral > 0 ? (premium / collateral) * 100 : 0
  const annualPct = dte > 0 ? yieldPct * (365 / dte) : 0
  const breakeven = strat === 'cc' ? spot - r.mid : r.k - r.mid
  return { collateral, premium, yieldPct, annualPct, breakeven, assignPct: Math.abs(r.delta) * 100 }
}

// 在一侧合约里挑「|Δ| 最接近目标」的一张（过滤掉 Δ 异常的深度实值/僵尸盘）
function pick(rows: OptRow[], target: number): OptRow | undefined {
  const usable = rows.filter((r) => { const d = Math.abs(r.delta); return d >= 0.02 && d <= 0.6 })
  if (!usable.length) return undefined
  return usable.reduce((a, b) => (Math.abs(Math.abs(a.delta) - target) <= Math.abs(Math.abs(b.delta) - target) ? a : b))
}

const $ = (n: number, d = 2) => n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })

export default function OptionsIncome() {
  const { data, status } = useJson<OptionsData>('options.json', EMPTY)
  const tickers = Object.keys(data.tickers)
  const [tk, setTk] = useState<string>('')
  const [strat, setStrat] = useState<Strat>('csp')
  const [riskIdx, setRiskIdx] = useState(1)
  const [bucketKey, setBucketKey] = useState('14-30')

  const cur = tk && data.tickers[tk] ? tk : tickers[0]
  const chain = cur ? data.tickers[cur] : undefined
  const bucket = useMemo(() => {
    if (!chain) return undefined
    return chain.buckets.find((b) => b.key === bucketKey) ?? chain.buckets[0]
  }, [chain, bucketKey])

  const rows = bucket ? (strat === 'cc' ? bucket.calls : bucket.puts) : []
  const target = RISK[riskIdx].delta
  const best = bucket ? pick(rows, target) : undefined
  const bestEco = best && chain && bucket ? economics(best, strat, chain.spot, bucket.dte) : undefined

  if (status !== 'loading' && tickers.length === 0) {
    return (
      <div>
        <h1 className="text-2xl font-extrabold">期权收租</h1>
        <Card className="p-8 mt-4 text-center text-muted text-sm">
          期权链数据暂缺——管道本轮未抓到 Cboe 行情（无假数据原则：抓不到就留空，不编造）。
          <br />下次数据更新后自动恢复。
        </Card>
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-2xl font-extrabold">期权收租</h1>
      <p className="text-sm text-muted mt-1">
        把股票「租」出去：卖出期权收权利金，像收租一样赚时间价值。真实 Cboe 报价（15 分钟延迟），非估算。
      </p>

      {/* 标的 */}
      <div className="flex flex-wrap gap-1.5 mt-4">
        {tickers.map((t) => (
          <button key={t} onClick={() => setTk(t)}
            className={cx('px-3 py-1.5 rounded-lg text-sm font-bold border',
              t === cur ? 'bg-brand text-white border-brand' : 'bg-white text-muted border-line hover:bg-canvas')}>
            {t}
          </button>
        ))}
      </div>

      {/* 策略 + 风险档 */}
      <div className="grid sm:grid-cols-2 gap-3 mt-3">
        <Card className="p-2 flex gap-2">
          {([['csp', '现金担保看跌 CSP', '备好现金，愿意低价接货'], ['cc', '备兑看涨 CC', '已持 100 股，租出上涨空间']] as const).map(([key, label, note]) => (
            <button key={key} onClick={() => setStrat(key)}
              className={cx('flex-1 rounded-lg px-3 py-2 text-left border',
                strat === key ? 'bg-brand text-white border-brand' : 'bg-white border-line hover:bg-canvas')}>
              <div className="text-sm font-bold leading-tight">{label}</div>
              <div className={cx('text-[10px] mt-0.5', strat === key ? 'text-white/75' : 'text-muted')}>{note}</div>
            </button>
          ))}
        </Card>
        <Card className="p-2 flex gap-2">
          {RISK.map((r, i) => (
            <button key={r.label} onClick={() => setRiskIdx(i)}
              className={cx('flex-1 rounded-lg px-3 py-2 border',
                riskIdx === i ? 'bg-brand text-white border-brand' : 'bg-white border-line hover:bg-canvas')}>
              <div className="text-sm font-bold">{r.label}</div>
              <div className={cx('text-[10px] mt-0.5', riskIdx === i ? 'text-white/75' : 'text-muted')}>Δ≈{r.delta} · {r.note}</div>
            </button>
          ))}
        </Card>
      </div>

      {/* DTE 档 */}
      {chain && (
        <div className="flex gap-2 mt-3">
          {chain.buckets.map((b) => (
            <button key={b.key} onClick={() => setBucketKey(b.key)}
              className={cx('flex-1 rounded-lg px-3 py-2 text-sm font-semibold border',
                bucket?.key === b.key ? 'bg-brand-soft text-brand border-brand/40' : 'bg-white text-muted border-line hover:bg-canvas')}>
              {BUCKET_LABEL[b.key] ?? b.key}
              <span className="block text-[10px] font-normal">{b.expiry.slice(5)} 到期 · {b.dte} 天</span>
            </button>
          ))}
        </div>
      )}

      {/* 推荐合约（当前档位 |Δ| 最接近目标的一张） */}
      {chain && bucket && best && bestEco ? (
        <Card className="mt-3 p-4 border-l-4 border-l-brand">
          <div className="flex items-baseline justify-between flex-wrap gap-2">
            <div className="text-sm text-muted">
              卖 1 张 <b className="text-ink">{cur} {bucket.expiry.slice(5)} ${$(best.k, best.k % 1 ? 2 : 0)} {strat === 'cc' ? 'Call' : 'Put'}</b>
              <span className="ml-1">（现价 ${$(chain.spot)}）</span>
            </div>
            <Link to={`/stock/${cur}`} className="text-xs text-brand hover:underline">看 {cur} 详情 →</Link>
          </div>
          <div className="flex items-baseline gap-2 mt-1.5">
            <span className="text-3xl font-extrabold tnum text-brand">${$(bestEco.premium, 0)}</span>
            <span className="text-sm text-muted">权利金 / 张（{bucket.dte} 天）</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3 text-center">
            {[
              ['简单年化', `${$(bestEco.annualPct, 1)}%`, '仅供档位间比较'],
              ['占用' + (strat === 'cc' ? '市值' : '现金'), `$${$(bestEco.collateral, 0)}`, strat === 'cc' ? '需已持有 100 股' : '接货备用金'],
              ['盈亏平衡', `$${$(bestEco.breakeven)}`, strat === 'cc' ? '持股成本降至' : '接货净成本'],
              ['被行权概率', `≈${$(bestEco.assignPct, 0)}%`, '以 |Δ| 近似'],
            ].map(([l, v, n]) => (
              <div key={l as string} className="rounded-xl bg-canvas px-2 py-2.5">
                <div className="text-[10px] text-muted">{l}</div>
                <div className="text-base font-bold tnum mt-0.5">{v}</div>
                <div className="text-[9px] text-muted mt-0.5">{n}</div>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-muted mt-3 leading-snug">
            {strat === 'cc'
              ? <>若到期 {cur} ≤ ${$(best.k, 0)}：白收 ${$(bestEco.premium, 0)}，股票还在。若涨破 ${$(best.k, 0)}：股票以 ${$(best.k, 0)} 被买走（涨幅封顶，但仍是盈利卖出）。</>
              : <>若到期 {cur} ≥ ${$(best.k, 0)}：白收 ${$(bestEco.premium, 0)}，现金完好。若跌破 ${$(best.k, 0)}：按 ${$(best.k, 0)} 接货 100 股（净成本 ${$(bestEco.breakeven)}——所以只卖你真愿意持有的股票）。</>}
          </p>
        </Card>
      ) : chain && bucket ? (
        <Card className="mt-3 p-6 text-center text-sm text-muted">该档位暂无 Δ 合适的可卖合约</Card>
      ) : null}

      {/* 完整链表 */}
      {chain && bucket && rows.length > 0 && (
        <>
          <SectionTitle>{cur} · {BUCKET_LABEL[bucket.key]}（{bucket.expiry} 到期）· {strat === 'cc' ? 'Calls' : 'Puts'}</SectionTitle>
          <Card className="overflow-x-auto">
            <table className="w-full text-sm tnum">
              <thead>
                <tr className="text-[11px] text-muted border-b border-line">
                  {['行权价', 'Bid', 'Ask', '中间价', 'Δ', 'IV', '未平仓', '简单年化'].map((h) => (
                    <th key={h} className="px-3 py-2 text-right first:text-left font-semibold whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const eco = economics(r, strat, chain.spot, bucket.dte)
                  const isBest = best && r.k === best.k
                  return (
                    <tr key={r.k} className={cx('border-b border-line/60 last:border-0', isBest && 'bg-brand-soft/60 font-semibold')}>
                      <td className="px-3 py-1.5">
                        ${$(r.k, r.k % 1 ? 2 : 0)}{isBest && <span className="ml-1 text-[9px] text-brand font-bold">推荐</span>}
                      </td>
                      <td className="px-3 py-1.5 text-right">{$(r.bid)}</td>
                      <td className="px-3 py-1.5 text-right">{$(r.ask)}</td>
                      <td className="px-3 py-1.5 text-right">{$(r.mid)}</td>
                      <td className="px-3 py-1.5 text-right">{$(Math.abs(r.delta), 2)}</td>
                      <td className="px-3 py-1.5 text-right">{$(r.iv * 100, 0)}%</td>
                      <td className="px-3 py-1.5 text-right">{r.oi.toLocaleString()}</td>
                      <td className={cx('px-3 py-1.5 text-right', eco.annualPct >= 15 ? 'text-pos' : '')}>{$(eco.annualPct, 1)}%</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </Card>
        </>
      )}

      {/* 学习卡 */}
      <SectionTitle>怎么理解</SectionTitle>
      <div className="grid sm:grid-cols-3 gap-3">
        {[
          ['现金担保看跌（CSP）', '备好「行权价 × 100」的现金，卖出 1 张看跌期权。到期股价高于行权价 → 白收权利金；跌破 → 以行权价买入 100 股（等于打折接货）。只对你本来就想持有的股票做。'],
          ['备兑看涨（CC）', '已持有 100 股，卖出 1 张高于现价的看涨期权。到期没涨到行权价 → 白收权利金继续持股；涨破 → 股票以行权价卖出（盈利离场但错过更多涨幅）。'],
          ['风险与边界', 'Δ 近似「到期被行权的概率」，保守/中性/激进 ≈ 0.10/0.20/0.30。收租的真正风险：股票大跌时权利金杯水车薪——它不保护本金。年化为简单外推，不代表可持续收益。'],
        ].map(([t, body]) => (
          <Card key={t} className="p-4">
            <div className="text-sm font-bold">{t}</div>
            <p className="text-xs text-muted mt-1.5 leading-relaxed">{body}</p>
          </Card>
        ))}
      </div>

      <p className="text-[11px] text-muted mt-5 leading-snug">
        数据：{data.source || 'Cboe 延迟行情'} · 快照 {data.asOf}{chain?.quoteTime ? `（报价时间 ${chain.quoteTime}）` : ''}。
        权利金按 bid/ask 中间价估算，实际成交以盘口为准。1 张 = 100 股。仅为学习工具，非投资建议。
      </p>
    </div>
  )
}
