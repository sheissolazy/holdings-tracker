# 持仓追踪 · Holdings Tracker

自用静态站：追踪关注人物的持仓 / 交易 / 喊单 + AI 公司分析 + IPO 日历 + 新闻。
GitHub Pages 静态托管 + PWA，电脑/手机自适应。架构与设计见 [`PLAN.md`](./PLAN.md)。

## 本地开发

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # 类型检查 + 产物到 dist/
```

技术栈：React 18 + Vite 6 + TypeScript + Tailwind v4 + react-router(hash) + lightweight-charts + recharts。
> Spring 类比：`package.json`≈`pom.xml`，`npm ci`≈`mvn install`，Vite≈Spring Boot DevTools 热重载，`dist/`≈`target/`。

## 页面

首页 Briefing · 明日交易计划 · 人物详情 · 完整持仓 · 股票详情 · AI 完整分析 · 新闻 · IPO 日历 · 设置。
当前全部读 **mock 数据**（`src/data/mock.ts`）。真实数据由下方管道生成。

## 部署到 GitHub Pages（需你的 GitHub 账号）

1. 新建 GitHub 仓库，把本项目推上去：
   ```bash
   git init && git add -A && git commit -m "init holdings tracker"
   git branch -M main
   git remote add origin git@github.com:<你的用户名>/<仓库名>.git
   git push -u origin main
   ```
2. 仓库 **Settings → Pages → Build and deployment → Source 选 "GitHub Actions"**。
3. push 后 `.github/workflows/deploy.yml` 自动构建并部署。站点地址：`https://<用户名>.github.io/<仓库名>/`。
4. 手机打开该地址 → 浏览器「添加到主屏幕」即为 PWA。

> `vite.config.ts` 用 `base: './'`（相对路径），配合 hash 路由，项目子路径下也能正常加载，无需改 base。

## 数据管道（M3/M4，需密钥与网络）

Python 脚本在 GitHub Actions 里抓数据 → 写 `public/data/*.json` → 提交 → 触发重新部署。

```bash
cd pipeline
pip install -r requirements.txt
python run_all.py          # 本地试跑，写到 ../public/data/
```

定时任务见 `.github/workflows/data.yml`（cron）。需要在仓库 **Settings → Secrets** 配置：

| Secret | 用途 | 必需 |
|--------|------|------|
| `ANTHROPIC_API_KEY` | 构建时生成 AI 分析 | AI 分析需要 |
| `X_AUTH_TOKEN` / `X_CT0` | 自有 X 登录 cookie，拉 Musk/Serenity | 社交信号需要 |

13F（SEC EDGAR）、Congress（house/senate-stock-watcher）、Truth Social（Trump）、股价、IPO、新闻 RSS 均为**免费无密钥**。各脚本带 `--mock` 兜底，缺数据源时不致整体失败。

详见 [`pipeline/README.md`](./pipeline/README.md)。

> 免责：AI 分析基于公开数据生成，非投资建议。13F 有 ~45 天申报延迟；社交信号为最佳努力，时效/完整性不保证。
