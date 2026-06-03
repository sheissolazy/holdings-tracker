# 数据管道（pipeline/）

构建时抓数据 → 写 `../public/data/*.json` → 提交回仓库 → 触发前端重新部署。
**静态站运行时不抓任何数据**，只读这些 JSON。

## 跑一次

```bash
cd pipeline
python run_all.py --mock     # 用兜底数据，验证管道与 JSON 结构（无需联网/密钥/装包）
python run_all.py            # 真实抓取；缺源或缺密钥的步骤自动回落兜底，整体不中断
```

输出到 `../public/data/`：
`people.json` · `signals.json` · `news.json` · `articles.json` · `ipos.json` ·
`events.json` · `tradeplan.json` · `meta.json` · `stocks/{T}.json` · `prices/{T}.json`

## 数据源与密钥

| 模块 | 源 | 密钥 | 备注 |
|------|----|------|------|
| `fetch_13f` | SEC EDGAR 13F-HR | 无 | Buffett/Leopold。**CUSIP→ticker 映射表需补**，当前回落 mock |
| `fetch_congress` | house-stock-watcher | 无 | Pelosi |
| `fetch_social` | Truth Social / RSSHub | `X_AUTH_TOKEN` `X_CT0` | Trump 免登录；Musk/Serenity 需你的 X cookie |
| `fetch_prices` | stooq CSV | 无 | 仅拉关注列表的票 |
| `fetch_news` | RSS / Wechat2RSS | 无 | 猫笔刀 RSS 填到 `config.PEOPLE[maobidao].rss` |
| `fetch_ipos` | Finnhub | `FINNHUB_API_KEY` | 缺则回落 mock 列表 |
| `gen_ai` | Claude API | `ANTHROPIC_API_KEY` | 生成 thesis；缺则回落 mock |

在 GitHub 仓库 **Settings → Secrets and variables → Actions** 配置上述 secret。

## 自动化

`.github/workflows/data.yml`（cron）每日收盘后跑 `run_all.py`，把变化的 JSON 提交；
提交后 `deploy.yml` 经 `workflow_run` 自动重新部署。

## 待办（让数据真正落地）

1. **CUSIP→ticker 映射表**：13F infoTable 只有 CUSIP，需一张映射表（SEC company_tickers + 补全）。
2. **社交分类**：把抓到的帖子过 `gen_ai` 抽取 ticker + 多空（目前社交为兜底信号）。
3. **前端切到读 JSON**：当前前端读 `src/data/mock.ts`；待 `public/data/` 有稳定真实数据后，
   加一个数据加载层（fetch JSON）替换 mock 导入。建议先在一个页面试点再全量。
