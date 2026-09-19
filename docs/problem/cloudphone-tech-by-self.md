# Cloud Phone Widget 技術參考：提供後續實作 Agent 使用

查核日期：2026-09-18。本文補充今年工作坊筆記，並非本隊產品的功能、架構或實作規格。

**檔名說明：本工作區實際檔案是 [`problem/notes.pdf`](notes.pdf)，沒有 `problem/note.pdf`。其標題及內容符合使用者指定的 2026 工作坊筆記，以下「今年筆記」均指這份檔案。**

## 1. 讀取順序、證據標籤與適用範圍

先讀今年筆記，再讀本文。遇到資訊衝突，不要用其他手機平台或參賽者的寫法覆蓋今年比賽限制。

| 標籤 | 意義 |
| --- | --- |
| **筆記確定** | 2026 工作坊已明示，本次比賽的基準。 |
| **官方確認** | 本次能讀到的 CloudMosa 官方頁面、開發文件或官方型別宣告有明確記載；不代表已在本次借用手機上驗證。 |
| **程式碼觀察** | 指定 repository 的特定版本確實如此撰寫；不等於官方規格、真機測試結果或程式正確性保證。 |
| **實作建議** | 依上述事實提出的工程處理方式，不是額外的平台要求。 |
| **待驗證** | 文件不足、互相矛盾，或需要實機／已登入的 Simulator 才能確認。 |

本次已讀取兩份本地 PDF、官方文件全文及四個參賽 repository 的相關原始碼。**未登入 Developer Program、未實際操作 Simulator、未取得 itel NEO R60+，也未執行參賽作品。** 下文不宣稱完成平台相容性測試。

### 官方文件其實有可用入口

- **直接 HTTP 查核：**`https://developer.cloudphone.tech/` 及該網域的 `/docs/guides/get-started/` 都回傳 503。
- **可讀取的官方替代網域：**[Cloud Phone for Developers 文件索引][docs]，本次直接取得 HTTP 200，並成功讀取下列各章。這是官方文件入口，不是第三方 mirror；[CloudMosa 官方型別 repository][types] 也連到該網域。
- **2026 官方說明仍可讀取：**[Cloud Widgets Development Guide][dev-guide] 標示更新於 2026-03-27；[UI & UX Design Guidelines][uiux] 標示更新於 2026-04-13。
- 本次已有直接可讀的官方資料，因此主要依據原站，沒有把搜尋摘要、不可驗證的 cache 或其他同名「Cloud Phone」產品當成規格。

### 今年筆記已確定，不必重新猜測

| 項目 | 本次實作必須遵守的基準 |
| --- | --- |
| 應用形式 | Cloud Phone Widget，即現代 Webapp。 |
| 顯示 | **240×320 必要；128×160 加分**。不能把加分尺寸誤寫成今年必要條件。 |
| 輸入 | **僅 Keypad、無觸控、無游標**。 |
| 可用操作 | 方向鍵、Enter、左右功能鍵／返回、0–9、`*`、`#`。實際事件見第 3 節。 |
| 導航 | 焦點明確、走訪順序可預測、每層可返回，適當使用數字捷徑與功能鍵標籤。 |
| 資源 | [Developer Program 登入][console-login]、Simulator；Ubuntu 24.04 主機及 SSH／root 資源；比賽提供 itel NEO R60+。 |
| 尚未公布的部分 | 筆記沒有說明「特定主題」內容；本文不能代替主辦方確認今年完整題目及評分規則。 |

[`2025-cloudmosa-problem.pdf`](2025-cloudmosa-problem.pdf) 用於理解定位和去年評分，不是今年規格的替代品。去年的技術評分列舉 PWA，不構成要求 Cloud Phone 支援離線的依據。

## 2. 與一般 Web App 的根本差異

**官方確認：CloudMosa 提供遠端瀏覽器，不是替開發者代管所有應用業務的雲端後端。** Widget 的 HTML／CSS／JavaScript 由 CloudMosa 的 Chromium 伺服器載入、執行並處理；手機端的 thin client 接收 PVGL 圖形指令並回傳輸入。它不是把整個 Android App 搬上手機，也不宜描述為單純串流網頁截圖或影片。[官方架構][architecture]

```text
按鍵手機上的 Cloud Phone client
        ↕ 輸入／畫面表示，必須連網
CloudMosa 的遠端 Chromium
        ↕ HTTPS / WSS
開發者自行託管的網站與服務
```

| 面向 | Cloud Phone 實際意義 | 證據 |
| --- | --- | --- |
| 語言與框架 | 現代 HTML、CSS、JS；官方有 React、Vue、Svelte 教學。不需要換成 KaiOS／Java ME 的程式。 | **官方確認**：[React][react]、[Vue][vue]、[KaiOS 遷移][kaios] |
| 打包 | 網站透過公開 HTTPS URL 存取，不是安裝 APK 或提交 KaiOS ZIP。 | **官方確認**：[2026 開發指南][dev-guide] |
| 框架生命週期 | React effects、Vue mounted/unmounted 仍按一般框架使用；它們不是 Cloud Phone 平台 lifecycle。 | **官方確認／程式碼觀察**：[官方 Vue sample][vue-sample] |
| 前端運算位置 | JavaScript 在遠端瀏覽器執行，手機 RAM 不等於 JS heap 上限。 | **官方確認**：[架構][architecture] |
| 存取裝置 | 桌面 Chromium 支援某 API，不代表手機硬體有對應能力。 | **官方確認**：[功能偵測][features] |
| 網路 | 手機到 CloudMosa、CloudMosa 到開發者網站，是不同鏈路；雲端抓取 1 MB JSON 不等於手機耗用 1 MB。畫面更新也會消耗連線流量。 | **官方確認**：[Networking][networking] |
| 離線、背景 | 不能離線使用，也不能在背景常駐執行。 | **官方確認**：[PWA 差異][pwa] |
| 按鍵與焦點 | RWD 不會自動補上方向鍵導航；必須處理焦點、選取、返回與文字編輯的分工。 | **筆記確定／官方確認**：[React 導航教學][react] |

**實作建議：**可以用熟悉的 Web stack；不要因手機低階就主動退回十年前的 JavaScript。也不要因雲端執行就忽略渲染頻率、連線往返或焦點操作成本。CloudMosa 沒有承諾無限 CPU／記憶體。實際 Chromium 版本應讀取 Simulator／實機的 User-Agent，不能把文件中的範例版本寫死。

TypeScript 仍需正常編譯為 JavaScript。Next.js 等框架若另有伺服器端渲染，`window`／`document`／Cloud Phone 擴充能力應在瀏覽器端初始化；CloudMosa 的「遠端瀏覽器渲染」與應用框架的 SSR 是不同層次。元件庫標榜 keyboard accessible，也不保證只用方向鍵、不靠 Tab 就能操作，須逐個檢查。

## 3. 實體按鍵、DOM 事件與返回

### 3.1 官方按鍵對照

下表是**官方確認的文件對照，不是本次實機量測**。主要依 `keydown` 的 **`event.key`** 判斷；`keyCode` 僅供查核舊碼。原始表：[Get Started → Keyboard Keys][get-started]。

| 實體鍵 | `event.key` | 官方列出的 `keyCode` | 官方列出的 `code` | 處理方式 |
| --- | --- | --- | --- | --- |
| 左功能鍵 LSK | `Escape` | 27 | `Escape` | 可程式化；慣例為選單／選項。 |
| 上 | `ArrowUp` | 38 | `ArrowUp` | 移動焦點或捲動。 |
| 下 | `ArrowDown` | 40 | `ArrowDown` | 同上。 |
| 左 | `ArrowLeft` | 37 | `ArrowLeft` | 同上；編輯文字時另有游標語意。 |
| 右 | `ArrowRight` | 39 | `ArrowRight` | 同上。 |
| 中央確認鍵 | `Enter` | 13 | `Enter` | 啟動選中項目。 |
| 0 | `0` | 48 | `Digit0` | 輸入或目前畫面的捷徑。 |
| 1–9 | `1`–`9` | 49–57 | `Digit1`–`Digit9` | 同上。 |
| 星號 | `*` | 106 | `NumpadMultiply` | 比較 `key === '*'`。 |
| 井號 | `#` | 51 | `Digit3` | **與數字 3 共用表列 keyCode/code，不能只據此辨認。** |
| 右功能鍵 RSK | **不是一般鍵盤事件** | 不適用 | 不適用 | 預設上一筆 history；無上一筆則退出 widget。新版文件有 `window` 的 `back` 事件。 |
| 撥號鍵 | `Call` | 0 | `Power` | 官方額外列出，但今年筆記沒有將它列為必要可用鍵；不要讓核心操作依賴它。 |
| 掛斷鍵 | 不提供可攔截的標準操作 | 不適用 | 不適用 | `EndCall` 由 OS 用來退出 Cloud Phone，不能覆寫。 |

**不要將 KaiOS 的 `SoftLeft`／`SoftRight`，或參賽碼裡的 `F12`、`LSK`、`Shift`、`Backspace`，直接視為 Cloud Phone 的正式 soft-key 事件。** 桌面模擬可以自行映射，但須與正式輸入來源分開。

### 3.2 RSK 的新舊文件差異

**官方確認：**[2026 開發指南][dev-guide] 說 RSK 不是 keyboard event，預設依 history 返回／關頁。[較完整的 Design Guide][design] 及 [官方 `BackEvent` 型別][types-back] 則明示：

- 用 `window.addEventListener('back', handler)` 接收返回。
- `event.preventDefault()` 可以攔截預設返回。
- 沒有攔截時，history 無可返回項目便退出；也可用 `window.close()` 主動退出 widget。

**版本差異：**2025-01 的 [Vue sample README][vue-readme] 還寫「不能覆寫 RSK」；2025-12 的官方型別已記載 `back`。因此不能照抄舊 sample 的限制，亦不能假定所有歷史 client 都支援新事件。**本次未找到 `back` 最低 client 版本或官方專用偵測名稱，R60+ 的實際支援仍待驗證。** `navigator.hasFeature('BackEvent')` 不是官方列出的探測方式。

**實作建議：**頁面層優先沿用 router／History API；確定 `back` 可用後，再用它處理需先關閉的本地狀態。下面只示範事件契約，`hasOpenLayer`／`closeOpenLayer` 由應用提供，不是 SDK：

```js
function bindBackForLocalLayer(hasOpenLayer, closeOpenLayer) {
  function onBack(event) {
    if (!hasOpenLayer()) return; // 讓平台自行返回／退出
    event.preventDefault();     // 必須在同步事件處理階段攔截
    closeOpenLayer();
  }
  window.addEventListener('back', onBack);
  return () => window.removeEventListener('back', onBack);
}
```

使用上要注意：

1. **一次只選一套返回策略。** 若 overlay 已對應一筆 history，應靠 history/popstate 關閉；不要又在 `back` 手動關閉，留下假的 history entry。上例只適合沒有額外 history entry 的本地圖層。
2. 不支援 `back` 的 client，要讓 overlay 也有可返回的 history 狀態，並在 history 改變時還原畫面。不能只改 React/Vue state，卻假設 RSK 會知道要關選單。
3. `popstate` 是 history 改變後的通知；不能把它當成可取消的 `back` 事件。避免反覆 push history 把使用者困在 app。
4. 若要先等自製確認框，先同步 `preventDefault()`，再等待使用者選擇。不要 `await` 之後才攔截事件。
5. 一般桌面分頁可能拒絕 `window.close()`；桌面表現不能證明 Cloud Phone 的關頁行為。實機要分別確認退出 widget、回到 Cloud Phone 首頁、掛斷離開 Cloud Phone。

### 3.3 焦點與事件分工

下列是**實作建議**，以今年筆記、官方導航教學及標準 DOM 事件為基礎：

- 以 `keydown` 處理導航，用 `input`／`change` 接收文字值；不靠 `keypress` 或單看 keyCode。
- 使用 `<button>`、`<a>`、`<input>` 等可聚焦元素。若自行做 list/grid，維護穩定 item ID，更新真正的 DOM focus，勿只有視覺高亮。
- 初次進頁、非同步內容載入、返回上一頁及關閉對話框後，都要指定有效焦點。刪除目前項目後移至合理鄰項；空列表也要能返回。
- 明確指定目前哪一層擁有按鍵：對話框／選單／頁面，避免同一個 Enter 同時作用於兩層。框架卸載時移除 listener。
- 只有處理了該按鍵才 `preventDefault()`。若自訂方向移動，就同時避免瀏覽器捲動造成雙重反應。
- **Enter 僅啟動一次。** 原生 button/link 可透過正常 `click` 處理鍵盤啟動；若另外在 `keydown` 主動 `.click()`，須攔截預設啟動，避免重複送出。不要一邊全域 Enter 執行動作、一邊讓原生 click 再執行。
- 官方記載長按方向鍵會產生 `repeat`；導航可接受重複，確認／送出通常須擋住長按重複，並防止等待期間再次啟動。[Design Guide][design]
- 捲動要跟隨實際焦點，可用 `scrollIntoView({ block: 'nearest' })`，但須避免固定底列遮住選中項。不要把「每按一次捲 50px」當成完整的 focus navigation。
- 桌面沒有滑鼠也要完成所有操作。Tab 只能輔助開發，不能作為目標裝置的必要操作。

## 4. 文字輸入與數字捷徑：不能把 T9 當桌面鍵盤

**官方確認：**Cloud Phone 有原生 IME。依 client 能力，輸入時可能開啟全螢幕文字編輯器，也可能在保留欄位可見性的情況下顯示輸入介面。以 `navigator.hasFeature('EmbeddedTextInput')` 查詢平台能力。[Feature Detection][features]

**實作建議：**先使用原生 HTML 輸入元件及 IME。編輯時不要用全域 0–9、`*`、`#` 快捷鍵搶走文字輸入；也不要把 Backspace 無條件當上一頁。實際輸入法可能消化按鍵，DOM 不一定會看見每一下實體按鍵。

例如全域捷徑可先排除一般文字編輯目標；這是示意 helper，還須配合當前選單與 IME 狀態：

```js
function isTextEditing(event) {
  const el = event.target;
  return event.isComposing || (
    el instanceof HTMLElement && (
      el.isContentEditable ||
      el.matches('input:not([readonly]):not([disabled]), textarea:not([readonly]):not([disabled])')
    )
  );
}
// 一般全域數字捷徑：若 isTextEditing(event) 為 true，交給輸入元件。
```

平台有非標準屬性 `x-puffin-entersfullscreen="off"`。官方說禁用原生全螢幕輸入後，開發者必須自行處理按鍵與欄位值；它**不是免費獲得完整 T9 編輯器**。[官方屬性說明][features]

**待驗證／文件差異：**[官方型別註解][types-input] 對該屬性另寫了 EmbeddedTextInput 的適用限制，與參考頁的敘述不完全一致。不要將此屬性設為全站預設。R60+ 上的孟加拉文輸入、刪字、小數點、負號、`*`／`#` 切換模式、`inputmode` 效果、composition 事件順序及 IME 關閉後焦點都要實測。`inputmode="numeric"` 只能當提示，不能視為硬體行為保證。

## 5. 確實存在的 Cloud Phone 專用能力

**官方確認：**不是每個 widget 都需要 SDK 初始化。它是網站，加上若干非標準 API／屬性；未找到必須使用的 `CloudPhone.init()`、`onLaunch()`、`onShow()` 或 `onHide()` 契約，不要自行發明。

| API／屬性 | 已知契約 | 注意事項 |
| --- | --- | --- |
| `navigator.hasFeature(name)` | 回傳 `Promise<boolean>`；main thread／Web Worker 可用，名稱區分大小寫；未知名稱為 false。 | 必須 `await`，不能把 Promise 當布林值。一般瀏覽器可能沒有該方法。 |
| `window` 的 `back` event | 攔截 RSK 預設行為。 | 非 `KeyboardEvent`；最低 client 版本待確認。 |
| `navigator.volumeManager` | 官方型別有 `requestUp()`、`requestDown()`，控制系統音量。 | 不等於標準 media volume；Simulator 無效果。 |
| `navigator.volumeManager.requestShow()` | Multimedia 文件另有此方法，用來顯示音量 HUD。 | 本次讀取的官方型別沒有宣告它；使用前檢查方法，並實測。 |
| `x-puffin-entersfullscreen` | 控制原生全螢幕輸入行為。 | 見第 4 節，勿無條件禁用 IME。 |
| `x-puffin-playsinline` | 控制影片是否內嵌顯示。 | 多媒體專用，並非所有頁面都要設。 |

來源：[Feature Detection][features]、[Multimedia][multimedia]、[官方 TypeScript 宣告][types-file]。

官方列出的 feature names 為：`AudioCapture`、`AudioPlay`、`AudioSeek`、`AudioUpload`、`VideoCapture`、`VideoSeek`、`VideoUpload`、`EmbeddedTextInput`、`FileDownload`、`FileUpload`、`ImageUpload`、`SmsScheme`、`TelScheme`、`Vibrate`。[官方 feature 型別][types-features]

跨桌面與 Cloud Phone 的保守寫法：

```js
async function hasCloudPhoneFeature(name) {
  if (typeof navigator.hasFeature !== 'function') return false;
  try {
    return await navigator.hasFeature(name);
  } catch {
    return false;
  }
}
```

這裡的 false 表示「沒有確認 Cloud Phone 擴充能力」，**不表示桌面瀏覽器沒有等價標準 API**。如果是跨平台程式，需要另外處理標準 API。偵測為 true 也不是使用者已授權或硬體操作必然成功；真正呼叫仍需處理失敗。

TypeScript 專案可使用官方 `@cloudmosa-inc/cloudphone-types` 開發依賴。它是型別，不是 runtime SDK，也不會替桌面或舊手機補出缺少的 API。[官方安裝說明][types]

## 6. 啟動、離開、閒置與資料保存

### 平台 lifecycle 與一般頁面生命週期的界線

**官方確認：**Cloud Phone 是 single-tab 遠端瀏覽器；閒置一段時間後 session 會結束，不能在背景持續工作。官方只說 `onbeforeunload` **可能**呼叫，沒有給出可靠的關閉回呼或固定閒置秒數。Manifest 被忽略，不需 Service Worker；離線、Push、Background Sync 均不能當作現有基礎能力。[PWA 文件][pwa]

**實作建議：**正常進頁初始化、router 導航、元件 listener 清理仍按 Web 開發方式處理。將 `visibilitychange`／`pagehide` 視為觀察機會，不是「一定會執行的最後保存點」。重要進度應在操作完成時保存；不要等到掛斷、斷線或關頁才保存。這也符合瀏覽器對 [`beforeunload` 不可靠性的說明][beforeunload]。

**待驗證：**來電、鎖屏、切離、短暫斷線、重新開啟 widget 各自會保留還是重建 session，事件順序及實際 timeout 都沒有足夠資料。不能宣稱「重連必然回到原畫面」，也不能指定一個自行猜測的 session 有效期。

### Storage 的「local」實際上在 CloudMosa 雲端

下表為**官方確認**，來源：[Data Storage][storage]。

| 能力 | 官方描述 | 對實作的意義 |
| --- | --- | --- |
| `localStorage` | 支援、跨 session 保存；5 MB 限制。 | 仍要處理額度／寫入錯誤。 |
| `sessionStorage` | 重新載入仍在；退出 Cloud Phone app 後清除。 | 不能當永久資料。widget 返回首頁與整個 app 退出的細節另測。 |
| IndexedDB | 支援；無固定公布 quota，單一 blob 不超過 50 MB，仍可出現 quota error。 | 不是無限儲存承諾。 |
| Cookies | 支援標準 cookie 行為。 | 同源、HttpOnly、SameSite 等仍有意義。 |
| `navigator.storage.persist()` | 一律 false。 | 不能要求不可清除的永久保存。 |
| `navigator.storage.estimate()` | 回報 quota 可能高於實際可存額度。 | 不能拿它當容量保證。 |
| 平台 Clear Data | 可清除 Cloud Phone 管理的儲存與 cookies。 | 不會因此刪除開發者自己後端的業務紀錄。 |

儲存由 CloudMosa 雲端處理，裝置保有加密所需的 key；不等於把 app 的資料庫下載到手機。因此 localStorage／IndexedDB 可用與「可離線運作」沒有等號。

**官方確認：**HTTP response cache 是 session 期間的暫存，退出後會清除，不跨使用者共用。[Networking → Caching][networking] 不要把 PWA 頁面的「取得最新版本」解讀成每次請求都完全無 cache。

## 7. Viewport、CSS、文字與渲染

### 顯示尺寸與官方矛盾

使用標準 viewport：

```html
<meta name="viewport" content="width=device-width, initial-scale=1">
```

**官方確認：**PWA／Design 章說 widget 全螢幕、不含 system status bar；但 **2026 UI/UX 頁仍說 header 在 status bar 下方**。[PWA][pwa]、[Design][design]、[2026 UI/UX][uiux]

**待驗證：**究竟是文件示意沿用、client 差異，還是平台 UI 有變，不能只靠這些頁面判定。實作先使用實際 viewport，記錄 `innerWidth`、`innerHeight`、`devicePixelRatio`；真機確認狀態列／IME 是否占用可見範圍。不要先固定扣掉一個猜測的 20px 或 24px 系統列。

### 在兩種解析度下的實作建議

- 240×320 與 128×160 各自重排，不以 `transform: scale(...)` 壓縮整個介面。
- 小尺寸基礎樣式直接生效，不要只寫以 640px 起跳的手機 breakpoint。注意 `min-width`、固定寬度及第三方元件的預設 padding。
- 頁首、內容及自製 soft-key bar 都消耗畫面高度。可用 layout flow／grid 排列；若底列 fixed，內容須預留高度，避免焦點移到被遮住的位置。
- 預設 body margin、flex child 的 `min-width`／`min-height`、overflow、長字串和多位數字，都可能使 128px 畫面無法操作。不要以極小字級隱藏溢位問題。
- 使用明顯的 `:focus`／`:focus-visible`。不能只提供 `:hover` 提示；關鍵數值、單位、動作與返回標籤必須可讀。
- 官方字級表使用 `pt`，不要誤當成同數值的 CSS `px`。字型尺寸與 header 高度是設計指引，不是渲染器強制值。
- 桌面顯示的英文字寬不能代表孟加拉文。測試 glyph fallback、組合字元、行高、換行與數字格式；圖示也須能辨認，不能假設初次上網者懂所有抽象符號。

**官方確認的其他差異：**目前文件說 `prefers-color-scheme` 回傳 light、`prefers-reduced-motion` 為 no-preference，沒有對應的使用者系統選項。若服務需要主題／降低動態偏好，不能只依賴這兩個 media query。[Design Guide][design]

**官方確認：**Canvas、WebGL 可用，WebGPU 未支援。文件所述約 20 FPS 是良好連線下的觀察，不是固定上限或保證。雲端渲染不適合假設穩定高幀率；canvas 不宜先畫超大畫布再縮小。[Graphics Rendering][graphics]

## 8. 網路、硬體與多媒體相容性

### 網路與來源識別

**官方確認：**`fetch`、XHR、WebSocket、SSE 可使用；HTTPS／WSS 為基礎。CORS、SOP、CSP 仍按瀏覽器規則運作，雲端執行不會讓跨來源限制消失。來源 IP 通常是 CloudMosa 資料中心；官方說使用者 IP 由 `X-Forwarded-For` 提供。Network Information API 不能準確代表手機鏈路。[Networking][networking]

**實作建議：**

- 手機斷線不等於遠端 Chromium 到自家 API 也同時斷線；不要只據 `navigator.onLine` 或 API 請求成功就宣稱手機已收到結果。
- 本機 `localhost` 不會自動變成遠端 Cloud Phone 可連的測試站；進 Simulator 前需有其可存取的公開 HTTPS 位址。
- CDN 的 GeoIP 結果可能是資料中心所在地。XFF 也不能無條件信任，須按自家可信代理鏈處理，不能拿來當身分驗證。
- 若遇 WAF、CAPTCHA 或 rate limit，先檢查是否把共享資料中心出口視為同一個人／機器人。不要為了相容就關閉所有防護。[官方 Security 說明][security]

### 能力表

| 能力 | 官方資料的狀態 | 目前應採取的做法 |
| --- | --- | --- |
| HTML／CSS／JS、React／Vue | 支援現代 Web 與框架。 | 不代表任意第三方元件已能 keypad-only 操作。 |
| Service Worker、離線、背景同步、推播 | 本次文件列未支援。 | 不作為核心依賴。[PWA][pwa] |
| GPS／Geolocation、WebRTC、Web Speech | Get Started 列尚未支援。 | 不能假設可定位、即時通話或用瀏覽器語音辨識。[API availability][get-started] |
| 檔案上／下載 | Get Started 列 client 2.7.0+。 | 查 `FileUpload`／`FileDownload` 及實機；不能用 Simulator 的結果代替。[API availability][get-started] |
| 麥克風／MediaDevices、震動 | Get Started 列 client 3.0+。 | 查能力並處理權限／硬體失敗；不能看到方法存在就認定可用。[API availability][get-started] |
| `sms:`／`tel:` | 有官方 feature names。 | 這是啟動裝置對應操作的能力，不是任意讀取簡訊、通訊錄或靜默代發簡訊的權限。[Feature Detection][features] |
| `alert`／`confirm`／`prompt` | 舊版官方 Getting Started 的相容性表列不支援。 | 採 keypad 可操作的 DOM 對話框；是否有新版變更列入實測，不引用舊表宣稱已量測。[舊入門頁][old-start] |
| pop-up／多分頁 | single-tab。 | 不依賴 popup 登入或多視窗流程。[Storage][storage] |

**與本次手機直接相關：**官方 [Itel NEO R60+ 頁面][itel] 記載 2024-11 發行機型的 Cloud Phone 版本為 **2.5.0**。這只能當歷史機型資料，不能推定 2026 借用裝置已升至 2.7／3.0，也不能推定完全沒升級。先讀實機 About 版本，再測功能。該機型頁的一般行銷用語不會覆蓋今年「按鍵型手機、無觸控」規格。

### 若後續需要影音

**官方確認：**音訊可用 HTML audio；Web Audio 不支援。`HTMLMediaElement.volume` 無效，改用 Volume Manager；音量 HUD 開啟時上下鍵由系統調音量。影片預設全螢幕，可用前述 inline 屬性。播放速度固定正常速度；seek 的 `currentTime` 變更有節流，並應偵測 AudioSeek／VideoSeek。Media Source Extensions 不支援，不能預設依賴 MSE 的播放器一定運作。[Multimedia][multimedia]

這些只是平台能力參考，不代表本隊題目需要加入錄音、影片或其他功能。

### 語言與時間

**官方確認：**支援 Unicode、`Intl` 及瀏覽器語言資訊；但裝置回報的 locale 可能不完整。變更系統語言要先離開 Cloud Phone，所以不能期待執行中收到 `languagechange`。時區可能只有 `Etc/GMT...` 固定 offset，而非地區時區名稱。[Internationalization][i18n]

**實作建議：**允許選擇語言；不要從資料中心 IP 自動鎖定語言。需要判斷有效期限的資料，採一致時間基準，不依賴手機時鐘或自行解析 `Etc/GMT` 的正負號。

## 9. 開發、測試與發布的通用方式

這裡說明平台接入方式，不規劃本隊的 deployment 或產品架構。

1. **本機開發：**普通 Web 專案。Chrome Responsive viewport 設定兩種尺寸，用方向鍵、Enter、Esc、數字、星號與井號測操作；右功能鍵可用瀏覽器返回模擬。[2026 開發指南][dev-guide]
2. **公開測試站：**將網站託管於可公開存取的 HTTPS URL。SPA history mode 須由主機支援路由 fallback，或採合適的 hash routing；這是一般託管問題，不是 Cloud Phone 必須使用 hash 的規定。[React 教學][react]
3. **Developer Program：**登入後登記測試 widget；連同名稱、URL、icon。網站內容由開發者主機提供，平台提供載入、測試與分發。[首次發布][publish]
4. **Simulator：**[入口][simulator]，本次未登入存取會轉至登入頁。官方說目前用 Google Chrome，提供 Elements、Console、Network 等遠端 debugger。桌面 DevTools 和遠端 widget debugger 不是同一個執行環境。[Developer Tools][tools]
5. **實機：**Cloud Phone 首頁 → LSK 設定 → About → LSK 七次 → 確認；在 developer account 登記測試 IMEI，重開 Cloud Phone 後找帶扳手圖示的未發布 widget。選單版本差異以當年裝置為準。[Developer Tools][tools]
6. **正式分發：**開發模式可測試不等於已公開上架。官方首次發布指南描述聯絡平台、經初步與合作夥伴測試後發布；比賽是否只要開發模式展示，須依主辦方要求。[首次發布][publish]

**Simulator 限制，官方確認：**麥克風／相機、檔案上傳／下載、Volume Manager 有不支援或無效果的情況，不能用它驗證所有硬體能力。也不能把「桌面 Chrome 240×320 可操作」寫成「R60+ 已可用」。[Developer Tools][tools]

**Icon 文件差異：**首次發布頁寫 80×80、≤1 MB；2026 UI/UX 頁要求 baseline 512×512。兩者不能合併成單一確定上傳規格。保留 512×512 不透明 PNG 原稿，依當前 Console 的實際限制產生需要的版本；未登入 Console，本文不宣稱已確認最終欄位驗證。[首次發布][publish]、[2026 UI/UX][uiux]

## 10. 四個過往作品：可學習的處理方式與不可照搬的假設

本次以各 repository 預設分支的 HEAD 進行靜態閱讀，固定版本如下。這些觀察不是得獎認證或實機成功證明，也不要求沿用其框架版本。

| Repository | 本次查閱 commit | 前端實際依賴 |
| --- | --- | --- |
| [CloudNest](https://github.com/mch-cloudmosa-team4/CloudNest) | `4ae0dd5f0b63351abc96deb0e6796de1048972cd`，2025-10-12 | Vue 3、Vue Router、Pinia、Vite。 |
| [CloudMosa_Hackathon / CoinMind](https://github.com/awkward-willy/CloudMosa_Hackathon) | `8def488492389a3800a7e4cb804aa2d304fb0e4c`，2025-09-21 | Next.js 15、React 19、Chakra UI。 |
| [CloudMosa-2025-MeichuHackathon](https://github.com/YuanWang08/CloudMosa-2025-MeichuHackathon) | `46d08f1805f10bd45276a1fc80752b7555fa3762`，2025-09-21 | Vue 3、TypeScript、Pinia、vue-i18n、Vite。 |
| [meichuhackathon](https://github.com/cca814/meichuhackathon) | `bdaafae072a9841bde9d6988603882a2de2eaafb`，2025-09-21 | React 19、React Router、Vite。 |

### CloudNest

**程式碼觀察：**[App.vue 的導航處理](https://github.com/mch-cloudmosa-team4/CloudNest/blob/4ae0dd5f0b63351abc96deb0e6796de1048972cd/frontend/src/App.vue#L297) 用 `event.key`、選取 index、ArrowLeft／ArrowRight、Enter、Escape 控制選單；掛載／卸載時增刪全域 listener。部分內容採固定步長捲動。框架證據：[package.json](https://github.com/mch-cloudmosa-team4/CloudNest/blob/4ae0dd5f0b63351abc96deb0e6796de1048972cd/frontend/package.json)。

**可學習：**將按鍵轉成明確選取狀態與導航動作。**不可推論：**同檔也保留 touch/hover 處理，這不能成為今年手機有觸控的證據；程式碼存在也不證明每頁皆可只用按鍵完成。

### CoinMind

**程式碼觀察：**[KeyboardHandler.tsx](https://github.com/awkward-willy/CloudMosa_Hackathon/blob/8def488492389a3800a7e4cb804aa2d304fb0e4c/frontend/app/components/KeyboardHandler.tsx#L25) 在 capture phase 監聽，依選單是否開啟決定處理按鍵或交給頁面。[NavigationContext.tsx](https://github.com/awkward-willy/CloudMosa_Hackathon/blob/8def488492389a3800a7e4cb804aa2d304fb0e4c/frontend/app/components/NavigationContext.tsx#L84) 集中選單狀態、選取及 router.push。依賴見 [package.json](https://github.com/awkward-willy/CloudMosa_Hackathon/blob/8def488492389a3800a7e4cb804aa2d304fb0e4c/frontend/package.json)。

**可學習：**集中管理鍵盤與頁面層級。**不可照搬：**它用 F12 畫右鍵高亮，但程式也提到 F12 是桌面 DevTools；不是 RSK 真機 key 的可靠來源。Next.js 可用也不代表平台要求 SSR。

### CloudMosa-2025-MeichuHackathon 廣播 App

**程式碼觀察：**[App.vue](https://github.com/YuanWang08/CloudMosa-2025-MeichuHackathon/blob/46d08f1805f10bd45276a1fc80752b7555fa3762/frontend/src/App.vue#L26) 區分 editable target、確認框、選單及頁面；有移除 listener、讓輸入中的 Backspace 刪字，以及關閉確認框後阻擋後續 keyup 的處理。[依賴檔](https://github.com/YuanWang08/CloudMosa-2025-MeichuHackathon/blob/46d08f1805f10bd45276a1fc80752b7555fa3762/frontend/package.json)。

**可學習：**需要處理編輯模式、事件優先權與重複啟動；單一全域 switch 不足以解決所有頁面。**不可推論：**F12／Backspace 返回是該專案的映射；它並未證明平台一定發送這些鍵。其 keyup workaround 也不是所有瀏覽器都必須照抄的規格。

### meichuhackathon

**程式碼觀察：**[navigation.jsx](https://github.com/cca814/meichuhackathon/blob/bdaafae072a9841bde9d6988603882a2de2eaafb/frontend/src/components/navigation.jsx#L69) 用數字鍵直接導航、React refs 與 focus；選單鍵處理寫成 `LSK`／`Shift`。[Home.jsx](https://github.com/cca814/meichuhackathon/blob/bdaafae072a9841bde9d6988603882a2de2eaafb/frontend/src/page/Home.jsx#L82) 使用 `x-puffin-playsinline`。[依賴檔](https://github.com/cca814/meichuhackathon/blob/bdaafae072a9841bde9d6988603882a2de2eaafb/frontend/package.json)。

**可學習：**數字捷徑與特有影片屬性的實際使用。**不可照搬：**`LSK`／`Shift` 不能取代官方的 `Escape`；[handleKey.js](https://github.com/cca814/meichuhackathon/blob/bdaafae072a9841bde9d6988603882a2de2eaafb/frontend/src/route/handleKey.js) 還有元件外 hooks 等可疑碼，不能當成熟基底。

### 官方 sample 的參考價值

[Vue SoftKeyBar][vue-softkeys] 使用 Escape／Enter；[OptionsMenu][vue-options] 展示方向鍵、真實 focus、listener 清理，以及選單與 history 的串接。可參考責任分工，但 README 對 RSK 的說明已舊；sample 不是可直接保證符合 2026 裝置的相容性套件。

## 11. 開始實作前與拿到實機後，必須保留的驗證清單

這是**平台相容性驗證**，不是本隊功能清單。

| 待確認事項 | 為何不能現在當作事實 | 驗證方式 |
| --- | --- | --- |
| R60+ client、Chromium 版本 | 歷史機型頁與今年借用機不一定相同。 | About、User-Agent，記錄日期與機型。 |
| RSK 的 `back` | 已有官方契約，最低 client 版本不明。 | 在有／無 history、開啟選單時按 RSK；記錄 back/popstate；測 preventDefault。 |
| 退出與 lifecycle | 沒有固定 timeout／可靠 onExit 契約。 | 返回首頁、掛斷、閒置、斷網／重連、重開，分別記錄事件與資料。 |
| `*`／`#`、長按、Enter 啟動次數 | IME 與裝置版本可能影響事件。 | 記錄 key、code、keyCode、repeat、target；對照 click 次數。 |
| 原生 IME | 語言與全螢幕／embedded 模式有差異。 | 孟加拉文、數字、刪字、取消、確認、返回及焦點恢復。 |
| 240×320／128×160 可用範圍 | 官方 status bar 敘述互有差異。 | 量測 viewport/DPR，查看各列是否遮擋。128×160 可先用 Simulator。 |
| 字型 | Unicode 可用不等於每種字在小螢幕都可讀。 | 實際語言、長名稱、多位數及組合字元。 |
| Storage 行為 | quota 不是固定服務保證。 | reload、退出 app、重開、Clear Data；使用可丟棄測試資料。 |
| 硬體擴充 | Simulator 與實機能力不同。 | 需要時才測 hasFeature 加真正操作。 |
| Icon／發布流程 | 文件規格有差異，尚未登入 Console。 | 查看實際欄位，依主辦方當年指示測試與提交。 |
| 主機外部 URL／憑證／網路 | 筆記只確認有提供主機。 | 拿到資訊後確認公開 HTTPS 存取，不預設 domain 或 port。 |

除錯時可以在暫時的事件記錄頁觀察 `keydown`、`keyup`、`input`、`change`、`compositionstart/end`、`back`、`popstate`、`visibilitychange`、`pagehide`。記錄事件型別、目前 focus、URL／history 狀態與 viewport；**原生 IME 可能讓部分實體鍵不經過 DOM，沒有事件不能直接解讀為按鍵壞掉。**

完成這些檢查後，應將實測版本、觀察及與文件的差異補回本文，而不是讓後續 Agent 再憑記憶重猜。

## 12. 來源索引

以下網頁均於 2026-09-18 查閱；頁面若沒有明確更新日，不把搜尋引擎的 crawl 日期當規格版本。程式碼使用固定 commit 連結。

| 來源 | 主要用途 |
| --- | --- |
| [CloudMosa 公司官網](https://www.cloudmosa.com/)／[Cloud Phone 官網](https://www.cloudphone.tech/) | 遠端瀏覽器、雲端卸載與數位近用定位。 |
| [官方文件總覽][docs] | 503 時可用的官方替代入口。 |
| [2026 Cloud Widgets Development Guide][dev-guide] | Web 標準、RSK 預設、公開 HTTPS、桌面測試。 |
| [2026 UI & UX Guidelines][uiux] | Icon 與視覺指引，亦保留和其他文件的差異。 |
| [Get Started][get-started]／[Architecture][architecture] | key/code 表、硬體 API、遠端執行模型。 |
| [Cloud Phone Design][design] | back、焦點、渲染與顯示差異。 |
| [Feature Detection][features]／[官方型別][types-file] | 特有 API、feature 名稱與自訂屬性。 |
| [PWA][pwa]／[Data Storage][storage] | 不支援離線／背景、session 與儲存。 |
| [Networking][networking]／[Privacy & Security][security] | 網路來源、HTTPS、CORS、cache。 |
| [Graphics Rendering][graphics]／[Multimedia][multimedia] | 繪圖、影音與效能邊界。 |
| [Internationalization][i18n] | 語言、時區與國際化差異。 |
| [React 教學][react]／[Vue 教學][vue]／[KaiOS 遷移][kaios] | 框架、路由與其他 feature-phone 平台的差異。 |
| [Developer Tools][tools]／[首次發布][publish]／[R60+][itel] | Simulator、實機開發模式、發布、機型歷史版本。 |
| [MDN KeyboardEvent.key][keyboard-key]／[beforeunload][beforeunload] | 標準 Web 事件背景，不用來取代 Cloud Phone 自訂映射。 |

[docs]: https://developer.cloudfone.com/docs/
[dev-guide]: https://www.cloudphone.tech/dev-guidelines
[uiux]: https://www.cloudphone.tech/uiux-guidelines
[console-login]: https://www.cloudphone.tech/auth/sign-in
[simulator]: https://www.cloudphone.tech/my/simulator
[get-started]: https://developer.cloudfone.com/docs/guides/get-started/
[architecture]: https://developer.cloudfone.com/docs/guides/architecture/
[design]: https://developer.cloudfone.com/docs/guides/cloud-phone-design/
[tools]: https://developer.cloudfone.com/docs/guides/developer-tools/
[publish]: https://developer.cloudfone.com/docs/guides/your-first-widget/
[features]: https://developer.cloudfone.com/docs/reference/feature-detection/
[storage]: https://developer.cloudfone.com/docs/reference/data-storage/
[networking]: https://developer.cloudfone.com/docs/reference/networking/
[multimedia]: https://developer.cloudfone.com/docs/reference/multimedia/
[i18n]: https://developer.cloudfone.com/docs/reference/internationalization/
[graphics]: https://developer.cloudfone.com/docs/advanced/graphics-rendering/
[security]: https://developer.cloudfone.com/docs/advanced/privacy-security/
[pwa]: https://developer.cloudfone.com/docs/tutorials/progressive-web-apps/
[react]: https://developer.cloudfone.com/docs/tutorials/react/
[vue]: https://developer.cloudfone.com/docs/tutorials/vue/
[kaios]: https://developer.cloudfone.com/docs/tutorials/kaios/
[itel]: https://developer.cloudfone.com/device/itel_it9310/
[old-start]: https://www.cloudfone.com/getting-start
[types]: https://github.com/cloudmosa/cloudphone-types
[types-file]: https://github.com/cloudmosa/cloudphone-types/blob/cb1ff74e6e4b14e367965290db23b92bd978c89d/types.d.ts
[types-back]: https://github.com/cloudmosa/cloudphone-types/blob/cb1ff74e6e4b14e367965290db23b92bd978c89d/types.d.ts#L82
[types-input]: https://github.com/cloudmosa/cloudphone-types/blob/cb1ff74e6e4b14e367965290db23b92bd978c89d/types.d.ts#L215
[types-features]: https://github.com/cloudmosa/cloudphone-types/blob/cb1ff74e6e4b14e367965290db23b92bd978c89d/types.d.ts#L60
[vue-sample]: https://github.com/cloudmosa/cloudphone-vue-sample
[vue-readme]: https://github.com/cloudmosa/cloudphone-vue-sample/blob/f3788f0aeefb87974da4648dbf4fb4e045a3a309/README.md#L53
[vue-softkeys]: https://github.com/cloudmosa/cloudphone-vue-sample/blob/f3788f0aeefb87974da4648dbf4fb4e045a3a309/src/components/SoftKeyBar.vue#L31
[vue-options]: https://github.com/cloudmosa/cloudphone-vue-sample/blob/f3788f0aeefb87974da4648dbf4fb4e045a3a309/src/components/OptionsMenu.vue#L26
[keyboard-key]: https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/key
[beforeunload]: https://developer.mozilla.org/en-US/docs/Web/API/Window/beforeunload_event
