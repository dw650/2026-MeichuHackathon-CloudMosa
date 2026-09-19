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
