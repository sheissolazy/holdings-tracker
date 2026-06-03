import { useMemo, useState } from 'react'
import { useData } from '../data/DataProvider'
import { Card, SectionTitle } from '../components/ui'
import { cx } from '../lib/format'

// 来源高亮：被跟踪的公众号「猫笔刀」用紫色突出
const sourceTag = (s: string) =>
  s === '猫笔刀' ? 'bg-detail-soft text-detail border-detail/30' : 'bg-canvas text-muted border-line'

export default function News() {
  const { news: allNews } = useData()
  const sources = useMemo(() => ['全部', ...Array.from(new Set(allNews.map((n) => n.source)))], [allNews])
  const [source, setSource] = useState('全部')
  const [q, setQ] = useState('')

  const list = useMemo(() => {
    const s = q.trim().toLowerCase()
    return [...allNews]
      .filter((n) => (source === '全部' ? true : n.source === source))
      .filter((n) => (s ? n.title.toLowerCase().includes(s) || n.tags.some((t) => t.toLowerCase().includes(s)) : true))
      .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
  }, [source, q, allNews])

  // 按日期分组
  const groups = useMemo(() => {
    const m = new Map<string, typeof list>()
    for (const n of list) {
      const arr = m.get(n.publishedAt) ?? []
      arr.push(n)
      m.set(n.publishedAt, arr)
    }
    return Array.from(m.entries())
  }, [list])

  return (
    <div>
      <h1 className="text-2xl font-extrabold">新闻 · 信息流</h1>
      <p className="text-sm text-muted">聚合跟踪的人 / 标的相关新闻 · 外链原文</p>

      {/* 搜索 + 来源筛选 */}
      <div className="mt-4 flex flex-col gap-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="搜标题 / 标签…"
          className="w-full sm:max-w-xs px-3 py-2 text-sm rounded-lg border border-line bg-white outline-none focus:border-brand"
        />
        <div className="flex gap-2 overflow-x-auto no-sb -mx-1 px-1">
          {sources.map((s) => (
            <button
              key={s}
              onClick={() => setSource(s)}
              className={cx('shrink-0 text-xs font-semibold px-3 py-1.5 rounded-full border',
                s === source ? 'bg-brand text-white border-brand' : 'bg-white text-muted border-line hover:bg-canvas',
                s === '猫笔刀' && s !== source && 'text-detail border-detail/40')}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <p className="text-xs text-muted mt-3">{list.length} 条结果</p>

      {/* 时间线分组 */}
      {groups.map(([date, items]) => (
        <div key={date}>
          <SectionTitle>{date}</SectionTitle>
          <Card className="px-4 divide-y divide-line">
            {items.map((n) => (
              <a key={n.id} href={n.url} target="_blank" rel="noreferrer" className="block py-3 group">
                <div className="flex flex-wrap items-center gap-1.5 mb-1">
                  <span className={cx('text-[10px] font-bold px-1.5 py-0.5 rounded border', sourceTag(n.source))}>{n.source}</span>
                  {n.tags.map((t) => (
                    <span key={t} className={cx('text-[10px] font-semibold px-1.5 py-0.5 rounded border', sourceTag(t))}>{t}</span>
                  ))}
                </div>
                <p className="text-sm leading-snug group-hover:text-brand">{n.title} <span className="text-muted">↗</span></p>
              </a>
            ))}
          </Card>
        </div>
      ))}

      {list.length === 0 && <p className="text-sm text-muted text-center py-12">无匹配新闻</p>}
    </div>
  )
}
