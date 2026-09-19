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
