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

## 2026-09-19 T16 日期與新舊標示的文字由呼叫端傳入
- 情況：T16 要產生「9/19 週六」「Sat 19/9」「昨天」「3 天前」，但 i18n 在 T17 才做；lib 不能寫死介面文字，也不該綁定 i18next 的插值語法。
- 決定：`lib/dates.ts` 不含任何語言文字，由 `DateLabels` 參數傳入：`weekdays`（週日開頭）、`yesterday`、`none` 三個字串，以及 `date({m,d,w})`、`dateTime({m,d,time})`、`daysAgo({n})` 三個組字函式，變數名稱沿用 `STR`。資料時間照 03 §7 與草圖，兩種語言都是「9/19 11:40」；時刻固定 24 小時制 `HH:mm`，取時間字串原本寫的時刻，不換算時區。
- 理由：T17 可以直接寫 `date: (v) => t('date', v)`；lib 的測試仍能驗證完整文字。
- 影響：`frontend/src/lib/dates.ts`。T17 要提供 `DateLabels`（`STR` 沒有資料時間的字串，要新增一個 key）。

## 2026-09-19 T16 數字的進位與正負號
- 情況：文件只說用 `Intl.NumberFormat`、小數位數依單位；草圖用 `toFixed` 先進位再決定 `+`／`−`／`±`。但 `toFixed` 依二進位值進位（0.15 → 0.1），和 `Intl`（0.15 → 0.2）不一致；`Intl` 也會把 −0.04 印成「-0.0」。
- 決定：一律由 `Intl` 進位（`signDisplay: 'exceptZero'` 加 `formatToParts`），正負號取自進位後的結果：正數 `+`、負數 `−`（U+2212，不帶號的格式遇到負數也用它）、進位後為 0 是 `±`。`null`、`NaN`、`Infinity` 都顯示「—」。價差的方向（`priceDiffDirection`）也依換算並進位後的值判斷，所以「±0」一定是持平色（草圖用未進位的原始值判斷）。
- 理由：畫面上的數字、正負號與顏色永遠一致。
- 影響：`frontend/src/lib/format.ts`、`frontend/src/lib/change.ts`。

## 2026-09-19 T16 百分比格式
- 情況：06 §3.4 規定了持平門檻與小數位數，但沒寫百分比是否依國家 locale、要不要帶正負號。
- 決定：`formatPercent` 用 `Intl` 的 percent 樣式與國家 locale，只顯示大小，方向靠 ▲▼＝；10% 的界線依原始比例判斷（9.96% 顯示「10.0%」，和草圖相同）。另外提供 `formatSignedPercent` 給沒有符號的地方（例如「比 7 日均價」`+3.1%`），持平時是 `±0%`，和價差的 `±` 一致（草圖在 0 時顯示 `+0%`）。
- 理由：percent 樣式以十進位乘 100，不會有 0.145 → 14% 的浮點誤差；全 App 的正負號規則一致。
- 影響：`frontend/src/lib/change.ts`。

## 2026-09-19 T16 新舊標示與單位設定的退回
- 情況：06 §3.5 寫「3 天以上用警示色」，草圖從 2 天起就用警示色，也沒有「休市」狀態；單位表之後由 `GET /countries` 提供，使用者存的單位 id 可能已經不在表裡。
- 決定：照文件，`stale` 滿 3 天才警示；`closed` 顯示最新交易日（格式同「9/19 週六」）、不警示；未知的狀態當成 `stale`，`stale` 卻沒有天數時不加標示。`resolveUnit` 依序退回：存的 id → 預設 id → 第一個選項 → 公斤（×1、1 位小數）。單位格式是 `{ id, perKg, decimals }`，`perKg` 是由每公斤換算的倍數（公擔 100、台斤 0.6）。
- 理由：文件優先於草圖；資料或設定不符時退回最常見的顯示，畫面不會壞掉。
- 影響：`frontend/src/lib/dates.ts` 的 `describeFreshness`、`frontend/src/lib/units.ts`；`/countries` 的單位欄位若取別的名稱，T22 在 API 層對應成 `UnitSpec`。

## 2026-09-19 T17 字串 key 的分組與命名
- 情況：T17 只寫「key 依畫面分組並取有意義的名稱」，沒規定怎麼分組、`STR` 的陣列怎麼存、變數怎麼命名。
- 決定：共用的放 `app`、`softkeys`、`hints`、`date`、`freshness`、`priceType`、`states`、`common`、`menu`、`categories`；各畫面放 `setup`、`home`、`detail`（`tabs`、`trend`、`today`、`stats`、`compare`）、`markets`、`areas`、`watch`、`settings`、`about`。陣列改成以 id 為 key 的物件，id 沿用路由與 API：首頁分頁 `watch`／`all`、詳情分頁 `trend`／`today`／`compare`、分類是後端的 `cereal`…`other` 加 `all`、`recent`、到貨量 `low`／`normal`／`high`、波動與 30 日位置 `low`／`mid`／`high`；排序 `priceDesc`／`priceAsc`／`distanceAsc`／`distanceDesc` 與設定列 `language`／`country`／`area`／`wholesaleUnit`／`retailUnit` 是自訂的。只有星期維持陣列（週日開頭，給 `DateLabels`）。`{a}` 這類變數改成有意義的名稱（`{{area}}`、`{{count}}`、`{{price}}`…）；日期類（`date.*`、`freshness.daysAgo`）沿用 T16 的 `m`、`d`、`w`、`time`、`n`，直接傳給 `DateLabels`。
- 理由：畫面可以直接寫 `` t(`detail.stats.arrivals.${level}`) ``；key 有型別，拼錯會編譯失敗。
- 影響：`frontend/src/i18n/locales/*.json`、`frontend/src/i18n/index.ts`。加字串時兩個檔案都要加，`locales.test.ts` 檢查兩邊的 key 與變數一致。

## 2026-09-19 T17 草圖字串的調整
- 情況：`STR` 有幾句寫死範例值、拆成兩段，或只給草圖自己用；英文在數量是 1 時會變成「1 markets」。
- 決定：
  - `errSub`「先顯示 09:12 的資料」、`emptyNote`「通常 14:00 前更新」的時間改成 `{{time}}`，由畫面帶入。
  - `aboutL` 第 3、4 段合併成 `about.noMoney` 一句；第 2 段和 `helpL` 第 5 段相同，只留 `about.demo`。
  - 不搬：草圖模擬離開 App 的 `exitT`、`exitN`；語音播報（B8）的 `voice`、`voiceS`、`hint.listen`，做 B8 時再加。
  - 新增：資料時間 `date.dataTime`（兩種語言都是 `{{m}}/{{d}} {{time}}`，03 §7）；語言清單的 `setup.language.fallbackNote`「→ English・尚未提供」（02 §5.1；草圖是在程式裡組字）。
  - 英文單複數：`detail.today.markets`、`detail.compare.marketCount` 用 i18next 的 `count` 加 `_one`／`_other`（「1 market in this area」「1 mkt」）；中文兩個形式是同一句，只為了兩個檔案的 key 相同。`detail.today.median` 不分單複數，數量是 1 時照草圖改用 `detail.today.oneMarket`（中文的複數規則沒有「one」，不能交給 i18next 切換）。
- 理由：介面文字全部走 i18n（03 §7），畫面不自己組字；用詞仍照 `STR`，只改範例值與分段。
- 影響：`frontend/src/i18n/locales/*.json`。

## 2026-09-19 T17 語言的判斷與退回
- 情況：02 §5.1 只寫「手機語言排第一」；`navigator.language` 的代碼不一定標準（08 §9）；手機語言不在三個主要語言裡、或選了尚未翻譯的語言時怎麼辦，文件沒寫。
- 決定：
  - 手機語言只比對主要子標籤（不分大小寫，`-`、`_` 都可以）：`zh-Hant-TW`、`zh-CN` 都算繁體中文；`tl-TL` 這類不在清單的算推測不到。
  - 手機語言是三個主要語言之一才排第一並標「手機語言」；否則照草圖的預設順序（繁體中文、English、हिन्दी），不標示。「More・其他」的語言不標示也不調整順序。
  - store 存使用者選的語言 id（可能是 `hi`、`bn`…），`resolveLanguage` 換成介面語言：只有 `zh-TW`、`en` 是它自己，其他一律 `en`。B6 做完印地文時，把 `hi` 加進 `SUPPORTED_LANGUAGES` 並加字串檔即可。
  - 還沒選語言時（首次設定），介面先用手機語言換算出的介面語言。
  - `<html lang>`：`zh-TW` 用 `zh-Hant`，其他用 `en`，讓 tokens.css 的 `:lang(zh)` 生效。
  - API 的多語文字（`{"zh-TW", "en"}`）用 `pickText` 取：介面語言 → 英文 → 第一個非空值；都沒有時是空字串。
- 理由：規則最少、都能測試；選了尚未翻譯的語言也會記住，翻譯完成後自動生效。
- 影響：`frontend/src/i18n/languages.ts`、`index.ts`、`text.ts`。T18 的 `settings` 存語言 id，還原與變更時呼叫 `setLanguage(id)`。

## 2026-09-19 T18 store 的欄位與動作
- 情況：04 §4.5 只列出 `settings`、`session` 要放什麼，沒寫欄位、預設值、國家預設值從哪裡來、首次設定什麼時候算完成、demo 開關存在哪裡。
- 決定：
  - `settings`（localStorage key `agriprice.settings`，版本 1）：`language`（語言 id，可能是 `hi` 等；還沒選是 `null`，介面跟著手機語言）、`country`（`IN`／`TW`／`null`）、`areaId`（我的地區）、`recentAreaIds`（最近的在前、不重複、最多 3 個）、`watchlist`（依顯示順序）、`priceType`（`wholesale`／`retail`）、`units`（每種價格類型一個單位 id，`null`＝國家預設）、`setupDone`、`demo`（`fail`、`stale`、`locate`：`auto`｜`none`｜`IN:nashik`｜`TW:taipei`）。demo 開關先放進 settings，T36 做「Demo」列時不必遷移。
  - 國家預設值由呼叫端從 `GET /countries` 傳進來，store 不呼叫 API：`chooseCountry(code, defaults)` 的 `defaults` 欄位名稱照 API（`default_area_id`、`default_recent_area_ids`、`default_watch`），可以直接傳 API 回傳的國家物件。
  - 換成別的國家：我的地區、最近地區、關注換成該國預設，單位回到 `null`，清空最近看過的作物；再選一次同一個國家什麼都不變（不會洗掉關注）。語言、批發／零售、demo 開關保留。
  - 首次設定完成＝選了地區：`chooseArea` 同時把 `setupDone` 設為 true；還沒選國家時忽略。選國家時雖然先填入預設地區，但要選完地區才算完成。
  - 詳情頁換「正在看的地區」用 `rememberArea`：照草圖只加進最近地區，不改我的地區。
  - `session`（`agriprice.session`，版本 1）：`lastLocation`（`pathname + search` 與 `location.key`）、`focus`（`{ key, id }` 陣列，最舊的在前，只留最新 50 筆）、`recentCrops`（最近的在前、最多 5 個）。焦點用陣列不用物件，因為像數字的 key 會打亂物件的順序。上次畫面的 `location.key` 也存起來，F13 重開後歷史的 key 是新的，靠 `selectLastFocusId` 找回那個畫面的焦點。
  - 最近看過的作物只存一份（草圖是每個國家一份），換國家時由 `chooseCountry` 清空。
- 理由：欄位一次定好，後面的任務只加動作、不改存放格式；store 只存使用者的選擇，伺服器資料留給 TanStack Query。
- 影響：`frontend/src/store/settings.ts`、`session.ts`。T20 在焦點移動時呼叫 `rememberFocus`；T21 每次導覽呼叫 `rememberLocation`，而且只在 `setupDone` 時才還原 `lastLocation`；T22 的 demo 標頭讀 `settings.demo`。

## 2026-09-19 T18 localStorage 壞掉時的處理
- 情況：04 §4.5 規定解析失敗或版本不符時執行遷移函式、失敗就重設；沒寫版本相同但內容不對、少了欄位、版本比 App 新時怎麼辦。zustand persist 遇到 JSON 解析錯誤或遷移函式丟出例外時會停在初始狀態，`hasHydrated()` 一直是 false，壞資料也留在 localStorage。
- 決定：
  - `store/migrate.ts` 的 storage：讀不到或 JSON 解析失敗都當成沒存過；寫入失敗（空間滿、被封鎖）時繼續用記憶體裡的狀態。
  - 每次載入都用各欄位的 reader 檢查：有欄位型別不對，或跨欄位規則不成立（`setupDone` 卻沒有國家或地區），就整份重設成預設值，也就是回到首次設定；只是少了欄位，那個欄位用預設值；清單去掉重複並截到上限。
  - 版本不同時照 `steps[n]`（第 n 版 → 第 n+1 版）一步一步遷移；少了步驟、步驟丟出例外、版本比 App 新、遷移完仍不合格，都重設，並把預設值寫回 localStorage。
  - 兩個 store 目前都是版本 1，還沒有遷移步驟；遷移流程在 `migrate.test.ts` 用假的步驟測試。之後改存放格式時，版本加 1 並在 `steps` 加一步。
- 理由：同一套規則處理所有壞資料，App 不會卡住；少欄位不重設，萬一忘了加版本，使用者也不會被送回首次設定。
- 影響：`frontend/src/store/migrate.ts`；各 store 的 `readers`、`check`、`steps`。

## 2026-09-19 T18 語言設定與 i18next 同步
- 情況：T17 決定 store 存語言 id，並在還原與變更時呼叫 `setLanguage(id)`，但沒寫由誰呼叫、還沒選語言時怎麼辦。
- 決定：`store/settings.ts` 載入時套用一次，之後訂閱 `language` 的變化（包括重新 rehydrate）；`null`（還沒選，或資料被重設）時用手機語言，和 i18n 初始化相同。
- 理由：只要載入 store 就生效，不必在 `main.tsx` 另外接線；副作用不放進 `lib/`。
- 影響：`frontend/src/store/settings.ts`。
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

## 2026-09-19 T11 管線與 worker 的細節
- 情況：06 §8 只寫 mock「啟動時一次、每天 00:05（當地）」，但 mock 同時涵蓋兩個時區；04 §7 沒寫零售列的市場數、同市場多筆時的交易量怎麼算。
- 決定：
  - 每次執行都同步 seed 並跑全部已啟用的 provider，各國用自己的「今天」；排程是兩個 job，分別在印度與台灣當地 00:05 執行（結果相同，只是讓兩國都在自己換日後更新）。
  - 彙整只重算這次受影響的日期：先刪掉該國那些日期的 `market_daily`、`area_daily`，再從 `quotes` 重算，所以重跑結果相同。同市場同天多筆時，價格取中位數、交易量取總和；零售列的 `n_markets` 記 0。
  - `quotes` 用 COPY 寫進暫存表，再一次 `INSERT … ON CONFLICT` 合併（2.6 萬列從約 6 秒降到 0.6 秒）。
  - `rows_in = rows_ok + rows_dropped`；重複列也算進 `rows_dropped`，並在 `drop_reasons` 記為 `duplicate`。
  - 抓取失敗時整批 rollback（舊資料不動），`ingest_runs` 記 `failed` 與錯誤訊息；`/api/v1/health` 列出各來源最近一次成功的時間。
  - `PROVIDERS` 裡還沒實作的來源（`tw_moa`、`in_datagov`）只記警告並略過。
  - worker 等 api healthy（已經 migrate）才啟動；`make seed` 用 `docker compose run --rm worker python -m app.worker --once`。
- 理由：一條管線、重跑結果相同、失敗不影響舊資料。
- 影響：`backend/app/ingest/pipeline.py`、`backend/app/repositories/ingest.py`、`backend/app/worker.py`、`compose.yaml`、`Makefile`。

## 2026-09-19 T12 指標的計算區間與樣本數
- 情況：06 §3.4 沒寫「最近 7 天」「30 日」是以最新交易日還是今天為終點，也沒寫樣本多少才算足夠；到貨量在有市場漏報時會被低估。
- 決定：
  - 所有區間都以後端算的「今天」為終點（今天往回 7 或 30 個日曆日），和走勢圖一致；舊資料的地區在區間內資料少時，指標自然變成空值。
  - 比 7 日均價、30 日位置、波動至少要 2 天有資料，否則為空值（畫面顯示「—」）。
  - 到貨量用「每個有報價市場的平均交易量」計算比值，避免某市場漏報時看起來像到貨減少。
  - 漲跌比率先四捨五入到 12 位小數再和 0.05% 比較，避免浮點誤差把剛好 0.05% 判成持平。
  - 比價名次用競賽排名（1、2、2、4），價格先四捨五入到 4 位小數（資料庫精度）再比；有報價但是舊資料的地區仍然排名，只標示新舊。
- 理由：畫面上的數字和走勢圖對得起來；資料不足就顯示「—」，不補值。
- 影響：`backend/app/services/stats.py`、`freshness.py`、`compare.py`。

## 2026-09-19 T14 價格 API 的細節
- 情況：04 §6 列了端點與 quote 範例，但沒寫 `/prices` 裡不存在的作物怎麼辦、「本地區 N 個市場」的 N 是哪個數、到貨量與波動要不要附數值、資料時間用哪個時區。
- 決定：
  - `/prices` 的 `crops` 裡不存在的作物直接略過（首頁不會因為關注清單裡有一個舊作物就整頁 404）；地區不存在仍回 404 `area_not_found`。單一作物的端點遇到不存在的作物回 404 `crop_not_found`，市場回 `market_not_found`，國家回 `country_not_found`。
  - quote 的 `markets` 同時給 `count`（最新交易日有報價的市場數，用在「{n} 個市場中位數」）與 `total`（地區全部市場數，用在「本地區 {N} 個市場」卡片），`min_per_kg`／`max_per_kg` 只算最新交易日有報價的市場。
  - `stats` 除了文件範例的欄位，另外給 `volatility_pct`、`arrivals_ratio`、`high30_per_kg`、`low30_per_kg`、`change7_pct`、`change30_pct`，給走勢頁與「▲18%」用。
  - `fetched_at` 換成該國的時區偏移（例：`+05:30`），前端直接顯示字串裡的時間。
  - 比價列預設依價格高到低、沒有資料的排最後、同價依距離；名次由後端算，不受前端排序影響。
  - 各市場列表的每個市場用它自己 30 天內最新的價格（附新舊），差額是和地區中位數比。
  - 零售沒有 `markets` 端點；quote 在零售時 `markets` 為 null、`arrivals` 為 null。
  - 所有價格端點加 `Cache-Control: public, max-age=60`；demo 模式另外加 `Vary: X-Demo-Fail, X-Demo-Stale`。服務層留一個 `Demo` 參數（地區往前推 N 天），T15 接上標頭。
  - pytest 的 coverage 設定 `concurrency = ["greenlet", "thread"]`：SQLAlchemy async 用 greenlet 切換，不設定的話 `await` 之後的程式會被當成沒執行。
- 理由：前端需要的數值都由後端算好；缺的資料一律回 null 與原因。
- 影響：`backend/app/services/prices.py`、`backend/app/schemas/prices.py`、`backend/app/api/v1/prices.py`、`backend/pyproject.toml`。

## 2026-09-19 T15 位置推測與 demo 標頭的細節
- 情況：04 §3、§6.2 定了標頭與 300 km 門檻，但沒寫「公開 IP」的範圍、demo 標頭的格式細節與作用範圍、`/locate` 的快取。
- 決定：
  - 「公開 IP」＝Python `ipaddress` 的 `is_global`：私有網段、迴路、鏈結本地、電信級 NAT（100.64.0.0/10）、文件用網段都略過，從最左邊找第一個公開位址；可以處理 IPv6、`[IPv6]:port`、`IPv4:port`。
  - `/locate` 只回 `country`、`area_id`（名稱由前端從地區清單取），並加 `Cache-Control: private, no-store`，因為答案因人而異。IP 不存、不寫日誌。
  - 查詢介面 `GeoLookup` 可替換；預設讀 mmdb（DB-IP Lite City，`make geoip` 下載，compose 把 `infra/geoip/` 唯讀掛進 api），檔案不存在就用永遠推測不到的 `NullLookup`。DB-IP Lite 的授權是 CC BY 4.0，若在正式環境使用，「關於與資料說明」要加註「IP Geolocation by DB-IP」。
  - demo 標頭只在 `DEMO_MODE=true` 時解析：`X-Demo-Fail: 1` 只讓價格類端點回 503 `demo_failure`（目錄、健康檢查、`/locate` 不受影響）；`X-Demo-Stale: 地區:天數`（可用逗號放多個，天數 1–60，格式錯的忽略），同時影響價格端點與地區清單的新舊；`X-Demo-IP` 取代轉發位址；`X-Demo-Locate: IN:nashik` 或 `none` 直接指定結果（地區必須存在，否則視為推測不到）。
- 理由：照文件的規則，細節選最簡單而且能在 demo 時重現每種狀態的做法。
- 影響：`backend/app/services/locate.py`、`backend/app/services/demo.py`、`backend/app/deps.py`、`infra/geoip/README.md`、`scripts/fetch-geoip.sh`。

## 2026-09-19 T19 按鍵範圍的層級與順序
- 情況：04 §4.2 只寫「分派給堆疊最上層、面板打開時不穿透」，沒寫上下順序怎麼決定。React 先執行子元件的 effect，畫在畫面裡的面板會比畫面早註冊，只看註冊順序的話面板會被壓在下面。也沒寫最上層沒有某個鍵的 handler 時要不要往下傳。
- 決定：
  - `useKeys(handlers, { layer })` 分兩層：`screen`（預設，畫面）與 `overlay`（面板：選單、換地區、排序）。`overlay` 永遠在 `screen` 之上；同一層裡最新註冊的在上面。
  - 只有最上面的範圍收到按鍵；它沒寫的鍵直接丟掉，不往下傳。所以一個畫面、一個面板各只呼叫一次 `useKeys`，焦點 hook 提供的 handler 合併進同一個物件。
  - handler 存在 ref 裡，每次按鍵都讀最新的；只在掛載與 `layer` 改變時註冊，重新 render 不會改變順序。註冊用 `useLayoutEffect`，畫面 commit 後、下一個按鍵進來前，堆疊就已經更新。
  - `window` 上唯一的 `keydown` 監聽器在有範圍時自動掛上，最後一個範圍移除時拿掉，不需要另外呼叫安裝函式。除錯頁 `/debug/keys` 不註冊範圍，看到的仍是原始事件。
- 理由：用層級決定順序，不受 effect 執行順序影響；不往下傳最符合「面板打開時按鍵不會穿透」。
- 影響：`frontend/src/keys/keyScope.ts`、`useKeys.ts`；`frontend/eslint.config.js` 另外擋下 `keys/` import `screens/`。要加新的層（例如 B8 語音播報要蓋在面板上）就在 `keyScope.ts` 的 `LAYERS` 加一個名稱。

## 2026-09-19 T19 preventDefault 與不處理的按鍵
- 情況：04 §4.2 寫「按鍵處理完都要 preventDefault」「Enter 只在 keydown 處理」，沒寫沒處理的鍵、被忽略的長按、組合鍵與輸入法怎麼辦。
- 決定：
  - 最上層範圍有對應 handler 的鍵才 `preventDefault()`，長按時被忽略的重複事件也算；沒有 handler 的鍵不動，保留瀏覽器的預設行為。
  - `Enter` 不論有沒有 handler、是不是長按，一律 `preventDefault()`，焦點在按鈕上時不會再觸發 `click`（08 §12「統一只處理 keydown」）。
  - 帶 Ctrl、Meta、Alt 的組合鍵與輸入法組字中（`isComposing`）的事件完全不處理。Shift 照常處理，因為桌機要按 Shift 才打得出 `#`、`*`。
  - 不另外排除輸入框（baseline 不需要打字，08 §4【決定】）；長按不節流，等 08 §12 實機確認 repeat 速度再調。
- 理由：只攔自己處理的鍵，其他交給瀏覽器；OK 只走 keydown 一條路，不會觸發兩次。
- 影響：`frontend/src/keys/keyScope.ts` 的 `onKeyDown`。

## 2026-09-19 T20 焦點 hook 的介面與接法
- 情況：04 §4.4 只寫 `useFocusList(ids)`、`useGrid(ids, cols)` 要處理哪些鍵，沒寫 hook 怎麼找到項目與要捲動的容器、怎麼接上 T19「一層只呼叫一次 `useKeys`」、OK 與數字鍵要做什麼、面板打開時畫面的清單怎麼辦。
- 決定：
  - `useFocusList(ids, { root, onActivate, digitOffset, active })`；`useGrid(ids, cols, { 同上, onLeftEdge })`。兩者都回傳 `{ focusedId, keys, focus }`。畫面先放 `keys`，再加自己的鍵：`useKeys({ ...list.keys, onHash, onStar, onMenu })`；面板相同，只是改成 `useKeys(..., { layer: 'overlay' })`。
  - `root` 由畫面用 `useRef` 建立，放在包住項目的元素上；沒有項目的頁面放在內容上。項目要有 `data-focus-id` 與 `tabIndex={-1}`，只在 `root` 裡面找。要捲動的是 `root` 本身，或最近一個 `overflow-y: auto｜scroll` 的祖先（Shell 的內容區）。
  - hook 不回傳 ref：React Compiler 的 lint（`react-hooks/refs`）看到回傳物件的某個屬性被放進 JSX 的 `ref`，會把整個物件當成 ref，之後讀 `list.keys`、`list.focusedId` 都會報錯。
  - OK 與數字鍵都呼叫 `onActivate(id)`。數字 N 對應 `ids[N - 1 + digitOffset]`，超出清單就不動作。首頁連線失敗的警示卡沒有數字鍵帽，所以傳 `digitOffset: 1`（草圖的 `v.off`）。數字鍵會先把焦點移到該項再執行，所以返回時焦點在剛打開的項目上。`0` 不處理；畫面要用 `0`（B8 語音）時自己包一層 `onDigit`。
  - 沒有項目時，`keys` 只有 ↑ ↓，一次捲動 60% 高度；不提供 `onEnter`、`onDigit`，由畫面自己加（例如走勢頁按 OK 換分頁）。
  - `active: false` 表示上面蓋著面板：不移動 DOM 焦點、不寫 store、不理會歷史變化。變回 true 時，焦點回到原本的項目。畫面依網址的 `?sheet=` 算出（`active: !sheet`）；面板自己的清單用預設值 true。
  - 每次 commit 後都重新套用焦點（真正的 DOM focus，並捲到可見範圍），項目重新 render 或內容位移時焦點不會掉。
- 理由：畫面只需要一個 ref、一次 `useKeys`，lint 不會誤報；面板用明確的 `active` 判斷，和網址在同一次 render 生效，不會搶走面板的焦點。
- 影響：`frontend/src/focus/useFocusList.ts`、`useGrid.ts`、`dom.ts`。之後的畫面照上面的方式接；B7 支援滑鼠點擊時用回傳的 `focus(id)`。

## 2026-09-19 T20 捲動與九宮格邊界的細節
- 情況：03 §5 寫「移出可見範圍時立即捲動並留 6px 邊距；第一項放得下時捲到最上面」「返回時依 ID 還原焦點與捲動位置」，沒寫怎麼量位置、捲動位置要不要另外存。02 §4 寫「九宮格一次跳一列」，沒寫在最上列、最下列按 ↑ ↓ 時怎麼辦；草圖把目標夾在 0–8 之間，會斜著跳到角落。
- 決定：
  - 焦點項目和可見範圍上下緣的距離小於 6px 就捲動，捲到剛好留 6px。判斷和捲動都用 6px（草圖用 4px 判斷、捲到 6px）。位置用 `getBoundingClientRect` 相對於捲動容器計算，中間隔幾層元素都正確。第一項放得下時，優先捲到最上面。
  - 直接設定 `scrollTop`，不用 `scrollIntoView`，也不用平滑捲動。沒有項目時，一次捲 `round(可見高度 × 0.6)`。
  - 捲動位置不另外存：返回時依 ID 還原焦點，再用同一條規則捲到可見範圍，和草圖的做法相同。
  - 九宮格：↑ ↓ 的目標格不存在（在最上列、最下列，或最後一列比較短）時停在原地；◀ ▶ 只在同一列裡移動，最左欄再按 ◀ 呼叫 `onLeftEdge`，最右欄或右邊沒有格子時停在原地。
- 理由：只用一個數字，最好理解也最好測；夾在範圍內會斜著跳，不符合「一次跳一列」。
- 影響：`frontend/src/focus/dom.ts`（`SCROLL_MARGIN`、`PAGE_SCROLL`）、`useGrid.ts`。

## 2026-09-19 T20 焦點的記憶與還原時機
- 情況：04 §4.4 寫「每一筆歷史記住焦點 ID，返回時依 ID 還原，ID 不存在時落在第一項」，沒寫資料還沒載入、清單在畫面上改變、同一個畫面換到另一筆歷史時怎麼辦，也沒寫什麼時候寫進 store。
- 決定：
  - 以 `location.key` 為準。同一個畫面元件沒有卸載、但換到另一筆歷史時（同一路由 push、分頁 replace、面板關閉），依那一筆記住的 ID 還原；沒有紀錄就是新畫面，從第一項開始。
  - 清單在畫面上改變時（資料載入、批發⇄零售）：焦點項目還在，就留在它身上；不見了，就移到原本位置上的項目（清單變短時是最後一項）。清單變空時沒有焦點，等項目回來再依記住的 ID 還原，所以返回時資料還在載入也能還原。
  - 焦點一改變就寫進 session store：按鍵造成的移動在按鍵當下寫，因為打開項目後可能馬上離開畫面；還原與清單變動造成的改變在 effect 裡寫。`active` 是 false 時不寫。
  - F13 重開後歷史的 key 是新的，而焦點 hook 只查目前的 key。T21 還原上次的畫面時，要在畫面第一次 render 前用 `rememberFocus(新的 key, selectLastFocusId(...))` 把焦點帶過去，否則會從第一項開始。
- 理由：store 裡的焦點一直是最新的，不必等離開時才存（08 §7）；依 ID 而不是索引，資料順序改變也不會落在錯的項目。
- 影響：`frontend/src/focus/restore.ts`（`restoreFocus`、`followList`、`useRestoredFocus`）；T21 的重開流程。

## 2026-09-19 T20 前端覆蓋率門檻
- 情況：baseline T20 要求 `src/lib`、`src/keys`、`src/focus`、`src/store` 合計 ≥ 90%，沒寫看哪幾項指標。
- 決定：在 `frontend/vite.config.ts` 的 `coverage.thresholds` 用一個 glob `src/{lib,keys,focus,store}/**`，四個資料夾合計的 statements、branches、functions、lines 都要 ≥ 90%，不逐檔檢查。低於門檻時 `npm run coverage` 失敗；`make test` 與 CI 的前端 job 都跑這個指令。已確認暫時把門檻調到 100% 時確實會失敗。
- 理由：四項都看，最不容易漏；照計畫寫的「合計」，和後端（services＋ingest 合計）一致。
- 影響：`frontend/vite.config.ts`。之後有新的核心資料夾就加進 glob。
## 2026-09-19 T21 路由表與歷史的做法
- 情況：04 §4.3 定了路徑與「面板 push、分頁 replace、啟動時先換成首頁再 push」，但沒寫面板中的項目開啟另一個畫面、已經有面板時再開面板、從網址直接進入面板時要怎麼處理，也沒寫路由表怎麼讓各畫面平行開發。
- 決定：
  - 路由表由 `buildRoutes(screens)` 產生，每個畫面一個檔案（`src/screens/<畫面>/<名稱>Screen.tsx`），先放佔位元件；畫面任務只改自己的檔案。路由測試傳入替身元件，真的畫面換上來也不會壞。
  - 畫面一律用 `useNav()`：`open`（push）、`back`、`switchTab`（replace）、`openSheet`（push；已經有面板時改成 replace，不疊兩層）、`closeSheet`（back；如果面板是這一頁的第一筆歷史，就改成拿掉參數）、`leaveSheet`（面板裡的項目開啟其他畫面時，用 replace 取代面板那一筆，返回時回到原畫面而不是面板）。
  - 啟動還原（F13）只在「從首頁網址開啟 App」時做：歷史換成首頁、再 push 上次的畫面，並把上次的焦點帶到新的歷史 key；上次是首頁時直接開首頁（例如「全部作物」分頁）。其他網址（重新整理、直接連結）照原樣開。`?sheet=`、首次設定、除錯頁都不還原。
  - 首次設定沒完成時，除了 `/setup/*` 與 `/debug/*`，所有路徑都導向 `/setup/lang`；作物詳情的分頁不是 trend／today／compare 時導向 today；其他未知路徑導回首頁。
  - `RouterProvider` 從 `react-router` 匯入，不用 `react-router/dom`：測試環境會把兩者載入成兩份，context 對不上。
- 理由：讓右軟鍵的 `history.back()` 在任何情況下都照「關面板 → 上一頁 → 首頁離開」運作。
- 影響：`frontend/src/app/`（`paths.ts`、`navigation.ts`、`routes.ts`、`RootLayout.tsx`、`DetailTabGuard.tsx`、`router.ts`）、`frontend/src/screens/*` 的佔位元件。

## 2026-09-19 排程改成多線平行（使用者同意）
- 情況：baseline.md 的「平行開發」規定一次只派一個子 agent、前端線依序做；使用者在 21:20 左右要求加速，並同意偏離原排程。
- 決定：前端基礎改成 T20、T23（子 agent，各自的 worktree）與 T21（主 session）同時做；同步點 1 分兩段（先合併 T16–T21，T23／T24 完成後再合併並跑 `make e2e`）；畫面階段由多個子 agent 各用一個 worktree 同時做，主 session 先做共用的畫面工具與首頁當範本，再負責合併。品質關卡不變（lint、型別、測試、覆蓋率門檻、大段落 Playwright）；畫面測試只寫計畫要求的核心情境。
- 理由：縮短等待時間，品質底線不變。
- 影響：只影響執行順序，不影響規格。

## 2026-09-19 T22 API client 與 query 的細節
- 情況：04 §4.5 規定 10 秒逾時、重試 1 次、保留舊資料，但沒寫逾時要不要重試（重試會讓錯誤畫面晚 20 秒才出現）、msw 的 fixtures 怎麼產生才能一直跟 API 對得上。
- 決定：
  - `apiGet` 用 `AbortController` 做 10 秒逾時；錯誤一律轉成 `ApiError(code, status, requestId)`，`code` 取自 API 的錯誤本文，沒有本文時依 HTTP 狀態推（400 → `invalid_param`、404 → `not_found`、500 → `internal`、503 → `upstream_unavailable`），另外有前端自己的 `timeout`、`network`、`aborted`。`errorKind()` 把錯誤分成 `not_found`（回到選擇畫面）、`bad_request`（回首頁）、`unavailable`（連線失敗、保留舊資料）。
  - 只重試一次連線問題（網路錯誤、5xx）；逾時與 4xx 不重試，確保「超過 10 秒會顯示錯誤」成立。
  - TanStack Query：`staleTime` 5 分鐘、`placeholderData: keepPreviousData`、不因視窗焦點或重新連線而重抓、不輪詢；目錄類（國家、作物）的 `staleTime` 1 小時。選單「重新整理」與「重試」用 `useRefresh()` 重抓畫面上的資料。
  - msw fixtures 由後端實際回應存下來（`make fixtures`：測試資料庫、固定時鐘、mock 資料，重跑結果相同）；handlers 找不到完全對應的 fixture 時，退回該國的預設地區或代表作物並換掉 id，讓畫面測試可以用任何作物與地區。
  - demo 建置才把設定裡的 demo 開關轉成標頭（`X-Demo-Fail`、`X-Demo-Stale: <我的地區>:3`、`X-Demo-Locate`）；正式建置不帶。
  - 漲跌顏色由 `CountryTheme` 依國家的 `up_is_pos` 設在 `<html data-up>`。
  - `StalenessOut.state` 改成 Literal，產生的前端型別變成 `'today' | 'closed' | 'stale' | 'none'`。
- 理由：錯誤處理集中在 client；fixtures 與 API 同源，契約改了重跑一次即可。
- 影響：`frontend/src/api/`、`frontend/src/app/{providers,CountryTheme,demoHeaders}.tsx`、`frontend/src/test/msw/`、`frontend/src/test/fixtures/`、`backend/tests/dump_api_fixtures.py`、`scripts/save-api-fixtures.sh`。
## 2026-09-19 T23 漲跌顏色改由 React context 決定
- 情況：03 §3.1 規定漲跌顏色依國家（`upIsPos`），沒寫怎麼實作。T03 的 tokens.css 用祖先元素的 `data-up` 屬性切換 `--up`／`--dn`，這樣元件的 class 只看方向，單元測試無法驗證「印度漲是綠、台灣漲是紅」：jsdom 不代入 `var()`，Vitest 也不載入 CSS 內容（`?raw`、`?inline` 都是空字串）。
- 決定：`components/rise.ts` 提供 `UpIsPosContext`（預設 `true`＝印度）、`riseColor(direction, upIsPos)` 與 `useRiseColor(direction)`；Pill、Sparkline、MetricGrid 依方向與國家選 `pos`（綠）、`neg`（紅）、`flat`（灰）class，直接用 `--pos`／`--neg`／`--flat`。刪除 tokens.css 的 `--up`／`--dn` 與 `[data-up='neg']`，不留兩套機制。
- 理由：顏色只在一個地方決定，而且測試能直接驗證；▲▼＝ 符號不受國家影響。
- 影響：`frontend/src/components/rise.ts`、`Pill`、`Sparkline`、`MetricGrid`、`styles/tokens.css`、`lib/change.ts` 的註解。T21／T22 要在 App 根部加 `<UpIsPosContext value={country.up_is_pos}>`，沒加就一律是印度的顏色；畫面自己的 CSS 需要漲跌色時，用 `useRiseColor(direction)` 取得 class。

## 2026-09-19 T23 元件字級提高到下限
- 情況：草圖的指標標題 10px、走勢圖刻度 9px、今日價格標籤 10px、分頁兩側的 ◀ ▶ 9px，都低於 240×320 的 11px 下限；tokens 的 `--fs-3` 在 128×160 是 10px，中文的「舊」「你」「批發」會低於中文 11px 的下限。
- 決定：以上都改用 `--fs-3`（240×320 是 11px）；128×160 的中文把 `--fs-3` 也提高到 11px（原本只有 `--fs-2`）。鍵帽維持 9px（03 §3.2 的例外），一律畫成 `<kbd>`，T24 的字級檢查略過 `kbd` 即可。
- 理由：CLAUDE.md 的字級下限。放不下的標題用省略號（例如英文「vs 7-day avg」），不縮字。
- 影響：`TrendChart`、`MetricGrid`、`Tabs`、`KeyCap` 的 CSS 與 `styles/tokens.css`。指標標題被截斷時，T27 可以改短英文字串。

## 2026-09-19 T23 元件的介面與 128×160 的做法
- 情況：03 §4、§6 列了元件與縮減規則，沒寫元件的介面、兩種尺寸怎麼切換，也有幾個草圖沒處理的情況。
- 決定：
  - 元件只負責顯示：文字與數字由畫面格式化後傳入（`TrendChart` 收 `formatValue`）；可選的項目（Card、九宮格的格子、面板的列）收 `focusId`，畫出 `data-focus-id` 與 `tabIndex={-1}`，焦點樣式只看 `:focus`。
  - 兩種尺寸都用 CSS 切換，不在 JS 判斷：`TrendChart` 同時畫 216×112 與 114×58 兩張 SVG，由 media query 顯示其中一張。128×160 不畫資訊列右格、鍵帽（九宮格與面板的數字鍵帽除外）、分頁箭頭、說明列、迷你走勢、指標格，以及狀態框的圖示與說明。
  - Card：`price={null}` 顯示「—」並變灰，同時拿掉迷你走勢與漲跌，原因由畫面放在 `meta`；128×160 是單行，漲跌只留符號。比價與市場清單在 128×160 也照 03 §6 顯示價格加符號（草圖只顯示差額）。「舊」「你」在 128×160 仍保留文字，因為不是今天的資料一定要標示（草圖在 128×160 拿掉了「舊」）。
  - StatusBox 分成 `lines`（兩種尺寸都顯示）與 `details`（只在 240×320）；面板在 128×160 用勾選圖示取代草圖的「 ✓」文字。
  - TrendChart：7 點以內每天都標 X 軸（沒有價格的日子標 `closedLabel`）並畫點，否則只標第 0、7、14、21 與最後一天；今天沒有價格時，最後一個有價格的點加粗並標數字；參考值較長時加寬右側留白；價格完全沒變時只畫一條參考線。迷你走勢照草圖，跳過沒有價格的日子。
  - 分類色用 `data-tone`（tokens.css 設定 `--tn`、`--tc`）；分類的順序（鍵盤 1–9）、色調與代表圖示在 `components/categories.ts`。Shell 把 `overlay` 放進一個蓋住 header 與內容、不蓋軟鍵列的圖層，面板填滿該圖層。
- 理由：畫面只要傳資料，元件不需要知道國家、語言或螢幕尺寸；兩種尺寸的差異集中在 CSS。
- 影響：`frontend/src/components/`、`frontend/src/icons/`、`frontend/src/styles/tokens.css`。

## 2026-09-19 T23 元件展示頁
- 情況：T23 要做 `/debug/components` 給 T24 檢查；T06 決定除錯頁只用英文、不走 i18n。
- 決定：區塊標題照 T06 用英文；元件裡的文字走 i18n、依目前語言顯示，才能檢查中文的字級與長度。進入時焦點在第一張卡片，↑ ↓ 在所有可選項目之間移動，方便看焦點樣式；面板畫在頁內固定高度的框裡，不蓋住整頁。
- 理由：同一頁就能在兩種語言、兩種尺寸下檢查所有元件。
- 影響：`frontend/src/screens/debug/DebugComponents.tsx`、`frontend/src/app/debugRoutes.tsx`。T24 檢查這一頁的字級時只略過 `kbd`。

## 2026-09-19 T24 Playwright 檢查的做法
- 情況：07 §4 列了檢查項目與「只輸出 JSON 摘要、失敗才截圖」，但沒寫 `make e2e` 怎麼起服務、哪些文字不算字級下限、狀態怎麼準備。
- 決定：
  - `make e2e` 用 `VITE_DEMO=true DEMO_MODE=true docker compose up -d --build --wait` 起完整服務（跑完後服務維持 demo 模式），再跑 Playwright；兩個 project：240×320 與 128×160。
  - 自訂報告器只印一份 JSON（通過數、失敗項目與數值、截圖路徑）；`screenshot: only-on-failure`，截圖在 `frontend/e2e/artifacts/`（不進 Git）。
  - 檢查：頁面不水平溢出；`header`、`footer` 與標了 `data-fixed` 的區塊不溢出（有省略號的文字除外）；有 `data-focus-id` 的畫面焦點必須在這種元素上而且完整在內容區內；可見文字的字級 ≥ 11px（128×160：≥ 10px，中文 11px），`<kbd>` 鍵帽（9px）是唯一例外；沒有 console error 與未處理的例外。
  - 用 `addInitScript` 在 App 載入前寫入 store 的儲存格式，直接開啟任何畫面、國家、語言與價格類型；除錯頁 `/debug/viewport` 故意有 10px 樣本，不列入檢查。
  - CI 另有 `.github/workflows/e2e.yml`：手動觸發或 push 到 `main` 時跑 `make e2e`，失敗時上傳截圖。
- 理由：一個指令跑完、輸出精簡；之後 T34、T39 的全部畫面檢查沿用同一套。
- 影響：`frontend/playwright.config.ts`、`frontend/e2e/`、`frontend/tsconfig.e2e.json`、`Makefile`、`.github/workflows/e2e.yml`。

## 2026-09-19 T31 換地區面板與地區清單的細節
- 情況：02 §5.6 與草圖沒寫：面板打開時畫面的軟鍵標籤由誰給；`for=view` 沒有 `back` 時選完要回哪裡；距離從哪裡算；「更改國家…」落在前 9 列時要不要鍵帽；狀態點用哪個門檻；清單載入中與失敗的樣子；清單的左軟鍵。
- 決定：
  - `screens/shared/AreaSheet.tsx` 匯出 `sheetSoftKeys(t)`（空／選取／關閉），畫面在 `nav.sheet` 有值時改用它；面板開著時左軟鍵（Escape）也關閉面板（同草圖）。
  - `for=view` 沒有 `back`（或不是站內路徑）時，目前地區當成我的地區；選了只記進最近使用，然後返回上一頁。
  - 距離一律從「我的地區」算（`for=view` 也一樣）；距離是 0 的列只寫所屬區域。
  - 前 9 列都畫數字鍵帽，包括「更改國家…」（地區少於 9 個時），數字鍵只作用在有鍵帽的列。
  - 狀態顏色照 `describeFreshness`：`warn`（3 天以上）琥珀色、無資料灰色、其他（今天、昨天、休市）綠色；草圖把 2 天前也標成琥珀色，這裡以程式的門檻為準。
  - 載入中：4 張靜態骨架卡片，中間軟鍵空白。沒有資料又失敗：「連線失敗／你的設定都還在」加一張「重試」卡片，中間軟鍵「重試」。
  - 地區清單左軟鍵空白，不開選單（草圖標籤也是空白）。
- 理由：照草圖與現有元件，選最簡單、不會走進死路的做法。
- 影響：`frontend/src/screens/shared/AreaSheet.tsx`、`frontend/src/screens/areas/`。
## 2026-09-19 T25 首頁與作物清單的載入、錯誤與空清單
- 情況：02 §5.2、§6 只寫了各狀態要顯示什麼；草圖把載入文字放在骨架卡片下面（兩種尺寸都會被擠出畫面），也沒有「關注清單是空的」「沒有舊資料的連線失敗」的首頁畫面。
- 決定：
  - 載入中：「正在取得 {地區} 的行情…」「超過 10 秒會顯示錯誤」放在骨架卡片上方；骨架最多 4 張、不可選、不畫數字鍵帽（載入中數字鍵沒有作用），中間軟鍵留空。
  - 換批發／零售、換地區、改關注清單時，新資料到之前顯示骨架，不沿用上一個查詢的資料（`keepPreviousData` 的 placeholder），避免零售標籤配上批發價格；日期仍沿用上一筆回應的 `today`。
  - 沒有舊資料的連線失敗：沿用草圖詳情頁的錯誤畫面，狀態框「連線失敗」「你的設定都還在」加一張「重試」卡片，中間軟鍵「重試」。有舊資料時照 02 §6 在最上方放警示卡，作物卡改標「舊」且不再加註「昨天」等，數字鍵仍對應卡片上的鍵帽。
  - 關注清單是空的：只顯示一張「瀏覽作物」卡片，OK 切到「全部作物」分頁。
- 理由：狀態文字在兩種尺寸都看得到；畫面上的價格、標籤、單位永遠來自同一個查詢；每個狀態都有出口。
- 影響：`frontend/src/screens/home/`（`useAreaPrices.ts`、`CropCards.tsx`、`cropList.ts`、`HomeScreen.tsx`）。

## 2026-09-19 T26 作物清單的資料與狀態
- 情況：02 §5.3 只寫「和首頁相同的作物卡片」；沒寫價格怎麼抓、連線失敗怎麼顯示、未知分類怎麼辦。
- 決定：所有作物清單共用一次不帶 `crops` 的 `/prices`（我的地區、目前的批發／零售），在前端依分類篩選；「全部」依作物目錄的順序，「最近」依 `recentCrops`（最新在前）。狀態與首頁「關注」相同（含連線失敗的警示卡與「舊」）；沒有作物時顯示「無資料」、中間軟鍵留空；網址裡不認得的分類導回首頁。
- 理由：瀏覽多個分類只需一次請求；卡片與狀態的程式和首頁共用一份。
- 影響：`frontend/src/screens/crop-list/CropListScreen.tsx`（重用 `frontend/src/screens/home/` 的卡片與 hook）。
## 2026-09-19 T33 面板開著時的軟鍵
- 情況：面板開著時軟鍵要顯示「空／選取／關閉」（草圖 `shell`），但面板改不到畫面自己的 Shell。
- 決定：`MenuSheet.tsx` 匯出 `useMenuSheetSoftKeys()`；畫面在 `nav.sheet` 有值時把它傳給 Shell 的 `softKeys`。選單開著時左軟鍵（Escape）也會關閉選單（同草圖）。react-refresh 規則不允許元件檔匯出 hook，這一行加註 `eslint-disable-next-line`。「換地區」照草圖把選單換成同一個畫面的 `?sheet=area`，所以放選單的畫面也要放 `AreaSheet`；`areaFor` 參數保留，但選單本身用不到。
- 理由：標籤和面板放在一起，畫面只要一行判斷。
- 影響：`frontend/src/screens/shared/MenuSheet.tsx`；首頁、作物清單、詳情、市場畫面接上選單時使用。

## 2026-09-19 T33 沒有鍵帽的清單不理會數字鍵
- 情況：02 §4 規定 1–9 開啟「標了該數字鍵帽的項目」；編輯關注（草圖沒有鍵帽）和 Demo 清單都沒有鍵帽，但 `useFocusList` 預設會把數字鍵對到第 N 項。
- 決定：這兩個清單的數字鍵不做事（`onDigit: undefined`）；設定和語言清單畫鍵帽 1–N，數字鍵直接執行該列。
- 理由：避免按數字鍵改到看不到編號的項目。
- 影響：`frontend/src/screens/watch/WatchScreen.tsx`、`frontend/src/screens/settings/DemoSettings.tsx`。

## 2026-09-19 T33 設定列在 128×160 的值
- 情況：草圖在 128×160 把設定列右側的值全部拿掉；但批發／零售單位是按 OK 原地切換，拿掉值就看不到切換的結果。
- 決定：128×160 只拿掉會打開另一個畫面的列（語言、國家、我的地區、Demo）的值；單位列和 Demo 開關保留值（膠囊變窄，名稱讓位、用省略號）。
- 理由：原地切換的列一定要看得到結果。
- 影響：`frontend/src/screens/settings/settings.module.css` 的 `.optional`。

## 2026-09-19 T33 設定的語言清單
- 情況：草圖的「語言」列是按 OK 在中英之間切換；T33 的規格改成打開清單，清單的順序與樣式沒寫。
- 決定：`/settings/language` 用和首次設定相同的三個語言與順序（手機語言在前並標「手機語言」；हिन्दी 標「→ English・尚未提供」），目前的語言打勾，鍵帽 1–3；選了就存並返回設定。焦點照規則從第一項開始。
- 理由：和首次設定一致，使用者看過同一份清單。
- 影響：`frontend/src/screens/settings/LanguageSettings.tsx`、`SettingsItemScreen.tsx`（其他 `/settings/:item` 導回設定；正式建置的 `demo` 也導回）。

## 2026-09-19 T33 Demo 開關的畫面
- 情況：06 §7.5、04 §6.2 只寫了三個開關與標頭；列的樣式、循環順序、切換後已快取的資料怎麼辦都沒寫。
- 決定：設定的「Demo」列（齒輪圖示）右側顯示「開」（任一開關開著）或「關」。`/settings/demo` 三列：模擬 API 失敗、模擬地區未更新（開／關，說明列寫出影響的地區與天數），模擬推測位置依「自動 → 印度 Nashik → 台灣 台北市 → 推測不到」循環。每次切換後把 TanStack Query 的快取全部標成過期（`invalidateQueries()`），之後每個畫面都用新的標頭重新取資料。
- 理由：展示時切完開關回到首頁就看得到效果，不必再按「重新整理」；設定列的「開」提醒展示者還有開關沒關。
- 影響：`frontend/src/screens/settings/DemoSettings.tsx`、`SettingsScreen.tsx`、`settings.demo.*` 字串。

## 2026-09-19 T33 關於頁的資料來源與 DB-IP 標示
- 情況：草圖寫「資料來源：{來源}」；T15 決定用 DB-IP Lite（CC BY 4.0），要標示「IP Geolocation by DB-IP」，位置沒寫。
- 決定：「資料來源」卡片第一行是粗體標籤，接著一行是國家的資料來源，再一行「IP Geolocation by DB-IP（CC BY 4.0）」；「本 App 不會向你要錢、密碼或驗證碼。」維持最後一張卡。
- 理由：兩者都是資料出處，放同一張卡；標籤自成一行就不用另外加標點字串。
- 影響：`frontend/src/screens/about/AboutScreen.tsx`、`about.ipCredit` 字串。
## 2026-09-19 T32 首次設定的歷史、推測位置與狀態
- 情況：02 §5.1 與草圖定了五個畫面與順序，沒寫設定畫面在歷史裡怎麼收掉、推測位置還沒回來時怎麼辦、其他語言的頁碼記在哪、清單載入中與失敗時顯示什麼。
- 決定：
  - 每個設定畫面是一筆歷史；網址的 `?depth=N` 記錄第一個設定畫面之上開了幾筆。選「是，就是這裡」或選完地區時用 `backAndReplace('/', N)` 退回第一筆再換成首頁，首頁底下不留設定畫面。每個設定畫面只前進一次：Cloud Phone 的按鍵可能一次到好幾個，下一個畫面出現前的第二個 OK 會多推一筆 depth 沒算到的歷史。
  - 語言畫面一出現就查 `/locate`。選完語言：推測到地區或還在查 →「確認位置」（還在查就先顯示靜態骨架）；沒推測到或查詢失敗 → 直接「選擇國家」。「確認位置」拿到空的推測、失敗或清單裡沒有的地區時，把自己這一筆換成「選擇國家」（depth 不變）；沒有國家就打開 `/setup/area` 也換成「選擇國家」。
  - 其他語言的頁碼放在網址 `?page=`（從 1 開始，第 1 頁不寫）；◀ ▶ 用取代歷史換頁（同分頁），返回時回到同一頁與同一個語言；128×160 不畫 ◀ ▶。
  - 確認位置、國家、地區的資料載入中顯示靜態骨架列；失敗時顯示「連線失敗」與一張「重試」卡（OK 或 1），中間軟鍵「重試」。
  - 「選擇國家」在設定完成後打開（「更改國家…」）時不畫步驟點，選了就換國家並返回。
  - 首次設定的地區清單：預設地區第一，其餘依與預設地區的直線距離；每列照草圖有邦或區域、距離，右側是資料狀態點與例外文字（`describeFreshness`），圖示方塊依新鮮度著色；128×160 只留名稱。步驟點在 128×160 也放得下，保留。語言列照草圖不畫數字鍵帽，但數字鍵照樣可選。
- 理由：設定完成後按返回不該回到設定；推測位置只是捷徑，查不到不能卡住使用者；載入與失敗的樣子和其他畫面一致。
- 影響：`frontend/src/screens/setup/`。設定頁若要換語言，另做清單，不要重用首次設定的語言畫面（它會接著走確認位置或國家）。
## 2026-09-19 T27 作物詳情（行情）的狀態與細節
- 情況：02 §5.4、§6 與草圖沒寫：休市時資料時間寫什麼、「通常 14:00 前更新」的時間從哪來、沒有資料（`no_data`）時大數字卡怎麼顯示、重新整理失敗但有舊資料時詳情頁怎麼標示、`*` 之後焦點怎麼回到第一項、作物或地區不存在（404）怎麼辦。
- 決定：
  - 資訊列右邊：今天的資料寫 `fetched_at`（「9/19 11:40」）；休市寫交易日期、不用警示色；舊資料的「昨天」「N 天前」一律用警示色（02 §5.4）；沒有資料不寫。
  - 今天沒更新（`staleness.state = stale`）才顯示「{地區} 今天還沒更新」；「通常 14:00 前更新」固定用草圖的 14:00（API 沒有各地區的更新時間）；「最近一筆」的價格加上單位；兩個出口卡片畫 1、2 鍵帽。
  - 沒有資料：大數字卡寫「—」與「無資料」，不顯示漲跌與三個指標；批發仍顯示「本地區 N 個市場」卡片。
  - 重新整理失敗但有舊資料：保留舊資料，最上方加一張警示卡「連線失敗・先顯示 HH:mm 的資料」，它是第一個可選項目，OK 重試（數字鍵從下一項算起）。完全沒有資料才顯示錯誤畫面與「重試」。
  - 載入中沒有可選項目，中間軟鍵空白、OK 不做事（草圖是「選單／空白／返回」）。換批發／零售或換地區時，TanStack Query 保留的上一筆資料如果是別的作物、地區或價格類型就不顯示，改顯示載入中；只有走勢天數不同時照常顯示。
  - `*` 切換後用 `switchTab` 把同一個網址換成新的歷史紀錄，焦點因此回到第一項（02 §4）。
  - API 回 404／400（作物或地區不存在）：直接換成首頁（04 §6.1）。
  - 打開詳情頁（作物存在時）就記進「最近看過」。
- 理由：照 docs 的原則（不是今天的資料一定要標示、不補值、每個錯誤畫面都有出口），其餘選最簡單的做法。
- 影響：`frontend/src/screens/crop-detail/`（`useDetail.ts`、`DetailFrame.tsx`、`TodayTab.tsx`、`states.tsx`）。之後 API 提供各地區更新時間時，改 `TodayTab.tsx` 的 `USUAL_UPDATE`。

## 2026-09-19 T28 走勢頁的細節
- 情況：沒寫區間內完全沒有價格時怎麼顯示、X 軸的日期格式、換分頁時天數要不要保留。
- 決定：選定區間內沒有任何價格就不畫圖，顯示「—」「無資料」，也不顯示三個指標；7 日的 X 軸是星期的第一個字（中文 1 字、英文 2 字），30 日是「月/日」（兩種語言都照草圖）；換分頁時保留 `?area=`、`?days=`、`?sort=`（草圖的天數與排序是全域狀態），所以回到走勢頁仍是剛才的天數。「波動」只算最近 7 天（06 §3.4），30 日也顯示同一個值。
- 理由：不補值、不畫空圖；參數留在網址裡，返回與重開都能還原。
- 影響：`TrendTab.tsx`、`useDetail.ts`（`tabUrl`）。

## 2026-09-19 T29 比價與排序面板的細節
- 情況：沒寫排序存在哪裡、同價與沒有資料的地區怎麼排、數字鍵對應哪一項、排序面板打開時焦點在哪、128×160 的比價列。
- 決定：
  - 排序放在網址 `?sort=`：`price_desc`（預設，不寫）、`price_asc`、`distance_asc`、`distance_desc`；選了之後用 `closeSheetAndReplace`，焦點回到第一項。排序面板打開時焦點在目前的排序（照草圖），左軟鍵也能關閉面板。
  - 前端排序：沒有資料的地區永遠在最後；同價保持 API 的順序（API 同價依距離）；依距離排序時，沒有資料的地區之間也依距離。
  - 卡片左邊的數字是 API 的價格名次（06 §4，和排序方式無關），沒有名次寫「—」；數字鍵 1–9 照清單位置開啟（和草圖相同）。
  - 說明列的新舊照 06 §3.5：「昨天」不用警示色、3 天以上用警示色、休市寫日期；零售不寫市場數。
  - 128×160：照 03 §6 與 T23 的決定，一行顯示名次、名稱、價格與差額符號（草圖只顯示差額）；地區名稱不加「縣」字尾，不顯示名次說明。
- 理由：名次和排序分開，使用者換排序也看得到價格名次；其餘照 docs 與草圖。
- 影響：`CompareTab.tsx`、`SortSheet.tsx`、`compareRows.ts`。
## 2026-09-19 T30 單一市場「看 {地區} 的零售價」怎麼返回
- 情況：02 §5.5 只寫零售時提供「看 {地區} 的零售價」；草圖是一路返回到詳情頁。瀏覽歷史看不到下面是哪些畫面，重開 App 後單一市場下面是首頁（04 §4.3），直接退兩步會把首頁那一筆換掉。
- 決定：`screens/markets/trail.ts` 依 `location.key` 記下每筆市場畫面的歷史下面還有幾筆屬於「詳情 → 各市場 → 單一市場」：各市場被 push（只有詳情會 push 它）記 1、換地區（replace）沿用原本那一筆、單一市場＝各市場＋1。出口呼叫 `nav.backAndReplace(詳情的行情頁?area=, 步數)`；重開或重新整理後不知道步數，就只取代自己那一筆。
- 理由：回到原本的詳情頁、不增加歷史，也不會在重開後把首頁換掉；只動自己的資料夾。
- 影響：`frontend/src/screens/markets/trail.ts`、`MarketScreen.tsx`、`MarketsScreen.tsx`。如果之後 `useNav` 提供歷史深度，可以改用它。

## 2026-09-19 T30 各市場的差額標籤與 128×160
- 情況：草圖的差額只有「+127」加顏色；元件 `Pill` 一律加 ▲▼＝。128×160 草圖每列只有名次、名稱、價格；03 §6 的清單規則是保留漲跌符號，但差額不是漲跌。
- 決定：差額用 `Pill`（「▲+127」，和 `Pill` 註解的 `+95` 範例一致）；128×160 不顯示差額，每列只留名次、名稱、價格。
- 理由：顏色以外一定要有符號（03 §3.1）；小螢幕把空間留給市場名稱，否則名稱只剩 4 個字。
- 影響：`frontend/src/screens/markets/markets.module.css` 的 `.rows` 規則依 `Card` 的結構選到價格後面的標籤；`Card` 改結構時要一起看。

## 2026-09-19 T30 市場畫面的狀態細節
- 情況：02 §6 沒寫市場畫面的「先顯示 09:12 的資料」用哪個時間、單一市場不是今天的資料標在哪裡、網址裡的作物或市場不存在時怎麼辦。
- 決定：
  - 更新失敗但有舊資料：保留舊資料，最上方一張警示卡（OK＝重試）。各市場 API 沒有抓取時間，寫交易日（「先顯示 9/19 週六 的資料」）；單一市場用 `fetched_at` 的時間。
  - 單一市場不是今天的資料：資訊列右側批發標籤後面寫「昨天」「3 天前」（≥ 3 天用警示色），和詳情頁資訊列的寫法一致；128×160 照 03 §6 不顯示右側。
  - API 回 404 或 400（例如換國家後按返回回到舊作物的市場）：取代成首頁，同「未知的路徑一律導回首頁」。
  - 零售時各市場不發請求（只有批發有市場資料），切回批發才取得。
  - 距離「{km} km」新增 i18n `markets.distance`；載入中的「…」接在 `states.loading` 後面（照 02 §6）。
- 理由：都是最簡單、和其他畫面一致的做法。
- 影響：`frontend/src/screens/markets/`、`frontend/src/i18n/locales/*.json`。

## 2026-09-19 T34 大段落檢查 B 的做法與修正
- 情況：單頁應用在畫面內切換時，Playwright 的 `networkidle` 不會重設，按鍵太快會落在資料還沒載入的畫面；另外走勢圖把所有沒有資料的日子都標「休」，地區資料較舊時（例：Kolar）最近幾天會被誤標成休市。
- 決定：
  - e2e 在頁面載入前包一層 `fetch` 計算進行中的請求；`settled()` 等到沒有進行中的請求、畫面上沒有骨架（`Skeleton` 標 `data-skeleton`），再等兩個 animation frame。元件展示頁本來就展示骨架，所以允許骨架。
  - 主要流程只用按鍵：首次設定（有推測、沒有推測兩條路）、首頁 → 詳情三個分頁（含 7／30 日切換）→ 本地區各市場 → 單一市場 → 返回、`*` 切換批發零售、`#` 面板換正在看的地區、選單 → 設定 → 返回；印度／台灣 × 繁中／English 四個組合；每一步都檢查溢出、焦點、字級與 console。
  - 全部畫面清單補上設定子頁、最近看過、舊資料地區、比價其他排序、沒有資料地區的市場頁、零售的市場頁、台灣英文版的走勢與市場頁。
  - `TrendPoint` 新增 `closed`：只有該國的休市星期（`closed_weekdays`）而且沒有價格的那天，7 日走勢的 X 軸才寫「休」；其他沒有資料的日子照常寫星期、只畫空白帶。
- 理由：檢查結果要反映使用者真的會看到的畫面；「休」只能用在休市日，不能掩蓋資料延遲。
- 影響：`frontend/e2e/`、`frontend/src/components/{Skeleton,TrendChart}/`、`frontend/src/screens/crop-detail/TrendTab.tsx`。

## 2026-09-19 T35 狀態處理的補強
- 情況：各畫面在 T25–T33 已經做了 F12 的狀態，但還沒有 04 §8 的「每個畫面包一層 error boundary」，首頁與作物清單也沒處理「設定裡的地區已經不存在」（404 `area_not_found`）。
- 決定：
  - 路由表替每個畫面（與外層）加上 `ErrorBoundary: ScreenError`：畫面出錯時顯示「這個畫面出了問題／你的設定都還在」與「回首頁」出口（OK 以 replace 回首頁），不會變成空白頁。新增 `errors.screen.*` 字串（繁中、English）。
  - 首頁與作物清單收到 `area_not_found` 時，以 replace 導向完整地區清單（`/areas?for=home`）重新選擇；詳情與市場畫面在 T27、T30 已經改成回首頁。
  - 端對端用 demo 開關重現每種狀態：API 失敗且沒有舊資料（錯誤框＋重試）、只用按鍵從「設定 › Demo」打開 API 失敗後回首頁（保留舊資料、警示卡、「舊」標籤）、我的地區今天未更新、作物沒有零售、地區沒有資料。128×160 的卡片是單行，警示卡只保留「連線失敗」標題。
- 理由：每種錯誤都有出口；設定失效時直接帶使用者到能修正的畫面。
- 影響：`frontend/src/app/{ScreenError.tsx,routes.ts}`、`frontend/src/screens/home/useAreaPrices.ts`、`frontend/e2e/states.spec.ts`、locale 檔。

## 2026-09-19 T37 128×160 收尾的結果
- 情況：T37 要逐一套用每個畫面的 128×160 縮減規則（03 §6）。平行開發時，每個畫面在第一次實作就照規則做了（清單單行、不畫迷你走勢與說明列、資訊列不畫鍵帽、分頁不畫 ◀ ▶、行情頁不顯示作物圖示與指標、走勢圖不畫刻度、面板只有數字鍵帽與文字）。
- 決定：T37 只做驗證與目視檢查：`make e2e` 的全部畫面與主要流程在 128×160 都通過；16 個畫面的 128×160 截圖逐一目視確認。唯一保留與草圖不同的地方是「舊」標籤在 128×160 仍然顯示（T23 的決定：不是今天的資料一定要標示）；連線失敗的警示卡在 128×160 只保留「連線失敗」標題。英文較長的標題（例如「Median of 7 markets · ₹/qtl」）在 240×320 以省略號截斷，符合 03 §7「長名稱用省略號」，之後可以再縮短英文字串。
- 理由：縮減規則已經在各畫面實作；這個任務確認兩種尺寸都沒有溢出、字級與焦點都正確。
- 影響：無程式變更。

## 2026-09-19 T38 README 的做法
- 情況：T38 要求 README 放截圖、快速開始、架構圖、技術選型、技術亮點、測試與專案結構，而且每個指令都實際跑過、每個連結都存在、mermaid 語法正確。
- 決定：
  - 截圖由 `make screenshots` 產生（`frontend/e2e/screenshots.spec.ts`，只在 `SCREENSHOTS=1` 時執行）：demo 模式的完整服務、240×320、2 倍解析度，四張放在 `docs/images/`（台灣首頁、印度行情、印度英文比價、台灣 30 日走勢）。
  - 驗證方式：README 的相對連結用腳本逐一檢查檔案存在（21 個）；mermaid 用官方 mermaid 11 實際解析並繪製；`make up`、`make dev`、`make seed`、`make logs`、`make geoip`、`make test`、`make lint`、`make e2e`、`make audit`、`make types`、`make screenshots` 都在本機實際執行過。
- 理由：評審打開 repo 第一眼看到的是 README，內容要能照著做而且正確。
- 影響：`README.md`、`docs/images/`、`frontend/e2e/screenshots.spec.ts`、`Makefile`。

## 2026-09-19 T39 驗收時的修正
- 情況：驗收檢查發現 128×160 的作物詳情、各市場、單一市場、作物清單看不到目前的價格類型：資訊列在小尺寸只留左半邊，而「批發／零售」標籤放在右半邊。02 §2 規定「目前的類型永遠顯示在畫面上」。
- 決定：`InfoBar` 新增 `small` 屬性（128×160 時代替右半邊顯示的內容），上述四個畫面傳入價格類型標籤；首頁本來就把標籤放在左半邊。另外新增驗收 e2e：`*` 讓詳情頁的價格、標籤、單位與指標一起變、首頁每張卡片一起變而且選擇會保存；只用按鍵從設定切換語言後，國家、地區與幣別不變。
- 理由：任何尺寸都不能出現「看不出是批發還是零售」的價格。
- 影響：`frontend/src/components/InfoBar/`、`frontend/src/screens/{crop-detail/DetailFrame,markets/*,crop-list/CropListScreen}.tsx`、`frontend/e2e/acceptance.spec.ts`。

## 2026-09-20 作物擴充到每國 21 種
- 情況：使用者覺得作物偏少。原本每國 10 種（06 §7.3 沿用草圖），首頁九宮格有幾格點進去是「無資料」：台灣的穀物、豆類、油籽、其他，印度的油籽、其他。
- 決定（使用者同意）：
  - 兩國各 21 種，七個分類都至少 2 種。作物照各國市場常見的品項挑，不要求兩國相同，因為比價只在同一國內。
  - 追加的作物排在草圖的 10 種之後，預設關注不變。兩國的同一種作物共用代號與圖示，台灣的毛豆用 `soybean`。新畫 13 個圖示，風格照原本的。
  - mock 參數（價格、區間、漲跌、到貨量、零售係數）依各國常見行情估計；零售只給一般家庭會買的品項。
  - 來源名稱用各來源實際的寫法（data.gov.in 的 commodity、FarmTransData 的作物名稱），之後接真實資料（B2、B3）可以直接對照。台灣的稻米、紅豆、芝麻可能不在果菜批發市場的資料裡【待確認】，接真實資料時要另找來源或顯示無資料。
- 理由：展示時九宮格每一格都有內容；清單原本的順序不變，既有的測試與數字鍵位置不受影響。
- 影響：`backend/app/seed/{IN,TW}.yaml`、`frontend/src/icons/`、`frontend/src/test/fixtures/`、docs/06 §7.3–7.4、docs/03 §8。
## 2026-09-20 CD 提前完成（加分項 B1）
- 情況：使用者要讓組員隨時看到最新的 `main`。02 §3.2 的 B1 原本排在 Simulator 測試之後。主辦單位的 VM 對外只開 22、3000、3001（80／443 被擋），同一台 VM 上還有組員的其他專案；repo 是私有的。
- 決定：使用者選了部署來源 dw650/harrykuo1、CI 通過後才部署、伺服器關 demo 模式。其餘：
  - 伺服器的 `~/harrykuo1` 改成 git clone，用唯讀 deploy key 拉程式，金鑰只設定在這個 repo 的 `core.sshCommand`。
  - GitHub Actions 用專用金鑰 SSH 進伺服器。這把金鑰在 `authorized_keys` 用 forced command 與 `restrict` 限定只能執行 `deploy.sh`，只傳 ref。
  - `deploy.sh`：`docker compose up --build --wait`，再經過 Caddy 做健康檢查；失敗就自動部署上一個成功的 commit（記在 `.git/deploy-last-good`），用 flock 避免兩個部署同時跑。
  - 先用 HTTP（`http://203.116.30.131:3001`）；HTTPS 等 80／443 開放後改 `.env` 即可。
  - 使用者同意停掉同一台 VM 上佔用 3000 port 的 `agriprice` 容器（只停止，沒有刪除）。
- 理由：手動部署與 CD 共用一支腳本；私有 repo 不必把 GitHub 權杖放在伺服器上；CI 用的金鑰外洩時最多只能觸發部署。
- 影響：`scripts/deploy.sh`、`.github/workflows/deploy.yml`、docs/07 §5.2–5.3、docs/00 目前狀態、README。

## 2026-09-20 依賴檢查遇到外部服務中斷時只警告
- 情況：npm 的 audit 服務維修（503），CI 的 `npm audit` 失敗，整個 CI 算失敗，Deploy 就被跳過。使用者希望避免外部服務的問題擋住部署。
- 決定：`make audit-frontend`、`make audit-backend` 改用 `scripts/audit.py`：
  - 找到漏洞一定失敗：npm 是 high 以上，pip 是任何一個，和原本相同。
  - 輸出看不出是網路或服務錯誤時也算失敗，不會默默跳過。
  - 明確是連不上（503、逾時、DNS 等）時重試 3 次；還是不行就顯示警告（GitHub Actions 的 `::warning::`），不算失敗。
  - 子程序不帶 `FORCE_COLOR`，`uv export` 加 `--color never`，避免 requirements 檔被寫進顏色控制碼。
- 理由：沒有執行的檢查不等於找到漏洞；依賴只在 lockfile 改變時才會變，下一次執行就會補檢查。
- 影響：`scripts/audit.py`、`Makefile`、docs/07 §5.1。

## 2026-09-20 CD 改成伺服器自己拉
- 情況：Deploy workflow 從 GitHub 的機器 SSH 到 VM 時逾時。VM 的 22 port 只開給部分網路（從使用者的電腦連得上），GitHub Actions 的機器連不進來。
- 決定：
  - GitHub 不連伺服器。CI 通過後，Deploy workflow 把 `deploy` 分支移到該 commit（`GITHUB_TOKEN` 需要 `contents: write`）。
  - 伺服器上的 systemd 計時器每分鐘執行 `scripts/deploy-poll.sh`，有新 commit 就用 deploy key fetch，再執行 `deploy.sh`。失敗的 commit 不重試，等下一個。
  - 原本給 GitHub Actions 用的 SSH 金鑰已經從伺服器移除，secret `DEPLOY_SSH_KEY` 不再使用。
- 理由：伺服器只需要對外連線；GitHub 上不用存能登入伺服器的金鑰；從標記到開始部署最多約一分鐘。
- 取捨：GitHub 上看不到部署是否成功，要看網站或伺服器的日誌（`journalctl -u agriprice-deploy`）。
- 影響：`.github/workflows/deploy.yml`、`scripts/deploy-poll.sh`、`scripts/deploy.sh`、`infra/deploy/`、docs/07 §5.2–5.3、README。

## 2026-09-20 B2 台灣農業部真實批發行情（tw_moa）
- 情況：06 §1 只寫了端點與「參數、欄位以實際回應為準」。實際呼叫後發現：`Crop` 是部分比對；每次回應都附上所有市場的休市公告；`$top` 上限 10000；同一作物有多個品種與進口貨，價格差很多；作物名稱和 mock 用的不同（甘薯、蕹菜、大蒜-蒜頭、濕香菇）。文件沒寫開啟真實來源後 mock 怎麼處理、要抓多少天、怎麼避免每小時重抓 60 天。
- 決定：
  - `PROVIDERS` 加上 `tw_moa` 才開啟，預設仍是 `mock`。開啟後台灣只用 `tw_moa`、印度仍是 mock，一個國家不混用兩種來源：worker 每次執行先刪掉各國「不是目前來源」的報價並重算那些日期，所以切換時舊的示範資料會消失，關掉 `tw_moa` 時台灣回到 mock。只設 `PROVIDERS=tw_moa` 時印度沒有任何資料。
  - 台灣零售沒有資料（等 B4）；稻米、紅豆、芝麻在果菜批發市場沒有交易，也沒有資料。畫面照原本的規則顯示「—」與原因（`no_data`）。
  - 對照表 `source_maps.tw_moa` 完全比對（name, variety）：空品種只對到沒有品種的品項。每個作物只收 seed 上 `variety` 的那個品種（例：甘藍只收「甘藍-初秋」，不收改良種與進口；香蕉收「香蕉」即北蕉），毛豆收「毛豆-豆莢」（鮮莢，不收豆仁），落花生收「生」，甘蔗收「帶皮」。mock 的對照（空品種＝任何品種）不變。
  - 市場只對照 seed 的 14 個市場。東勢、溪湖、永靖、南投、台東等不在我們地區裡的市場記為 `unmapped`；不新增市場，因為會改變 mock 的畫面（例：台中市多一個永遠沒有資料的市場）。
  - 抓法：每個品項一個請求、用日期區間抓完整段期間（約 18 個請求），不是每天每個品項一個請求；依序送出、間隔 1 秒，逾時 60 秒，429、5xx、網路錯誤最多試 3 次（間隔 5、10 秒）；errMsg、不是 JSON、其他 4xx 讓那次執行失敗，舊資料不動。provider 在第一次 `fetch(day)` 抓完整段期間，之後的 `fetch` 從同一批資料取，所以 provider 介面與 `run_provider` 都不用改。
  - 期間：啟動時與每天的例行執行抓 60 天（和檢查規則的 60 天一致）；06 §8 的每小時更新（台灣 06:00–15:00）只抓最近 3 天，資料晚一兩天才出現也補得到。
  - 休市公告（`作物代號` 為 `rest`）記成新的丟棄原因 `market_closed`，不算 `unmapped`；每個回應都會重複附上，同一列只留一次。為此 `RowError` 多了 `reason`。
  - 06 §3.5「真實資料接上後改成『全國當天都沒有報價』才算休市」這次**沒有做**，台灣仍用週一休市。原因：實際資料裡週一也有幾個市場交易（西螺、花蓮等），照字面做的話幾乎不會有休市日；而且抓取失敗時每一天都會被當成「全國沒有報價」，舊資料就不會被標示出來。之後要做的話，建議改用來源的休市公告。【待確認】
- 理由：顯示的價格和畫面上的品種一致；對照不到就丟、不猜；一次完整執行約 1 萬列、30 秒，每小時更新只有幾百列；provider 介面、`run_provider` 與 mock 資料都不變。
- 影響：`backend/app/ingest/providers/tw_moa.py`（新）、`backend/app/ingest/{normalize,pipeline}.py`、`backend/app/ingest/providers/base.py`、`backend/app/repositories/ingest.py`、`backend/app/worker.py`、`backend/app/seed/TW.yaml`、`backend/tests/fixtures/tw_moa_farmtrans.json`、`backend/tests/ingest/test_tw_moa.py`；兩個既有測試改了前提（`test_seed` 的 tp2 要從每個來源的對照表拿掉、`test_worker` 的「未實作來源」改用 `in_datagov`）；`.env.example`、docs/06 §1.2、§8、docs/04 §2、§5.2。要加品種或市場時改 `TW.yaml` 的 `source_maps.tw_moa`。

## 2026-09-20 B2 驗收：沒有任何來源的國家不刪資料
- 情況：驗收 B2 時發現，`PROVIDERS` 設錯（例如只寫 `tw_moa`、忘了 `mock`）時，印度沒有任何來源，`retire_sources` 會刪掉印度的所有價格。
- 決定：沒有任何啟用中來源的國家，保留原本的價格並記一筆警告；只有在有來源可以取代時，才刪掉其他來源的價格。
- 理由：設定錯誤頂多讓資料停在舊的，不能讓資料消失。
- 影響：`backend/app/ingest/pipeline.py`、`backend/tests/ingest/test_pipeline.py`。

## 2026-09-20 顯示執行中的版本、單一市場的來源不重複
- 情況：組員分不出線上是不是新版本；開啟真實資料後，單一市場畫面的來源會變成「農業部 農產品交易行情 · 農業部 農產品交易行情」。
- 決定：
  - `APP_VERSION`（commit 短 hash）由 `make up` 與 `scripts/deploy.sh` 帶進 api 容器，沒有時是 `dev`；`/api/v1/health` 多一個 `version` 欄位，「關於」頁最後一張卡片顯示「版本 xxxxxxx」。msw 的 health fixture 固定是 `dev`，重產生時不會變。
  - 單一市場畫面的來源：國家的資料來源與這筆報價的來源相同時只顯示一次。
- 理由：部署是否成功一眼可以確認；同一段字不重複出現。
- 影響：`backend/app/{config.py,schemas/health.py,api/v1/health.py}`、`compose.yaml`、`Makefile`、`scripts/deploy.sh`、`frontend/src/api/queries.ts`、`frontend/src/screens/{about,markets}/`、docs/02、docs/04、docs/07。

## 2026-09-20 行情頁的附近最高／最低價
- 情況：要在行情頁告訴使用者「附近哪個地區今天價格最高、哪個最低」。docs 與草圖都沒有這張卡片，也沒有定義「附近」要多遠、要不要算舊資料、這個地區自己最高時怎麼寫。
- 決定：
  - **附近的範圍**：同一個國家內離正在看的地區最近的 **3 個**地區，而且地區中心的直線距離（haversine，和比價頁相同）在 **300 km 以內**。以 seed 的座標：台北市 → 新北市 11、桃園市 27、宜蘭縣 38 km；台中市 → 雲林縣 44、嘉義市 78、花蓮縣 96 km；Nashik → Ahmednagar 142、Pune 165、Jalgaon 215 km；North Delhi 300 km 內只有 Agra（191 km）；Bengaluru Urban 只有 Kolar（61 km；Kurnool 在 322 km 外）。300 km 沿用位置推測「最近的地區超過 300 km 就算推測不到」的上限（06 §6）。
  - **只比同一天**：這個地區的價格要是新的（今天，或中間只有休市日）；附近地區的最新交易日要和它**相同**才算，比較早（舊資料）或比較晚的都不算。所以卡片不另外標日期，日期看資訊列。
  - **最高與最低**：在這個地區和符合的附近地區之間取。同價時算這個地區（附近沒有更高的，就說這裡最高）；附近地區之間同價時取近的。價格比較到小數 4 位（和名次相同）。沒有符合的附近地區，或附近都和這裡同價時，不顯示卡片。
  - **由後端算**：quote 回應多一個 `nearby`（`highest`、`lowest` 兩列，各有 `area_id`、價格、差額、直線距離、`is_base`），手機只下載兩列。純函式在 `services/nearby.py`，SQL 沿用 `repositories/prices.py` 的 `area_daily_rows`。
  - **畫面**：三個指標下方兩張地區卡片，各自可以選、各自有數字鍵帽，OK 或數字鍵打開那個地區的行情分頁（和比價頁相同）。說明列「附近最高 · 直線 165 km」、右側是價格與差額。這個地區本身就是最高（或最低）時，那一張改成它自己的卡片（定位圖示、「附近最高」、「你」標籤，不顯示價格、不能選），排在另一張前面。
  - **用語不分角色**：只寫「附近最高／附近最低」（英文「Highest nearby」「Lowest nearby」），不寫「賣到哪裡多賺」「去哪裡買便宜」；兩張都能選，賣方看最高、買方看最低（00：不做賣方／買方角色）。
  - 英文的說明列在 240×320 放不下「Highest nearby · 165 km (straight)」，距離會被截掉；所以可選卡片的英文寫「Highest · 165 km (straight)」，自己的卡片寫「Highest nearby」。說明列用 `detail.today.nearby.highestAt` 一整句，各語言自己決定怎麼寫。
  - 關於頁多一行說明附近的範圍。
- 理由：
  - 3 個、300 km 兩國都合理：台灣的縣市很近，取最近的 3 個不會跨到島的另一頭；印度的縣相隔 100–250 km，300 km 內通常有 1–3 個，太遠的不算（例：North Delhi 第二近的 Indore 在 676 km 外）。只用半徑的話，300 km 幾乎涵蓋整個台灣；只用個數的話，North Delhi 的「附近」會包含 676、870 km 外的地區。
  - 只比同一天，差額才有意義，也不會把舊資料當成今天的顯示。
  - 卡片放在指標下方：焦點從「本地區各市場」往下移時，中間的指標會一起露出來；自己的卡片不能選，排在前面，讓最後一張一定是可選的，捲到最下面時整頁都看得到。零售時第一個焦點就是附近的卡片（在 240×320 不用捲動就看得到），這時中間軟鍵是「查看」；沒有附近卡片時仍然是「比價」。
- 影響：`backend/app/services/{nearby,freshness,prices}.py`、`backend/app/schemas/prices.py`、`backend/app/api/v1/prices.py`、`backend/tests/{unit/test_nearby.py,api/test_nearby.py}`、`backend/tests/dump_api_fixtures.py`（多存 North Delhi 與 Bengaluru Urban 的洋蔥批發行情）；`frontend/src/screens/crop-detail/{NearbyCards.tsx,nearbyRows.ts,TodayTab.tsx}`、i18n、關於頁、`frontend/src/api/schema.d.ts`、msw fixtures 與 handler（借用別的作物或地區的 fixture 時 `nearby` 設成 `null`）、e2e；docs/02 §3.1、§5.4，docs/04 §6。要改範圍就改 `nearby.py` 的 `NEARBY_COUNT`、`NEARBY_MAX_KM`，以及關於頁的 `about.nearby`。
## 2026-09-20 B5 國際參考價
- 情況：02 §3.2 只寫「選單進入的獨立頁；一條世界銀行月資料系列」，06 §1.3 只寫要用具名序列。使用者和 lead 另外決定：六條序列、以免金鑰的匯率換成當地幣別每公斤、匯率每天跟各國的每日工作一起抓、Pink Sheet 每天最多一次條件式 GET、部署重啟不重抓。其餘細節文件沒寫。
- 決定：
  - **序列**（使用者決定）：Pink Sheet 的 Rice, Thai 5%、Wheat, US HRW、Maize、Soybeans、Sugar, world、Palm oil，放在 `app/seed/intl/series.yaml`（子資料夾，國家 seed 的載入只讀 `app/seed/*.yaml`），worker 同步進 `intl_series`。依欄位名稱找序列並核對單位；Sugar, world 的原始單位是**美元/公斤**，其他是美元/公噸，詳情頁照原始單位顯示（不是全部寫成美元/公噸）。
  - **檔案位址**：lead 給的位址（文件代號 `…-0050012025`）是 2025 年的文件，`Last-Modified` 停在 2026-01-14；官方頁目前連到 `…-0050012026`（2026-09-02 更新，含 2026 年 8 月）。所以 worker 每次檢查都先讀官方頁找「Monthly prices」連結，讀不到就用上次成功的位址或內建位址；`PINK_SHEET_URL` 可以固定一個檔案。官方頁與檔案都支援 `If-Modified-Since`（查核 2026-09-20），檔案用條件式 GET。
  - **匯率**：ExchangeRate-API 的 `open.er-api.com/v6/latest/USD`（使用者決定）。存全部幣別的最新一筆（快取，條款允許），API 只回傳該國幣別那一個（條款不允許轉發）。每個月份都用最新匯率換算，畫面寫「以 9/19 匯率換算」。國家幣別取自 seed，加馬來西亞（MYR）不用改程式。
  - **時機**：各國 00:05（和既有的每日工作同時；每個不同 UTC 時差一個工作，台灣與馬來西亞共用）與啟動時檢查，但只在到期時下載：匯率在「還沒有」「來源公布的下次更新已過（同一小時內不重抓）」或「滿 24 小時」時；Pink Sheet 在「還沒有」或「滿 23 小時」時（留一小時餘裕給每日工作的時間誤差）。狀態存在 `intl_sources`，所以重啟不重抓；每次檢查都記在 `ingest_runs`（`er_api`、`wb_pink`）。worker 啟動時先同步序列（本機、很快），畫面在任何下載之前就有六列。
  - **資料表**：`intl_series`、`intl_prices`（美元／原始單位，照原樣）、`fx_rates`、`intl_sources`；migration `80ac1f2d0366`（down_revision `bec1dda1df2f`），只新增資料表，合併時可以直接改接到別的 head 後面。
  - **API**：`GET /intl?country=`、`GET /intl/{series}?country=`，價格每公斤、當地幣別（照 04 §6），另附原始美元價；缺資料附 `reason`（`no_data`、`no_fx`）；demo 的 `X-Demo-Fail` 也有效。
  - **畫面**：選單最後一列（原本各列的數字鍵不變）；兩頁都沒有選單、`*`、`#`；單位固定每公斤（取該國單位表裡每公斤的那一個，不跟批發／零售的單位設定）。清單卡片的說明列月份在前（英文規格較長時月份不會被截掉）；月份比今天所在月份早 3 個月以上用警示色（正常晚 1 個月，月初晚 2 個月）。匯率標示「Rates By Exchange Rate API」放在兩頁（條款要求每個使用匯率的頁面都要標示）；關於頁加一行兩個來源的標示（Pink Sheet 是 CC BY 4.0）。單一序列頁沒有可選項目，↑ ↓ 捲動；指標用「近一年高、近一年低、比一年均價」，避免「12 月高」被讀成十二月。
  - **套件**：`openpyxl`（唯讀模式讀 xlsx）與 `defusedxml`（openpyxl 會自動用它解析 XML）；開發用 `types-openpyxl`。另外下載有大小上限（20 MB）、解壓後上限（64 MB）。
- 理由：官方頁的連結是唯一不用每年手動改設定的做法；到期規則讓每天的請求數固定在約 3 個（匯率 1、官方頁 1、檔案 1，檔案多半回 304），部署再頻繁也不會增加；月資料只換算、不補值，缺什麼就說什麼。
- 影響：`backend/app/ingest/intl/`（新）、`backend/app/{repositories,services,schemas,api/v1}/intl.py`（新）、`backend/app/seed/intl/series.yaml`（新）、`backend/app/seed/{schema,loader}.py`、`backend/app/db/models.py`（`DATA_TABLES` 多四張表）、migration、`backend/app/{config,worker}.py`、`compose.yaml`、`.env.example`、`backend/tests/`（樣本、`intl_server.py`、`conftest.py` 的 `_ensure_intl_data`）、`frontend/src/screens/intl/`（新）、`frontend/src/lib/monthly.ts`（新）、`frontend/src/i18n/`、`MenuSheet`、`AboutScreen`、路由、msw fixtures 與 handler、e2e。要加序列改 `series.yaml`；要換匯率來源改 `backend/app/ingest/intl/fx.py` 與 `FX_URL`。

## 2026-09-20 資料來源的共同介面與抓取原則
- 情況：B2 之後 worker 用 `REAL_SOURCES`、`REFRESH_HOURS` 兩張表和 `build_providers` 的 if/elif 認得每個來源，啟動時與每天的例行執行都重抓 `tw_moa` 整段 60 天。伺服器每次 push 都重新部署，要接第三個來源（馬來西亞）之前，先把介面與抓取的方式定下來（使用者要求）。
- 決定：
  - 每個來源在 provider 旁邊宣告一個 `SourceInfo`（代號、國家、價格類型、期間、是否連網、排程重抓幾天、每小時更新時段、啟動時多久內成功過就略過），列進 `app/ingest/registry.py`。mock 標成備援來源（`fallback`），涵蓋沒有真實來源的國家。provider 多一個 `stats`：送出的請求數、下載時就略過的資料列（算進丟棄筆數）、下載過的檔案的 ETag 與 Last-Modified。
  - 連網來源的抓取原則（`app/ingest/policy.py`）：啟動時，6 小時內成功過、對照表沒變、資料庫還有它的價格就略過；其他每次執行只抓資料庫還缺的日期加上最近 3 天；資料庫沒有它的價格、或對照表改了才抓整段 60 天。「缺的日期」看資料庫有沒有這個來源的報價，所以全國休市的日子會一直算缺；`tw_moa` 用日期區間一次抓完，請求數不變，只是回應多幾天。
  - 對照表的指紋存在 `ingest_runs.maps_hash`：seed 加了作物或市場，下一次執行就抓整段，新作物也有歷史資料。
  - 條件式請求的驗證資訊存在 `ingest_runs.files`，只有對照表沒變、資料庫還有這個來源的價格時才帶上，避免來源關掉又打開（價格已被刪掉）時拿到 304 卻沒有資料。
  - 共用的連線與重試寫在 `app/ingest/http.py`（間隔 1 秒；429、5xx、網路錯誤最多 3 次，間隔 5、10 秒；下載到一半斷線就整個重來），`tw_moa` 改用它。
  - 契約測試 `tests/ingest/test_contract.py`：登記表裡的每個來源都要有離線的測試案例，否則測試失敗。
  - `ingest_runs` 新增 `requests`、`files`、`maps_hash`（migration `74f6aadac0c6`）。`PROVIDERS=mock` 的結果和原本完全相同。
- 理由：新增來源只要寫 provider 與 `INFO`，不必改 worker；重新部署不會重抓 60 天；每次執行花了多少請求看得到。
- 影響：`backend/app/ingest/{http,policy,registry,pipeline}.py`、`backend/app/ingest/providers/{base,mock,tw_moa}.py`、`backend/app/repositories/ingest.py`、`backend/app/worker.py`、`backend/app/db/models.py` 與 migration；測試 `test_http`、`test_policy`、`test_contract`、`test_worker`（原本的「每小時更新用短期間」改成「依排定的日期抓」，`test_tw_moa` 改用登記表替換來源）；docs/06 §1.2、§1.4、§8，docs/04 §5.2。

## 2026-09-20 馬來西亞的地區、市場與作物
- 情況：使用者同意加入第三個國家馬來西亞（英文顯示），資料來自官方 PriceCatcher。文件只給了方向（8–11 個縣、涵蓋各州、包含有批發市場與濕巴剎多的縣、每個分類至少 2 種作物），具體選哪些要看資料。
- 決定：
  - 11 個地區，每州或直轄區一個縣：Kuala Lumpur（整個直轄區；PriceCatcher 把吉隆坡分成 11 個國會選區，每區的濕巴剎太少）、Klang、Johor Bahru、Timur Laut、Kinta、Kota Bharu、Kuantan、Kuala Terengganu、Seremban、Kulim、Kuching。有 Borong 的縣優先（7 個），再補濕巴剎多、每天都有回報的縣。沒選 Melaka Tengah（只有 2 個濕巴剎）與 Larut, Matang & Selama（有 Borong，但名稱在 128×160 放不下，Perak 改選 Kinta）。
  - 名稱兩種語言都用英文（和印度相同），州名用 PriceCatcher 的寫法（Penang 例外）。座標是縣的中心（首府），`km` 是市場到縣中心的大約直線距離。
  - 市場：7 個 Borong 各是所在縣的唯一市場；Timur Laut、Kinta、Kota Bharu、Kuching 沒有市場。
  - 作物 20 種：只選濕巴剎有報價、以 1 公斤計價、多數縣每天都有的品項；每個作物只對照一個品項（例：甘藍用北京進口的 1458，比中國進口的 104 回報多）。資料做不到的分類：穀物只有麵粉（每週報一次）、水果只有萊姆與金桔、「其他」沒有作物，`test_seed` 把這兩個例外寫明。每週才報一次的花生、椰絲、麵粉平常會顯示「N 天前」。
  - 國家設定：MYR、`en-MY`、UTC+8、沒有固定休市日、漲為綠色（`up_is_pos: true`，和 Bursa Malaysia 相同）、代表價叫「查報價」、單位 RM／公斤（2 位小數，有「仙」）與 RM／斤（kati＝0.605 公斤）、資料來源名稱附 CC BY 4.0。預設地區 Kuala Lumpur，預設關注番茄、甘藍、辣椒、洋蔥、黃瓜、小白菜、蒜頭。
  - mock 參數依 2026 年 9 月濕巴剎價格的中位數估計；例外情境：Kuching 昨天、Kulim 3 天前、花生 2 天前、麵粉 3 天前。
- 理由：地區分散在各州、每個地區都有足夠的回報點；只放真的有資料的作物，開真實資料時每種作物都有價格。
- 影響：`backend/app/seed/MY.yaml`、`backend/tests/ingest/test_seed.py`、`frontend/src/icons/`（新畫 8 個圖示）、docs/06 §7.2–7.4。

## 2026-09-20 PriceCatcher：零售取濕巴剎的中位數、沒有批發價
- 情況：PriceCatcher 是每個回報點（premise）一個價格，06 §3.3 規定零售是每個地區每天一個價格。原本以為 Borong（批發市場）可以當市場，實際下載後發現：15 個 Borong 在 2025 年每週回報一次，2026 年起幾乎沒有資料（1 月 6 列，之後沒有）。名稱有「Pasar Borong」但類型是濕巴剎的回報點，價格和一般濕巴剎差不多，是零售價。
- 決定：
  - 地區零售價＝地區內各濕巴剎（Pasar Basah）當天報價的中位數。不收迷你市場（多數只在週一回報，混進來週一的價格會跳，例：Kota Bharu 番茄平常 8.0、週一變 9.95）、超市與大賣場（通路與品級不同）、雜貨店與餐廳。
  - 做法是通用的：`NormalizedQuote` 加一個 `point`（回報點代號），檢查時每個回報點各算一列，檢查完才把同地區、作物、品種、日期的回報點合成一筆中位數（`app/ingest/combine.py`），資料庫仍是每個地區每天一個零售價，彙整的 SQL 不用改。`rows_ok` 是通過檢查的回報點筆數，寫進資料庫的筆數比較少。
  - 批發：seed 仍把 7 個 Borong 對照成市場（恢復回報就會出現），示範資料也有批發價；開真實資料時，馬來西亞的批發價全部是「—」（`no_data`）。**預設價格類型沒有改**（仍是批發），要不要讓馬來西亞預設零售由團隊決定。【待確認】
  - 執行時不下載 lookup 檔：seed 直接列出回報點與品項代號（79 個濕巴剎、7 個 Borong、20 個品項），測試用 lookup 樣本檢查類型、縣與單位。新開的濕巴剎要改 seed 才會收。
- 理由：中位數不怕單一攤商填錯；只收同一種、每天回報的通路，價格才不會因為回報點組成改變而跳動；PriceCatcher 是零售調查，不能把濕巴剎的價格當批發價。
- 影響：`backend/app/ingest/{combine,normalize,validate,pipeline}.py`、`backend/app/ingest/providers/base.py`、docs/06 §1.5、§3.3。

## 2026-09-20 PriceCatcher 的抓法
- 情況：每月一個 CSV（一個月約 50 MB、180 萬列），每天 12:00 UTC 更新；60 天的期間跨 3 個月。使用者要求每個檔一次執行最多下載一次、用條件式請求、不要頻繁打擾來源。
- 決定：
  - 用 CSV，不用 parquet（小 20 倍，但要多裝約 48 MB 的 pyarrow）；邊下載邊讀，只留下對照得到的列，記憶體只放約 6 萬列。
  - 只下載排定日期（§1.4 的抓取原則）所在的月份；帶上次成功下載時的 ETag 與 Last-Modified，304 就沒有新列，並把驗證資訊帶到這次執行的紀錄，下一次還能用。
  - 當月（或更晚）的檔案 404 是「還沒發布」（每月 1 日晚上 8 點前），不算錯；更早的月份 404、欄位名稱不對，都讓那次執行失敗，舊資料不動。格式不對的列記為 `malformed`。
  - 排程：每天 00:05 與 20:00–23:00 每小時（馬來西亞時間）；啟動時 6 小時內成功過就略過。
- 理由：一般情況下每次排程只有 1–2 個 304 請求；整個月檔只在它更新後下載一次。
- 取捨：當天的價格晚上 8 點才出來，白天看到的是昨天的資料（畫面標「昨天」）；國定假日沒有資料，那個月的檔每次排程都會問一次（304，幾乎不花流量）。
- 影響：`backend/app/ingest/providers/my_pricecatcher.py`、`backend/tests/ingest/test_my_pricecatcher.py`、`backend/tests/fixtures/my_pricecatcher/`。

## 2026-09-20 地區清單的資料新舊看所有價格類型
- 情況：`GET /countries/{cc}/areas` 的最新交易日原本只看批發。馬來西亞只有零售，全部地區都會顯示「無資料」。04 §6 沒有寫要看哪一種價格。
- 決定：最新交易日改成批發、零售兩者中較新的那天。印度、台灣的示範資料兩者的新舊相同，`tw_moa` 沒有零售，所以結果和原本一樣。
- 理由：地區清單要回答「這個地區有沒有資料」；各作物的價格仍依使用者選的價格類型各自標示新舊。
- 影響：`backend/app/repositories/catalog.py`（`latest_dates`）、`backend/app/services/catalog.py`。

## 2026-09-20 mock 參數的區間與到貨量可以省略
- 情況：PriceCatcher 每個回報點只有一個價格、沒有到貨量；seed 的 `mock.lo`／`hi`／`arr`／`arrR` 原本必填。
- 決定：這四個改成可省略（`lo` 與 `hi`、`arr` 與 `arrR` 要一起給或一起省略）；mock 只在來源格式有這些欄位時印出來。印度、台灣的 seed 沒變，輸出完全相同。
- 理由：不放用不到的參數，示範資料也不會出現真實資料沒有的區間與到貨量。
- 影響：`backend/app/seed/schema.py`、`backend/app/ingest/providers/mock.py`。

## 2026-09-20 「附近」改成統一 100 km 內的所有地區
- 情況：使用者希望各國用同一個距離定義，不限個數（原本是「最近 3 個、300 km 內」）。
- 決定：附近＝同一國家內直線 100 km 以內、而且最新交易日和這裡相同的所有地區，約貨車 2 小時的距離。
  - 用 seed 的座標算過：台灣 10 區在 100 km 內都有鄰居（最多 4 個）；50 km 時花蓮沒有鄰居；150 km 以上台北會算到台中，「附近」變成半個台灣。
  - 印度原本的 11 區彼此相隔 140 km 以上，100 km 內只有 Bengaluru–Kolar；接真實資料時改成三個邦的全部縣，大多數地區就會有鄰居。
  - 測試與 e2e 的例子改成台灣：新北市（台北市較高、桃園市較低）、台北市（自己最高）。
  - 關於頁的「示範資料」說明一併修正：國際參考價是世界銀行的真實資料。
- 影響：`backend/app/services/nearby.py`、`backend/tests/{unit,api}/test_nearby.py`、`backend/tests/dump_api_fixtures.py`、msw fixtures、`frontend/src/screens/crop-detail/TodayTab.test.tsx`、`frontend/src/i18n/locales/*.json`、`frontend/e2e/{flows,screens}.spec.ts`、docs/02 §5.4、docs/04。

## 2026-09-20 伺服器上的 repo 目錄改名
- 情況：VM 上的目錄沿用最早手動部署時的 `~/harrykuo1`，和 repo 名稱不同，容易搞混。
- 決定：改名為 `~/2026-MeichuHackathon-CloudMosa`（使用者要求）。compose 專案名稱跟著目錄改變，所以資料庫改用新的 volume，由 worker 重新匯入；舊的 `harrykuo1_*` volume 保留不刪（不是這次建立的），要刪由人決定。systemd 單元的路徑一併更新。
- 影響：`infra/deploy/agriprice-deploy.service`、docs/07 §5.2、VM 上的 `/etc/systemd/system/agriprice-deploy.service`。
## 2026-09-20 N1 新聞頁（使用者決定）
- 情況：02 §3.3 原本把「AI 摘要」列為不做。使用者 2026-09-20 決定加一個新聞頁：左軟鍵選單 › 新聞 → 清單 → 內容，每則有兩句摘要，按 `1` 看相關作物的行情；不開外部網站。
- 決定：
  - 功能編號 N1，規格寫在 02 §3.4、§5.9；02 §3.3 的「AI 摘要」改成「新聞頁的兩句摘要除外」。
  - 選單位置：和 B5「國際參考價」一樣放在 baseline 各項之後，排在它後面（首頁 `7`、詳情頁 `8`），原本各項的數字鍵都不變。（第一版放在「關於」之前，會讓「設定」從 5 變 6；rebase 到含 B5 的 main 時改成照 B5 的做法。）
  - 新聞畫面和「關於」一樣沒有左軟鍵選單；右軟鍵返回。資訊列只顯示我的地區與抓取時間，不畫 `#`（換地區走首頁的選單）。
  - 內容頁沒有可選的項目（↑ ↓ 捲動），相關作物用數字鍵 1–3 打開、OK 等於 1。作物卡片如果做成可選的項目，焦點會把畫面捲到最下面，長的標題與摘要就看不到，也捲不回去。
  - 摘要下面一律寫「AI 依原文摘要，可能有誤」；「關於與資料說明」多一段說明新聞與摘要的來源。
- 理由：照使用者與隊友的草圖（Region 列、卡片、只有返回鍵）；按鍵規則和既有畫面一致。
- 影響：`frontend/src/screens/news/`、`frontend/src/components/NewsCard/`、`MenuSheet.tsx`、`paths.ts`、`routes.ts`、`icons`（新聞圖示）、i18n、About；e2e `news.spec.ts`、`flows.spec.ts`、`states.spec.ts`、`acceptance.spec.ts`；docs 02、03。

## 2026-09-20 N1 新聞的來源、過濾與保存
- 情況：使用者指定 Google 新聞 RSS（不需金鑰）；每國的搜尋字放在獨立的設定檔，不放 seed（seed 另一條線在改）。實測搜尋結果很雜。
- 決定：
  - 設定檔 `backend/app/ingest/news/sources.yaml`：每國的版本（hl、gl、ceid）與搜尋字、`keywords`、`topics`、`price_words`、`exclude`、作物與地區的別名。馬來西亞先寫好（英文與馬來文兩個版本，馬來文要 `ceid=MY:ms`），seed 有馬來西亞之後才會執行。
  - 只收價格新聞：有 `keywords`，或同時有「作物或 topics」與「price_words」，而且沒有 `exclude`。第一版只要求提到關鍵字或作物，實測留下了加倍券、選舉掃街、車價、美國批發市場報告，所以改成現在的規則。
  - 作物與地區用名稱比對（seed 的每種語言＋別名）；英文要整個字相符、接受複數；「臺」當「台」；中文地區名另外去掉「市」「縣」。
  - 去重：同 guid 或標題只差標點空白大小寫。第一次抓 `when:7d`，之後 `when:2d`（重疊一天）；超過 7 天的刪掉，API 也只列 7 天內的。
  - 只存標題、摘要、發布者、網域、連結（解得開就存發布者網址）、日期、作物與地區標籤；原文不存。
- 理由：規則簡單、可以在設定檔調整，不需要額外套件；不存原文避免轉載問題。
- 影響：`backend/app/ingest/news/{sources.yaml,config,match,rss,pipeline}.py`；docs 06 §1.6（rebase 到含馬來西亞與來源登記表的 main 前是 §1.4）。

## 2026-09-20 N1 新聞摘要：模型、原文與額度
- 情況：使用者先後改了三次做法，最後定案：伺服器自己讀原文；Gemini 免費額度是主要摘要來源（實驗室的自架模型延後，但程式保留）；有原文就用便宜的 Flash 模型不開搜尋，讀不到原文才用 `gemini-2.5-flash` 加 Google 搜尋；每天最多約 30 次模型呼叫；失敗就只顯示標題。
- 決定：
  - 讀原文：照 googlenewsdecoder 的做法解 Google 新聞連結（文章頁的 `data-n-a-sg`／`data-n-a-ts` → `batchexecute`）；抓發布者網頁（瀏覽器 UA、逾時、重試一次、最多 3 MB），正文依序取 JSON-LD `articleBody`、`<p>` 段落、`og:description`，最多 3,000 字。不加 trafilatura 等套件。只抓公開網址（轉址也檢查；服務名稱、localhost、內網 IP 不抓），避免 SSRF。2026-09-20 用真實連結試過：台灣 3 則讀到 2 則、印度 3 則讀到 2 則（讀不到的是 Cloudflare 驗證頁與 403）。
  - 模型順序：`SUMMARY_API_BASE`＋`SUMMARY_MODEL`（OpenAI 相容，有設定才用，逾時 300 秒）→ Gemini `GEMINI_MODEL`（預設 **`gemini-3.5-flash-lite`**：2026-09-20 查 pricing 與 models 頁，穩定版、2026-07-21 發布、未公告停用日期、免費層輸入輸出不收費、免費層沒有 grounding）。沒有原文時用 **`gemini-2.5-flash`** 加 `googleSearch` 工具（免費 grounding 每天 500 次，未公告停用日期）；它不接受 JSON Schema 與工具並用，所以用提示要求 JSON，並要求回答有引用網頁（`groundingChunks`）。
  - 回答規則：JSON；兩句以內；語言要對（台灣要有中文、印度與馬來西亞是英文）；300 字以內；作物只收該國清單的代號（Gemini 文字模型另外用 JSON Schema 的 enum 限定）。不合規則就丟掉，不重寫、不補。
  - 額度：最近 24 小時、所有國家合計最多讀 30 篇原文、呼叫模型 30 次；每國每次最多「上限 ÷ 國家數」（三國各 10）；Gemini 每 7 秒最多一次。rate-limits 頁已不列免費層數字（只在 AI Studio 顯示），所以取保守的值。額度、429、金鑰錯誤、模型不存在時，這個模型在這次執行不再使用；Google 回 403／429／5xx 時不再解連結。
  - 一則最多送兩次（`summary_tries`）；先處理提到地區、再來是提到作物的、較新的。每則記下產生摘要的模型（`summary_model`）。
  - 測試的 Gemini 與 OpenAI 相容回應是照官方文件的格式寫的（沒有金鑰，無法錄真實回應）；無效金鑰的錯誤回應是 2026-09-20 真實錄下的。
- 理由：原文加便宜模型最省額度；沒有原文時才用搜尋；任何一步失敗都只少一個摘要，不會出現編造的內容。
- 影響：`backend/app/ingest/news/{gnews,article,reader,summarize,job}.py`、`backend/app/config.py`、`compose.yaml`（worker 的環境變數、`host.docker.internal`）、`.env.example`；docs 04 §2、06 §1.6。

## 2026-09-20 N1 新聞的排程、手動執行與示範資料
- 情況：使用者要求每國當地 00:00 抓一次、可以手動執行（CLI，不做公開的 HTTP 觸發）、伺服器每次部署都會重啟 worker 但不能每次都重抓；e2e 不能連網。
- 決定：
  - worker 為每國排 00:00（當地時區）的工作，另外在啟動時排一次「只補沒有新聞、或最近 24 小時沒有成功抓過的國家」的工作（第一版只看最近一次成功的時間，e2e 發現切換 demo／google 後國家會變成空的，所以加上「沒有新聞」）；同一個程序內用鎖避免兩次新聞執行重疊。價格的 `python -m app.worker --once`（`make seed`）不抓新聞。
  - 手動：`docker compose exec worker python -m app.news --once [--country TW]`，照樣受每日額度限制。
  - `NEWS_SOURCE=google｜demo｜off`（預設 google）。`demo` 讀 `backend/app/ingest/news/demo.yaml` 的固定示範新聞（發布者「示範資料」「Demo data」，網域 `demo.example`，自帶示範摘要），走同一條管線；`make e2e` 與 `make screenshots` 用它。每次執行前先刪掉這個國家「其他來源」的新聞，所以示範新聞不會留在正式資料裡。
  - 每次執行記在 `news_runs`（抓到幾則、新增幾則、請求數、讀了幾篇原文、呼叫幾次模型、幾則摘要、錯誤），額度就從這裡算。
- 理由：部署頻繁也不會浪費請求與模型額度；e2e 與截圖不依賴網路，結果固定。
- 影響：`backend/app/news.py`、`backend/app/worker.py`、`backend/app/ingest/news/{demo.py,demo.yaml,job.py}`、`Makefile`（e2e、screenshots）；docs 04、06 §1.6、§8。

## 2026-09-20 N1 新聞的 API 與資料表
- 情況：04 §6 只有 GET、價格類 API；新聞要一個清單與一則內容。
- 決定：
  - `GET /api/v1/news?country=&area=`：最近 7 天最多 9 則，`area_ids` 含這個地區的排前面，其餘新到舊；回傳 `today`、`fetched_at`（最近一次成功執行的結束時間，國家時區）。每則有 `published_date` 與 `days_ago`（後端依國家時區算），前端只顯示「今天／昨天／日期」。`area` 不屬於這個國家時回 404 `area_not_found`。
  - `GET /api/v1/news/{id}`：同樣的欄位加 `country`、`today`；不存在或超過 7 天回 404 `news_not_found`。內容頁直接用這支，重新開啟 App 時也能還原。
  - 新表 `news_items`、`news_runs`，migration `23655d2e487a`，只建立與刪除自己的兩張表。rebase 到含 B5 的 main 時，down_revision 從 `bec1dda1df2f` 改成 B5 的 `80ac1f2d0366`，維持單一 head。
  - 多列 INSERT 以第一列的欄位為準，欄位不同的列要分組寫入（`repositories/news.insert_items`）。
- 理由：沿用既有的錯誤格式、快取標頭與型別產生流程；排序在資料庫做，前端不必知道地區的別名。
- 影響：`backend/app/{api/v1/news.py,schemas/news.py,services/news.py,repositories/news.py,db/models.py}`、migration、`frontend/src/api/{queries.ts,schema.d.ts}`、msw fixtures 與 handlers、`tests/dump_api_fixtures.py`；docs 04 §6、§7。

## 2026-09-20 N1 新聞在馬來西亞
- 情況：rebase 到含馬來西亞 seed 與來源登記表的 main（252441d）後，馬來西亞的新聞會開始執行。馬來西亞的作物在 seed 只有中文與英文名稱，馬來文的新聞標題（harga cili、kubis、sawi…）比對不到；地區一州一個，標題多半寫州名。
- 決定：
  - `sources.yaml` 的 MY 加上作物的馬來文別名（kubis→甘藍、cili→辣椒、sawi→小白菜、kangkung→空心菜…）與地區的州名別名（Selangor→Klang、Pahang→Kuantan、Penang→Timur Laut、KL→Kuala Lumpur…）。
  - 摘要語言維持英文（介面沒有馬來文）；馬來文標題帶 `lang="ms"`。
  - 示範新聞多 4 則馬來西亞（其中一則是馬來文標題、沒有摘要），e2e 與 msw fixture 都加上馬來西亞。
  - 新聞 migration `23655d2e487a` 改接在 `74f6aadac0c6` 之後；新聞 worker 排程接在來源登記表版的 worker 後面，沒有用回 `REAL_SOURCES`／`REFRESH_HOURS`。
  - 國家變成三個，每國每次的額度是 30 ÷ 3 = 10。
- 理由：馬來西亞的新聞一半是馬來文；州名是標題裡最常見的地名。
- 影響：`backend/app/ingest/news/{sources.yaml,demo.yaml,demo.py}`、`backend/tests/news/`、`backend/tests/dump_api_fixtures.py`、`frontend/src/test/fixtures/news__area-kualalumpur_country-MY.json`、`frontend/src/screens/news/*.test.tsx`、`frontend/e2e/news.spec.ts`；docs 06 §1.6。

## 2026-09-20 新聞：關掉搜尋備援、額度改成可設定
- 情況：線上第一次抓新聞時，`gemini-2.5-flash` 回 404「不再開放給新使用者」；改用 `gemini-3.6-flash`、`gemini-3.5-flash` 實測 Google 搜尋（grounding）都回 429「超過額度」。也就是免費方案沒有 grounding 額度，抓不到原文的新聞只會白打一次 API。
- 決定：
  - `GEMINI_GROUNDED_MODEL` 預設空白＝關閉這一段；要用再指定模型（付費金鑰才有意義）。抓不到原文就只顯示標題，絕不編造摘要。
  - 每天的篇數與模型呼叫次數改由 `NEWS_DAILY_ARTICLES`、`NEWS_DAILY_MODEL_CALLS` 設定，預設仍是 30。
- 影響：`backend/app/config.py`、`backend/app/ingest/news/{summarize,job}.py`、`backend/app/news.py`、`backend/tests/news/`、`.env.example`、docs/06 §1.6。
## 2026-09-20 馬來文與印地文介面（機器翻譯，待母語者檢查）
- 情況：要加 Bahasa Melayu（`ms`）與 हिन्दी（`hi`）兩個介面語言（印地文是加分項 B6）；同時有其他分支在 zh-TW／en 加新字串，`locales.test.ts` 原本要求所有字串檔的 key 完全相同。資料名稱（作物、地區、分類、來源）在 seed 只有 `{zh-TW, en}`。
- 決定：
  - `ms.json`、`hi.json` 翻譯 en.json 的每一個 key，**都是機器翻譯，要請母語者檢查**；變數與單複數 key 照英文。用詞統一：市場＝pasar／मंडी（印度的批發市場慣稱 mandi）、地區＝kawasan／क्षेत्र、批發＝borong／थोक、零售＝runcit／खुदरा、價格＝harga／भाव、關注＝Kegemaran（最愛）／मेरी सूची（我的清單）、中位數＝median／मध्य भाव。品牌名稱 AgriPrice、資料來源與授權標示（World Bank Pink Sheet、Rates By Exchange Rate API、DB-IP）照原文。
  - 退回：`SUPPORTED_LANGUAGES` 是 `zh-TW`、`en`、`ms`、`hi`；i18next 的 `fallbackLng` 是英文，所以 ms／hi 缺的 key 執行時顯示英文。`locales.test.ts` 只要求 zh-TW 與 en 的 key 完全相同；ms／hi 只檢查沒有英文沒有的 key、變數與英文相同，並在測試輸出印出涵蓋率（例：`ms.json: 232/232 keys (100.0%)`）與缺的 key，不會失敗。型別上 zh-TW 仍要有全部英文的 key，ms／hi 是「每個 key 都可以沒有」的同一棵樹（`PartialStrings`），別的分支加了 zh-TW／en 的 key，合併後 ms／hi 不用同時補，之後再補翻譯即可。
  - 資料名稱仍只有 `{zh-TW, en}`：`pickText` 本來就是「介面語言 → 英文 → 第一個非空值」，ms／hi 顯示英文名稱（例：「Nashik district के भाव」）。
  - 單複數照各語言的規則：馬來文只有 `_other`；印地文 0 和 1 都用 `_one`（「0 मंडी」「1 मंडी」「3 मंडियाँ」）。
  - 「More・其他」的語言（孟加拉文等）仍標「→ English・尚未提供」。
- 理由：翻譯與其他分支可以各自進行，合併時不會因為缺翻譯而擋住；使用者永遠看得到字（最差是英文），不會看到 key。
- 影響：`frontend/src/i18n/{languages,index}.ts`、`locales/{ms,hi}.json`、`locales.test.ts`。之後加字串：zh-TW 與 en 一定要加；ms／hi 可以晚點補，測試輸出會列出還缺哪些。

## 2026-09-20 主要語言的清單與順序
- 情況：02 §5.1 原本是三個語言（繁中、English、हिन्दी），手機語言排第一；T33 決定設定的語言清單和首次設定相同。多了 Bahasa Melayu 後要決定位置；要不要依國家調整順序，文件沒寫。
- 決定：
  - 主要語言四個，預設順序照草圖再加上馬來文：繁體中文、English、हिन्दी、Bahasa Melayu（圖示字母 `M`、紫色）。手機語言是其中之一時排第一並標「手機語言」。
  - 首次設定的語言畫面還不知道國家（位置推測在背景查，回來時再重排會讓焦點跳動），只用「手機語言 → 預設順序」。
  - 設定的語言清單（國家已知）：手機語言 → 該國的語言 → 其餘照預設順序；四個都一直列出。國家的語言：印度 English、हिन्दी；馬來西亞 Bahasa Melayu、English、繁體中文；台灣 繁體中文、English（`COUNTRY_LANGUAGES`）。
  - 首次設定的語言畫面多一列，「More・其他」變成第 5 項（數字鍵 5）。
- 理由：手機語言最可能是使用者讀得懂的；國家已知時，把當地常用的語言往前放，少按幾下。
- 影響：`frontend/src/i18n/languages.ts`（`mainLanguages(phone, country)`）、`screens/settings/LanguageSettings.tsx`；docs/02 §5.1。

## 2026-09-20 馬來文、印地文的數字與日期
- 情況：數字的 locale 依國家是【決定】（03 §7）；印地文等 locale 可能用自己的數字（`mr-IN` 預設是天城文數字）。日期的字要有馬來文、印地文；7 日走勢的 X 軸原本把星期名稱截成 1 字（中文）或 2 字（英文），天城文會被截壞（शनि → शन）。
- 決定：
  - 數字仍用國家的 locale（不改【決定】）；所有 `Intl.NumberFormat` 都加 `numberingSystem: 'latn'`，任何語言都是 0–9。印度的 `en-IN` 和 `hi-IN-u-nu-latn` 的結果相同，所以印地文使用者看到的分組不變。
  - 日期：馬來文「Sab 19/9」、印地文「शनि 19/9」（CLDR 的星期縮寫）；資料時間照當地習慣日在前「19/9 11:40」（繁中、英文維持「9/19 11:40」）；月份用 CLDR 縮寫（Ogo、अग॰）。
  - 新增 `date.weekdayInitials`（四個字串檔都有），走勢圖直接用，不再截字：繁中「日…六」、英文「Su…Sa」和原本相同；馬來文「Ah…Sa」；印地文用 CLDR 的 narrow（र、सो、मं、बु、गु、शु、श）。休市的「休」：馬來文沿用英文的 X，印地文寫 बंद。
- 理由：價格在任何語言下都讀得一樣；日期照使用者的習慣；截字對組合字母的文字不安全。
- 影響：`frontend/src/lib/{format,change,monthly,dates}.ts`、`i18n/dateLabels.ts`、`screens/crop-detail/TrendTab.tsx`、`screens/debug/DebugComponents.tsx`；docs/03 §7。

## 2026-09-20 天城文的字型與字級
- 情況：字型堆疊只有 Roboto、Noto Sans TC、Noto Sans，天城文要靠瀏覽器自己挑備用字型；128×160 的字級下限是 10px（中文 11px），天城文有上下的母音符號與連字，10px 很難讀。雲端 Chromium 有哪些字型還沒驗證（08 §12）。
- 決定：
  - 字型堆疊在 `sans-serif` 前加上 `'Noto Sans Devanagari'`，不自備字型檔：Cloud Phone 官方支援印地文介面，雲端應該有天城文字型；本機與 CI 的 Chromium 有 Noto Sans Devanagari。到 Simulator 用 `/debug/viewport` 的 प्याज 樣本確認；沒有的話再自備子集（用 `unicode-range`，只有出現印地文時才載入）。
  - 128×160 的印地文比照中文：`:root:lang(hi)` 把說明列與小標籤放大到 11px；e2e 的字級檢查對天城文字元也要求 11px。別的介面語言裡的中文或天城文（語言清單的名稱與圖示字母「中」「अ」）加上 `lang` 屬性，`[lang|='zh']`、`[lang|='hi']` 在 128×160 至少 11px。
- 理由：天城文的筆畫密度和中文一樣高；寫明字型名稱，排版結果才固定、可測。
- 影響：`frontend/src/styles/tokens.css`、`frontend/e2e/checks.ts`；docs/03 §3.2、docs/08 §12。

## 2026-09-20 馬來文、印地文放不下的字串
- 情況：e2e 的版面與字級檢查全部通過後，逐頁看兩種尺寸的截圖並量字串寬度，發現幾處被省略號截掉的是數字或單位（03 §7：數字永遠不截斷）；128×160 的馬來文右軟鍵「Kembali」是一個長字，寬度等於字本身，跑到中間軟鍵底下（往左溢出不會讓 footer 變寬，原本的檢查抓不到）。
- 決定：
  - 縮短（括號內是原本的字）：馬來文 本地區市場卡「{{count}} pasar tempatan」（…di kawasan ini）、最高最低「Maks X · Min Y」（Tinggi／Rendah）、較前一交易日「vs hari lalu」（vs hari dagangan lepas）、比 7 日均價「vs 7 hari」（vs purata 7 hari）、距離「{{km}} km lurus」（去掉括號）、設定列「Kawasan」（Kawasan saya）、右軟鍵「Balik」（Kembali）、關注「Kegemaran」與全部作物「Tanaman」（Senarai saya／Semua tanaman）、分類「Kacang」「Biji minyak」「Lain」「Terkini」（Kekacang／Bijian minyak／Lain-lain／Baru dilihat），最近使用的地區也用「Terkini」。印地文 本地區市場卡數字放前面「{{count}} स्थानीय मंडियाँ」（इस क्षेत्र में …）、最高最低「ऊँचा X · नीचा Y」（अधिकतम／न्यूनतम；走勢的高、低與國際參考價跟著改）、較前一交易日「पिछले दिन से」（पिछले कारोबारी दिन से）、比 7 日均價「7 दिन औसत से」（…के औसत से）、距離「{{km}} km सीधी」、比價的市場數一律「{{count}} मंडी」（像英文的 mkts）。
  - 仍用省略號、沒有再縮的：128×160 的地區名稱、詳情分頁「Banding」、部分分類名稱與比價說明列的最後一段，和英文的情況相同。
  - 軟鍵左右兩格加 `max-width: 100%`，太長時以省略號結尾，不會蓋住中間軟鍵；e2e 的版面檢查多一項「軟鍵互相重疊」。
- 理由：數字與單位要看得到；只換更短的說法，不縮字。
- 影響：`frontend/src/i18n/locales/{ms,hi}.json`、`frontend/src/components/SoftKeys/SoftKeys.module.css`、`frontend/e2e/checks.ts`。

## 2026-09-20 新聞清單照時間、額度花在清單上的那幾則
- 情況：使用者看新聞清單預期是新到舊，但原本把提到「我的地區」的排到最前面；而且摘要的額度是照抓取順序花的（伺服器上台灣存了 24 則、讀了 10 篇、產出 8 則摘要），清單只顯示 9 則，其中好幾則沒有摘要。
- 決定：
  - 清單（`GET /news` 與畫面）一律依發布時間新到舊，`area` 參數只用來回 `area_id` 與檢查地區；提到的地區仍在每則的 `area_ids`，資訊列照舊顯示我的地區。
  - worker 每個國家改成先算出「API 會回的那份清單」（同一個排序與上限：最近 7 天最新的 9 則，由 `repositories.news.list_items` 提供），只對其中還沒有摘要、且重試次數還沒到上限（2 次）的，由新到舊花額度；排在清單之外的只先存起來，等它排進清單再輪到它。每日額度（`NEWS_DAILY_ARTICLES`、`NEWS_DAILY_MODEL_CALLS`，預設各 30、滾動 24 小時、三國共用）與每次呼叫的間隔不變，所以實際買到的是每國每天最多 9 則摘要。
- 理由：新聞清單照時間才符合預期；額度只值得花在使用者真的會看到的那幾則。
- 影響：`backend/app/repositories/news.py`、`services/news.py`、`ingest/news/pipeline.py`、`api/v1/news.py`、`schemas/news.py`、`db/models.py`（新增 `NEWS_LIST_ITEMS`）、`frontend/src/screens/news/`、msw fixtures；docs/02 §5.9、docs/04 §6、docs/06 §1.6。
## 2026-09-20 馬來西亞擴充到濕巴剎回報足夠的每個縣
- 情況：使用者要求把馬來西亞的真實資料擴充到回報足夠的每個縣，原本 11 個地區的代號不變；「足夠」由資料決定並記下規則；每個縣要有真的中心座標。
- 決定：
  - 「足夠」＝過去 60 天全國有資料的日子裡，**超過一半的日子至少有 2 個濕巴剎回報**這 20 種作物。直轄區（吉隆坡、布城）各算一個縣（PriceCatcher 把吉隆坡分成國會選區）。用 7/23–9/20 的資料（56 天）算出 **75 個縣**（13 個州與 2 個直轄區，285 個濕巴剎）。分界很清楚：合格的縣最少也有 37 天，不合格的最多 8 天（Kuala Pilah），其餘 62 個縣只有 1 個或沒有濕巴剎回報（Labuan 也是）。原本 11 個都合格。
  - 地區清單寫在 seed，執行時不自動增減；要重算就照同一個規則用最新的月檔再算。
  - 名稱照 lookup 的縣名（例：Larut, Matang & Selama、Seberang Perai Utara），兩種語言都是英文；128×160 放不下時照原本的規則以省略號截斷，不另取簡稱。代號＝縣名的小寫英文字母（例：`larutmatangselama`）。州名照 PriceCatcher，Penang 照原本的例外。
  - 座標：追加的 64 個縣用 OpenStreetMap Nominatim 查一次（每秒最多 1 個請求，共 77 個請求），存在 seed：有同名市鎮就用市鎮（35 個），沒有就用 OpenStreetMap 給這個縣的點（28 個），Larut, Matang & Selama 用首府 Taiping。原本 11 個縣的座標不變（首府，和查到的點相差不到 20 公里）。
  - mock：追加的縣 `retail: true`、`lag: 0`、沒有市場，價格水準 `k` 用 7–9 月的真實資料算（每個作物、每天「縣的中位數 ÷ 各縣中位數的中位數」再取中位數）。Borong 2026 年沒有回報，追加的縣不加市場，原本的 7 個不變。
  - `coverage` 改成「15 個州與直轄區、75 個縣」。
  - 新聞（N1）原本假設一州一個地區，州名別名只給一個縣（例：Pahang→Kuantan）。改成州名別名給那個州的每一個縣（`backend/app/ingest/news/sources.yaml`；Sabah、Melaka、Perlis 是新加的州），標題寫 Pahang 的新聞，Bera、Kuantan、Temerloh 的使用者都會排在前面；縣名本身照原本的規則自動比對。
- 理由：規則只看資料、每個合格的縣都有 2 個以上的濕巴剎可取中位數；地區多了，位置推測與「附近最高／最低」也更準。
- 取捨：地區清單變長（75 個，照距離排序）；吉隆坡附近多了 Petaling Jaya、Petaling、Gombak 等縣，示範資料在批發模式下「附近」找不到有批發價的地區就不顯示。`PROVIDERS=mock` 每次執行的示範資料從約 7.7 萬列變成約 15.3 萬列（多出來的是馬來西亞 64 個縣的零售），用到 mock 的後端測試跟著變慢。
- 影響：`backend/app/seed/MY.yaml`、`backend/app/ingest/news/sources.yaml`、`backend/tests/ingest/test_seed.py`、`backend/tests/api/test_catalog.py`、`backend/tests/news/test_pipeline.py`、`frontend/src/test/fixtures/`（`make fixtures`）、docs/06 §1.5、§7.2、§7.4。

## 2026-09-20 PriceCatcher 的濕巴剎改從 lookup 讀
- 情況：原本 seed 列出 79 個濕巴剎的代號，新開的濕巴剎要改 seed 才會收；擴充後要列 285 個。使用者要求從 lookup 找出每個縣全部的濕巴剎。
- 決定：
  - seed 的 `source_maps.my_pricecatcher.areas` 改列縣（`州/縣`，例：`Selangor/Klang`；直轄區只寫州名），不列回報點；正規化先比 `州/縣`、再比州名。Borong 仍用代號對照成市場。
  - provider 每次執行先讀 `lookup_premise.csv`（約 480 KB），每一列都附上回報點的類型、州、縣（原始格式多三個欄位），只留下對照到的 Borong 與這些縣的濕巴剎。
  - lookup 留在 worker 程序的記憶體，之後帶 ETag 與 Last-Modified 問，沒變就 304、用留著的那份。它的驗證資訊不存進 `ingest_runs.files`：worker 重啟後手上沒有內容，304 沒有用，所以重啟後第一次需要時會多下載一次 lookup。平常的排程是 1 個 lookup 的 304 加 1–2 個月檔的 304。
  - mock 的零售列印一個虛構的濕巴剎（代號 `demo-<地區>`），附上 seed 的縣，和真實資料走同一個正規化；mock 與真實來源共用同一份縣的清單（YAML anchor）。
  - lookup 改了但月檔沒變時，新濕巴剎在已經下載過的日期的資料不會補進來，只從之後下載的日期開始收（`maps_hash` 只看 seed）。
- 理由：新開或改類型的濕巴剎不必改 seed；seed 只放「哪些縣」這個真正的決定。
- 取捨：一次執行對照得到約 21 萬列（原本約 6.4 萬），worker 記憶體最高約 250 MB。每次 worker 重啟後多一個約 480 KB 的請求。
- 影響：`backend/app/ingest/providers/my_pricecatcher.py`、`backend/app/ingest/normalize.py`、`backend/app/ingest/providers/mock.py`、`backend/tests/ingest/test_{my_pricecatcher,normalize,mock_provider,contract}.py`、`backend/tests/fixtures/my_pricecatcher/lookup_premise.csv`（改存全部的濕巴剎與 Borong）、docs/06 §1.5。

## 2026-09-20 國家可以宣告預設的價格類型
- 情況：馬來西亞的真實資料只有零售，新使用者選了馬來西亞卻先看到批發的「—」。之前記為【待確認】（見「PriceCatcher：零售取濕巴剎的中位數、沒有批發價」），使用者決定馬來西亞預設零售。
- 決定：
  - seed 的國家設定加 `default_price_type`（`wholesale` 或 `retail`，不寫就是 `wholesale`），同步到 `countries.default_price_type`（migration `5c1e7a9d2b40`，down_revision `23655d2e487a`（新聞的 migration）），`GET /countries` 回傳。只有 `MY.yaml` 寫 `retail`，印度、台灣不改。
  - 前端選國家時（首次設定、接受推測的位置、之後在設定更改國家）把價格類型換成那個國家的預設；再選同一個國家不變；之後照樣用 `*` 切換，每次切換都存起來。
- 理由：新使用者第一眼就看到有資料的價格；已經在用的人不受影響（只有換國家時才套用）。
- 影響：`backend/app/seed/schema.py`、`backend/app/db/models.py` 與 migration、`backend/app/ingest/seed.py`、`backend/app/services/catalog.py`、`backend/app/schemas/catalog.py`、`frontend/src/store/settings.ts`、`frontend/src/api/schema.d.ts`、docs/02 §1、docs/04 §5、§7。

## 2026-09-20 馬來西亞加上茄子；香蕉與芒果加不了
- 情況：跨國比同一種作物的功能要求三國的作物清單有交集，還缺香蕉、芒果、茄子（協調者要求）。
- 決定：只加**茄子**（`eggplant`，PriceCatcher 的 TERUNG BULAT `1923`，以 1 公斤計價，52 個縣有報價，60 天裡 17 天有資料≈每週兩次，中位數 RM 9.00；示範資料 `p: 6.2`、`rt: 1.45`、`lag: 2`，和印度共用圖示）。**香蕉與芒果不加**：香蕉（PISANG BERANGAN 18、PISANG EMAS 19）以公斤計價，但 7/23–9/20 濕巴剎一列都沒有（只有超市、迷你市場、雜貨店報）；`lookup_item.csv` 裡沒有生鮮芒果（只有芒果汁 `1340`）。要有這兩種就得收超市價，和「零售＝濕巴剎的中位數」的決定衝突，交給團隊決定。
- 影響：`backend/app/seed/MY.yaml`、`backend/tests/fixtures/my_pricecatcher/lookup_item.csv`（多一列 1923）、`backend/tests/ingest/test_{seed,my_pricecatcher}.py`、`frontend/src/test/fixtures/`、docs/06 §7.3。
## 2026-09-20 跨國比價：各國參考價卡片（使用者要求，改掉【決定】）
- 情況：00 的決定表原本寫「比價範圍：只在同一個國家內比較各地區；不做跨國比價」。使用者要求在作物詳情的比價頁加一張卡片，讓人看得出本地價格是高還是低。
- 決定：
  - 00 的「比價範圍」那一列改成「地區排名只在同一個國家內；另外在比價頁加一張各國參考價卡片」，並標明是 2026-09-20 使用者要求改的；「不做」那一列刪掉「跨國比價」。
  - **全國價**＝那個國家在自己最新交易日、各地區價的中位數，附地區數（和地區價標市場數同一個做法），不另外發明算法。
  - 每一行標那個國家報的是批發還是零售：優先用使用者選的那一種，沒有就用另一種（馬來西亞只有零售）。批發與零售不混算。
  - 換算用 B5 已經存好的 `fx_rates`（美元中轉），畫面寫匯率日期；用到多個幣別時取最舊的一天。缺價格是 `no_data`、缺匯率是 `no_fx`，都顯示「—」與原因。
  - 哪些作物有跨國資料由 catalog 決定（同一個 `crop_id` 出現在幾個國家），不寫死作物清單。
  - 有 Pink Sheet 序列的作物（rice、wheat、maize、soybean→soybeans、sugarcane→sugar）最後加一行世界銀行世界價，標成國際參考、不是國家。
  - 其他國家都沒有這項作物時，卡片只寫一行「其他國家沒有這項作物的報價」，不畫空卡片、不顯示 0。
  - 卡片是資訊，不可選（焦點清單不變），128×160 每國一行。
  - 走現有的 `GET /crops/{crop}/compare`（多一個 `other_countries` 欄位），不開新端點、不加新表。
- 理由：農夫要判斷的是「我這裡算貴還是便宜」，全國中位數＋既有匯率就夠，而且不必新增資料管線；卡片不可選，按鍵操作不變。
- 影響：`backend/app/services/crosscountry.py`（新）、`app/services/prices.py`、`app/repositories/{catalog,intl,prices}.py`、`app/schemas/prices.py`、`frontend/src/screens/crop-detail/OtherCountriesCard.tsx`（新）、`CompareTab.tsx`、四個字串檔、關於頁；docs/00、02 §5.4、04、06 §4.1。
## 2026-09-20 台灣補齊所有果菜市場、依真實資料重選作物
- 情況：台灣原本 10 個縣市、14 個市場、21 種作物（沿用草圖加上追加的），接真實資料（B2）後東勢、溪湖、永靖、南投、台東的交易都對照不到，稻米、紅豆、芝麻沒有資料，評審無法用農業部的資料逐一核對。使用者決定：地區＝FarmTransData 裡有果菜批發市場的縣市，市場＝資料裡全部的果菜市場，作物依最近 60 天的實際覆蓋重選（約 24–30 種、每類最多 9 種）。
- 決定：
  - 抓一次最近 60 天的全部蔬果交易（2026-09-20，20 個請求、間隔 1 秒、15 萬列）。果菜市場共 19 個（台北市場、台南市場是花卉市場，只有休市公告），分屬 13 個縣市：新增彰化縣（溪湖、永靖）、南投縣（南投）、台東縣（台東），台中市多東勢。原本的代號都保留，預設地區仍是台北市。
  - 作物 29 種：每個品項算「各縣市有交易的天數 ÷ 該縣市交易日數」的平均，挑高的、最近兩週仍有交易的國產品種。只收一個品種的規則不變（辣椒改成紅小，覆蓋較高）。去掉稻米、紅豆、芝麻、毛豆、落花生、甘蔗、香菇、芒果；清單見 06 §7.3。
  - 菇類不單獨成類：只在 5–6 個縣市有交易（37–45%），比選進來的都低。
  - mock 的 `p`／`lo`／`hi` 取 60 天所有市場平均價／下價／上價的中位數，`arr` 取一個市場一天交易量的中位數；故意放的例外（嘉義昨天、宜蘭 3 天前、花蓮無資料、豐原無資料、雲林與屏東沒有零售、甘藷昨天、空心菜 3 天前、花椰菜與空心菜沒有零售）都留著。前 13 種作物照原本的順序，預設關注不變。
  - 市場距離：每個市場在 seed 給大約座標（依公開地址在 OpenStreetMap 查，查不到門牌的用同一條路），seed 同步時由座標算到地區中心的直線距離；seed 的市場只能給 `km`（示範的固定值）或座標其中一種。新縣市的中心是縣市政府所在地。
- 理由：評審打開農業部的網站，看到的市場與品項在 App 裡都找得到；每種作物在多數縣市都有價格，少出現「—」。
- 影響：`backend/app/seed/TW.yaml`、`backend/app/seed/schema.py`（市場座標）、`backend/app/geo.py`（直線距離移到這裡，`services/compare.py` 轉用）、`backend/app/ingest/seed.py`、測試（`test_seed.py`、`test_tw_moa.py`、兩個寫死甘藍價格的測試）、`frontend/src/icons/`（新畫 8 個圖示）、msw fixtures、e2e、docs/06 §1.2、§4、§7.2–7.4。

## 2026-09-20 每個國家自己的作物分類
- 情況：分類原本寫死七個（穀物、蔬菜、水果、豆類、香料、油籽、其他），九宮格還有「全部」。台灣的真實資料是果菜市場，沒有穀物、油籽，照七類分會有空格。使用者決定：每個國家可以在 seed 定義自己的分類（最多 8 個），沒定義的用現在的七個；九宮格是該國分類依序加「最近看過」，拿掉「全部」；分類名稱來自 API。
- 決定：
  - seed 的 `country.categories`：`id`、`name`（zh-TW、en）、`icon`（作物圖示代號）、`tone`（既有的色系之一）。最多 8 個、代號不重複、不能用 `recent` 與 `all`；作物的 `category` 必須是其中之一。沒寫就是預設七個（名稱、圖示、色系照原本的），所以印度、馬來西亞的 seed 不用改。每個分類 2–9 種作物（馬來西亞原本的例外不變），測試檢查。
  - 存在 `countries.categories`（jsonb，migration `5c3e1f7a9b20`，down_revision `5c1e7a9d2b40`），`GET /countries` 的每個國家多 `categories`。作物 API 不變（仍是 `category` 代號）。
  - 台灣六類：葉菜類（Leafy）、根莖類（Roots）、瓜類（Gourds）、花果菜類（Veg）、辛香料（Spices）、水果（Fruit）。英文名稱要短：128×160 的格子約放 6 個英文字母，「Fruit veg」會被截成「Fruit…」，和「Fruit」分不出來，所以花果菜類的英文用「Veg」。
  - 前端：九宮格用 API 的分類加「最近」，分類載入前不畫格子（焦點才會落在第一格）；作物清單的標題用 API 的名稱，`/cat/<代號>` 不是這個國家的分類（包括 `/cat/all`）就回首頁。作物圖示方塊與圖表的顏色由該國分類的 `tone` 決定（`useCountryData().toneOf`）；國際參考價的序列仍用預設七類的顏色。i18n 只留「最近」，分類名稱的字串拿掉。
- 理由：分類跟著各國的資料，九宮格不會有點進去是空的格子；分類名稱和作物名稱一樣由資料決定，新增國家不用改前端。
- 影響：`backend/app/seed/schema.py`、`backend/app/db/models.py`、migration、`backend/app/ingest/seed.py`、`backend/app/schemas/catalog.py`、`backend/app/services/catalog.py`；`frontend/src/components/categories.ts`、`CropIcon`、`screens/home/HomeScreen.tsx`、`screens/crop-list/CropListScreen.tsx`、各畫面的圖示顏色、`i18n/locales/*.json`；docs/02 §5.2–5.3、03 §3.1、04 §3、§7、06 §1.4。其他 agent 新增的語言檔若還有 `categories.cereal` 等字串，可以刪掉（只剩 `categories.recent` 有用到）。

## 2026-09-20 新聞變成首頁分頁、國際參考價變成九宮格的格子
- 情況：使用者決定把兩個入口從左軟鍵選單移到首頁：新聞成為第三個分頁（關注｜全部作物｜新聞），國際參考價成為九宮格裡原本「全部」的位置。
- 決定：
  - 九宮格＝該國分類（最多 7 個）＋國際參考價（藍、地球圖示 `globec`）＋最近看過，共最多 9 格；seed 的分類上限因此改成 7，`intl` 也是保留代號。
  - 新聞仍是 `/news`（詳情頁與行為不變），但畫面上多了和首頁一樣的分頁列（目前分頁是「新聞」）、左軟鍵選單、`#` 換地區，右軟鍵是「離開」（分頁用取代歷史）。首頁「全部作物」在最右欄按 ▶ 會到新聞，新聞按 ◀ 回到「全部作物」。
  - 選單拿掉「國際參考價」與「新聞」兩列，其餘各列的數字鍵不變（首頁 1–5、詳情頁 1–6）。i18n 的 `menu.intl`、`menu.news` 刪掉，新增 `categories.intl`（國際價／Global／Global／वैश्विक），四種語言都有。
- 理由：兩個入口原本藏在選單裡，使用者不容易發現；首頁的分頁與九宮格是最容易按到的地方。
- 影響：`frontend/src/screens/home/HomeScreen.tsx`、`screens/news/NewsListScreen.tsx`、`screens/shared/MenuSheet.tsx`、`focus/useGrid.ts`（多了 `onRightEdge`）、`components/categories.ts`、`icons/`（新圖示 `globec`）、四個語言檔、相關測試與 e2e；`backend/app/seed/schema.py`（分類上限 7、保留 `intl`）；docs/02 §3.1、§3.2、§5.2、§5.8、§5.9、docs/03 §4。

## 2026-09-20 台灣保留芒果，三國共同的作物
- 情況：跨國比價卡（另一條線）需要三個國家有共同的作物；台灣依覆蓋率重選後少了芒果。
- 決定：台灣加回芒果（愛文，覆蓋率 42%，產季尾聲），共 30 種。三國共同的 12 種是番茄、甘藍、辣椒、蒜頭、洋蔥、馬鈴薯、胡蘿蔔、薑、香蕉、芒果、小黃瓜、茄子（代號相同）。芒果的示範價格改成真實中位數 81.1 元／公斤（原本 55 元）。
- 理由：跨國比較要用同一個代號；覆蓋率低的那一種在沒有交易的縣市照原本的規則顯示「—」。
- 影響：`backend/app/seed/TW.yaml`、測試的作物數、docs/06 §7.3。
