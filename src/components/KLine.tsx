import { useEffect, useRef } from 'react'
import { createChart, ColorType, type IChartApi } from 'lightweight-charts'
import type { PriceBar } from '../data/types'

export default function KLine({ bars, height = 260 }: { bars: PriceBar[]; height?: number }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!ref.current) return
    const chart: IChartApi = createChart(ref.current, {
      height,
      layout: { background: { type: ColorType.Solid, color: 'transparent' }, textColor: '#64748b', fontSize: 11 },
      grid: { vertLines: { color: '#f1f5f9' }, horzLines: { color: '#f1f5f9' } },
      rightPriceScale: { borderColor: '#e2e8f0' },
      timeScale: { borderColor: '#e2e8f0', timeVisible: false },
      crosshair: { mode: 0 },
      handleScroll: false,
      handleScale: false,
    })
    const series = chart.addCandlestickSeries({
      upColor: '#16a34a', downColor: '#dc2626', borderVisible: false,
      wickUpColor: '#16a34a', wickDownColor: '#dc2626',
    })
    series.setData(bars.map((b) => ({ time: b.t, open: b.o, high: b.h, low: b.l, close: b.c })))
    chart.timeScale().fitContent()

    const onResize = () => chart.applyOptions({ width: ref.current?.clientWidth })
    onResize()
    window.addEventListener('resize', onResize)
    return () => { window.removeEventListener('resize', onResize); chart.remove() }
  }, [bars, height])

  return <div ref={ref} className="w-full" />
}
