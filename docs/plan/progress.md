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
- 2026-09-19 T07 完成：全部資料表的 SQLAlchemy 模型與初始 migration（quotes 唯一鍵 NULLS NOT DISTINCT、area_daily 索引、source_area_map）；升降級與模型一致性測試；api 啟動時自動 migrate（4dd298c）
- 2026-09-19 T08 完成：IN.yaml（11 地區、31 市場、10 作物）與 TW.yaml（10 地區、14 市場、10 作物）含國家設定、單位、休市日、mock 參數與對照表；pydantic 驗證參照；同步可重複執行並刪除已移除的項目（a2f9fe8）
