import { people } from '../data/mock'
import { Card, SectionTitle, Avatar } from '../components/ui'
import { useLocalStorage } from '../lib/useLocalStorage'
import { cx } from '../lib/format'

interface Settings {
  disabledSources: string[]      // 关闭的跟踪源 id
  refresh: 'close' | '6h' | 'manual'
  compact: boolean
  showSparkline: boolean
  defaultRange: '1M' | '3M' | '6M' | '1Y'
}
const DEFAULTS: Settings = { disabledSources: [], refresh: 'close', compact: false, showSparkline: true, defaultRange: '3M' }

const TYPE_LABEL: Record<string, string> = { '13f': '13F', options: '期权', ptr: 'Congress', social: '社交', statement: '言论', wechat: '公众号' }
const REFRESH = [['close', '每日收盘后'], ['6h', '每 6 小时'], ['manual', '仅手动']] as const

export default function Settings() {
  const [s, setS] = useLocalStorage<Settings>('settings', DEFAULTS)

  const toggleSource = (id: string) =>
    setS((v) => ({ ...v, disabledSources: v.disabledSources.includes(id) ? v.disabledSources.filter((x) => x !== id) : [...v.disabledSources, id] }))

  const exportSettings = () => {
    const blob = new Blob([JSON.stringify(s, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'holdings-tracker-settings.json'
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <div>
      <h1 className="text-2xl font-extrabold">设置</h1>
      <p className="text-sm text-muted">自用配置，存于本地浏览器（localStorage），不上传。</p>

      {/* 跟踪源管理 */}
      <SectionTitle>跟踪源管理</SectionTitle>
      <Card className="divide-y divide-line">
        {people.map((p) => {
          const on = !s.disabledSources.includes(p.id)
          return (
            <div key={p.id} className="flex items-center gap-3 p-3">
              <Avatar id={p.id} size={32} />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold truncate">{p.name}</div>
                <div className="text-[11px] text-muted truncate">{p.org} · {p.signalTypes.map((t) => TYPE_LABEL[t] ?? t).join(' / ')}</div>
              </div>
              <Toggle on={on} onClick={() => toggleSource(p.id)} />
            </div>
          )
        })}
      </Card>
      <p className="text-[11px] text-muted mt-2">关闭后该源不在首页 / 信号中显示（mock 阶段仅保存偏好）。</p>

      {/* 刷新频率 */}
      <SectionTitle>数据刷新频率</SectionTitle>
      <Card className="p-2 flex flex-col sm:flex-row gap-2">
        {REFRESH.map(([val, label]) => (
          <button key={val} onClick={() => setS((v) => ({ ...v, refresh: val }))}
            className={cx('flex-1 text-sm font-semibold rounded-lg px-3 py-2 border',
              s.refresh === val ? 'bg-brand text-white border-brand' : 'bg-white text-muted border-line hover:bg-canvas')}>
            {label}
          </button>
        ))}
      </Card>
      <p className="text-[11px] text-muted mt-2">实际由 GitHub Actions cron 决定；此处为期望频率偏好。</p>

      {/* 显示设置 */}
      <SectionTitle>显示</SectionTitle>
      <Card className="divide-y divide-line">
        <Row label="紧凑模式" desc="更密的行距与卡片">
          <Toggle on={s.compact} onClick={() => setS((v) => ({ ...v, compact: !v.compact }))} />
        </Row>
        <Row label="显示迷你走势 (sparkline)" desc="人物行末尾的活跃度迷你图">
          <Toggle on={s.showSparkline} onClick={() => setS((v) => ({ ...v, showSparkline: !v.showSparkline }))} />
        </Row>
        <Row label="K 线默认区间" desc="股票详情页打开时的默认范围">
          <div className="flex gap-1">
            {(['1M', '3M', '6M', '1Y'] as const).map((r) => (
              <button key={r} onClick={() => setS((v) => ({ ...v, defaultRange: r }))}
                className={cx('text-xs px-2 py-1 rounded-md font-medium', s.defaultRange === r ? 'bg-brand text-white' : 'text-muted hover:bg-canvas')}>{r}</button>
            ))}
          </div>
        </Row>
      </Card>

      {/* 数据导出 */}
      <SectionTitle>数据</SectionTitle>
      <Card className="p-3 flex flex-col sm:flex-row gap-2">
        <button onClick={exportSettings} className="flex-1 text-sm font-semibold border border-line rounded-lg px-3 py-2 hover:bg-canvas">
          导出设置 JSON
        </button>
        <button onClick={() => { if (confirm('恢复默认设置？')) setS(DEFAULTS) }}
          className="flex-1 text-sm font-semibold border border-line rounded-lg px-3 py-2 hover:bg-canvas text-neg">
          恢复默认
        </button>
      </Card>

      {/* 关于 */}
      <SectionTitle>关于 · 数据源</SectionTitle>
      <Card className="p-4 text-xs text-muted space-y-2 leading-relaxed">
        <p>• 13F 持仓：SEC EDGAR（季度，~45 天申报延迟）。Buffett、Leopold/Situational Awareness。</p>
        <p>• Congress 交易：house/senate-stock-watcher 开源数据集。Pelosi。</p>
        <p>• 社交喊单：Truth Social API（Trump）/ 自托管 RSSHub（Musk、Serenity）；构建时经 Claude 抽取 ticker + 多空。</p>
        <p>• 公众号：猫笔刀，经 Wechat2RSS 接入（~6–24h 延迟）。</p>
        <p>• AI 分析：构建时调用 Claude API 生成并缓存，非投资建议。</p>
        <p className="pt-1 text-muted/70">当前为 mock 演示数据。真实数据由 GitHub Actions 定时管道生成。</p>
      </Card>
    </div>
  )
}

const Row = ({ label, desc, children }: { label: string; desc: string; children: React.ReactNode }) => (
  <div className="flex items-center gap-3 p-3">
    <div className="min-w-0 flex-1">
      <div className="text-sm font-semibold">{label}</div>
      <div className="text-[11px] text-muted">{desc}</div>
    </div>
    {children}
  </div>
)

const Toggle = ({ on, onClick }: { on: boolean; onClick: () => void }) => (
  <button onClick={onClick}
    className={cx('w-11 h-6 rounded-full p-0.5 transition-colors shrink-0', on ? 'bg-brand' : 'bg-line')}>
    <span className={cx('block w-5 h-5 bg-white rounded-full shadow transition-transform', on && 'translate-x-5')} />
  </button>
)
