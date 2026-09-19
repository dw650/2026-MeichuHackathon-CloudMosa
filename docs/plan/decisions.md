# 實作時的決定

> docs 和草圖都沒寫、由 agent 在實作時自行決定的事項。只增不改；要推翻前一條就新增一條並註明。
> 格式：
>
> ```
> ## YYYY-MM-DD TNN 標題
> - 情況：文件哪裡沒寫
> - 決定：怎麼做
> - 理由：為什麼選這個（一兩句）
> - 影響：改到哪些檔案；之後要改的話要動哪裡
> ```


## 2026-09-19 T03 TypeScript 版本
- 情況：05 要求「建專案時取最新穩定版」。npm 上 TypeScript 最新是 7.0，create-vite 範本預設 6.0；但 `openapi-typescript`（型別產生）只接受 TypeScript 5，`typescript-eslint` 也只支援到 6.0。
- 決定：固定 `typescript@~5.9`。
- 理由：工具鏈（openapi-typescript、typescript-eslint）都支援的最新版本。
- 影響：`frontend/package.json`。等 openapi-typescript 支援新版再升級（單獨開分支）。

## 2026-09-19 T03 react-router 版本
- 情況：05 寫 `react-router` 7；npm 上最新是 8。
- 決定：照 05 用 7（`^7.18`）。
- 理由：文件寫明 7；路由與歷史的做法（04 §4.3）以 7 的 API 為準。
- 影響：`frontend/package.json`。

## 2026-09-19 T03 前端套件一次裝齊
- 情況：前端線由子 agent 在 worktree 平行開發，兩邊都改 `package-lock.json` 容易衝突。
- 決定：T03 就把 05 §2 列的套件全部裝好（react-router、zustand、TanStack Query、i18next、msw、openapi-typescript、Playwright 等）。
- 理由：之後的任務不必再動 `package.json`，合併時比較不會衝突。
- 影響：`frontend/package.json`、`package-lock.json`。

## 2026-09-19 T03 用 ESLint 檢查分層規則
- 情況：04 §4.1 規定 `components/` 不讀 store、不呼叫 API；`screens/` 不直接用 `fetch`、`localStorage`；08 規定只用 `event.key`、不用 `alert`。文件沒寫要怎麼檢查。
- 決定：在 `frontend/eslint.config.js` 用 `no-restricted-imports`、`no-restricted-globals`、`no-restricted-properties`（`keyCode`、`which`、`navigator.geolocation`）與 `no-alert` 擋下來。
- 理由：違規在 `make lint` 就會失敗，不必靠人工檢查。
- 影響：`frontend/eslint.config.js`。

## 2026-09-19 T03 web 的健康檢查
- 情況：正式環境的 `SITE_ADDRESS` 是網域，Caddy 不聽 8080，用網站本身做健康檢查會失敗。
- 決定：健康檢查打容器內的 Caddy admin 端點 `http://127.0.0.1:2019/config/`（只在容器內，不對外）。
- 理由：不論 `SITE_ADDRESS` 是什麼都能用。
- 影響：`compose.yaml` 的 `web.healthcheck`。

## 2026-09-19 T06 除錯頁的文字與範圍
- 情況：文件要求介面文字走 i18n，但除錯頁（`/debug/keys`、`/debug/viewport`）是給開發者在實機上校正用的工具，文件沒寫它們是否要翻譯。
- 決定：除錯頁只用英文、不走 i18n；`/debug/viewport` 故意放 10px 的字級樣本，之後的 Playwright 字級檢查不檢查 `/debug/keys`、`/debug/viewport`。按鍵頁另外記錄 `popstate`／`back` 事件與按鈕 `click` 次數，方便驗證 08 §12 的 RSK 與 Enter 兩項。
- 理由：它們不是使用者會看到的畫面；正式建置不含這些路由。
- 影響：`frontend/src/screens/debug/`、`frontend/src/app/debugRoutes.tsx`。

## 2026-09-19 T06 demo 建置旗標
- 情況：`VITE_DEMO` 沒設定時 Vite 不會靜態替換，正式建置刪不掉 demo 專用的程式。
- 決定：`vite.config.ts` 一律 `define` `import.meta.env.VITE_DEMO`（預設 `"false"`）；旗標集中在 `src/app/flags.ts` 的 `IS_DEMO_BUILD`（dev 或 `VITE_DEMO=true`）。後端的 `/api/v1/debug/headers` 只在 `DEMO_MODE=true` 時註冊，而且不列入 OpenAPI，產生的前端型別不受 demo 設定影響。
- 理由：正式建置的路由表裡完全沒有除錯頁（已用正式與 demo 兩種映像實測）。Rolldown 仍會輸出沒有被引用的 chunk 檔，無法從路由到達，暫不處理。
- 影響：`frontend/vite.config.ts`、`frontend/src/app/flags.ts`、`backend/app/main.py`。

## 2026-09-19 T07 資料表的補充欄位與零售對照
- 情況：04 §7 只列主要欄位。零售資料沒有市場，`source_market_map` 對照不到地區；`quotes` 的唯一鍵（來源、市場、作物、品種、交易日）遇到零售列時市場是空值。
- 決定：
  - 新增 `source_area_map`（來源的回報中心或城市 → 地區），給零售資料用。
  - `quotes` 唯一鍵改成（來源、價格類型、地區、市場、作物、品種、交易日），並設 `NULLS NOT DISTINCT`；批發列的市場決定地區，所以等同文件的鍵，零售列也能擋重複。品種空白存成 `''`。
  - `countries` 另外存名稱、涵蓋範圍、預設最近地區、地區名稱後綴（「 縣」）、代表價名稱（常見價／平均價）、單位表（JSONB）；`closed_weekdays` 用 ISO 星期（1＝週一…7＝週日）。
  - `crops.has_retail`、`markets.sort`、`ingest_runs.drop_reasons`（各原因的丟棄筆數）、`quotes.country`、`market_daily.country／area_id／fetched_at`、`area_daily.country`。
  - 除了文件要求的 `ix_area_daily_lookup`，另加 `ix_area_daily_compare`（國家、作物、類型、日期），給比價查詢用。
  - 用 CHECK 限制價格類型、代表價 > 0、「批發一定有市場、零售一定沒有」。
- 理由：API 需要的國家設定都能從資料庫讀；零售與批發走同一條管線。
- 影響：`backend/app/db/models.py`、`backend/app/db/migrations/versions/`。改欄位要新增 migration。

## 2026-09-19 T08 Seed 檔的結構
- 情況：06 §7.3 說基準價 `p`「seed 時換成每公斤」，但 06 §7.1 又要求 mock 輸出來源格式（印度用 quintal）。另外 mock 的例外情境（地區、市場、作物的資料延遲）文件沒寫要放哪裡。
- 決定：
  - mock 參數放在 seed YAML 各項目的 `mock` 區塊，單位跟來源一致（印度 ₹／quintal、台灣元／公斤），由 mock provider 直接讀；換成每公斤是在正規化這一步。資料庫只存目錄（國家、地區、市場、作物、對照表），不存 mock 參數。
  - 例外情境用 `lag`（比今天晚幾天，`null`＝完全沒有資料）表示，放在地區、市場、作物的 `mock` 區塊。
  - 對照表放在 `source_maps.<來源>`。mock 產生原始資料時，名稱反查自同一份對照表，所以一定對得上，正規化仍然完整跑對照。
  - 同步時刪除 seed 裡已經沒有的地區、市場、作物（連帶刪除相關資料），對照表整批替換，所以重跑結果相同。
  - 新增 `countries.source_label`（關於頁的資料來源名稱），用第二個 migration 補上。
- 理由：mock 和真實資料走同一條管線；加國家＝加一個 YAML 檔。
- 影響：`backend/app/seed/`、`backend/app/ingest/seed.py`、`backend/app/repositories/catalog.py`。

## 2026-09-19 T09 Mock 原始資料的格式與產生細節
- 情況：06 §7 規定 mock 輸出來源格式，但零售來源（DoCA、物價查報）的格式還是【待確認】；data.gov.in 沒有到貨量；文件也沒寫市場的 ±2% 是每天不同還是固定、到貨量怎麼分到各市場、今天休市時基準價落在哪天。
- 決定：
  - 印度批發用 data.gov.in 的欄位（`state`、`district`、`market`、`commodity`、`variety`、`grade`、`arrival_date` dd/mm/yyyy、`min_price`／`max_price`／`modal_price` 字串、₹／quintal），另外加一個 mock 專用的 `arrival_qtl`；接真實資料後沒有這欄，到貨量就顯示「—」。
  - 台灣批發用 FarmTransData 的欄位（`交易日期` 民國日期、`作物名稱`「甘藍-初秋」、`市場名稱`、`上價`／`中價`／`下價`／`平均價`、`交易量` 公斤）。
  - 零售先自訂接近來源的格式：印度 `centre`、`commodity`、`date`、`retail_price`（₹／公斤）；台灣 `調查日期`、`縣市`、`品項`、`零售價`（元／公斤）。
  - 每列多兩個 mock 專用的欄位 `_country`、`_type`（wholesale／retail），讓同一個 provider 可以涵蓋兩國兩種價格。
  - 市場的 ±2%、零售的 ±2.5%、隨機漫步都用「國家、作物、市場或地區、日期」當種子，每天不同但重跑相同。
  - 「今天」如果是休市日，基準價落在今天以前最近的交易日。
  - 到貨量是地區層級：最新交易日＝`arr`，前 7 個交易日的平均剛好是 `arr ÷ arrR`，再平均分給地區內的各市場。
- 理由：照文件的規則，缺的部分選最簡單、之後好換成真實格式的做法。
- 影響：`backend/app/ingest/providers/mock.py`。接上真實零售來源（B4）時換掉零售格式即可。

## 2026-09-19 T10 檢查規則的細節
- 情況：06 §2.1 的「價格 ≤ 0」沒說是否包含最低、最高價；「同國同作物當天中位數」沒說是否分批發與零售；也沒寫格式錯誤的列怎麼算。
- 決定：
  - 只有代表價 ≤ 0 或缺漏才丟掉整列；最低或最高價 ≤ 0 時保留代表價、清掉區間。
  - 離群值的中位數依（國家、作物、價格類型、交易日）分組，批發與零售分開算。
  - 檢查順序：缺值與 ≤ 0 → 區間顛倒 → 日期（未來、60 天以前）→ 去重（後到的覆蓋先到的，另外記重複筆數）→ 離群值。
  - 讀不懂的列（例如日期格式錯）記為 `malformed`，對照不到的記為 `unmapped`，和其他丟棄原因一起記數。
- 理由：少丟資料、不讓零售價被當成批發價的離群值；去重後再算中位數，重複列不會影響判斷。
- 影響：`backend/app/ingest/validate.py`、`backend/app/ingest/normalize.py`。
