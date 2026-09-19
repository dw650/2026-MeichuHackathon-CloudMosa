# 進度紀錄

> 每完成一個任務就在最下面加一行，只增不改。格式：
> `- YYYY-MM-DD TNN 完成：一句話說明做了什麼（commit 短 hash）`
> 卡住時也要寫：`- YYYY-MM-DD TNN 卡住：卡在哪裡、試過什麼、需要人做什麼`

- 2026-09-19 T01 完成：資料夾結構、.gitignore、.env.example、Makefile（up／down／logs）、compose 只有 db（綁 127.0.0.1:${DB_PORT}），make up 後 db healthy（e76c204）
- 2026-09-19 T02 完成：uv 專案、FastAPI（factory）、pydantic-settings、統一錯誤格式與 X-Request-ID middleware、/api/v1/health、Alembic、Dockerfile、compose api、make test／lint（後端）（dc60f4d）
- 2026-09-19 T03 完成：Vite + React 19 + TS strict、ESLint（含分層規則）＋Prettier、Vitest、tokens.css／global.css、Shell、web 映像（Caddy：/api 轉發、X-Client-Forwarded-For、SPA fallback、安全標頭）、compose.prod.yaml；8080 顯示 Shell、console 無 CSP 錯誤（6a9763c）
- 2026-09-19 T04 完成：compose.dev.yaml（frontend-dev 跑 Vite、api --reload、bind mount、dev 預設 DEMO_MODE）、Caddyfile.dev、make dev；8080 經 Caddy 的 HMR 不整頁重載、/api 仍轉發（02f1cbf）
- 2026-09-19 T05 完成：ci.yml（frontend、backend＋PostgreSQL service、images），每步都呼叫 make 目標；覆蓋率一行摘要；make audit（npm audit、pip-audit，目前 0 漏洞）；YAML 與 actionlint 檢查通過（2417253）
- 2026-09-19 T06 完成：/debug/keys（key、code、repeat、時間差、popstate／back、Enter click 次數）、/debug/viewport（尺寸、字級、Intl 樣本），只在 dev 或 VITE_DEMO 建置；/api/v1/debug/headers 只在 DEMO_MODE（8359ab2）
- 2026-09-19 T16 完成：src/lib 純函式——units（06 §5 單位表、由每公斤換算、單位設定失效時退回）、format（Intl 依國家 locale、lakh 分組、進位後才決定 +／−／±、缺值顯示「—」）、change（0.05% 持平、百分比位數規則、▲▼＝）、dates（UTC 安全的日期與星期、資料時間照字串原本的時刻、昨天／N 天前、滿 3 天警示、休市顯示日期），文字由 DateLabels 傳入；src/lib 覆蓋率 100%（9421605）
