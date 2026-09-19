# 08 Cloud Phone 平台限制

> 本 App 會用到的平台事實與限制。來源是 CloudMosa 官方文件（2026-09-18～19 查閱）與工作坊筆記。
> 較早、較完整的查核筆記在 [`problem/cloudphone-tech-by-self.md`](problem/cloudphone-tech-by-self.md)；兩者衝突時以本文為準。
> 官方文件入口：<https://developer.cloudfone.com/docs/>（工作坊給的 `developer.cloudphone.tech` 目前回傳 503）。

## 1. 運作方式【查核】

- App 的 HTML、CSS、JS 在 **CloudMosa 機房的 Chromium** 上執行，畫面轉成向量繪圖指令（PVGL）送到手機；手機是 thin client，只顯示畫面、回傳按鍵。
- 所以 React 等現代框架都能用，也**不需要 SSR**。手機效能不是瓶頸，**網路往返和畫面更新**才是：4G 良好時峰值約 20 FPS，每次畫面更新都有一次網路往返。
- **手機流量取決於畫面更新量，不是 API 資料量**。後端回傳的 JSON 大小不影響手機流量；持續的動畫、跑馬燈、自動刷新會一直耗流量。
- App 以公開的 **HTTPS 網址**提供，不是安裝 APK。

## 2. 螢幕與版面

| 項目 | 內容 | 狀態 |
|---|---|---|
| 必要尺寸 | 240×320（QVGA），我們的主要設計尺寸 | 【查核】 |
| 加分尺寸 | 128×160（QQVGA）；官方上架指南要求兩種都支援 | 【查核】 |
| 官方設計指引 | header 高 40（QVGA）／20（QQVGA）；內文 16、註腳 12（QQVGA 為 12、10）；字型 Roboto | 【查核】，但單位標為 pt，對應多少 CSS px 【待確認】 |
| 深色偏好 | `prefers-color-scheme` 永遠回傳 `light`；`prefers-reduced-motion` 永遠是 `no-preference` | 【查核】 |
| 系統狀態列 | 畫面上方是否被系統狀態列占用，官方文件互相矛盾 | 【待確認】，版面一律用實際 `innerHeight` 計算 |
| viewport | 使用 `<meta name="viewport" content="width=device-width, initial-scale=1">` | 【查核】 |

## 3. 按鍵與事件【查核】

以 `keydown` 的 **`event.key`** 判斷，不要用 `keyCode`。

| 實體鍵 | `event.key` | 備註 |
|---|---|---|
| 方向鍵 | `ArrowUp`、`ArrowDown`、`ArrowLeft`、`ArrowRight` | 長按會連續觸發（`event.repeat === true`） |
| 中間確認鍵 | `Enter` | |
| 左軟鍵 LSK | `Escape` | 可自訂，慣例是開選單 |
| 右軟鍵 RSK | **不是鍵盤事件** | 預設等於 `history.back()`，沒有上一頁就關閉 App。新版平台可用 `window.addEventListener('back', …)` 並呼叫 `preventDefault()` 攔截 |
| 0–9 | `'0'`–`'9'` | |
| `*` | `'*'` | |
| `#` | `'#'` | keyCode／code 和數字 3 相同，**只能靠 `event.key` 分辨** |
| 撥號、掛斷 | `Call`、`EndCall` | 不使用。掛斷由系統處理，會直接離開 Cloud Phone |

**本 App 的返回策略【決定】**：每個畫面（包括底部面板）都對應一筆瀏覽歷史，RSK 靠 `history.back()` 就能正確返回。`back` 事件是否支援要實機確認（目標機出廠版本較舊），所以**不依賴它**；確認可用後，也只拿來處理不需要歷史的本地狀態，不和歷史機制重複返回。

## 4. 文字輸入

- 原生輸入法是類似 T9 的多按輸入，可能跳出全螢幕編輯器，很難用。【查核】
- **本 App 的 baseline 完全不需要打字**：語言、國家、地區、作物都用清單和數字鍵選。【決定】

## 5. 不能用的能力【查核】

- 觸控、游標、滑鼠 hover
- GPS／Geolocation（官方列為開發中）
- 推播通知、背景同步、背景執行
- Service Worker、離線使用（manifest 會被忽略）
- 多分頁、彈出視窗
- `alert`、`confirm`、`prompt`：一律自己做畫面內的對話框或面板
- Web Speech API、Web Audio

## 6. 能用的能力【查核】

- `fetch`、XHR、WebSocket、SSE、Web Worker
- Canvas、SVG、WebGL（WebGPU 不支援）
- HTML `<audio>` 播放（語音播報加分項用伺服器產生音檔再播放）
- `Intl`（數字、貨幣、日期格式化；`en-IN` 會用 lakh 分組 1,23,450）
- `localStorage`（約 5 MB，**存在 CloudMosa 雲端**，跨 session 保留）、`sessionStorage`、IndexedDB、Cookies
- `sms:`、`tel:` 連結（需用 `navigator.hasFeature('SmsScheme')` 等偵測；`sms:` 能否預填內文未記載）
- `navigator.hasFeature(name)`：回傳 `Promise<boolean>`，一般瀏覽器沒有這個方法，要先判斷

## 7. Session 與生命週期【查核】

- 閒置一陣子後 session 會結束，`onbeforeunload` **可能**會觸發，但不可靠；沒有固定的閒置秒數。
- 沒有平台專用的 lifecycle API（不存在 `CloudPhone.init()` 之類的東西）。
- **本 App 的做法【決定】**：每次使用者完成一個動作（換地區、改設定、進入某頁）就立刻存進 `localStorage`；重新開啟時回到上次的畫面與焦點。不要等關閉時才存。

## 8. 網路

| 項目 | 內容 | 狀態 |
|---|---|---|
| 來源 IP | App 對後端的請求來自 CloudMosa 機房 | 【查核】 |
| 使用者 IP | 放在 HTTP 標頭 `X-Forwarded-For` | 【查核】 |
| `CF-IPCountry` | 會得到 CloudMosa 機房所在地，**不能用來判斷使用者位置** | 【查核】 |
| 快取 | 回應只在 session 期間快取於記憶體，離開 App 後清除 | 【查核】 |
| CORS、CSP | 仍照一般瀏覽器規則；本 App 前後端同一個網域，避開 CORS | 【決定】 |
| `navigator.onLine` | 不能代表手機本身的連線狀態 | 【查核】 |

## 9. 語言與時間【查核】

- 支援 25 種以上語言，包括印地文、孟加拉文、烏爾都文（由右到左）、越南文、中文。
- `navigator.language` 直接回報手機系統語言，各廠牌代碼不一定標準（例如 `tl-TL`）。
- 時區只提供 `Etc/GMT+N` 形式的固定偏移，**無法表示印度的 +5:30**。本 App 的日期一律由後端依國家算好當地交易日再傳給前端。【決定】

## 10. 目標裝置：itel NEO R60+【查核】

- 240×320、4G、2000mAh 電池。
- 出廠 Cloud Phone 版本 **2.5.0**（2024-11 上市，銷售市場：越南、孟加拉、巴基斯坦）。
- 檔案上傳需要 2.7.0 以上；震動、麥克風需要 3.0 以上，這台可能都不能用。本 App 不依賴這些能力。
- 比賽期間主辦方會提供實機。

## 11. Simulator 與實機測試【查核】

- **Simulator**：<https://www.cloudphone.tech/my/simulator>，需要註冊開發者帳號，只支援 Google Chrome，附遠端 DevTools（Elements、Console、Network）。
- Simulator **只能載入公開的 HTTPS 網址**，localhost 不行。
- Simulator 的限制：麥克風／相機、檔案上傳下載、音量控制不支援或無效；硬體與儲存相關行為可能和實機不同。
- **實機開發模式**：Cloud Phone 首頁按 LSK 進設定 → About → 連按 LSK 7 次 → 確認；到 <https://www.cloudphone.tech/my> 登記手機的 IMEI；重開 Cloud Phone 後，首頁會出現帶扳手圖示的測試 widget。

## 12. 實機待驗證清單【待確認】

拿到 Simulator 或實機後，先用除錯頁（見 [07](07-dev-workflow.md) 的 Phase 0）逐項確認，結果回填到本文。

| 項目 | 怎麼確認 | 確認不了時的做法 |
|---|---|---|
| 實際 viewport 大小、是否有狀態列 | 記錄 `innerWidth`、`innerHeight`、`devicePixelRatio` | 用 `innerHeight` 排版，高度不足時自動壓縮 header |
| 官方 pt 對應多少 px、12px 字是否讀得清楚 | 字級樣本頁 | 維持字級下限，只改 tokens |
| Roboto 900、中文、天城文字型 | 樣本頁（`/debug/viewport` 有 प्याज 樣本；字型堆疊已寫明 Noto Sans Devanagari，03 §3.2） | 改用 700；必要時自備字型子集（天城文可用 `unicode-range` 只在出現印地文時載入） |
| `*`、`#`、`Escape` 的 `event.key`；長按的 repeat 速度 | 按鍵記錄頁 | 只用 `event.key`；調整節流參數 |
| RSK 的 `back` 事件是否支援 | 開著面板時按 RSK，觀察 `back`／`popstate` | 全部靠歷史記錄返回（本 App 預設做法） |
| Enter 會不會觸發兩次 | 在按鈕上按 Enter，計算次數 | 統一只處理 `keydown` 或只處理 `click`，擇一 |
| `X-Forwarded-For` 的實際格式 | 後端除錯端點回傳收到的標頭 | 推測不到就直接讓使用者選國家與地區 |
| 閒置多久 session 會結束、重開後的狀態 | 閒置後重開 | 每個動作都存 `localStorage` |
| `Intl` 的 `en-IN`、`zh-TW` 格式 | 樣本頁 | 由後端格式化 |
| 按鍵到畫面更新的延遲 | 高速錄影或時間戳 | 減少重繪範圍、多用數字鍵捷徑 |

## 來源

- [Get Started（按鍵表、API 支援）](https://developer.cloudfone.com/docs/guides/get-started/)・[Cloud Phone Design（back 事件、深色建議）](https://developer.cloudfone.com/docs/guides/cloud-phone-design/)・[Architecture](https://developer.cloudfone.com/docs/guides/architecture/)・[Networking](https://developer.cloudfone.com/docs/reference/networking/)・[PWA](https://developer.cloudfone.com/docs/tutorials/progressive-web-apps/)・[Data Storage](https://developer.cloudfone.com/docs/reference/data-storage/)
- [Internationalization](https://developer.cloudfone.com/docs/reference/internationalization/)・[Feature Detection](https://developer.cloudfone.com/docs/reference/feature-detection/)・[Developer Tools](https://developer.cloudfone.com/docs/guides/developer-tools/)・[React 教學](https://developer.cloudfone.com/docs/tutorials/react/)・[itel NEO R60+](https://developer.cloudfone.com/device/itel_it9310/)
- [2026 Dev Guidelines](https://www.cloudphone.tech/dev-guidelines)・[2026 UI/UX Guidelines](https://www.cloudphone.tech/uiux-guidelines)
