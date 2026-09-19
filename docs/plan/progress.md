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
- 2026-09-19 T09 完成：Mock provider 輸出 data.gov.in／FarmTransData 格式（quintal、民國日期）與零售格式；固定種子、今天往回 60 天、休市日不產生；地區／市場／作物的延遲與無資料、無零售等例外都放入（393773d）
- 2026-09-19 T10 完成：各來源格式的正規化（quintal→公斤、民國日期、對照表，對照不到與格式錯誤分別記數）與 06 §2.1 全部檢查規則（缺值、≤0、區間、離群值、日期、去重）（9b084dd）
- 2026-09-19 T11 完成：管線（fetch→正規化→檢查→COPY upsert quotes→market_daily／area_daily 中位數→ingest_runs）、worker（啟動時一次、各國當地 00:05）、compose worker、make seed；make up 後 area_daily 有資料（1f69f15）
- 2026-09-19 T12 完成：純函式：資料新舊（today／closed／stale／none）、漲跌與持平門檻、比 7 日均價、30 日位置、波動、到貨量、30 天序列（缺值 null）、比價名次與 haversine、市場差額；開啟後端覆蓋率門檻（services+ingest ≥ 90%，目前 97%）（ef6a230）
- 2026-09-19 T13 完成：GET /countries（含當地 today、單位表、預設關注）、/countries/{cc}/areas（座標、最新交易日與新舊）、/countries/{cc}/crops；每個端點有 summary 與範例、Swagger 在 /api/docs；scripts/gen-api-types.sh、make types、CI contract job（34c25a5）
- 2026-09-19 T14 完成：GET /prices、/crops/{crop}/quote（含 markets、change、stats、30 天序列、source）、/compare（名次、距離、差額）、/markets、/markets/{market}；沒有價格時附 reason；Cache-Control；前端型別已重新產生（a0cee3e）
- 2026-09-19 T15 完成：GET /locate（X-Client-Forwarded-For 最左邊的公開 IP → mmdb → 300 km 內最近地區）、可替換查詢介面與缺檔時照常運作、make geoip 與 infra/geoip/README.md；X-Demo-Fail／Stale／IP／Locate 只在 DEMO_MODE 生效（bab0e23）
