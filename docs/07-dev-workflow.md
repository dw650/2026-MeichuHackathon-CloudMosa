# 07 開發流程

> 開發階段、Git、測試、CI/CD、部署與完成的定義。人和 coding agent 都照這份做。

## 1. 開發階段【決定】

| 階段 | 內容 | 完成條件 |
|---|---|---|
| Phase 0 骨架 | 建專案、compose 能起、CI 架好、除錯頁 | `make up` 後首頁與 `/api/v1/health` 都能開；CI 的每個步驟在本機通過（GitHub 上實際執行要等人 push） |
| Phase 1 Baseline | F01–F18（[02](02-product-spec.md) §3.1） | [02](02-product-spec.md) §7 的驗收條件在本機 Chrome 全部通過 |
| Phase 2 Simulator | 部署到公開 HTTPS，在官方 Simulator（有實機就加上實機）測試 | 驗收條件在 Simulator 通過；[08](08-platform-constraints.md) §12 的清單回填 |
| Phase 3 加分項 | 依團隊決定的順序（[02](02-product-spec.md) §3.2） | 每項各自完成，且不破壞 baseline |

- **Simulator 完整測試放在 Phase 2**，baseline 完成後才做。
- 建議（非必要）：Phase 0 如果已經有公開網址（例如 tunnel），花 15 分鐘把除錯頁載入 Simulator，先確認 viewport 與按鍵，避免 Phase 1 整個做在錯的假設上。

### 1.1 Phase 0：骨架

1. 依 [04](04-architecture.md) §10 建立資料夾、`compose.yaml`、`compose.dev.yaml`、`Makefile`、`.env.example`。
2. 後端：FastAPI + `/api/v1/health`、Alembic 初始 migration、pytest 能跑。
3. 前端：Vite + React + TS strict、tokens.css、Shell（header／內容／軟鍵列）、Vitest 能跑。
4. **CI**：`ci.yml` 在這個階段就建好（§5），之後每次 push 都跑。
5. 除錯頁（只在 dev 與 demo 建置）：
   - `/debug/keys`：列出每次按鍵的 `key`、`code`、`repeat`、時間差。
   - `/debug/viewport`：`innerWidth`、`innerHeight`、`devicePixelRatio`、字級樣本（10–17px、Roboto 700／900、中文、天城文）、`Intl` 的 `en-IN` 與 `zh-TW` 格式範例。
   - `GET /api/v1/debug/headers`（只在 `DEMO_MODE`）：回傳收到的 `X-Forwarded-For`、`X-Client-Forwarded-For`。

### 1.2 Phase 1：Baseline 的建議順序

由下往上、每一步都能跑：

| 步驟 | 內容 | 大段落檢查 |
|---|---|---|
| 1 | seed（國家、地區、市場、作物）、mock provider、正規化、檢查、彙整 | — |
| 2 | services：地區價、漲跌、指標、新舊、比價、位置推測 | — |
| 3 | API 端點、錯誤格式、OpenAPI → 前端型別 | — |
| 4 | 前端基礎：按鍵範圍堆疊、焦點、路由與歷史、store persist、i18n、元件 | ✅ Playwright：元件頁在兩種尺寸不溢出 |
| 5 | 畫面：首頁 → 作物詳情（行情、走勢、比價）→ 本地區各市場 → 單一市場 → 換地區 → 首次設定 → 選單、編輯關注、設定、關於 | ✅ Playwright：主要流程＋兩種尺寸 |
| 6 | 狀態（F12）與 demo 開關（F18）、離開與恢復（F13） | — |
| 7 | 128×160 收尾、全部驗收條件 | ✅ Playwright：全部畫面 × 兩種尺寸 |

## 2. Git【決定】

- `main` 永遠可以跑、CI 永遠是綠的。
- 每個工作開一個本地分支：`feat/<主題>`、`fix/<主題>`、`docs/<主題>`、`chore/<主題>`。
- **不開 PR**。完成後在本地合併（以下是人的做法；agent 不 pull、不 push，並且在合併**前**先跑測試，見 [`plan/baseline.md`](plan/baseline.md)）：
  ```bash
  git switch main && git pull
  git merge --no-ff feat/<主題>
  make test && make lint        # 合併後在本地再跑一次
  git push
  ```
- 衝突在本地解決，解完一定重跑測試。
- commit 訊息用英文 Conventional Commits：`類型(範圍): 說明`（`feat`、`fix`、`test`、`refactor`、`docs`、`chore`），一個 commit 做一件事。程式碼註解與識別字也用英文；docs 用繁體中文。
- `.env`、mmdb 檔、API 金鑰不進 Git。
- **coding agent**：可以自己開分支、commit、在本地 `merge --no-ff` 進 `main`；**不 push**、不開 PR、不 force push、不改寫 `main` 的歷史。push 由人確認後執行。

## 3. 測試：TDD【決定】

平常用「紅 → 綠 → 重構」：

1. **紅**：先寫一個會失敗的測試，描述一個行為。
2. **綠**：寫剛好讓它通過的程式。
3. **重構**：在測試保護下整理程式。

| 對象 | 測試方式 | 範例 |
|---|---|---|
| 後端 services | pytest 單元測試，純函式 | 偶數個市場的中位數、休市日不算舊資料、同價同名次 |
| 後端 ingest | pytest，用 fixtures 的原始資料 | 民國日期轉換、quintal 換成每公斤、異常值被丟掉 |
| 後端 API | `TestClient` + compose 的 PostgreSQL | 錯誤格式、404、demo 標頭在非 demo 模式被忽略 |
| 前端 `lib/` | Vitest | 單位換算、lakh 分組、「3 天前」 |
| 前端 按鍵、焦點、store | Vitest + Testing Library | 九宮格最左欄按 ◀ 回到「關注」、面板打開時按鍵不穿透、壞掉的 `localStorage` 會重設 |
| 前端 畫面行為 | Testing Library + `msw` | 按 `*` 後標籤與價格一起變、沒有零售資料時顯示原因 |
| 版面 | **不寫單元測試**，交給 Playwright 大段落檢查 | — |

### 3.1 省 token 的做法

- 開發中只跑相關的測試：`npx vitest related <檔案> --run`、`uv run pytest tests/unit/test_pricing.py -q`。
- 合併前才跑全部。
- 用精簡輸出：Vitest `--reporter=dot`、pytest `-q`；失敗時才看完整訊息。
- 不要為了確認而重複跑已經通過的測試；不要把整份測試輸出貼進對話。

## 4. UI 檢查：Playwright（只在大段落）【決定】

- **什麼時候跑**：§1.2 表格標 ✅ 的時間點、合併大功能分支前、進 Phase 2 前。**平常的小改動不跑**。
- **怎麼跑**：`make e2e`，對 compose 起的完整服務（mock 資料、`DEMO_MODE=true`）。
- **檢查項目**：

| 項目 | 怎麼判斷 |
|---|---|
| 沒有水平溢出 | `document.documentElement.scrollWidth <= innerWidth` |
| 固定區塊沒有溢出 | header、資訊列、軟鍵列、卡片的 `scrollHeight <= clientHeight`、`scrollWidth <= clientWidth`（有省略號的文字除外） |
| 焦點看得見 | `document.activeElement` 有 `data-focus-id`，而且完整在內容區內 |
| 字級下限 | 所有可見文字的 computed `font-size` ≥ 11px（128×160：≥ 10px） |
| 按鍵流程 | [02](02-product-spec.md) §7 的主要流程，只用 `keyboard.press`；右軟鍵用 `page.goBack()`，左軟鍵用 `Escape` |
| 沒有錯誤 | 過程中沒有 console error、沒有未處理的 promise rejection |

- **尺寸**：240×320、128×160（B7 加上 1280×800）。
- **輸出要精簡**：測試最後只輸出一份 JSON 摘要（每個畫面 × 尺寸：通過或失敗的項目與數值）。**只有失敗時才存截圖**到 `frontend/e2e/artifacts/`，需要時再打開那一張來看。
- 截圖不做像素比對（畫面還在變，維護成本太高）。

## 5. CI／CD

### 5.1 CI：`.github/workflows/ci.yml`（Phase 0 就建好）

每次 push 任何分支都跑，目標在 5 分鐘內：

| job | 步驟 |
|---|---|
| frontend | `npm ci` → ESLint → `tsc --noEmit` → Vitest（含覆蓋率門檻）→ npm audit（正式依賴，high 以上就失敗）→ `vite build` |
| backend | `uv sync` → ruff → mypy → pytest（含覆蓋率門檻，用 GitHub Actions 的 PostgreSQL service）→ `pip-audit` |
| contract | 由後端產生 OpenAPI → 產生前端型別 → `git diff --exit-code`（型別過期就失敗） |
| images | `docker compose build` |

`e2e.yml`：手動觸發，以及 push 到 `main` 時跑 Playwright。

兩個依賴檢查（npm audit、pip-audit）都經過 `scripts/audit.py`。找到漏洞，或出現不是網路／服務造成的錯誤，一律失敗。漏洞資料庫連不上時重試 3 次，還是不行就只顯示警告、不算失敗，下一次執行會再檢查。例：2026-09-20 npm 的 audit 服務維修，CI 因此失敗，擋住了部署。

### 5.2 部署：`scripts/deploy.sh`

在伺服器上的 repo 目錄執行，手動部署與 CD 都用它：

1. `git fetch`，把指定的 ref（分支、tag 或 commit，預設 `main`）checkout 成 detached HEAD。伺服器上不要改追蹤的檔案，部署時會被覆蓋。
2. `docker compose up -d --build --wait`（`api` 啟動時自動跑 migration），等所有服務都健康。
3. 經過 web（Caddy）打 `/api/v1/health`；成功就把這個 commit 記成上一個成功的版本（`.git/deploy-last-good`）。部署時把 commit 帶進 `APP_VERSION`，`/api/v1/health` 與「關於」頁會顯示目前的版本（`make up` 也會帶入）。
4. 失敗時印出最近的日誌、自動部署上一個成功的版本，並回傳非 0。
5. 回復就是部署較舊的 commit：`scripts/deploy.sh <commit>`。同一時間只會有一個部署在跑。

目前的伺服器【查核 2026-09-20】：

- 主辦單位的 VM `203.116.30.131`（Ubuntu 24.04，Docker 已裝）。repo 在 `~/2026-MeichuHackathon-CloudMosa`，是 dw650/2026-MeichuHackathon-CloudMosa 的 clone。同一台 VM 上還有組員的其他專案，部署只動這個目錄。
- 伺服器用唯讀的 deploy key（`~/.ssh/github_deploy_harrykuo1`）拉程式，只設定在這個 repo 的 `core.sshCommand`。dw650 組織預設停用 deploy key，要先在組織設定裡允許，repo 的 Settings → Deploy keys 才能新增。
- `.env` 手動建立、不進 Git：`WEB_PORT=3001`、`SITE_ADDRESS=:8080`、`DEMO_MODE=false`、`VITE_DEMO=false`，`POSTGRES_PASSWORD` 已換掉。
- 對外只開 22（只開給部分網路）、3000、3001，80／443 被擋，所以網址是 `http://203.116.30.131:3001`（沒有 HTTPS）。Cloud Phone 需要 HTTPS 時，請主辦單位開 80／443，在 `.env` 加上 `SITE_ADDRESS=<網域>`（沒有網域可以用 `203-116-30-131.sslip.io`）與 `COMPOSE_FILE=compose.yaml:compose.prod.yaml`，Caddy 會自己取得憑證；或改用 Cloudflare Tunnel。
- 手動部署：`ssh -i ~/.ssh/cloudphone -o IdentitiesOnly=yes ubuntu@203.116.30.131 '~/2026-MeichuHackathon-CloudMosa/scripts/deploy.sh main'`。
- 還沒有伺服器，或想即時分享開發中的畫面時，用 tunnel（Cloudflare Tunnel 或 ngrok）把本機的 Caddy 暴露成公開 HTTPS 網址。

### 5.3 CD：`.github/workflows/deploy.yml`（加分項 B1）

- dw650/2026-MeichuHackathon-CloudMosa 的 `main` CI 通過後（`workflow_run`），Deploy workflow 用 `GITHUB_TOKEN`（`contents: write`）把 `deploy` 分支移到這個 commit。也可以在 Actions 頁面手動執行 Deploy 並指定 ref，用來回復。
- GitHub 的機器連不進伺服器：22 port 只開給部分網路【查核 2026-09-20】，Actions 用 SSH 連線會逾時。所以改由伺服器主動拉：systemd 計時器 `agriprice-deploy.timer` 每分鐘執行 `scripts/deploy-poll.sh`，`deploy` 分支有新的 commit 就用 deploy key fetch，再執行 `deploy.sh`。單元檔在 `infra/deploy/`，安裝指令寫在檔案開頭。
- 部署失敗時，`deploy.sh` 會自動回到上一個成功的 commit。同一個失敗的 commit 不會每分鐘重試，要等更新的 commit，或手動執行 `deploy.sh`。
- GitHub 上的 Deploy 只代表「已標記」；有沒有部署成功，要看網站或伺服器的 `journalctl -u agriprice-deploy`。
- 不要手動 commit 到 `deploy` 分支。

## 6. 常用指令

| 指令 | 內容 |
|---|---|
| `make up` | 用正式設定起所有服務（`docker compose up -d --build`） |
| `make dev` | 開發模式：Vite HMR、api `--reload`（`compose.yaml` + `compose.dev.yaml`） |
| `make down` | 停止所有服務 |
| `make test` | 前端 Vitest + 後端 pytest（全部） |
| `make lint` | ESLint、tsc、ruff、mypy |
| `make audit` | `npm audit`、`pip-audit` |
| `make types` | 由 OpenAPI 重新產生前端型別 |
| `make e2e` | Playwright 大段落檢查 |
| `make screenshots` | 重新產生 README 用的截圖到 `docs/images/` |
| `make seed` | 重新同步 seed 並產生 mock 資料 |
| `make logs` | 看 api 與 worker 的日誌 |

## 7. 完成的定義（每個功能）

- 符合 [02](02-product-spec.md) 的規格，並依 [03](03-ux-ui.md) 的樣式實作。
- 先寫測試再寫程式，測試通過；lint 與型別檢查通過。
- 新增的介面文字有繁中與英文；沒有寫死的字串。
- 載入中、錯誤、沒有資料三種狀態都處理，而且都有出口。
- 每個畫面的左／中／右軟鍵標籤正確；只用按鍵就能走完。
- 行為和文件不一樣時，先和團隊確認，再同步更新 docs（特別是 [00](00-overview.md) 的決定表）。
- 合併進 `main` 後 CI 是綠的。
