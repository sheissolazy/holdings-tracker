export const cx = (...c: (string | false | null | undefined)[]) =>
  c.filter(Boolean).join(' ')

export const fmtPct = (n: number, withSign = true) =>
  `${withSign && n > 0 ? '+' : ''}${n.toFixed(1)}%`

export const pctColor = (n: number) =>
  n > 0 ? 'text-pos' : n < 0 ? 'text-neg' : 'text-muted'

export function fmtMoney(n?: number): string {
  if (n == null) return '—'
  const a = Math.abs(n)
  if (a >= 1e9) return `$${(n / 1e9).toFixed(1)}B`
  if (a >= 1e6) return `$${(n / 1e6).toFixed(0)}M`
  if (a >= 1e3) return `$${(n / 1e3).toFixed(0)}K`
  return `$${n}`
}

export const daysFrom = (iso: string) => {
  const d = Math.round((Date.parse(iso) - Date.parse('2026-06-01')) / 86400000)
  return d
}
