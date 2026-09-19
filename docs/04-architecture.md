# 04 系統架構

> 服務怎麼組成、前後端怎麼分層、API 契約、資料表、容錯做法、資料夾結構。套件選擇見 [05](05-tech-stack.md)；資料的算法見 [06](06-data.md)。

## 1. 系統圖

```
 按鍵手機 ──畫面／按鍵── CloudMosa 機房的 Chromium
                              │ HTTPS（X-Forwarded-For: 使用者 IP）
                              ▼
 ┌──────────────── docker compose（一台 VM）────────────────┐
 │  web：Caddy 2                                              │
 │   ├─ /        → React 建置後的靜態檔                       │
 │   └─ /api/*   → api:8000                                   │
 │                                                            │
 │  api：FastAPI ──────────┐                                  │
 │   routers → services → repositories                        │
 │                          ▼                                 │
 │  db：PostgreSQL 16 ◀──── worker：排程抓取                  │
 │   （volume）              providers → 正規化 → 檢查 → 彙整 │
 │               mock｜tw_moa｜my_pricecatcher｜in_datagov    │
 │                           B5：Pink Sheet＋匯率             │
 └────────────────────────────────────────────────────────────┘
                                 │（加分項）
                                 ▼
     data.moa.gov.tw、storage.data.gov.my、api.data.gov.in
                 worldbank.org、open.er-api.com（B5）
```

- **單一網域**：前端與 API 同一個 HTTPS 來源，沒有 CORS、沒有混合內容問題（往屆作品的常見錯誤）。
- **讀寫分離**：worker 負責寫入（抓取與彙整），api 只讀；抓取失敗不影響 API。
- **mock 也是 provider**：baseline 用 `mock` provider，真實資料只是加上 `tw_moa`、`my_pricecatcher`、`in_datagov`，管線其他部分不變。

## 2. Docker Compose 服務【決定】

| 服務 | image | 內容 | 對外 |
|---|---|---|---|
| `db` | `postgres:16` | 資料放在 named volume；有 healthcheck | 不對外 |
| `api` | 自建（`backend/Dockerfile`） | 啟動前跑 `alembic upgrade head`；uvicorn | 不對外，由 web 轉發 |
| `worker` | 同 `api` 的 image，不同指令 | APScheduler：啟動時執行一次 seed 與 mock 產生，之後依排程；新聞每天 00:00（各國當地時間）抓一次（[06](06-data.md) §1.6） | 不對外 |
| `web` | 自建（`frontend/Dockerfile`：多階段，Node 建置 → `caddy:2` 放入 `dist/` 與 `Caddyfile`） | HTTPS、靜態檔、轉發 `/api` | 本機 8080；正式環境 80、443（`compose.prod.yaml`） |

- 所有服務 `restart: unless-stopped`；`api`、`worker` 在 `db` healthy 後才啟動。
- 設定全部走環境變數，範本在 `.env.example`；真正的 `.env` 不進 Git。

| 變數 | 用途 | 預設 |
|---|---|---|
| `SITE_ADDRESS` | Caddy 的站台位址。本機只用 HTTP；正式環境填網域，Caddy 自動申請 HTTPS | `:8080` |
| `WEB_PORT`、`DB_PORT` | 本機對外的埠號（網頁、給本機測試連的資料庫）；兩個 worktree 同時開發時各用不同的值 | `8080`、`5432` |
| `POSTGRES_PASSWORD`、`DATABASE_URL` | 資料庫連線 | — |
| `PROVIDERS` | 啟用的資料來源，逗號分隔：`mock`、`tw_moa`（台灣改用農業部真實批發價，見 [06](06-data.md) §1.2）、`my_pricecatcher`（馬來西亞改用 PriceCatcher 真實零售價，見 [06](06-data.md) §1.5） | `mock` |
| `INTL_PRICES` | worker 下載國際參考價（B5：世界銀行 Pink Sheet 與匯率，只在到期時下載，見 [06](06-data.md) §8）；`false` 不下載 | `true` |
| `PINK_SHEET_URL` | 固定使用的 Pink Sheet 月資料檔；空白＝用官方頁上目前連結的檔案（[06](06-data.md) §1.3） | 空 |
| `DEMO_MODE` | 開啟 demo 開關（F18） | `false` |
| `GEOIP_DB_PATH` | IP 地理資料庫檔案路徑（DB-IP Lite City，免註冊；檔案不存在時位置推測回傳 `null`） | `/data/geoip/city.mmdb` |
| `DATAGOV_API_KEY` | 印度 data.gov.in 金鑰（B3） | 空 |
| `NEWS_SOURCE` | 新聞來源（worker）：`google`（Google 新聞搜尋，需要對外 HTTPS）、`demo`（固定的示範新聞，不連網；`make e2e` 用）、`off` | `google` |
| `GEMINI_API_KEY`、`GEMINI_MODEL` | 新聞摘要用的 Gemini 免費額度金鑰（Google AI Studio）與模型（預設 `gemini-3.5-flash-lite`）；沒設定就不做摘要，只顯示標題 | 空 |
| `SUMMARY_API_BASE`、`SUMMARY_MODEL`、`SUMMARY_API_KEY` | 自架模型的 OpenAI 相容端點（例：`http://host.docker.internal:11434/v1`），有設定時先用它，Gemini 當備援 | 空 |

### 2.1 開發環境

`compose.dev.yaml` 疊在 `compose.yaml` 上：

- `web` 改用開發用的 `Caddyfile.dev`：`/` 轉發到 Vite dev server、`/api` 轉發到 api，**開發時也是同一個來源**。
- 加一個 `frontend-dev` 服務跑 Vite（HMR），原始碼用 bind mount。
- `api` 用 `--reload`，原始碼用 bind mount。
- 常用指令包在 `Makefile`（`make up`、`make dev`、`make test`、`make e2e`、`make types`），指令內容見 [07](07-dev-workflow.md)。

## 3. 請求流程與使用者 IP

1. Cloud Phone 的 Chromium 發出請求，標頭 `X-Forwarded-For` 帶著手機的 IP（[08](08-platform-constraints.md)）。
2. Caddy 預設**不信任**外部傳來的 `X-Forwarded-For`，會用連線來源（CloudMosa 機房）覆蓋。所以 Caddy 另外把原始標頭原封不動轉成 `X-Client-Forwarded-For` 交給 api：
   ```
   reverse_proxy /api/* api:8000 {
       header_up X-Client-Forwarded-For {http.request.header.X-Forwarded-For}
   }
   ```
3. api 從 `X-Client-Forwarded-For` 取**最左邊的公開 IP**，查本機 mmdb，找最近的地區（[06](06-data.md) §6）。
4. 這個 IP 只用來推測位置，而且使用者一定會確認；即使被偽造也只影響自己的推測結果，所以不做更嚴格的信任設定。實際格式要在 Simulator 上確認【待確認】。

## 4. 前端架構

### 4.1 分層

| 資料夾 | 職責 | 不可以做 |
|---|---|---|
| `screens/` | 一個畫面一個資料夾：組合元件、決定軟鍵、`#` 的功能、焦點清單 | 直接呼叫 `fetch`、直接讀 `localStorage` |
| `components/` | 純顯示元件（Shell、InfoBar、Card、Tabs、Sheet、TrendChart…），props 進、畫面出 | 讀 store、呼叫 API |
| `keys/` | 全域按鍵分派與「按鍵範圍堆疊」 | 知道任何畫面的細節 |
| `focus/` | 焦點管理：清單、九宮格、依 ID 還原 | — |
| `store/` | Zustand：使用者設定、session 狀態，全部 persist | 存 API 回傳的價格資料 |
| `api/` | API client、產生的型別、TanStack Query 的 query 定義 | — |
| `lib/` | 純函式：單位換算、數字與日期格式、漲跌方向 | 有副作用 |
| `i18n/` | i18next 初始化與字串檔 | — |

### 4.2 按鍵【決定】

- 全 App 只有**一個** `keydown` 監聽器（掛在 `window`），依 `event.key` 分派給**按鍵範圍堆疊的最上層**：畫面在最下面，打開的面板在上面。面板打開時按鍵不會穿透到畫面。
- 每個範圍用宣告的方式註冊：`useKeys({ onUp, onDown, onLeft, onRight, onEnter, onMenu, onStar, onHash, onDigit })`。
- `event.repeat` 為真時，只有方向鍵處理，其他鍵忽略。
- `Enter` 只在 `keydown` 處理並 `preventDefault()`，避免和按鈕的 `click` 重複觸發（實機待驗證，見 [08](08-platform-constraints.md) §12）。
- 按鍵處理完都要 `preventDefault()`，避免瀏覽器預設捲動。
- 左軟鍵 `Escape` 打開選單。右軟鍵不是按鍵事件，靠歷史返回（§4.3）。

### 4.3 路由與歷史【決定】

每個畫面、每個面板都對應一筆瀏覽歷史，右軟鍵的 `history.back()` 自然就會「關閉面板 → 回上一頁 → 在首頁時離開」。

| 路徑 | 畫面 |
|---|---|
| `/setup/lang`、`/setup/langs`、`/setup/locate`、`/setup/country`、`/setup/area` | 首次設定（F01） |
| `/?tab=watch｜all` | 首頁（F02） |
| `/cat/:catId` | 作物清單（F03） |
| `/crop/:cropId/:tab`（`trend`、`today`、`compare`）`?area=` | 作物詳情（F04） |
| `/crop/:cropId/markets?area=`、`/crop/:cropId/markets/:marketId` | 本地區各市場、單一市場（F05） |
| `/areas?for=home｜view` | 完整地區清單（F07） |
| `/watch`、`/settings`、`/settings/:item`、`/about` | 編輯關注、設定、關於（F09–F11） |
| `/intl`、`/intl/:seriesId` | 國際參考價清單與單一序列（B5，從左軟鍵選單進入） |
| `/news`、`/news/:newsId` | 新聞清單、新聞內容（N1，[02](02-product-spec.md) §5.9） |

- **面板**用查詢參數表示（`?sheet=menu｜area｜sort`），打開時 `push`，關閉時 `history.back()`。
- **分頁**切換用 `replace`，不新增歷史（[02](02-product-spec.md) §4）。
- 詳情頁「正在看的地區」放在網址 `?area=`，不改 store 裡的「我的地區」；返回時自然恢復。
- **重新開啟（F13）**：啟動時如果 store 有上次的路徑，先把歷史換成首頁，再 `push` 上次的路徑，這樣右軟鍵仍然能回到首頁，而不是直接離開。
- 未知的路徑一律導回首頁。

### 4.4 焦點【決定】

- 可選的項目帶 `data-focus-id`（例如 `crop:onion`、`area:pune`），焦點用真正的 DOM `focus()`，並設 `tabIndex={-1}`。
- `focus/` 提供 `useFocusList(ids)` 與 `useGrid(ids, cols)`，處理 ↑ ↓、九宮格的 ◀ ▶、1–9 直接開啟、移動後捲到可見範圍。
- 每一筆歷史（`location.key`）記住上次的焦點 ID，存在 store；返回時依 ID 還原，ID 不存在時落在第一項。
- 捲動規則見 [03](03-ux-ui.md) §5。

### 4.5 狀態與資料【決定】

| 狀態 | 放哪裡 | 內容 |
|---|---|---|
| 使用者設定 | Zustand `settings`（persist） | 語言、國家、我的地區、最近 3 個地區、關注清單、批發／零售、單位 |
| session | Zustand `session`（persist） | 上次的路徑、每筆歷史的焦點 ID、最近看過的作物 |
| 伺服器資料 | TanStack Query | 價格、清單、比價；不 persist |

- persist 帶版本號；解析失敗或版本不符時執行遷移函式，失敗就重設成預設值並回到首次設定，**不能讓壞掉的 `localStorage` 卡死 App**。
- 每次設定改變就立刻寫入（Zustand persist 預設行為），符合「每個動作都存」（[08](08-platform-constraints.md) §7）。
- TanStack Query：逾時 10 秒（`AbortController`）；失敗重試 1 次；`staleTime` 5 分鐘；保留上一次的資料（`placeholderData: keepPreviousData`）。有舊資料時顯示舊資料並標示，沒有才顯示錯誤畫面（[02](02-product-spec.md) §6）。
- 不自動輪詢；使用者從選單「重新整理」或重試時才重新抓。

### 4.6 兩種尺寸與 RWD

- tokens 在 `styles/tokens.css`：預設是 240×320 的值，`@media (max-width: 176px)` 換成 128×160 的值。
- 元件依 [03](03-ux-ui.md) §6 在小尺寸隱藏或改排，用 CSS 處理；只有資料量不同時（例如每屏筆數）才在 JS 判斷，判斷依據是 `matchMedia`，不是 user agent。
- 電腦版 RWD（B7）：`@media (min-width: 480px)` 另一組版面，按鍵操作仍然有效，另外支援滑鼠點擊。

## 5. 後端架構

### 5.1 分層【決定】

| 層 | 位置 | 職責 |
|---|---|---|
| routers | `app/api/v1/` | 只處理 HTTP：參數驗證、呼叫 service、轉成回應 schema |
| schemas | `app/schemas/` | Pydantic 請求與回應模型；OpenAPI 由這裡產生 |
| services | `app/services/` | 業務邏輯：地區價、漲跌與指標、比價排名、資料新舊、位置推測。**純函式優先**，方便單元測試 |
| repositories | `app/repositories/` | 所有 SQL 都在這裡；service 不直接碰 ORM session |
| db | `app/db/` | SQLAlchemy 模型、session、Alembic migration |
| ingest | `app/ingest/` | provider、正規化、檢查、寫入、彙整 |
| worker | `app/worker.py` | APScheduler 進入點，只呼叫 `ingest` |
| news | `app/news.py` | 新聞的手動執行指令（`python -m app.news --once [--country TW]`）與 worker 的新聞排程工作，只呼叫 `ingest/news` |

依賴方向只能往下：routers → services → repositories → db。`ingest` 和 `services` 共用 repositories，但彼此不互相呼叫。

### 5.2 Provider 介面

```python
class PriceProvider(Protocol):
    source: str                       # "mock"、"tw_moa"……
    countries: tuple[str, ...]        # 這次執行涵蓋的國家
    stats: FetchStats                 # 送出的請求數、下載時略過的資料列、下載過的檔案

    async def fetch(self, day: date) -> list[RawRow]:
        """抓某個交易日的原始資料；mock 也輸出來源格式。"""

    def normalize(self, raw: RawRow, maps: SourceMaps) -> NormalizedQuote | None:
        """轉成標準報價（每公斤、我們的代號）；對照不到回傳 None。"""
```

- 每個來源在同一個檔案宣告 `INFO = SourceInfo(...)`（國家、價格類型、期間、是否連網、排程），列進 `app/ingest/registry.py`。worker 只讀登記表，不認得任何一個來源的名字；介面、抓取原則與新增來源的步驟見 [06](06-data.md) §1.4。
- 真實來源在一次執行的第一個 `fetch` 就抓完這次排定的日期（`tw_moa` 每個品項一個請求），之後的 `fetch` 從同一批資料取出。排定哪些日期由抓取原則決定（`app/ingest/policy.py`），連網的請求共用 `app/ingest/http.py` 的間隔與重試。

管線：`fetch → normalize → validate → upsert quotes → aggregate(受影響的日期) → 記錄 ingest_run`。每一步都是可單獨測試的函式；真實來源的測試用 `tests/fixtures/` 裡存下來的實際回應，**測試不連外網**。

## 6. API 契約

- 前綴 `/api/v1`；只有 `GET`（baseline 沒有寫入的 API，使用者設定存在前端）。
- 價格一律回傳**每公斤、當地幣別**的數值；單位換算與格式化在前端（[06](06-data.md) §5）。
- 名稱等多語文字回傳物件 `{"zh-TW": "...", "en": "..."}`，切換語言不必重抓。
- 日期用 `YYYY-MM-DD`（當地交易日）；時間用帶時區偏移的 ISO 8601。
- 回應帶 `Cache-Control: public, max-age=60`。
- API 文件：Swagger UI 在 `/api/docs`、OpenAPI 在 `/api/v1/openapi.json`，正式環境也開放。
- 安全標頭（CSP、`nosniff`、`Referrer-Policy`、`Permissions-Policy`）由 Caddy 加上；CSP 不套用在 `/api/*`。細節見 [`plan/baseline.md`](plan/baseline.md) T03。

| 方法與路徑 | 用途 | 主要回傳 |
|---|---|---|
| `GET /health` | 健康檢查 | 資料庫狀態、各來源最近一次成功抓取的時間、執行中的版本（commit，`APP_VERSION`） |
| `GET /locate` | IP 推測位置（F17） | `country`、`area_id`，推測不到時為 `null` |
| `GET /countries` | 國家清單與設定 | 幣別、locale、單位、休市日、漲跌顏色、預設地區、預設關注、預設價格類型（`default_price_type`） |
| `GET /countries/{cc}/areas` | 地區清單 | 名稱、區域、座標、有無零售、最新交易日與新舊 |
| `GET /countries/{cc}/crops` | 作物清單 | 名稱、分類、品種、有無零售 |
| `GET /prices?country=&area=&type=&crops=` | 首頁與作物清單 | 每個作物的地區價、漲跌、7 日迷你走勢、新舊 |
| `GET /crops/{crop}/quote?country=&area=&type=&days=30` | 行情頁與走勢頁 | 地區價、市場數、市場最高與最低、漲跌、指標、30 日序列、附近最高與最低（`nearby`） |
| `GET /crops/{crop}/compare?country=&area=&type=` | 比價頁 | 各地區的價格、市場數、直線距離、差額、新舊、名次；目前地區的名次與總數 |
| `GET /crops/{crop}/markets?country=&area=` | 本地區各市場（只有批發） | 各市場代表價、距離、新舊、與中位數的差額 |
| `GET /crops/{crop}/markets/{market}?country=` | 單一市場 | 代表價、漲跌、當日區間、來源 |
| `GET /intl?country=` | 國際參考價清單（B5） | 國家幣別與今天、換算用的匯率（`fx`：每美元多少、匯率日期）、Pink Sheet 更新日；每條序列：名稱、規格、原文名稱、最新月份、原始美元價與單位、每公斤當地價、比上月、`reason` |
| `GET /intl/{series}?country=` | 單一國際序列（B5） | 同上一條序列的欄位，加上 12 個月序列（沒有價格的月份為 `null`）與這 12 個月的高、低、平均、比平均 |
| `GET /news?country=&area=` | 新聞清單（N1） | 最近 7 天最多 9 則：提到 `area` 的排前面，其餘新到舊；每則有標題、語言、摘要（可能為 `null`）、發布者與網域、發布時間（國家時區）、當地日期、`days_ago`、相關作物、提到的地區；另有 `fetched_at`（最近一次成功抓取） |
| `GET /news/{id}` | 新聞內容 | 同一則的欄位加上 `country`、`today`；不存在或超過 7 天回 404 `news_not_found` |

- 比價頁的四種排序在**前端**做（地區最多幾十個，換排序不必重抓）；名次由後端算，不受排序影響。
- `type` 是 `wholesale` 或 `retail`；零售沒有 `markets` 相關端點，前端依規格顯示說明。
- 國際參考價的價格一樣是**每公斤、當地幣別**：每個月份都用最新的每日匯率換算，`usd` 保留世界銀行公布的原始值（`usd_unit`：`mt` 或 `kg`）。月份用該月第一天（`2026-08-01`）。沒有價格時 `price_per_kg` 為 `null` 並附 `reason`：`no_data`（還沒有月份）、`no_fx`（沒有這個幣別的匯率）。只回傳正在看的國家那一種幣別的匯率（匯率來源的條款不允許轉發整份匯率）。demo 的 `X-Demo-Fail` 對這兩個端點也有效。

`GET /api/v1/crops/onion/quote?country=IN&area=nashik&type=wholesale` 的回應範例：

```json
{
  "crop_id": "onion",
  "area_id": "nashik",
  "type": "wholesale",
  "currency": "INR",
  "today": "2026-09-19",
  "trade_date": "2026-09-19",
  "staleness": { "days": 0, "state": "today" },
  "fetched_at": "2026-09-19T11:40:00+05:30",
  "price_per_kg": 23.5,
  "markets": { "count": 7, "min_per_kg": 22.8, "max_per_kg": 24.9 },
  "change": { "pct": 0.042, "diff_per_kg": 0.95, "direction": "up", "prev_trade_date": "2026-09-18" },
  "stats": { "vs_avg7_pct": 0.031, "arrivals": "high", "pos30": 0.82, "volatility": "mid",
             "high7_per_kg": 23.5, "low7_per_kg": 21.9 },
  "series": [ { "date": "2026-08-21", "price_per_kg": 21.2 }, { "date": "2026-08-23", "price_per_kg": null } ],
  "source": { "id": "mock", "name": { "zh-TW": "示範資料", "en": "Demo data" } },
  "nearby": {
    "highest": { "area_id": "pune", "price_per_kg": 24.3, "diff_per_kg": 0.8, "distance_km": 165, "is_base": false },
    "lowest": { "area_id": "ahmednagar", "price_per_kg": 22.6, "diff_per_kg": -0.9, "distance_km": 142, "is_base": false }
  }
}
```

- 沒有資料時 `price_per_kg` 為 `null`，並附 `reason`：`no_retail_area`、`no_retail_crop`、`no_data`，讓前端顯示對應說明。
- `staleness.state`：`today`、`closed`（中間只有休市日）、`stale`、`none`（[06](06-data.md) §3.5）。
- `nearby`（2026-09-20 追加，行情頁的「附近最高／最低」，[02](02-product-spec.md) §5.4）：在這個地區和附近地區之間，價格最高與最低的各一列，手機只要下載兩列，不必下載所有地區。
  - 附近＝同一個國家內直線距離 100 km 以內的所有地區（`NEARBY_MAX_KM`）；只算最新交易日和這個地區相同的。這個地區的價格要是新的（`staleness.state` 是 `today` 或 `closed`）。
  - 每列：`area_id`、`price_per_kg`、`diff_per_kg`（那個地區減這個地區）、`distance_km`（直線）、`is_base`（這個地區本身就是最高或最低；這時差額與距離都是 0）。同價時算這個地區，附近地區之間同價時取近的。
  - 這個地區沒有價格或是舊資料、沒有符合的附近地區、或附近都和這裡同價時為 `null`。
  - 走勢頁也會收到這個欄位（同一個端點），不使用。

### 6.1 錯誤格式

```json
{ "error": { "code": "area_not_found", "message": "Area 'xyz' not found in IN", "request_id": "b3f1…" } }
```

| HTTP | `code` 範例 | 前端處理 |
|---|---|---|
| 400 | `invalid_param` | 視為程式錯誤，回首頁 |
| 404 | `area_not_found`、`crop_not_found` | 設定裡的地區或作物已經不存在：清掉並回到選擇畫面 |
| 404 | `series_not_found`（B5） | 國際序列不存在（舊連結）：回到國際參考價清單 |
| 404 | `news_not_found`（N1） | 新聞已經超過 7 天：說明「新聞只保留 7 天」，右軟鍵回清單 |
| 503 | `upstream_unavailable`、`demo_failure` | 顯示連線失敗，有舊資料就顯示舊資料 |
| 500 | `internal` | 同 503 |

- 前端依 `code` 顯示 i18n 字串，**不直接顯示** `message`（那是給開發者看的英文）。
- 每個回應帶 `X-Request-ID`，日誌也記錄它，方便對照問題。

### 6.2 Demo 開關（F18）

只有 `DEMO_MODE=true` 時後端才理會以下請求標頭，否則忽略：

| 標頭 | 效果 |
|---|---|
| `X-Demo-Fail: 1` | 價格類 API 回傳 503 `demo_failure` |
| `X-Demo-Stale: nashik:3` | 指定地區的最新交易日往前推 3 天 |
| `X-Demo-IP: 203.0.113.5` 或 `X-Demo-Locate: IN:nashik`、`none` | 取代真實 IP 或直接指定推測結果 |

前端在 demo 建置（`VITE_DEMO=true`）時，設定頁最後多一列「Demo」，用按鍵切換這些開關，存在 `localStorage`，每個請求帶上對應標頭。正式建置沒有這一列。

## 7. 資料表

| 資料表 | 主要欄位 | 說明 |
|---|---|---|
| `countries` | `code` PK、`currency`、`locale`、`utc_offset_min`、`up_is_pos`、`closed_weekdays`、`default_area_id`、`default_price_type` | 國家設定；`default_price_type` 是新使用者選這個國家時的價格類型（seed 的 `country.default_price_type`，預設 `wholesale`） |
| `areas` | `id` PK、`country`、`name` jsonb、`region` jsonb、`lat`、`lon`、`has_retail`、`sort` | 地區 |
| `markets` | `id` PK、`area_id` FK、`name` jsonb、`km_from_center` | 市場 |
| `crops` | `(country, id)` PK、`name` jsonb、`category`、`variety` jsonb、`sort`、`default_watch` | 作物 |
| `source_crop_map` | `source`、`source_name`、`source_variety` → `crop_id` | 作物對照 |
| `source_market_map` | `source`、`source_market` → `market_id` | 市場對照 |
| `ingest_runs` | `id`、`source`、`started_at`、`finished_at`、`status`、`rows_in`、`rows_ok`、`rows_dropped`、`error`、`requests`、`files`、`maps_hash` | 每次抓取的紀錄；後三個給連網來源的抓取原則用（[06](06-data.md) §1.4） |
| `quotes` | `source`、`price_type`、`market_id`（零售為空）、`area_id`、`crop_id`、`variety`、`trade_date`、`rep_price`、`low_price`、`high_price`、`volume_kg`、`run_id`、`fetched_at` | 正規化後的報價；唯一鍵見 [06](06-data.md) §2.1 |
| `market_daily` | `(market_id, crop_id, trade_date)` PK、`rep_price`、`low_price`、`high_price`、`volume_kg` | 同市場同天多筆取中位數後的結果 |
| `area_daily` | `(area_id, crop_id, price_type, trade_date)` PK、`price`、`n_markets`、`min_market`、`max_market`、`volume_kg`、`fetched_at` | 地區價（批發為中位數、零售為調查價） |
| `intl_series` | `id` PK、`sort`、`source_column`、`unit`（`mt`／`kg`）、`icon`、`category`、`name` jsonb、`spec` jsonb | 國際參考價的序列（B5），由 `app/seed/intl/series.yaml` 同步 |
| `intl_prices` | `(series_id, month)` PK、`usd`、`fetched_at` | 每月月均價，美元／原始單位，照 Pink Sheet 原樣；`month` 是該月第一天 |
| `fx_rates` | `currency` PK、`per_usd`、`rate_date`、`fetched_at` | 每種幣別最新的每日匯率（每美元多少） |
| `intl_sources` | `id` PK（`wb_pink`、`er_api`）、`url`、`etag`、`last_modified`、`data_date`、`next_update_at`、`checked_at` | 國際參考價來源的下載狀態：上次檢查時間、條件式 GET 用的標頭、檔案更新日或匯率日期、匯率的下次更新時間 |
| `news_items` | `id` PK、`country` FK、`source`（`google`／`demo`）、`guid`、`title`、`title_key`、`lang`、`source_name`、`source_domain`、`url`、`published_at`、`summary`、`summary_lang`、`summary_model`、`summary_tries`、`crop_ids`、`area_ids`、`fetched_at` | 新聞（N1）。`(country, guid)`、`(country, title_key)` 唯一；只存標題、摘要、來源、連結、日期與標籤，**不存原文**；超過 7 天刪除 |
| `news_runs` | `id`、`country`、`source`、`started_at`、`finished_at`、`status`、`items_in`、`items_new`、`requests`、`articles`、`model_calls`、`summaries`、`error` | 每次新聞抓取的紀錄；每日額度（讀文章、呼叫模型）依最近 24 小時的加總計算 |

- 價格欄位用 `numeric(12,4)`，單位都是每公斤。
- `area_daily` 有 `(area_id, crop_id, price_type, trade_date DESC)` 索引；API 讀這張表，30 天序列與指標在請求時由 service 計算（每次最多 30 列）。
- 國家、地區、市場、作物、對照表的內容放在 `app/seed/`（YAML），worker 啟動時同步進資料庫；改 seed 不需要寫 migration，改欄位才需要。國際參考價的序列在 `app/seed/intl/series.yaml`（子資料夾，不會被當成國家檔讀取）。
- 國際參考價的四張表由 migration `80ac1f2d0366`（B5）建立，只新增資料表。

## 8. 容錯【決定】

| 可能出錯的地方 | 做法 |
|---|---|
| 外部資料來源掛掉或變格式 | worker 與 api 分開；抓取失敗保留舊資料並記錄在 `ingest_runs`；格式不對的資料列在檢查階段丟掉並記數 |
| 資料有錯（負數、區間顛倒、離群值） | 正規化檢查（[06](06-data.md) §2.1） |
| 重複抓取 | 以唯一鍵 upsert，重跑結果相同 |
| 某地區今天沒更新 | 回傳最新交易日與新舊狀態，前端標示，不假裝是今天 |
| API 慢或斷線 | 前端 10 秒逾時、重試 1 次、保留舊資料並標示；每個錯誤畫面都有出口 |
| 畫面程式出錯 | 每個畫面包一層 React error boundary，顯示錯誤並提供「回首頁」 |
| `localStorage` 壞掉或版本不符 | 版本號與遷移函式；失敗就重設 |
| 設定裡的地區或作物已經不存在 | API 回 404 `*_not_found`，前端清掉並回到選擇畫面 |
| IP 推測失敗或 mmdb 檔不存在 | `/locate` 回傳 `null`，前端改成手動選擇；api 照常啟動 |
| 服務當掉 | compose `restart: unless-stopped`、healthcheck、`/health` |
| 資料庫結構變更 | Alembic migration，api 啟動時自動升級 |

## 9. 評分對照：技術深度（30%）

| 評分項目 | 我們怎麼做 | 在哪裡 |
|---|---|---|
| 可讀性 | TypeScript strict、Python 型別與 mypy、ruff／ESLint／Prettier、統一命名；docs 與 CLAUDE.md | 全專案 |
| 可維護性 | 前後端分層、依賴方向固定；OpenAPI 產生前端型別；TDD；核心模組覆蓋率 ≥ 90%；CI 每次檢查 | §4、§5、[07](07-dev-workflow.md) |
| 可擴充性 | 加國家＝加 seed 檔；加資料來源＝加一個 provider；加語言＝加一個字串檔 | §5.2、[06](06-data.md) |
| 容錯 | §8 整張表 | §8 |
| React、模組化 | 畫面、元件、按鍵、焦點、store、API 分資料夾 | §4.1 |
| RWD | 240×320 與 128×160 兩套 tokens；電腦版 RWD 是加分項 B7 | §4.6 |
| PWA | 加分項 B7：只在一般瀏覽器啟用（Cloud Phone 不支援） | [05](05-tech-stack.md) |
| API 設計 | 版本化 REST、一致的錯誤格式、request id、快取標頭；公開的 `/api/docs` 互動文件 | §6 |
| 資料處理 | 抓取 → 正規化 → 檢查 → 中位數彙整 → 指標計算的管線；mock 與真實資料同一條管線 | §5.2、[06](06-data.md) |
| Serverless | 目前不用，說明為什麼選容器化；最後再決定要不要做排程抓取的 Serverless 版本 | [05](05-tech-stack.md) §5 |
| 雲端儲存 | PostgreSQL（volume）存價格；使用者設定存在 Cloud Phone 的雲端 `localStorage`；最後再決定正式環境要不要改用託管資料庫 | §2、§4.5、[05](05-tech-stack.md) §5 |
| CI/CD | CI 一開始就架：lint、型別、測試與覆蓋率門檻、API 契約、依賴套件安全檢查、建置 image；CD 是加分項 B1，沿用手動部署腳本 | [07](07-dev-workflow.md) |

## 10. 資料夾結構

```
/
├── CLAUDE.md
├── compose.yaml                 # db、api、worker、web
├── compose.dev.yaml             # 開發用覆蓋：Vite dev server、--reload、bind mount
├── compose.prod.yaml            # 正式環境覆蓋：開放 80、443
├── .env.example
├── README.md                    # 給評審與隊友：架構圖、快速開始、技術亮點
├── Makefile                     # up、dev、test、lint、audit、types、e2e、screenshots
├── frontend/
│   ├── Dockerfile               # Node 建置 → caddy:2
│   ├── package.json  vite.config.ts  tsconfig.json  playwright.config.ts
│   ├── src/
│   │   ├── main.tsx  App.tsx
│   │   ├── app/                 # routes.tsx、providers.tsx、ErrorBoundary.tsx
│   │   ├── screens/             # setup/、home/、crop-list/、crop-detail/、markets/、areas/、watch/、settings/、about/、intl/（B5）、news/（N1）
│   │   ├── components/          # Shell、Header、InfoBar、SoftKeys、Tabs、Card、NewsCard、CropIcon、KeyCap、Pill、Sparkline、TrendChart、Sheet、StatusBox、Skeleton
│   │   ├── keys/                # keyScope.ts、useKeys.ts
│   │   ├── focus/               # useFocusList.ts、useGrid.ts、restore.ts
│   │   ├── store/               # settings.ts、session.ts、migrate.ts
│   │   ├── api/                 # client.ts、schema.d.ts（產生的）、queries.ts
│   │   ├── i18n/                # index.ts、locales/zh-TW.json、locales/en.json
│   │   ├── lib/                 # units.ts、format.ts、dates.ts、monthly.ts（B5 的月份）
│   │   ├── styles/              # tokens.css、global.css
│   │   └── icons/               # crops.tsx、ui.tsx
│   └── e2e/                     # Playwright：viewports、overflow、focus、主要流程
├── backend/
│   ├── Dockerfile  pyproject.toml  uv.lock  alembic.ini
│   ├── app/
│   │   ├── main.py  config.py  errors.py  deps.py
│   │   ├── api/v1/              # health、locate、catalog、prices、markets、intl（B5）
│   │   ├── schemas/
│   │   ├── services/            # pricing、stats、compare、freshness、locate、intl（B5）
│   │   ├── repositories/
│   │   ├── db/                  # models.py、session.py、migrations/
│   │   ├── ingest/              # providers/（base、mock、tw_moa、my_pricecatcher）、registry、policy、http、normalize、validate、combine、pipeline
│   │   │                        # intl/（B5：http、pink_sheet、fx、refresh）
│   │   │                        # news/（N1：sources.yaml、rss、gnews（連結解碼）、article、reader、summarize、demo、pipeline、job）
│   │   ├── seed/                # IN.yaml、TW.yaml、MY.yaml（地區、市場、作物、對照、mock 參數）、intl/series.yaml（B5）
│   │   ├── news.py              # python -m app.news --once [--country TW]
│   │   └── worker.py
│   └── tests/                   # unit/、api/、ingest/、fixtures/
├── infra/
│   ├── caddy/                   # Caddyfile、Caddyfile.dev
│   └── geoip/                   # README（如何下載 mmdb）；mmdb 檔不進 Git
├── scripts/
│   ├── deploy.sh                # 手動部署；CD 也呼叫它
│   └── gen-api-types.sh         # 從 OpenAPI 產生前端型別
├── .github/workflows/
│   ├── ci.yml                   # 每次 push：lint、型別、單元測試、建置
│   ├── e2e.yml                  # 手動觸發或 main：Playwright
│   └── deploy.yml               # 加分項 B1
└── docs/
```
