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
- 2026-09-19 T17 完成：src/i18n——STR 搬進 zh-TW／en 字串檔（依畫面分組、key 有型別、{{變數}}、英文單複數、新增資料時間），語言清單（手機語言排第一並標示、हिन्दी 與 More 退回英文、More 每頁 4 個）、setLanguage 同步 <html lang>（zh-Hant）、pickText 取多語文字、dateLabels 接上 T16 的 DateLabels；測試兩份字串檔 key 與變數完全相同、兩種語言插值（016201b）
- 2026-09-19 T18 完成：src/store——settings（語言 id、國家、我的地區、最近 3 個地區、關注、批發／零售、各類型單位、首次設定完成、demo 開關；國家預設值由 GET /countries 傳入，換國家時重設地區、關注、單位與最近看過的作物）、session（上次畫面與其 location.key、每筆歷史的焦點留最新 50 筆、最近看過 5 個作物）、migrate（版本號＋逐步遷移、讀取時檢查欄位；壞 JSON、格式不對、沒有遷移路徑都重設回首次設定）；語言變更同步 i18next；src/store 覆蓋率 100%（d1e2498）
- 2026-09-19 T07 完成：全部資料表的 SQLAlchemy 模型與初始 migration（quotes 唯一鍵 NULLS NOT DISTINCT、area_daily 索引、source_area_map）；升降級與模型一致性測試；api 啟動時自動 migrate（4dd298c）
- 2026-09-19 T08 完成：IN.yaml（11 地區、31 市場、10 作物）與 TW.yaml（10 地區、14 市場、10 作物）含國家設定、單位、休市日、mock 參數與對照表；pydantic 驗證參照；同步可重複執行並刪除已移除的項目（a2f9fe8）
- 2026-09-19 T09 完成：Mock provider 輸出 data.gov.in／FarmTransData 格式（quintal、民國日期）與零售格式；固定種子、今天往回 60 天、休市日不產生；地區／市場／作物的延遲與無資料、無零售等例外都放入（393773d）
- 2026-09-19 T10 完成：各來源格式的正規化（quintal→公斤、民國日期、對照表，對照不到與格式錯誤分別記數）與 06 §2.1 全部檢查規則（缺值、≤0、區間、離群值、日期、去重）（9b084dd）
- 2026-09-19 T11 完成：管線（fetch→正規化→檢查→COPY upsert quotes→market_daily／area_daily 中位數→ingest_runs）、worker（啟動時一次、各國當地 00:05）、compose worker、make seed；make up 後 area_daily 有資料（1f69f15）
- 2026-09-19 T12 完成：純函式：資料新舊（today／closed／stale／none）、漲跌與持平門檻、比 7 日均價、30 日位置、波動、到貨量、30 天序列（缺值 null）、比價名次與 haversine、市場差額；開啟後端覆蓋率門檻（services+ingest ≥ 90%，目前 97%）（ef6a230）
- 2026-09-19 T13 完成：GET /countries（含當地 today、單位表、預設關注）、/countries/{cc}/areas（座標、最新交易日與新舊）、/countries/{cc}/crops；每個端點有 summary 與範例、Swagger 在 /api/docs；scripts/gen-api-types.sh、make types、CI contract job（34c25a5）
- 2026-09-19 T14 完成：GET /prices、/crops/{crop}/quote（含 markets、change、stats、30 天序列、source）、/compare（名次、距離、差額）、/markets、/markets/{market}；沒有價格時附 reason；Cache-Control；前端型別已重新產生（a0cee3e）
- 2026-09-19 T15 完成：GET /locate（X-Client-Forwarded-For 最左邊的公開 IP → mmdb → 300 km 內最近地區）、可替換查詢介面與缺檔時照常運作、make geoip 與 infra/geoip/README.md；X-Demo-Fail／Stale／IP／Locate 只在 DEMO_MODE 生效（bab0e23）
- 2026-09-19 T19 完成：src/keys——keyScope（window 上唯一的 keydown 監聽器，只依 event.key 分派給最上層範圍；screen／overlay 兩層，面板打開時不穿透；長按只有方向鍵；處理的鍵與 Enter 一律 preventDefault；略過 Ctrl／Meta／Alt 與輸入法組字）與 useKeys（handler 永遠最新、重新 render 不改順序）；ESLint 擋 keys/ import screens/（2680565）
