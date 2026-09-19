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
- 2026-09-19 T20 完成：src/focus——useFocusList（↑↓ 到兩端停住、OK 與 1–9 直接開啟並可略過沒有鍵帽的警示卡、真正的 DOM focus、捲到可見範圍留 6px、第一項放得下時捲到最上面、沒有項目時捲 60%）、useGrid（↑↓ 跳一列、◀▶ 同一列、最左欄呼叫 onLeftEdge）、restore（依 location.key 記進 session store、依 ID 還原、清單變動時留在原項目或原位置、面板打開時不搶焦點）；開啟前端覆蓋率門檻（lib＋keys＋focus＋store 合計 ≥ 90%，目前 99%）（67e55ed）
- 2026-09-19 T21 完成：一次登記全部路由（佔位畫面）、useNav（面板 push／關閉 back、分頁 replace、面板項目 replace）、啟動時先換成首頁再 push 上次畫面並帶回焦點、未完成設定導向首次設定、未知路徑回首頁（836367a）
- 2026-09-19 同步點 1（第一段）完成：track/frontend（T16–T21）合併進 main，make lint、make test 通過；T23、T24 完成後再合併並跑 make e2e（5478422）
- 2026-09-19 T22 完成：fetch 包裝（10 秒逾時、錯誤碼轉換、demo 標頭）、TanStack Query 預設值與每個端點的 hook、由 API 實際回應存下的 msw fixtures 與 handlers、QueryClientProvider 與漲跌顏色（892b191）
- 2026-09-19 T23 完成：src/components 的 Header、InfoBar、SoftKeys、Tabs、Card、CropIcon、KeyCap、Pill、Sparkline、TrendChart、MetricGrid、Sheet、StatusBox、Skeleton（另有 Tile、PriceTypeTag、IconGrid），SVG 搬到 src/icons；漲跌色改由 UpIsPosContext 決定；/debug/components 展示頁在兩種尺寸與語言下沒有溢出、字級不低於下限（45cf36f）
- 2026-09-19 T24 完成：Playwright 設定、只輸出 JSON 摘要的報告器、失敗才截圖、溢出／字級下限／焦點／console 檢查、make e2e（demo 模式完整服務）與 e2e.yml；元件展示頁在兩種尺寸 × 兩種語言通過（00cc165）
- 2026-09-19 同步點 1 完成：T23、T24 合併進 main，make lint、make test（前端 404、後端 157）、make e2e（70 項）全部通過（00cc165）
- 2026-09-19 T31 完成：# 換地區面板（最近 3 個地區＋其他地區…，首頁改我的地區、詳情改正在看的地區）與選擇地區清單（最近使用、依直線距離排序、資料狀態點、更改國家…、載入與失敗重試），匯出 sheetSoftKeys(t) 給畫面在面板開啟時使用（9ca7a0b）
- 2026-09-19 T25 完成：首頁「關注」作物卡片（價格、漲跌、7 日走勢、非今日標示、無資料說明）與「全部作物」九宮格，◀ ▶ 換分頁、`*` 批發／零售、`#` 換地區面板、左軟鍵選單、1–9 直接開啟，含載入、連線失敗（有／無舊資料）與 128×160 縮減（55cb19b）
- 2026-09-19 T26 完成：作物清單（分類、全部、最近看過）共用首頁的作物卡片與狀態，一次 `/prices` 供所有清單使用，空清單顯示「無資料」，未知分類導回首頁（ecb30b3）
- 2026-09-19 T33 完成：左軟鍵選單（詳情頁多「加入／取消關注」，匯出 useMenuSheetSoftKeys 給畫面顯示面板軟鍵）、編輯關注、設定五列與語言清單、關於與資料說明（含 DB-IP 標示）；demo 建置的設定多一列「Demo」，可切換模擬 API 失敗、地區未更新、推測位置三個開關（F18，T36 的其餘部分待做）（c468b46）
- 2026-09-19 T32 完成：首次設定五個畫面（語言、其他語言、確認位置、國家、地區），推測不到位置時直接選國家，選「是」或選完地區後回到首頁且不留設定畫面在歷史裡（244b114）
- 2026-09-19 T27 完成：作物詳情的外框（資訊列、分頁、選單與換地區面板）與行情分頁：大數字卡、本地區市場卡或零售說明、三個指標，以及載入中、連線失敗、沒有零售、今天未更新、無資料等狀態（8aa1055）
- 2026-09-19 T28 完成：走勢分頁：# 切換 7／30 日（`?days=30`）、沒有價格的日子斷線、高／低／波動跟著區間（f26ebeb）
- 2026-09-19 T29 完成：比價分頁與排序面板：API 名次、「你」、與正在看的地區的差額、四種排序（`?sort=`）、OK 或數字鍵開啟該地區的行情（8a7cae9）
- 2026-09-19 T30 完成：本地區各市場（依價格排名、與中位數的差額、非今天才標新舊、無資料排最後、`#` 換地區、零售改說明加「看批發」）與單一市場（代表價、漲跌、當日區間條、資料來源；零售時「看 {地區} 的零售價」回到詳情頁不增加歷史），含載入、失敗重試、保留舊資料與 128×160 縮減（70d8f28）
- 2026-09-19 同步點 2 完成：6 組畫面（T25–T33）合併進 main，make lint、make test（前端 478、後端 157）、make e2e（70 項）全部通過（10b50c6）
- 2026-09-19 T34 完成：Playwright 只用按鍵跑主要流程（首次設定兩條路、4 個國家 × 語言組合）與全部畫面 × 兩種尺寸共 114 項，檢查溢出、焦點、字級與 console；修正 e2e 等待方式與走勢圖誤標「休」（ae012fb）
- 2026-09-19 T35 完成：每個畫面的 error boundary（回首頁出口）、首頁與作物清單遇到 area_not_found 導向地區清單；demo 開關在完整服務上重現 API 失敗（有／沒有舊資料）、地區今天未更新、沒有零售、沒有資料，兩種尺寸都通過（f87641e）
- 2026-09-19 T36 完成：每個動作即時存（store）；從首頁網址重新開啟時回到上次畫面與焦點、返回回到首頁（T21 機制，e2e 驗證）；設定 › Demo 可切換三個開關，請求帶上 X-Demo-* 標頭（e2e 驗證）（d22336f）
- 2026-09-19 T37 完成：各畫面的 128×160 縮減規則已在實作時套用；make e2e 在 128×160 全部通過，16 個畫面截圖目視確認（3db54b5）
- 2026-09-19 T38 完成：根目錄 README（繁中）：一句話介紹、4 張 240×320 截圖（make screenshots 產生）、快速開始與 demo 模式、mermaid 架構圖、技術選型、技術亮點、測試與 CI、專案結構；指令都實際執行、21 個連結都存在、mermaid 可解析（0a50868）
- 2026-09-19 T39 完成：baseline 驗收——全部畫面 × 兩種尺寸、主要流程 × 四個國家與語言組合；新增驗收 e2e（`*` 讓所有數值一起切換、只用按鍵換語言不改國家與地區）；修正 128×160 看不到價格類型；make lint、make test（前端 481、後端 157）、make audit（0 漏洞）、make e2e（134 項）全部通過；空資料庫 `cp .env.example .env && make up` 約 31 秒可用，README 的快速開始照做可以跑起來（03aedd8）

## baseline 完成摘要（2026-09-19）

T01–T39 全部完成並合併進本地 `main`（沒有 push）。**Phase 2 由人接手**；各條平行開發線的分支（`track/*`）保留，worktree 已移除。

### 做了什麼

- **服務**：`make up` 用 docker compose 起四個服務：db（PostgreSQL 16，只綁 127.0.0.1）、api（FastAPI，啟動時自動 migrate）、worker（啟動時抓一次，之後在各國當地時間 00:05 抓）、web（Caddy：靜態檔、`/api` 轉發、安全標頭與 CSP、SPA fallback）。`make dev` 是 Vite HMR 加上 api `--reload`；`compose.prod.yaml` 開 80／443，`SITE_ADDRESS` 設成網域後 Caddy 會自己取得 HTTPS 憑證。
- **資料管線**：mock provider 輸出真實來源的格式（data.gov.in 的公擔、農業部 FarmTransData 的民國日期、零售調查）→ 正規化 → 06 §2.1 的檢查 → COPY upsert → 市場代表價與地區中位數（附市場數）→ `ingest_runs`。印度 11 個地區、31 個市場，台灣 10 個地區、14 個市場，各 10 種作物、60 天；延遲、休市、沒有零售、沒有資料等例外都放進 mock。
- **API**：`/api/v1` 的國家、地區、作物、價格、行情、比價、市場、位置推測與健康檢查；統一錯誤格式、X-Request-ID、Cache-Control、Swagger（`/api/docs`）。前端型別由 OpenAPI 產生（`make types`），CI 的 contract job 會擋下過期的型別。位置推測：`X-Forwarded-For` 最左邊的公開 IP → DB-IP 資料庫 → 300 km 內最近的地區；沒有資料庫檔案時照常運作，改成讓使用者自己選國家。
- **前端**：全部畫面——首次設定（語言、其他語言、確認位置、國家、地區）、首頁（關注、全部作物）、作物清單、作物詳情（行情、走勢、比價）、本地區各市場、單一市場、地區清單、左軟鍵選單、換地區與排序面板、設定（語言、單位、編輯關注等）、關於。按鍵只看 `event.key`；每個畫面與面板都是一筆歷史；用真正的 DOM 焦點並依 ID 還原；每個動作立刻存；重新開啟時回到上次的畫面與焦點。繁中與 English 全部走 i18n；支援 240×320 與 128×160；印度與台灣的幣別、單位、漲跌顏色都跟著國家。
- **狀態**：載入中、連線失敗（有／沒有舊資料）、地區今天未更新、沒有零售、沒有資料、地區不存在，以及每個畫面的 error boundary。demo 建置的設定多一列「Demo」，可以現場切換模擬 API 失敗、地區未更新與推測位置。
- **品質**：`make lint`（ESLint 含分層規則、tsc、ruff、mypy strict）；`make test`（前端 481 項、後端 157 項；後端 services＋ingest 覆蓋率 98%，前端 lib＋keys＋focus＋store 通過 90% 門檻，前端整體 96%）；`make audit` 0 個漏洞；`make e2e`（Playwright 134 項：全部畫面 × 兩種尺寸、主要流程 × 四個國家與語言組合、各種狀態、重新開啟、驗收項目，每項都檢查溢出、字級、焦點與 console）。CI 有 frontend、backend、contract、images 四個 job；`e2e.yml` 在手動觸發與 push 到 `main` 時跑。
- **README**：繁中，含 4 張截圖、快速開始、demo 模式、架構圖、技術選型與亮點。

### decisions.md 的重點

- 工具鏈：TypeScript 固定 5.9、react-router 用 7（產生型別與 lint 的工具還不支援 TS 6／7）。
- 分層規則交給 ESLint 擋：`components/` 不讀 store、不呼叫 API；`screens/` 不直接 `fetch`、不直接讀 `localStorage`；也擋 `keyCode`、`alert`、GPS。
- 後端：quotes 先 COPY 進暫存表再一次合併（約 6 秒降到 0.6 秒）；漲跌比率先進位到 12 位小數再和持平門檻比較；coverage 要設定 greenlet，才算得到 async 程式的覆蓋率。
- 數字與日期：一律由 `Intl` 進位，正負號看進位後的結果（`+`、`−`、`±`）；日期與星期的文字由 i18n 傳進 `lib/dates`。
- 漲跌顏色由 `UpIsPosContext` 依國家決定；元件的字級都提高到下限，只有鍵帽維持 9px。
- 走勢圖的「休」只用在該國的休市星期；其他沒有資料的日子照常寫星期，不掩蓋資料延遲。
- 每個畫面都有 error boundary；首頁與作物清單遇到 `area_not_found` 會導向地區清單。
- 128×160：「舊」標籤仍然顯示；資訊列多一格，讓價格類型永遠看得到（T39）。
- 排程改成多條線平行開發（使用者同意），品質關卡不變。

### 還沒做的事

- Phase 2：部署到公開 HTTPS、在官方 Simulator 測試、回填 08 §12。
- `scripts/deploy.sh`：07 §5.2 寫明 Phase 2 才開始使用，還沒寫。
- 加分項 B1–B8（順序見 02 §3.2）。B3 的 data.gov.in 需要 API 金鑰，要由人申請。
- 英文較長的標題（例如「Median of 7 markets · ₹/qtl」）在 240×320 以省略號截斷，符合規格，但可以再縮短英文字串。

### 給 Phase 2 的注意事項

- **一定要公開 HTTPS**：Simulator 在 CloudMosa 的機房執行，連不到 `localhost`。還沒有 VM 時，用 Cloudflare Tunnel 或 ngrok 把本機的 `:8080` 暴露出去（`SITE_ADDRESS=:8080` 不看 Host，tunnel 後面也能用）。有 VM 時在 `.env` 把 `SITE_ADDRESS` 設成網域，執行 `docker compose -f compose.yaml -f compose.prod.yaml up -d --build`。
- VM 上的 `.env` 手動建立，不進 Git；`POSTGRES_PASSWORD` 一定要換掉。
- 位置推測要先跑 `make geoip` 下載 DB-IP 資料庫（`*.mmdb` 不進 Git）；沒有這個檔案時 App 照常運作，只是不會推測地區。DB-IP 的 CC BY 4.0 標示已經放在關於頁，換資料庫時要一起改。
- 先部署 demo 建置（`.env` 設 `VITE_DEMO=true`、`DEMO_MODE=true`），在 Simulator 打開 `/debug/keys`、`/debug/viewport` 與 `/api/v1/debug/headers`，照 08 §12 逐項確認並回填。最要緊的幾項：`*`、`#`、`Escape` 的 `event.key`；面板開著時按 RSK 是否只關面板；Enter 會不會觸發兩次；實際的 `innerHeight`；`X-Forwarded-For` 的格式（決定位置推測能不能用）。
- 正式建置沒有除錯頁，`/api/v1/debug/headers` 回 404。展示時要不要保留設定裡的「Demo」開關（可以現場示範連線失敗、資料未更新），由團隊決定。
- 在 Simulator 照 02 §7 的驗收條件完整跑一次；程式有改動時，進 Phase 2 前先跑 `make e2e`。
- 2026-09-20 追加：作物擴充到每國 21 種，七個分類都至少 2 種（使用者要求）；新畫 13 個作物圖示；seed、msw fixtures、測試與 docs/06 §7.3–7.4 同步更新；make lint、make test（前端 481、後端 158）、make e2e（134 項）全部通過（f40073d）
- 2026-09-20 追加：CD（加分項 B1，使用者要求提前做）：`scripts/deploy.sh`（fetch → build → 健康檢查，失敗自動回到上一個成功的 commit）與 `deploy.yml`（dw650/harrykuo1 的 main CI 通過後 SSH 部署；金鑰限定只能執行 deploy.sh）；VM 端已準備好，等 GitHub 上的 deploy key 與 secret 設好後驗證（5501221）
- 2026-09-20 追加：CD 伺服器端驗證：VM 用 deploy key 拉 dw650/harrykuo1，手動部署 18a3e2c 成功（外部可連 :3001、demo 已關）；CI 金鑰送 ref 可以部署，夾帶指令與要 shell 都被拒絕。自動部署等 main push 到 dw650 後驗證
- 2026-09-20 追加：依賴檢查遇到外部服務中斷（npm audit 503）時重試後只警告、不擋部署；找到漏洞或其他錯誤仍然失敗（feaaa45）
- 2026-09-20 追加：CD 改成伺服器自己拉（GitHub 的機器連不到 VM 的 22 port）：Deploy workflow 移動 `deploy` 分支，VM 的 systemd 計時器每分鐘檢查並部署；CI 金鑰已從 VM 移除（8a432e3）
- 2026-09-20 追加：B2 台灣農業部真實批發行情（`tw_moa`）：`PROVIDERS=mock,tw_moa` 開啟後台灣只用 FarmTransData、印度仍是 mock，不混用；每個品項一個請求抓 60 天，台灣 06–15 時每小時更新最近 3 天；18 種作物有對照，稻米、紅豆、芝麻與台灣零售沒有資料；預設仍是 mock，伺服器尚未開啟；後端 186 項測試通過（e8bad2e）
- 2026-09-20 追加：「關於」頁與 /api/v1/health 顯示執行中的版本（APP_VERSION，由 make up 與部署腳本帶入）；單一市場畫面的資料來源重複時只顯示一次（8d6ff84）
- 2026-09-20 追加：行情頁附近最高／最低價：quote 回應多了 `nearby`（同國直線 300 km 內最近的 3 個地區，只比同一個交易日，取最高與最低兩列）；指標下方兩張地區卡片，OK 或數字鍵打開那個地區的行情，這個地區自己最高（最低）時標「你」，沒有符合的地區時不顯示；用語不分買賣方；make lint、make test（前端 495、後端 211）、make e2e（140 項）通過（f7fee5a）
- 2026-09-20 追加：B5 國際參考價：左軟鍵選單最後一項（數字鍵 6，詳情頁 7），世界銀行 Pink Sheet 六條月資料（稻米、小麥、玉米、大豆、原糖、棕櫚油）以 ExchangeRate-API 的最新匯率換成當地幣別每公斤，清單標月份與比上月，詳情頁有近 12 個月走勢、近一年高低與原始美元價；worker 啟動時與各時區 00:05 檢查、只在到期時下載（每天約 3 個小請求，部署重啟不重抓），新增四張表（migration 80ac1f2d0366）與 GET /intl、/intl/{series}；make lint、make test（前端 527、後端 289）、make e2e（152 項）通過（d0b06f1）
- 2026-09-20 追加：資料來源的共同介面與馬來西亞（使用者同意）：每個來源宣告 `SourceInfo` 並登記在 `registry.py`，連網來源共用抓取原則（重啟 6 小時內略過、只抓缺的日期加最近 3 天、檔案沒變用 304）與契約測試；馬來西亞 11 個縣、7 個 Borong 市場、20 種作物（新畫 8 個圖示），示範資料用 PriceCatcher 格式；`my_pricecatcher` 串接 KPDN PriceCatcher，零售＝各縣濕巴剎的中位數，Borong 2026 年起沒有回報所以批發是「—」；本機實跑 3 個請求、約 24 秒、6.4 萬列對照得到，之後的排程 2 個 304，抽查 12 個地區價與原始 CSV 相同；make lint、make test（前端 488、後端 251）、make e2e（176 項）全部通過；預設仍是 mock，伺服器尚未開啟（731b828）
- 2026-09-20 追加：資料來源的共同介面與馬來西亞（使用者同意）：每個來源宣告 `SourceInfo` 並登記在 `registry.py`，連網來源共用抓取原則（重啟 6 小時內略過、只抓缺的日期加最近 3 天、檔案沒變用 304）與契約測試；馬來西亞 11 個縣、7 個 Borong 市場、20 種作物（新畫 8 個圖示），示範資料用 PriceCatcher 格式；`my_pricecatcher` 串接 KPDN PriceCatcher，零售＝各縣濕巴剎的中位數，Borong 2026 年起沒有回報所以批發是「—」；本機實跑 3 個請求、約 24 秒、6.4 萬列對照得到，之後的排程 2 個 304，抽查 12 個地區價與原始 CSV 相同；rebase 到 main（0aab200）後 make lint、make test（前端 502、後端 275）、make e2e（182 項）全部通過；預設仍是 mock，伺服器尚未開啟（731b828）
