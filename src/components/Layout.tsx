import { useEffect, useMemo, useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { people, tickerList, stocks, allNews } from '../data/mock'
import { cx } from '../lib/format'
import { Avatar } from './ui'

const NAV = [
  { to: '/', label: '首页', icon: '◫', end: true },
  { to: '/plan', label: '明日计划', icon: '◷' },
  { to: '/news', label: '新闻', icon: '☰' },
  { to: '/ipos', label: 'IPO', icon: '🚀' },
  { to: '/settings', label: '设置', icon: '⚙' },
]

export default function Layout() {
  const [openSearch, setOpenSearch] = useState(false)

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setOpenSearch(true) }
      if (e.key === '/' && !/INPUT|TEXTAREA/.test((e.target as HTMLElement).tagName)) { e.preventDefault(); setOpenSearch(true) }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [])

  return (
    <div className="min-h-screen pb-20 md:pb-0">
      {/* Top bar */}
      <header className="sticky top-0 z-30 bg-white/85 backdrop-blur border-b border-line">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center gap-4">
          <Link to="/" className="font-extrabold text-brand text-lg shrink-0">持仓追踪</Link>
          <nav className="hidden md:flex items-center gap-1 ml-2">
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end}
                className={({ isActive }) => cx('px-3 py-1.5 rounded-lg text-sm font-medium',
                  isActive ? 'bg-brand-soft text-brand' : 'text-muted hover:bg-canvas')}>
                {n.label}
              </NavLink>
            ))}
          </nav>
          <button onClick={() => setOpenSearch(true)}
            className="ml-auto flex items-center gap-2 text-sm text-muted bg-canvas hover:bg-line/60 border border-line rounded-lg px-3 py-1.5">
            <span>🔍</span>
            <span className="hidden sm:inline">搜索人名 / ticker / 新闻</span>
            <kbd className="hidden md:inline text-[10px] bg-white border border-line rounded px-1">⌘K</kbd>
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-5">
        <Outlet />
        <footer className="mt-12 mb-4 text-center text-[11px] text-muted">
          数据为 mock 演示 · AI 分析非投资建议 · 自用原型
        </footer>
      </main>

      {/* Bottom tab bar (mobile) */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-white/95 backdrop-blur border-t border-line">
        <div className="flex">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end}
              className={({ isActive }) => cx('flex-1 flex flex-col items-center py-2 text-[11px] gap-0.5',
                isActive ? 'text-brand' : 'text-muted')}>
              <span className="text-lg leading-none">{n.icon}</span>{n.label}
            </NavLink>
          ))}
        </div>
      </nav>

      {openSearch && <SearchModal onClose={() => setOpenSearch(false)} />}
    </div>
  )
}

function SearchModal({ onClose }: { onClose: () => void }) {
  const [q, setQ] = useState('')
  const nav = useNavigate()
  const results = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return { ppl: people.slice(0, 4), tks: tickerList.slice(0, 4), nws: [] as typeof allNews }
    return {
      ppl: people.filter((p) => p.name.toLowerCase().includes(s) || p.org?.toLowerCase().includes(s)),
      tks: tickerList.filter((t) => t.toLowerCase().includes(s) || stocks[t].name.toLowerCase().includes(s)),
      nws: allNews.filter((n) => n.title.toLowerCase().includes(s)).slice(0, 5),
    }
  }, [q])

  const go = (path: string) => { onClose(); nav(path) }

  return (
    <div className="fixed inset-0 z-50 bg-ink/30 flex items-start justify-center pt-[12vh] px-4" onClick={onClose}>
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl border border-line overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="搜人名、ticker、新闻标题…  （Esc 关闭）"
          onKeyDown={(e) => e.key === 'Escape' && onClose()}
          className="w-full px-4 py-3.5 text-base outline-none border-b border-line" />
        <div className="max-h-[55vh] overflow-y-auto p-2">
          {results.ppl.length > 0 && <Group label="人物" />}
          {results.ppl.map((p) => (
            <button key={p.id} onClick={() => go(`/person/${p.id}`)} className="w-full flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-canvas text-left">
              <Avatar id={p.id} size={28} /><div><div className="text-sm font-semibold">{p.name}</div><div className="text-[11px] text-muted">{p.org}</div></div>
            </button>
          ))}
          {results.tks.length > 0 && <Group label="股票" />}
          {results.tks.map((t) => (
            <button key={t} onClick={() => go(`/stock/${t}`)} className="w-full flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-canvas text-left">
              <span className="font-bold text-sm w-14">{t}</span><span className="text-[12px] text-muted">{stocks[t].name}</span>
            </button>
          ))}
          {results.nws.length > 0 && <Group label="新闻" />}
          {results.nws.map((n) => (
            <a key={n.id} href={n.url} target="_blank" rel="noreferrer" className="block px-2 py-2 rounded-lg hover:bg-canvas text-sm">{n.title}</a>
          ))}
          {!results.ppl.length && !results.tks.length && !results.nws.length && (
            <p className="text-center text-sm text-muted py-8">无结果</p>
          )}
        </div>
      </div>
    </div>
  )
}

const Group = ({ label }: { label: string }) => (
  <div className="px-2 pt-2 pb-1 text-[11px] font-bold text-muted uppercase tracking-wide">{label}</div>
)
