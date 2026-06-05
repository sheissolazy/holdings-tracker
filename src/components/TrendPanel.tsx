import { useEffect, useMemo, useState } from 'react'
import { Card } from './ui'
import { cx } from '../lib/format'
import { dataUrl } from '../data/useJson'
import type { MarketItem } from '../data/DataProvider'

// 通用迷你图面板：读取 public/data/{dir}/{code}.json（5 年日线），按区间切片展示。
// 复用于「汇率 / 人民币兑换」(dir=fx) 与「大盘 / 商品」(dir=mkt)。
// 无假数据原则：抓不到 / 文件缺失 → 静默不渲染该图。

type Bar = { t: string; c: number }
type SeriesFile = { code: string; label: string; sym: string; kind?: string; bars: Bar[] }

// 近似交易日数：5日≈5、1月≈22、1年≈252、5年=全部
const RANGES = [
  { key: '5日', n: 5 },
  { key: '1月', n: 22 },
  { key: '1年', n: 252 },
  { key: '5年', n: Infinity },
] as const
type RangeKey = (typeof RANGES)[number]['key']

async function loadSeries(dir: string, code: string): Promise<SeriesFile | null> {
  try {
    const r = await fetch(dataUrl(`${dir}/${code}.json`), { cache: 'no-cache' })
    if (!r.ok) return null
    return (await r.json()) as SeriesFile
  } catch {
    return null
  }
}

// 按 kind 格式化当前值（与 pipeline/fetch_market._fmt_value 对齐）
function fmtValue(v: number, kind?: string): string {
  if (kind === 'yield') return `${v.toFixed(2)}%`
  if (kind === 'usd') return `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  if (kind === 'index') return v.toFixed(2)
  // fx：按量级选小数位
  return v >= 100 ? v.toFixed(2) : v.toFixed(4)
}

// 区间涨跌：收益率(yield)用 bp，其余用百分比（与单日 chg 口径一致）
function fmtDelta(first: number, last: number, kind?: string): string {
  if (kind === 'yield') {
    const bp = Math.round((last - first) * 100)
    return `${bp >= 0 ? '+' : ''}${bp}bp`
  }
  const pct = first ? ((last - first) / first) * 100 : 0
  return `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`
}

// 区间内首尾收盘画走势
function MiniChart({ bars, w = 200, h = 36 }: { bars: Bar[]; w?: number; h?: number }) {
  if (bars.length < 2) return null
  const vals = bars.map((b) => b.c)
  const min = Math.min(...vals), max = Math.max(...vals)
  const span = max - min || 1
  const x = (i: number) => (i / (bars.length - 1)) * w
  const y = (v: number) => h - ((v - min) / span) * (h - 4) - 2
  const line = vals.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  const up = vals[vals.length - 1] >= vals[0]
  const color = up ? '#16a34a' : '#dc2626'
  const area = `0,${h} ${line} ${w},${h}`
  const gid = `tr-${Math.round(min * 1e4)}-${bars.length}`
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="w-full" style={{ height: h }}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.18} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <polygon points={area} fill={`url(#${gid})`} />
      <polyline points={line} fill="none" stroke={color} strokeWidth={1.4}
        strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

export function TrendPanel(
  { items, title, dir = 'fx', gridCols = 'grid-cols-2 lg:grid-cols-3' }:
  { items: MarketItem[]; title: string; dir?: string; gridCols?: string },
) {
  const codes = useMemo(() => items.map((m) => m.code).filter(Boolean) as string[], [items])
  const [files, setFiles] = useState<Record<string, SeriesFile>>({})
  const [range, setRange] = useState<RangeKey>('1年')

  useEffect(() => {
    let alive = true
    Promise.all(codes.map((c) => loadSeries(dir, c))).then((res) => {
      if (!alive) return
      const map: Record<string, SeriesFile> = {}
      res.forEach((f) => { if (f) map[f.code] = f })
      setFiles(map)
    })
    return () => { alive = false }
  }, [codes.join(','), dir])

  const nBars = RANGES.find((r) => r.key === range)!.n
  const loaded = items.filter((m) => m.code && files[m.code])
  if (!loaded.length) return null

  return (
    <div className="mb-3">
      <div className="flex items-center justify-between mb-1.5">
        <div className="text-[11px] font-bold text-muted">{title}</div>
        <div className="flex gap-0.5 rounded-lg bg-canvas border border-line p-0.5">
          {RANGES.map((r) => (
            <button key={r.key} onClick={() => setRange(r.key)}
              className={cx('text-[10px] font-semibold px-1.5 py-0.5 rounded-md transition',
                range === r.key ? 'bg-white text-brand shadow-sm' : 'text-muted hover:text-ink')}>
              {r.key}
            </button>
          ))}
        </div>
      </div>
      <div className={cx('grid gap-2', gridCols)}>
        {loaded.map((m) => {
          const file = files[m.code!]
          const kind = m.kind ?? file.kind
          const all = file.bars
          const bars = nBars === Infinity ? all : all.slice(-nBars)
          const first = bars[0]?.c ?? 0
          const last = bars[bars.length - 1]?.c ?? 0
          const up = last >= first
          return (
            <Card key={m.label} className="p-2.5 hover:border-line/80 transition">
              <div className="flex items-baseline justify-between mb-0.5 gap-1">
                <span className="text-[11px] text-muted truncate">{m.label}</span>
                <span className={cx('text-[10px] font-bold tnum shrink-0', up ? 'text-pos' : 'text-neg')}>
                  {up ? '▲' : '▼'}{fmtDelta(first, last, kind).replace(/^[+-]/, '')}
                </span>
              </div>
              <div className="text-base font-extrabold tnum mb-1 leading-none">{fmtValue(last, kind)}</div>
              <MiniChart bars={bars} />
            </Card>
          )
        })}
      </div>
    </div>
  )
}
