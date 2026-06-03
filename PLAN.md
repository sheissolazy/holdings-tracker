# 持仓追踪 App — 技术方案与构建计划

> 自用产品。追踪感兴趣人物的最新持仓 / 交易 / 喊单，给出公司分析，列出可关注的 IPO。
> GitHub Pages 静态站 + PWA，电脑和手机自适应。

---

## 0. 一句话架构

**静态站读 JSON，JSON 由定时任务生成。**

```
GitHub Actions (cron 定时)
   └─ Python 抓取脚本：13F / Congress / IPO / 社交 / 价格 / 新闻
        └─ 写出 /public/data/*.json（含 AI 预生成分析）
             └─ git commit 回仓库
                  └─ Vite 构建静态站 → 部署 GitHub Pages
                       └─ 前端只读 JSON 渲染（手机/电脑自适应 + PWA）
```

要点：**静态站运行时不抓任何数据**。所有数据在构建时（GitHub Actions 里）抓好、算好、AI 分析好，落成 JSON 提交。前端是纯展示层。这样既保持「静态 + 免费」，又有新鲜数据。

---

## 1. 技术栈（建议）

| 层 | 选型 | 理由 |
|----|------|------|
| 前端框架 | **React + Vite + TypeScript** | 7 个互链页面共享大量组件；生态成熟 |
| 样式 | **Tailwind CSS** | 响应式断点 = 电脑/手机不同布局，同一套代码 |
| 路由 | React Router（hash 模式） | GitHub Pages 静态托管对 hash 路由最省心 |
| K 线图 | `lightweight-charts`（TradingView 免费库） | 专业 K 线 + 可叠加持仓事件标记 |
| 柱状/趋势/sparkline | `recharts` | 双向柱、横条、趋势线、迷你图都能覆盖 |
| 移动端 | **PWA**（vite-plugin-pwa） | 手机「添加到主屏」像原生 App；离线缓存 JSON |
| 本地存储 | localStorage / IndexedDB | 收藏、已读、笔记、跟踪源配置（自用无需登录） |
| 数据管道 | **Python**（脚本）+ GitHub Actions cron | 抓取/解析/调用 Claude API/写 JSON |
| 部署 | GitHub Actions → GitHub Pages | 全免费 |

**响应式策略**：移动优先（mobile-first）。例如 Briefing 主页——
- 手机：单列纵向流，关注事件日历折叠成可展开卡片。
- 电脑：主内容 + 右侧日历两栏，共识/分歧区块并排。

---

## 2. 数据源（最关键，含可行性与坑）

> 诚实标注：UI 是易的，数据是难的。下面每类信号的真实来源、延迟、成本、风险。

### 2.1 13F 机构持仓（Buffett / Berkshire 等）
- **源**：SEC EDGAR `13F-HR` 申报（XML information table）。**免费**。
- **延迟**：季度结束后最多 **45 天**才申报。这是结构性延迟，不是 bug。
- **做法**：按人物的机构 CIK 拉申报 → 解析 XML → 持仓表。
- **坑**：13F 只含 13(f) 类「多头」证券（股票、部分期权/可转债）。**Berkshire 的 put 期权多数不在 13F 体现**（历史上通过别的披露），所以「巴菲特的 put」需要单独数据源/人工补录，能力有限要标注清楚。

### 2.2 Congress 交易（Pelosi 等）
- **源（推荐）**：开源数据集 `house-stock-watcher` / `senate-stock-watcher`（GitHub 上公开的解析好的 JSON）。**免费**。
- **官方源**：House Clerk PTR（PDF，难解析）/ Senate eFD。直接解析 PDF 很痛，优先用上面的聚合 JSON。
- **延迟**：法规允许成交后最多 ~45 天披露。
- **字段**：议员、ticker、买/卖、金额区间（如 \$1K–\$15K）、披露日。

### 2.3 Leopold Aschenbrenner（Situational Awareness LP）✅ 已确认
- **确认有 13F**。Situational Awareness LP，**CIK `0002045724`**。免费走 SEC EDGAR。
- Q1 2026 13F（2026-05-15 申报）：$13.68B 13F-reportable，**大量芯片股 put**（~$8.46B notional，含 ~$1.6B NVDA put、~$2B SMH put），Bloom Energy 等多头。
- **正好命中用户要的「持仓 + put」**：他的 put 在 13F 里有体现（不同于 Buffett）。第一类数据源，无需 fallback。

### 2.4 IPO 打新日历
- **源**：Finnhub IPO calendar（免费 tier）或 Nasdaq IPO 日历。**免费/低成本**。
- **注意**：「打新」在美股对散户门槛高且 broker 相关。本 App 定位为**列出可关注的 IPO**（即将上市、定价区间、行业），不做实际申购对接。IPO 公司 = 普通股票，复用股票详情页。

### 2.5 社交喊单（Trump / Musk / Serenity / 黄仁勋）— 第三条路（非付费 API、非手动）
- **Trump → 免费、免登录** ✅：Truth Social 基于 Mastodon，Trump 是「知名账号」公开帖可无 auth 拉取：`truthsocial.com/api/v1/accounts/{id}/statuses`。用开源 [`truthbrush`](https://github.com/stanfordio/truthbrush) 封装，跑在 GitHub Actions 里。
- **Musk（X）/ Serenity（X）→ 免费但需自有登录 cookie**：X 关闭开放访问；**自托管 RSSHub** 喂入**你自己 X 账号的 cookie**（`auth_token` + `ct0`）即可拉 timeline（不是 \$100/月 API）。较脆弱、有账号风险，但零成本。
- **黄仁勋 Jensen Huang → 公开言论/背书**：他不公开交易，但公开讲话会动股价（近期「背书 Marvell」）。信号来源主要是**新闻/发布会报道**（走 §2.7 新闻管道）而非个人发帖；signalType 记为 `statement`，UI 上与 social 同蓝色卡片但标注「公开言论」。
- **分类层**：所有帖子/言论在构建时过一遍 **Claude API → 抽取 ticker + 看多/看空**，只保留与股票相关的喊单。这就是「自动化」替代手动录入。
- 仍标注：社交信号为「最佳努力」，时效/完整性不保证。

### 2.9 明日催化剂（给「明日交易计划」用）
- **源**：财报日历（earnings）、经济数据（FOMC/PCE/CPI）、IPO 定价日、期权到期日（OPEX）、被跟踪 ticker 的相关事件。多数可从 Finnhub/Nasdaq 免费 tier + 已有数据推导。
- **做法**：构建时汇总「明天」窗口内、与关注列表相关的事件 → 交给 Claude 生成前瞻计划（见 §4 页面 #9）。

### 2.6 股价 / K 线
- **源**：Finnhub / Alpha Vantage 免费 tier，或 stooq / Yahoo 非官方。
- **做法**：构建时为「被跟踪的 ticker 集合」拉 OHLC 快照写 JSON。免费 tier 有频率限制 → 只拉关注列表里的票。

### 2.7 新闻
- **源**：各家 RSS（Reuters/WSJ/Bloomberg 多数有 RSS 但正文可能付费墙）、NewsAPI 免费 tier、GDELT。
- **做法**：聚合 RSS → 按跟踪的人/票/主题打标签 → 写 JSON。外链原文（50+ 媒体不归我们管）。
- **微信公众号（如「猫笔刀」每日更新）→ 可接入** ✅：微信是围墙花园，无官方开放 API，但可经 **WeChat→RSS 桥**拿到每日文章：
  - [`Wechat2RSS`](https://wechat2rss.xlab.app/)（有免费公众号列表 + 付费稳定源，约 6h 延迟，承诺 24h 内收录）
  - 自托管 [`wewe-rss`](https://github.com/cooderl/wewe-rss)（基于微信读书）/ [`we-mp-rss`](https://github.com/rachelos/we-mp-rss)
  - RSSHub 也有 `wechat2rss` 路由可对接。
  - 拿到 RSS 后与其它新闻同管道：打标签 → 写 JSON → 在「今日信息来源/新闻」展示，外链原文。可靠性中等（依赖第三方桥）。

### 2.8 AI 分析
- **源**：**Anthropic Claude API**，构建时调用。
- **做法**：对每个被跟踪 ticker，喂入「基本面 + 持仓事件 + 近期新闻」→ 生成看多/看空/关注点 + 完整分析，**缓存成 JSON**。新闻/数据变化时重新生成。明确标注「AI 基于公开数据生成，非投资建议」+ 模型版本 + 生成时间。

---

## 3. 数据 Schema（JSON 草案）

```
/public/data/
  people.json          # 跟踪的人（统一抽象，见下）
  stocks/{TICKER}.json  # 每只票：基本面、价格、持有它的人、AI 分析、新闻
  briefing.json        # 主页聚合：今日要点、共识、分歧、本周事件、IPO、市场背景
  ipos.json            # IPO 日历
  news.json            # 全量新闻流
  meta.json            # 各数据源最后更新时间
```

**统一的「人物」抽象**（关键设计，让 13F / Congress / 期权 / 社交 共用一套）：

```jsonc
// people.json — 一个人物条目
{
  "id": "buffett",
  "name": "Warren Buffett",
  "org": "Berkshire Hathaway",
  "color": "#7c5cff",
  "signalTypes": ["13f", "options"],   // 决定详情页展示哪些区块
  "cik": "0001067983",
  "social": null
}
// 另一个：
{
  "id": "trump",
  "name": "Donald Trump",
  "signalTypes": ["social"],
  "social": { "platform": "truthsocial", "handle": "realDonaldTrump" }
}
```

**「持有/提及」差异化卡片**（股票详情页核心，已含你设计里的 PTR/13F，新增 social）：

```jsonc
{
  "personId": "nancy-pelosi",
  "type": "ptr",        // ptr=粉色 | 13f=紫/琥珀 | options=期权 | social=蓝色喊单
  "ticker": "NVDA",
  // type 专属字段：
  "strike": 120, "expiration": "2026-01-16", "daysToExp": 90,   // options/ptr
  "notional": 1500000, "avgPriceRange": [110, 130],             // 13f
  "postUrl": "...", "postedAt": "2026-05-30", "excerpt": "..."  // social 喊单
}
```

---

## 4. 页面清单（你的 7 页 + IPO/社交融入）

| # | 页面 | 状态 | 备注 |
|---|------|------|------|
| 1 | Briefing 主页 | 重建 | **新增**：本周打新 section、社交喊单 section |
| 2 | 人物详情页 | 重建 | **泛化**：按 signalTypes 渲染（13F 表 / Congress / 社交流） |
| 3 | 股票详情页 | 重建 | **新增**：social 蓝色喊单卡片类型；IPO 票也走这页 |
| 4 | 完整持仓页 | 新设计 | 你的规格：filter chips + 可排序表 + 可选 treemap |
| 5 | AI 完整分析页 | 新设计 | 你的规格：6 段 prose + 重新生成 + 可比公司 |
| 6 | 新闻列表页 | 新设计 | 你的规格：标签/来源/时间 filter + timeline |
| 7 | 设置页 | 新设计 | 你的规格：跟踪源管理 + 频率 + 通知 + 显示 + 导出 |
| 8 | **IPO 日历页** | 新增 | 辅助页：即将上市列表，行可跳股票详情 |
| 9 | **明日交易计划页** | 新增 | 主入口级：提前一天的前瞻计划（见下） |

> 跨页面：全局搜索（⌘K / `/`）、新闻外链——所有页面共有。

### 页面 #9 明日交易计划（Trade Plan，提前一天）— 简化版
- **定位**：与 Briefing 主页并列的第二入口（蓝色）。Briefing 看「已发生」，Trade Plan 看「明天怎么做」。
- **内容（已简化为可编辑清单）**：
  1. **明日行动清单**：AI 用今天的信息起草成简单的「动作 + 原因」条目；用户可<strong>直接改 / 删 / 加 / 勾选完成</strong>，自动存 localStorage（按日期）。「恢复 AI 草稿」可重置。
  2. **起草依据**（只读上下文）：明日催化剂 + 待处理信号，方便用户编辑时参考。
  3. 顶部标注非投资建议。
- **生成**：构建时（每天收盘后）由 Claude 基于 §2.9 催化剂 + 当天信号/价格，起草 `draftActions`，缓存 JSON；用户的编辑覆盖存在本地。

### Briefing 增强
- **导出 PDF**：Briefing 顶部「导出 PDF」按钮 → `window.print()` + 打印样式（隐藏导航/按钮），生成<strong>文本可选中</strong>的 PDF，便于上传给 AI 助手提问。
- **本周打新 IPO** 已上移到右栏顶部（在「本周关注事件」之前）。

### 跟踪人物 roster（当前）
Buffett(13f+options) · Leopold/Situational Awareness(13f, 含 put) · Pelosi(congress) · Trump(social/truthsocial) · Musk(social/X) · Serenity(social/X) · 黄仁勋 Jensen Huang(statement/公开言论)

---

## 5. 构建阶段（里程碑）

- **M0 脚手架**：Vite+React+TS+Tailwind+Router+PWA，部署管线打通（一个空页面上线 GitHub Pages）。设计 token（颜色：蓝主入口/紫详情/灰辅助，琥珀共识/coral 分歧）。
- **M1 数据契约**：定死 JSON schema，造一份**真实结构的 mock 数据**，前后端按它解耦。
- **M2 核心三页**：Briefing 主页 → 人物详情页 → 股票详情页（读 mock）。互链 + 响应式 + 全局搜索。
- **M3 数据管道（真实）**：先接最稳的两条——SEC 13F + Congress 开源 JSON + 股价。GitHub Actions cron 跑通，mock 换真数据。
- **M4 AI 分析**：构建时调 Claude API 生成并缓存；AI 完整分析页。
- **M5 其余页**：完整持仓页、新闻列表页、IPO 日历页、设置页。
- **M6 社交喊单**：手动录入 + 可选 X API，蓝色卡片类型上线。
- **M7 打磨**：通知、导出、treemap、笔记/收藏。

---

## 6. 风险与待决

1. **社交喊单数据**：X API 成本 / Trump 在 Truth Social → 倾向「手动录入 + 最佳努力」，需你拍板是否上付费 API。
2. **巴菲特 put**：13F 不一定覆盖，能力有限要在 UI 标注。
3. **Leopold 是否有 13F**：待查 EDGAR，可能只能挂社交信号。
4. **免费 API 频率限制**：只拉关注列表的票来规避。
5. **新闻正文付费墙**：我们只做标题+外链，不抓正文。
6. **Claude API 成本**：分析缓存、按需重生成，控制调用量。

---

## 7. 下一步

建议从 **M0 脚手架** 开始（能看到一个真实上线的空壳 + 设计系统），随后 M1 定 schema、M2 出三页可点的原型。
你确认这个方案后我就开 M0。
```
