import { useEffect, useMemo, useState } from 'react'
import { Card } from './ui'
import { cx } from '../lib/format'
import { dataUrl } from '../data/useJson'
import type { MarketItem } from '../data/DataProvider'

// 汇率迷你图：读取 public/data/fx/{code}.json（5 年日线），按区间切片展示。
// 无假数据原则：抓不到 / 文件缺失 → 静默不渲染该图。

type FxBar = { t: string; c: number }
type FxFile = { code: string; label: string; sym: string; bars: FxBar[] }

// 近似交易日数：5日≈5、1月≈22、1年≈252、5年=全部
const RANGES = [
  { key: '5日', n: 5 },
  { key: '1月', n: 22 },
  { key: '1年', n: 252 },
  { key: '5年', n: Infinity },
] as const
type RangeKey = (typeof RANGES)[number]['key']

async function loadFx(code: string): Promise<FxFile | null> {
  try {
    const r = await fetch(dataUrl(`fx/${code}.json`), { cache: 'no-cache' })
    if (!r.ok) return null
    return (await r.json()) as FxFile
  } catch {
    return null
  }
}

function fmtFx(v: number): string {
  return v >= 100 ? v.toFixed(2) : v.toFixed(4)
}

// 区间内首尾收盘算涨跌（区间表现，比单日更贴合图表）
function MiniChart({ bars, w = 200, h = 44 }: { bars: FxBar[]; w?: number; h?: number }) {
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
  const gid = `fx-${Math.round(min * 1e4)}-${bars.length}`
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

export function FxPanel({ items, title = '汇率' }: { items: MarketItem[]; title?: string }) {
  const codes = useMemo(() => items.map((m) => m.code).filter(Boolean) as string[], [items])
  const [files, setFiles] = useState<Record<string, FxFile>>({})
  const [range, setRange] = useState<RangeKey>('1年')

  useEffect(() => {
    let alive = true
    Promise.all(codes.map((c) => loadFx(c))).then((res) => {
      if (!alive) return
      const map: Record<string, FxFile> = {}
      res.forEach((f) => { if (f) map[f.code] = f })
      setFiles(map)
    })
    return () => { alive = false }
  }, [codes.join(',')])

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
      <div className="grid grid-cols-1 gap-2">
        {loaded.map((m) => {
          const all = files[m.code!].bars
          const bars = nBars === Infinity ? all : all.slice(-nBars)
          const first = bars[0]?.c ?? 0
          const last = bars[bars.length - 1]?.c ?? 0
          const pct = first ? ((last - first) / first) * 100 : 0
          const up = last >= first
          return (
            <Card key={m.label} className="p-2.5">
              <div className="flex items-baseline justify-between mb-1">
                <span className="text-[11px] text-muted truncate">{m.label}</span>
                <span className="text-sm font-bold tnum">{fmtFx(last)}</span>
              </div>
              <MiniChart bars={bars} />
              <div className="flex items-center justify-between mt-0.5">
                <span className="text-[10px] text-muted">{range}</span>
                <span className={cx('text-[11px] font-semibold tnum', up ? 'text-pos' : 'text-neg')}>
                  {up ? '+' : ''}{pct.toFixed(2)}%
                </span>
              </div>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
