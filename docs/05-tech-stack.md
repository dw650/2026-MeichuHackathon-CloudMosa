# 05 技術選型

> 用什麼、為什麼、有什麼不用。架構怎麼組起來見 [04](04-architecture.md)。
> **版本**：建專案時取當時的最新穩定版，用 lock file 固定（`package-lock.json`、`uv.lock`）；Docker image 標到主版本號。之後升級要單獨開分支。

## 1. 總覽【決定】

| 層 | 選擇 |
|---|---|
| 前端 | React 19 + TypeScript（strict）+ Vite |
| 後端 | Python 3.12 + FastAPI |
| 資料庫 | PostgreSQL 16 |
| 反向代理、HTTPS、靜態檔 | Caddy 2 |
| 執行環境 | Docker Compose（所有服務，含開發） |
| CI | GitHub Actions（一開始就架）；CD 是加分項 |

## 2. 前端

| 用途 | 套件 | 備註 |
|---|---|---|
| 框架 | `react`、`react-dom` 19 | 只做 SPA（client-side rendering） |
| 語言 | TypeScript，`strict: true` | 不用 `any`；API 型別由後端 OpenAPI 產生 |
| 建置 | Vite | `build.target` 設 `es2020`（遠端 Chromium 版本夠新） |
| 路由 | `react-router` 7 | 每個畫面、每個面板都是一筆歷史，右軟鍵才能用 `history.back()` 返回 |
| 狀態 | `zustand` 5 + `persist` middleware | 使用者設定、目前畫面、焦點；每個動作都寫進 `localStorage` |
| 伺服器資料 | `@tanstack/react-query` 5 | 快取、重試、逾時、「連線失敗時保留舊資料」 |
| API 型別 | `openapi-typescript` | 從後端 `/api/v1/openapi.json` 產生，CI 檢查有沒有過期 |
| 多語 | `i18next` + `react-i18next` | 字串放 `locales/{zh-TW,en}.json`；數字與日期用 `Intl` |
| 樣式 | CSS Modules + CSS 變數（設計 tokens） | tokens 見 [03](03-ux-ui.md)；兩種尺寸用 media query 切換 tokens |
| 圖示 | 內嵌 SVG 元件 | 從草圖的 `icons.js` 搬過來 |
| 單元測試 | `vitest` + `@testing-library/react` + `@testing-library/user-event` | 按鍵、焦點、狀態邏輯都用這層測 |
| API 假資料（測試用） | `msw` | 前端測試不需要啟動後端 |
| UI 檢查 | `@playwright/test` | 只在大段落完成時跑（見 [07](07-dev-workflow.md)） |
| 程式風格 | ESLint（flat config）+ `typescript-eslint` + `eslint-plugin-react-hooks` + Prettier | CI 會檢查 |
| PWA（加分項 B7） | `vite-plugin-pwa` | **只在不是 Cloud Phone 時才註冊 Service Worker** |

### 不用的東西

| 不用 | 原因 |
|---|---|
| Next.js、SSR | 頁面本來就在雲端 Chromium 執行，SSR 沒有好處，只會多一個 Node 服務 |
| MUI、Ant Design 等 UI 元件庫 | 為觸控與滑鼠設計，體積大、預設動畫多、焦點樣式難改；按鍵機的元件數量少，自己寫比較快 |
| Tailwind | 設計 tokens 已經定好，CSS Modules 比較好對照 [03](03-ux-ui.md)；兩種尺寸的切換用 media query 集中管理 |
| Redux | 狀態不多，Zustand 夠用 |
| 動畫套件 | 每次畫面變動都耗手機流量（[08](08-platform-constraints.md)） |
| 焦點管理套件（spatial navigation） | 本 App 的焦點只有清單、九宮格、面板三種，規則固定，自己寫一個小模組比較好測 |

### 為什麼是 React，不是 Vue

在 Cloud Phone 上兩者**沒有實質差別**：程式在雲端 Chromium 執行，手機只收畫面，框架大小與執行速度都不是瓶頸。影響開發速度的是團隊熟悉度和生態系，所以選團隊比較熟的 React。官方文件也有 React 教學可以參考。若團隊改成更熟 Vue，架構與本文件的其他規則都不需要改，只換對應套件（vue-router、Pinia、vue-i18n、Vitest）。

## 3. 後端

| 用途 | 套件 | 備註 |
|---|---|---|
| 框架 | `fastapi` + `uvicorn` | 自動產生 OpenAPI；用 async |
| 資料驗證 | `pydantic` v2、`pydantic-settings` | 請求、回應、設定全部有型別 |
| ORM 與遷移 | `sqlalchemy` 2（async）+ `alembic` | 資料表改動一律寫 migration |
| 資料庫驅動 | `psycopg` 3 | |
| 對外 HTTP | `httpx` | 抓取真實資料用；設逾時與重試 |
| 排程 | `apscheduler` | 在 worker 服務裡跑，不在 API 服務裡 |
| IP 推測 | `geoip2` + 本機 mmdb 檔（DB-IP Lite City） | 不呼叫外部服務，不保存 IP；檔案不進 Git |
| 測試 | `pytest`、`pytest-asyncio`、FastAPI `TestClient` | 資料庫測試用 compose 起的 PostgreSQL |
| 程式風格 | `ruff`（lint + format）、`mypy` | CI 會檢查 |
| 套件管理 | `uv` | 產生 `uv.lock`，Docker build 也用它 |
| 語音（加分項 B8） | 【待確認】伺服器端 TTS | 產生音檔並快取，前端用 `<audio>` 播放 |

**為什麼是 FastAPI**：團隊熟 Python；資料處理（正規化、中位數、統計）用 Python 寫最直接；自動產生的 OpenAPI 可以讓前端直接產生型別，前後端契約不會對不上。

## 4. 資料庫

- **PostgreSQL 16**：價格資料是固定欄位的時間序列，需要 `(地區, 作物, 日期)` 的查詢與彙整，關聯式資料庫最適合；也能在 compose 裡一起跑。
- 不另外加 Redis：彙整結果直接存成資料表（見 [06](06-data.md) §8），API 讀表就夠快；前端再有 TanStack Query 的快取。

## 5. 部署與基礎設施

| 項目 | 選擇 | 原因 |
|---|---|---|
| 容器 | Docker Compose | 開發、CI、正式環境用同一份 compose，一行指令起所有服務；也是「基礎設施即程式碼」 |
| 代理 | Caddy 2 | 自動申請 HTTPS 憑證；同一個網域送前端靜態檔並轉發 `/api`，避開 CORS 與混合內容；設定檔很短 |
| 主機 | 一台有公開 IP 的 VM（雲端或學校機器）【待確認】 | Simulator 只能載入公開 HTTPS 網址 |
| 開發時的公開網址 | Cloudflare Tunnel 或 ngrok【待確認】 | 在還沒有 VM 時讓 Simulator 連到本機 |
| CI | GitHub Actions | lint、型別、單元測試、建置 image；Playwright 只在手動觸發或 main 上跑 |
| CD（加分項 B1） | GitHub Actions → SSH 到 VM 執行部署腳本 | 和手動部署用同一支 `scripts/deploy.sh` |

### 為什麼不用 Serverless

評分項目列出 Serverless，但本 App 不適合硬套：

- 需要**排程抓取**與**常駐的資料庫連線**，Serverless 要另外拼湊排程與連線池服務。
- 冷啟動會讓第一次請求變慢，在按鍵機上等待更明顯。
- 團隊要求所有服務都能用 docker compose 在本機完整跑起來。

簡報的說法：「我們選擇容器化，用 docker compose 把 API、排程、資料庫、代理定義成程式碼，一行指令就能在任何機器重建；抓取、正規化、彙整三個階段分開，要換成 Serverless 函式時，只需要把 worker 的工作搬過去。」

### 之後可以考慮的做法（最後再決定）

團隊決定先維持現狀，baseline 與其他加分項完成後再討論：

| 做法 | 內容 | 成本 |
|---|---|---|
| 託管 PostgreSQL | 正式環境的資料庫改用 Neon、Supabase 等託管服務；本機仍用 compose 裡的 PostgreSQL | 幾乎不用改程式，只改 `DATABASE_URL`；對應「雲端儲存」 |
| Serverless 排程抓取 | 抓取真實資料是「定時執行、短時間、無狀態」的工作，適合 Serverless。正式環境用 Cloud Run Jobs 之類的服務排程執行；本機仍由 worker 容器執行同一支程式 | 中等，需要雲端帳號；接上真實資料（B2）後才有意義 |

### 為什麼 PWA 只給電腦與智慧型手機

Cloud Phone 會忽略 manifest，也不支援 Service Worker 與離線（[08](08-platform-constraints.md)）。所以 PWA 屬於加分項 B7（電腦版 RWD）的一部分：在一般瀏覽器可以安裝、快取介面；在 Cloud Phone 上用 `typeof navigator.hasFeature === 'function'` 判斷，**不註冊** Service Worker。
