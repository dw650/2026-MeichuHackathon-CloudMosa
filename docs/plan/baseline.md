# Baseline 執行計畫

> 給 coding agent 從頭跑到 baseline 完成用的任務清單。可以用一個 session 依序做完，也可以照「平行開發」一節，由兩個 session 平行做。每個 session 一次只做一個任務。
> 做完一個任務：勾選框打勾，並在 [`progress.md`](progress.md) 加一行紀錄。
> 對話被壓縮或重新開始時，從第一個沒打勾的任務繼續。
> 範圍是 [07](../07-dev-workflow.md) 的 Phase 0 與 Phase 1。**T39 完成就停**，Phase 2（Simulator）要人來做。

## 每個任務的做法

1. 讀任務寫的「參考」段落。不要整份 docs 重讀。
2. 開分支：`git switch -c feat/tNN-<短名稱>`（從最新的 `main`）。
3. TDD：先寫「測試」列出的失敗測試 → 寫程式讓它通過 → 重構。每個綠燈的小步驟 commit 一次，用英文 Conventional Commits，例如 `feat(api): add area median service`。
4. 確認「完成條件」全部成立。合併前跑 `make lint` 與 `make test`，兩者都要通過。
5. 合併：`git switch main && git merge --no-ff feat/tNN-<短名稱>`。**不 push**。
6. 在本文打勾，在 `progress.md` 加一行，然後 commit：`docs(plan): complete TNN`。

## 自己決定還是停下來

- **文件寫了**：照文件做。標【決定】的不能改。
- **文件沒寫**：照草圖 `docs/ui-mockup/`，包括文字、版面、數值、軟鍵標籤。介面文字以 `ui-mockup/src/data.js` 的 `STR` 為準。
- **草圖也沒有**：選最簡單、最容易改的做法，記進 [`decisions.md`](decisions.md)，然後繼續。
- **只有以下情況才停下來問人**：
  - 需要金鑰、帳號或付費服務。
  - 文件之間互相矛盾，而且牽涉到【決定】。
  - 同一個問題試了 3 種做法都失敗。
  - 需要刪除或覆蓋不是自己在這次執行中建立的東西。
- 停下來之前，先在 `progress.md` 寫清楚卡在哪裡、試過什麼。

## 平行開發（主 session 自動安排）

一個主 session 負責全部流程：後端與整合自己做，前端基礎與部分畫面交給**背景子 agent** 在另一個 worktree 做，同步點自己合併並驗證。人只需要下一次 prompt，除非遇到「自己決定還是停下來」列出的情況。

| 步驟 | 主 session 自己做 | 同時交給子 agent（在 worktree） |
|---|---|---|
| 1 | T01–T06 | — |
| 2 | 建立 worktree（見下方）；後端線 T07–T15 | 前端線：T16、T17、T18、T19、T20、T21、T23、T24 |
| 3 | 同步點 1：兩條線都完成後，合併 `track/frontend`，驗證，做 T22 | — |
| 4 | T25、T26、T31、T32、T33 | 先在 worktree `git merge main`，再做 T27、T28、T29、T30 |
| 5 | 同步點 2，然後 T34–T39 | — |
| 6 | 移除 worktree（`git worktree remove`，保留分支），寫完成摘要，**停止** | — |

### 建立 worktree（步驟 2 開始時做一次）

```bash
git worktree add ../<repo 資料夾名>-fe -b track/frontend main
```

進入 worktree：
1. `cp .env.example .env`，把 `WEB_PORT` 改成 `8081`、`DB_PORT` 改成 `5433`，避免和主 session 的服務衝突。
2. `cd frontend && npm ci`。

### 派子 agent 的方式

- **一次派一個子 agent，只做一個任務**，在背景執行。主 session 同時繼續做自己的任務。
- 收到完成通知後，主 session 先檢查：
  1. `git log` 有該任務的 commit。
  2. 在 worktree 跑前端的 lint 與測試，確認通過。
- 檢查通過就派下一個任務；沒通過就把問題交給新的子 agent 修。同一個任務失敗 2 次，改由主 session 在該條線的最後自己做。
- 派給子 agent 的指示要包含以下內容：
  - worktree 的絕對路徑、分支 `track/frontend`、任務編號。
  - 先讀 `CLAUDE.md` 與 `docs/plan/baseline.md` 裡該任務和它的「參考」段落。
  - 照 TDD 做。直接 commit 在 `track/frontend`，commit 訊息的範圍寫任務編號，例如 `feat(t19): add key scope stack`。
  - 完成後在 worktree 打勾並在 `progress.md` 加一行。
  - 只改 `frontend/` 與 `docs/plan/`；共用檔案（`Makefile`、`compose*.yaml`、`.github/`）改動越小越好，並在 commit 訊息註明。
  - **不切換到 `main`、不合併、不 push**。
  - 回報：完成或卡住、commit 清單、測試結果、自己做了哪些決定。

### 同步點的做法

1. 確認沒有正在執行的子 agent。
2. 在主 repo：`git merge --no-ff track/frontend`，解決衝突。
3. 跑 `make lint`、`make test`、`make e2e`，全部通過才算完成。
4. 在 `progress.md` 記一行「同步點 N 完成」。

`.gitattributes` 已經設定好：`progress.md`、`decisions.md` 在合併時會自動保留兩邊新增的內容。

### 不平行時

如果子 agent 一直失敗，或環境不允許開背景子 agent，就改成單一 session，從第一個沒打勾的任務依序做到 T39，並在 `progress.md` 記下原因。

## Phase 0：骨架

- [x] **T01 Repo 骨架**
  - 參考：[04](../04-architecture.md) §2、§10
  - 內容：
    - 建立資料夾結構。
    - 補齊 `.gitignore`：`node_modules`、`.venv`、`.env`、`*.mmdb`、`frontend/e2e/artifacts`、`dist`。
    - 建立 `.env.example` 與 `Makefile`（先放 `up`、`down`、`logs`）。`.env.example` 要有 `WEB_PORT=8080`、`DB_PORT=5432`；`Makefile` 從 `.env` 讀這兩個值。
    - `compose.yaml` 先只有 `db`；`db` 只綁在 `127.0.0.1:${DB_PORT}`，給本機測試用。
    - compose 的 project 名稱沿用資料夾名稱（不要寫死 `name:`），這樣兩個 worktree 可以同時起各自的服務。
  - 完成條件：`docker compose config` 沒有錯誤；`make up` 後 `db` 是 healthy。

- [x] **T02 後端骨架**
  - 參考：[04](../04-architecture.md) §5.1、§6.1；[05](../05-tech-stack.md) §3
  - 內容：
    - `uv` 專案、FastAPI、`config.py`（pydantic-settings）。
    - 錯誤格式與 `X-Request-ID` middleware；`GET /api/v1/health`（檢查資料庫連線）。
    - Alembic 初始化；`backend/Dockerfile`；compose 加上 `api`。
    - Makefile 加 `test`、`lint`（後端部分）。
  - 測試：`/health` 回傳 ok；不存在的路徑回傳統一錯誤格式；回應帶 `X-Request-ID`。資料庫測試用 `127.0.0.1:${DB_PORT}` 連 compose 的 `db`，並使用獨立的測試資料庫。
  - 完成條件：`make test`、`make lint` 通過；`make up` 後 api 容器 healthy。

- [x] **T03 前端骨架與 web 服務**
  - 參考：[03](../03-ux-ui.md) §2–§3；[04](../04-architecture.md) §3、§4.6；[05](../05-tech-stack.md) §2
  - 內容：
    - Vite + React + TS strict；ESLint + Prettier；Vitest + Testing Library。
    - `styles/tokens.css` 與 `global.css`：數值從 `ui-mockup/src/phone.css` 搬，含 128×160 的 media query。
    - `Shell` 元件：header、內容、軟鍵列三列 grid，高度用 `innerHeight`。
    - `frontend/Dockerfile`（Node 建置 → `caddy:2`）與 `infra/caddy/Caddyfile`：靜態檔、`/api/*` 轉發、`X-Client-Forwarded-For`、SPA fallback。
    - compose 加上 `web`。
    - 網址用環境變數 `SITE_ADDRESS`：本機預設 `:8080`（只用 HTTP，接受任何 Host，tunnel 也能用）；正式環境填網域，由 Caddy 自動申請 HTTPS。本機的主機埠是 `${WEB_PORT}:8080`；正式環境要開放的 80、443 埠寫在 `compose.prod.yaml`。
    - Makefile 的 `test`、`lint` 加上前端。
    - 正式用的 `Caddyfile` 加安全標頭：
      - `Content-Security-Policy`：`default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'`。**只加在 `/api/*` 以外的路徑**，因為 `/api/docs` 的 Swagger UI 會從 CDN 載入資源。
      - `X-Content-Type-Options: nosniff`、`Referrer-Policy: no-referrer`、`Permissions-Policy: geolocation=(), camera=(), microphone=()`。
      - **不要設** `X-Frame-Options` 或 CSP 的 `frame-ancestors`：Simulator 可能用 iframe 載入 App【待確認】。
      - 開發用的 `Caddyfile.dev` 不加 CSP，因為 Vite HMR 需要 inline script 與 WebSocket。
  - 測試：`Shell` 會顯示左、中、右軟鍵標籤。
  - 完成條件：`make up` 後 `http://localhost:8080` 顯示 Shell；`http://localhost:8080/api/v1/health` 回傳 ok；`curl -sI http://localhost:8080/` 看得到上面的安全標頭，而且瀏覽器 console 沒有 CSP 錯誤。

- [x] **T04 開發模式**
  - 參考：[04](../04-architecture.md) §2.1
  - 內容：`compose.dev.yaml`、`Caddyfile.dev`、`frontend-dev`（Vite HMR）、api `--reload`、bind mount；Makefile 加 `dev`。
  - 完成條件：`make dev` 後在 8080 看得到 Vite 的頁面，改前端檔案後頁面會更新；`/api` 仍然轉發到 api。

- [x] **T05 CI**
  - 參考：[07](../07-dev-workflow.md) §5.1
  - 內容：
    - `.github/workflows/ci.yml`，包含 frontend、backend（PostgreSQL service）、images 三個 job。`contract` job 在 T13 補上。
    - 覆蓋率報告：後端 `pytest --cov=app`，前端 Vitest `--coverage`（v8），輸出精簡的摘要。門檻分別在 T12、T20 開啟。
    - 依賴套件安全檢查：`npm audit --omit=dev --audit-level=high`、`uvx pip-audit`；Makefile 加 `audit`，CI 跑同一組指令。
    - 如果有漏洞，但還沒有修正版本：記進 `decisions.md`，在設定中忽略該編號並寫明理由，然後繼續，不要因此停下來。
  - 完成條件：
    - 每個步驟和 Makefile 用同一組指令，而且在本機都能通過。
    - YAML 語法正確，例如用 `npx --yes yaml-lint` 或 Python `yaml.safe_load` 檢查。
    - 不會 push，所以在 GitHub 上實際跑不在這個任務的範圍內。

- [x] **T06 除錯頁**
  - 參考：[07](../07-dev-workflow.md) §1.1；[08](../08-platform-constraints.md) §12
  - 內容：
    - `/debug/keys`、`/debug/viewport`：只在 dev 建置或 `VITE_DEMO=true` 時存在。
    - `GET /api/v1/debug/headers`：只在 `DEMO_MODE=true` 時存在。
  - 測試：按鍵頁會記錄 `event.key` 與 `repeat`；`DEMO_MODE=false` 時 headers 端點回傳 404。
  - 完成條件：測試通過。

## Phase 1-A：資料管線（後端）

- [x] **T07 資料表**
  - 參考：[04](../04-architecture.md) §7
  - 內容：SQLAlchemy 模型與 Alembic migration，含全部資料表、唯一鍵、`area_daily` 的索引。
  - 測試：對測試資料庫跑 upgrade 與 downgrade 都成功；`quotes` 的唯一鍵會擋下重複資料。
  - 完成條件：測試通過；api 啟動時會自動 migrate。

- [x] **T08 Seed**
  - 參考：[06](../06-data.md) §7.2–§7.3；`ui-mockup/src/data.js` 的 `COUNTRIES`
  - 內容：
    - `app/seed/IN.yaml`、`TW.yaml`：國家設定、地區、市場、作物、預設關注、單位、休市日、mock 參數（`p`、`lo`、`hi`、`chg`、`arr`、`arrR`、`rt`、`k`）、來源對照表。
    - 同步程式：可重複執行，結果相同。
  - 測試：
    - 執行兩次，筆數相同。
    - 每個市場的地區都存在；每個作物的分類在允許的清單內。
    - 印度 11 個地區、台灣 10 個地區，每國 10 種作物。
  - 完成條件：測試通過。

- [x] **T09 Mock provider**
  - 參考：[06](../06-data.md) §7.1、§7.4；[04](../04-architecture.md) §5.2
  - 內容：
    - 依 `PriceProvider` 介面，輸出**來源格式**的原始資料：印度用 data.gov.in 欄位與 quintal；台灣用農業部欄位與民國日期。
    - 以當地的今天往回 60 天；固定種子亂數；放入 §7.4 表列的全部例外情境。
  - 測試：
    - 同一天產生兩次，結果完全相同。
    - 休市日沒有資料。
    - Kurnool 與花蓮縣沒有資料；Kolar 與宜蘭縣的最新資料是 3 天前。
    - 青辣椒沒有零售資料。
  - 完成條件：測試通過。

- [x] **T10 正規化與檢查**
  - 參考：[06](../06-data.md) §2、§2.1
  - 內容：各來源的 `normalize`（quintal → 每公斤、民國日期轉換、對照表）與 `validate`（§2.1 的每一條規則）。
  - 測試：每一條檢查規則至少一個測試；對照不到的資料列會被記數；價格單位正確。
  - 完成條件：測試通過。

- [x] **T11 彙整、管線與 worker**
  - 參考：[06](../06-data.md) §3.2–§3.3、§8；[04](../04-architecture.md) §2、§5.2
  - 內容：
    - upsert `quotes` → `market_daily`（同市場同天多筆取中位數）→ `area_daily`（中位數、市場數、最高、最低；零售直接寫入）。
    - 記錄 `ingest_runs`。
    - `worker.py`：啟動時 seed 並產生資料，之後每天 00:05 再跑一次。
    - compose 加上 `worker`；Makefile 加 `seed`。
  - 測試：奇數與偶數個市場的中位數；重跑結果相同；只有 1 個市場；零售寫入；`ingest_runs` 的筆數正確。
  - 完成條件：測試通過；`make up` 後資料庫的 `area_daily` 有資料。

## Phase 1-B：服務與 API

- [x] **T12 計算服務**
  - 參考：[06](../06-data.md) §3.4、§3.5、§4
  - 內容（純函式）：
    - 資料新舊判斷：today、closed、stale、none。
    - 漲跌與持平門檻；指標：比 7 日均價、30 日位置、波動、到貨量。
    - 30 天序列：沒有資料的日子是 `null`。
    - 比價：同價同名次、沒有資料的不排名、haversine 距離、差額。
    - 各市場列表與中位數差額。
  - 測試：每個函式的邊界情況，包括樣本不足時回傳空值、最高等於最低時位置是 0.5、休市日不算舊資料。
  - 完成條件：測試通過。開啟後端覆蓋率門檻：`app/services` 與 `app/ingest` 合計 ≥ 90%，`make test` 與 CI 都檢查。

- [x] **T13 目錄 API 與型別產生**
  - 參考：[04](../04-architecture.md) §6
  - 內容：
    - `GET /countries`、`/countries/{cc}/areas`、`/countries/{cc}/crops`；多語名稱用物件表示。
    - API 文件頁：Swagger UI 在 `/api/docs`，OpenAPI 在 `/api/v1/openapi.json`；正式環境也開放，讓評審可以直接點。每個端點都寫 `summary` 與回應範例。
    - `scripts/gen-api-types.sh`；Makefile 加 `types`。
    - CI 補上 `contract` job。
  - 測試：API 測試（回應格式、不存在的國家回傳 404 與錯誤碼）。
  - 完成條件：測試通過；`make types` 產生 `frontend/src/api/schema.d.ts`；`http://localhost:8080/api/docs` 可以打開。

- [x] **T14 價格 API**
  - 參考：[04](../04-architecture.md) §6；[06](../06-data.md) §3
  - 內容：
    - `GET /prices`、`/crops/{crop}/quote`、`/crops/{crop}/compare`、`/crops/{crop}/markets`、`/crops/{crop}/markets/{market}`。
    - 沒有價格時附 `reason`；加上 `Cache-Control`。
  - 測試：
    - 每個端點至少一個正常情況與一個例外情況。例外包括：零售沒有資料時的 `reason`、地區是舊資料、`area_not_found`。
    - quote 回應和 §6 的範例欄位一致。
  - 完成條件：測試通過；重新產生前端型別。

- [x] **T15 位置推測與 demo 標頭**
  - 參考：[04](../04-architecture.md) §3、§6.2；[06](../06-data.md) §6
  - 內容：
    - 從 `X-Client-Forwarded-For` 取最左邊的公開 IP。
    - 用可以替換的查詢介面，預設讀 mmdb；檔案不存在時回傳推測不到，服務照常運作。
    - 找最近的地區，超過 300 km 就回傳推測不到。
    - `X-Demo-IP`、`X-Demo-Locate`、`X-Demo-Fail`、`X-Demo-Stale`：只在 `DEMO_MODE=true` 時生效。
    - `infra/geoip/README.md` 寫明怎麼下載免註冊的 DB-IP Lite（City）mmdb。**不要把 mmdb 檔放進 Git**；測試不依賴這個檔案。
  - 測試：
    - 標頭解析：私有 IP 跳過、格式錯誤、空值。
    - 用假的查詢介面測最近地區與 300 km 門檻。
    - demo 標頭在非 demo 模式被忽略。
  - 完成條件：測試通過。

## Phase 1-C：前端基礎

- [x] **T16 lib**
  - 參考：[03](../03-ux-ui.md) §7；[06](../06-data.md) §3.4、§5
  - 內容：
    - `units.ts`：由每公斤換算、小數位數。
    - `format.ts`：用 `Intl` 格式化；`en-IN` 的 lakh 分組。
    - `dates.ts`：「9/19 週六」「Sat 19/9」「昨天」「3 天前」。
    - 漲跌方向、百分比顯示規則。
  - 測試：每個函式的主要情況與邊界情況。
  - 完成條件：測試通過。

- [x] **T17 i18n**
  - 參考：[03](../03-ux-ui.md) §7；[02](../02-product-spec.md) F15；`data.js` 的 `STR`、`LANGS`、`MORE_LANGS`
  - 內容：
    - 把 `STR` 的 zh、en 搬到 `locales/zh-TW.json`、`en.json`，key 依畫面分組並取有意義的名稱。
    - 語言清單：手機語言排第一；हिन्दी 和其他語言都退回英文。
  - 測試：兩份字串檔的 key 完全相同；插值正常。
  - 完成條件：測試通過。

- [x] **T18 Store**
  - 參考：[04](../04-architecture.md) §4.5
  - 內容：`settings`、`session`，用 persist、版本號與遷移函式；壞掉的 JSON 會重設。
  - 測試：每次變更立刻寫入；版本不符時遷移；壞掉的資料被重設；國家改變時連帶重設地區與關注。
  - 完成條件：測試通過。

- [x] **T19 按鍵**
  - 參考：[04](../04-architecture.md) §4.2；[02](../02-product-spec.md) §4；[08](../08-platform-constraints.md) §3
  - 內容：`keyScope`（堆疊）與 `useKeys`。
  - 測試：
    - 最上層的範圍接收按鍵，面板打開時不穿透。
    - `repeat` 只對方向鍵有效；`#` 與 `*` 靠 `event.key` 分辨。
    - `Escape` 會觸發 `onMenu`；處理過的按鍵會 `preventDefault`。
  - 完成條件：測試通過。

- [x] **T20 焦點**
  - 參考：[04](../04-architecture.md) §4.4；[03](../03-ux-ui.md) §5；[02](../02-product-spec.md) §4
  - 內容：
    - `useFocusList`、`useGrid`：九宮格的 ◀ ▶ 在同一列移動，最左欄再按 ◀ 呼叫 callback。
    - 1–9 直接開啟；捲到可見範圍時留 6px 邊距；依 ID 還原焦點；沒有可選項目時捲動 60% 高度。
  - 測試：以上每一條規則各一個測試。
  - 完成條件：測試通過。開啟前端覆蓋率門檻：`src/lib`、`src/keys`、`src/focus`、`src/store` 合計 ≥ 90%，`make test` 與 CI 都檢查。

- [x] **T21 路由與歷史**
  - 參考：[04](../04-architecture.md) §4.3
  - 內容：路由表，**一次登記全部路由**，還沒做的畫面先放佔位元件，之後各畫面任務只改自己的檔案，平行開發時比較不會衝突；面板用 `?sheet=`，打開時 push、關閉時 back；分頁用 replace；啟動時還原上次的畫面（先換成首頁再 push）；未知路徑導回首頁。
  - 測試：用 memory router 測 push 與 replace 的次數、還原後按返回會回到首頁。
  - 完成條件：測試通過。

- [x] **T22 API client 與 queries**
  - 參考：[04](../04-architecture.md) §4.5、§6.1、§6.2
  - 內容：
    - `fetch` 包裝：10 秒逾時、依錯誤碼轉換錯誤、帶 demo 標頭。
    - TanStack Query 的預設值；每個端點一個 query hook。
    - `msw` 的 handlers 與 fixtures：由 API 實際回應存下來。
  - 測試：逾時；503 時保留舊資料；錯誤碼轉換。
  - 完成條件：測試通過。

- [x] **T23 元件**
  - 參考：[03](../03-ux-ui.md) §4、§6、§8；`ui-mockup/src/icons.js`、`render-core.js`、`phone.css`
  - 內容：
    - Header、InfoBar、SoftKeys、Tabs、Card、CropIcon（搬移所有 SVG）、KeyCap、Pill、Sparkline、TrendChart、MetricGrid、Sheet、StatusBox、Skeleton。
    - `/debug/components` 展示頁：只在 dev 或 demo 建置時存在。
  - 測試：Pill 的符號與顏色依國家；TrendChart 遇到 `null` 會斷線；Card 沒有資料時顯示「—」。
  - 完成條件：測試通過。

- [x] **T24 🔍 大段落檢查 A**
  - 參考：[07](../07-dev-workflow.md) §4
  - 內容：
    - `playwright.config.ts`；自訂報告只輸出 JSON 摘要；失敗時才存截圖。
    - 檢查項目：溢出、字級下限、沒有 console error。
    - 在 240×320 與 128×160 兩種尺寸檢查 `/debug/components`。
    - Makefile 加 `e2e`。
  - 完成條件：`make e2e` 通過。有問題就在這個任務內修好。

## Phase 1-D：畫面

每個畫面的測試都用 Testing Library 加 `msw`：按鍵 → 焦點或畫面變化 → 軟鍵標籤正確。

- [x] **T25 首頁（F02）**
  - 參考：[02](../02-product-spec.md) §5.2
  - 內容：「關注」清單；「全部作物」九宮格；◀ ▶ 換分頁；`*` 切換批發／零售；`#` 先接一個空的面板（T31 完成）；1–9 直接開啟；軟鍵。
  - 完成條件：測試通過。

- [x] **T26 作物清單（F03）**
  - 參考：[02](../02-product-spec.md) §5.3
  - 內容：分類、全部、最近看過三種清單。
  - 完成條件：測試通過。

- [x] **T27 作物詳情：行情（F04）**
  - 參考：[02](../02-product-spec.md) §5.4
  - 內容：大數字卡、「本地區 N 個市場」卡片、三個指標、零售時的說明。
  - 完成條件：測試通過。

- [x] **T28 作物詳情：走勢**
  - 參考：[02](../02-product-spec.md) §5.4
  - 內容：`#` 切換 7 日與 30 日、休市日斷線、三個指標。
  - 完成條件：測試通過。

- [x] **T29 作物詳情：比價與排序面板**
  - 參考：[02](../02-product-spec.md) §5.4
  - 內容：預設排序是價格高到低；四種排序；名次說明；自己的地區標「你」；OK 開啟該地區的詳情。
  - 完成條件：測試通過。

- [x] **T30 本地區各市場、單一市場（F05）**
  - 參考：[02](../02-product-spec.md) §5.5
  - 內容：包含零售時的說明與「看批發」出口。
  - 完成條件：測試通過。

- [x] **T31 換地區（F07）**
  - 參考：[02](../02-product-spec.md) §5.6
  - 內容：`#` 面板（最近 3 個地區＋其他地區…）；完整地區清單（依距離排序、資料狀態點、最後一項「更改國家…」）；在首頁換的是「我的地區」，在詳情頁換的是「正在看的地區」。
  - 完成條件：測試通過。

- [x] **T32 首次設定（F01）**
  - 參考：[02](../02-product-spec.md) §5.1
  - 內容：語言 → 其他語言（每頁 4 個）→ 確認位置 → 國家 → 地區；推測不到位置時跳過確認；選「是」直接進首頁，關注清單用預設。
  - 完成條件：測試通過。

- [x] **T33 選單、編輯關注、設定、關於（F08–F11）**
  - 參考：[02](../02-product-spec.md) §5.7
  - 內容：左軟鍵選單（詳情頁多「加入／取消關注」）；設定五列；demo 建置時多一列「Demo」（F18）；「關於與資料說明」的文字照草圖。
  - 完成條件：測試通過。

- [x] **T34 🔍 大段落檢查 B**
  - 參考：[07](../07-dev-workflow.md) §4；[02](../02-product-spec.md) §7
  - 內容：
    - Playwright 對完整服務跑主要流程，只用按鍵。
    - 每個畫面在兩種尺寸下檢查：溢出、焦點看得見、字級下限、沒有 console error。
  - 完成條件：`make e2e` 通過。有問題就在這個任務內修好。

## Phase 1-E：狀態與收尾

- [x] **T35 狀態（F12）**
  - 參考：[02](../02-product-spec.md) §6；[04](../04-architecture.md) §8
  - 內容：
    - 骨架畫面；連線失敗時保留舊資料並標示；地區今天未更新；沒有零售資料；沒有資料。
    - 每個畫面包一層 error boundary。
  - 測試：每種狀態都用 `msw` 重現，並檢查畫面上的出口可以用。
  - 完成條件：測試通過；demo 開關可以在完整服務上重現每種狀態。

- [x] **T36 離開與恢復（F13）與 demo 開關（F18）**
  - 參考：[02](../02-product-spec.md) §5.7；[08](../08-platform-constraints.md) §7
  - 內容：
    - 每個動作都存。重新開啟時回到原畫面與焦點，而且按返回會回到首頁。
    - 設定頁的「Demo」列可以切換三個開關。
  - 測試：重新載入後的畫面與焦點；demo 標頭有帶上。
  - 完成條件：測試通過。

- [ ] **T37 128×160 收尾**
  - 參考：[03](../03-ux-ui.md) §6
  - 內容：逐一套用每個畫面的縮減規則。
  - 完成條件：`make e2e` 在 128×160 全部通過。

- [ ] **T38 README**
  - 參考：[00](../00-overview.md)；[04](../04-architecture.md) §1、§9、§10；[05](../05-tech-stack.md)
  - 內容：根目錄 `README.md`，用繁體中文。評審打開 repo 第一眼看到的就是它。
    - 一句話介紹，加上 2–3 張 240×320 截圖。截圖用 Playwright 腳本產生到 `docs/images/`，可以重複產生；Makefile 加 `screenshots`。
    - 快速開始：`cp .env.example .env && make up` → `http://localhost:8080`；怎麼開 demo 模式；API 文件在 `/api/docs`。
    - mermaid 架構圖（內容同 04 §1）。
    - 技術選型表，每項一句理由（連到 05）。
    - 技術亮點：依評分的三個面向（軟體架構、前端、後端與雲端）列出，每一點連到對應的程式或文件（內容來自 04 §9）。
    - 測試：怎麼跑、覆蓋率門檻、CI 做了哪些檢查。
    - 簡化版的專案結構與文件地圖（連到 `docs/00-overview.md`）。
  - 完成條件：README 裡的每個指令都實際執行過而且正確；所有連結都指向存在的檔案；mermaid 語法正確。

- [ ] **T39 🔍 大段落檢查 C：baseline 驗收**
  - 參考：[02](../02-product-spec.md) §7
  - 內容：
    - Playwright：全部畫面 × 兩種尺寸。
    - 主要流程跑四個組合：印度 × English、印度 × 繁中、台灣 × 繁中、台灣 × English。
    - 確認：切換批發／零售時所有數值一起變；切換語言不會改變國家與地區。
    - `make lint`、`make test`、`make audit`、`make e2e` 全部通過；`docker compose up` 從空的資料庫開始也能正常運作；README 的快速開始照著做可以跑起來。
  - 完成條件：以上全部成立。在 `progress.md` 寫 baseline 完成摘要，包括做了什麼、[`decisions.md`](decisions.md) 的重點、還沒做的事、給 Phase 2 的注意事項。**然後停止**，等人接手 Phase 2。
