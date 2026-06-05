import { useData } from '../data/DataProvider'
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

const X_STATUS_META: Record<string, { label: string; cls: string }> = {
  ok:           { label: '正常', cls: 'bg-pos/10 text-pos' },
  expired:      { label: '登录已过期 · 需更新 cookie', cls: 'bg-neg/10 text-neg' },
  unconfigured: { label: '未配置', cls: 'bg-canvas text-muted' },
}

export default function Settings() {
  const { people, health } = useData()
  const [s, setS] = useLocalStorage<Settings>('settings', DEFAULTS)
  const xStatus = X_STATUS_META[health.x] ?? X_STATUS_META.unconfigured

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

      {/* 数据源健康 */}
      <SectionTitle>数据源健康</SectionTitle>
      <Card className="divide-y divide-line">
        <div className="flex items-center gap-3 p-3">
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold">X（Twitter）登录</div>
            <div className="text-[11px] text-muted">Musk / Serenity / Trump / 猫笔刀，依赖浏览器 cookie</div>
          </div>
          <span className={cx('text-[11px] font-bold px-2 py-1 rounded', xStatus.cls)}>{xStatus.label}</span>
        </div>
        {health.x === 'expired' && (
          <div className="p-3 text-xs text-muted leading-relaxed bg-amber-soft/40">
            <b className="text-amber-700">如何更新：</b>在浏览器登录 x.com → 开发者工具 → Application → Cookies → x.com，
            复制 <code className="font-mono">auth_token</code> 与 <code className="font-mono">ct0</code> 的值，
            发给维护者更新到 GitHub Secrets（<code className="font-mono">X_AUTH_TOKEN</code> /
            <code className="font-mono"> X_CT0</code>）。session cookie 通常 1–3 个月失效一次。
          </div>
        )}
        <div className="flex items-center gap-3 p-3">
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold">猫笔刀 · 每日文章</div>
            <div className="text-[11px] text-muted">经 X @mooomoocat 同步，几乎每日更新；≥2 天无新帖会提醒</div>
          </div>
          <span className={cx('text-[11px] font-bold px-2 py-1 rounded',
            health.maobidao?.stale ? 'bg-neg/10 text-neg' : 'bg-pos/10 text-pos')}>
            {health.maobidao?.stale
              ? (health.maobidao?.daysSince != null ? `已 ${health.maobidao.daysSince} 天无更新` : '抓取异常')
              : (health.maobidao?.lastPost ? `最近 ${health.maobidao.lastPost}` : '正常')}
          </span>
        </div>
      </Card>

      {/* 关于 */}
      <SectionTitle>关于 · 数据源</SectionTitle>
      <Card className="p-4 text-xs text-muted space-y-2 leading-relaxed">
        <p>• 13F 持仓：SEC EDGAR（季度，~45 天申报延迟）。Buffett、Leopold/Situational Awareness。</p>
        <p>• Congress 交易：美国众议院书记官（House Clerk）官方披露 PDF，解析真实买卖。Pelosi。</p>
        <p>• 社交喊单：X 网页版（Musk、Serenity，cookie 登录）/ Truth Social（Trump）；只在推文确实命中 ticker 时产信号，标「关注」，不臆测多空。</p>
        <p>• 公众号：猫笔刀，经 Wechat2RSS 接入（~6–24h 延迟）。</p>
        <p>• 行情 / 汇率：Yahoo Finance（免费）。新闻 / IPO / 基本面：Finnhub。</p>
        <p>• AI 分析：构建时（GitHub Actions）调用 Claude 生成并缓存，非投资建议。</p>
        <p className="pt-1 text-muted/70">无假数据原则：任何源抓不到一律留空，绝不编造。数据由定时管道生成。</p>
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
