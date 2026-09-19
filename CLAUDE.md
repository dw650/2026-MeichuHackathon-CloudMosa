# CLAUDE.md

按鍵型手機（CloudMosa Cloud Phone，240×320）上的農產品行情 App，是 2026 梅竹黑客松 CloudMosa 組第 3 題的作品。前端 React + TypeScript + Vite，後端 FastAPI，資料庫 PostgreSQL，所有服務用 docker compose 起。

## 先讀

- 任何工作開始前：`docs/00-overview.md`（決定表、文件地圖、名詞表）。
- 自動執行 baseline：`docs/plan/baseline.md`，從第一個沒打勾的任務繼續，並照該檔的「每個任務的做法」與「自己決定還是停下來」。照該檔的「平行開發」一節：主 session 自己做後端與整合，前端交給背景子 agent 在 worktree 做。
- 其他文件依任務的「參考」欄位讀需要的段落，不要整份重讀。

**以誰為準**：
1. docs。其中標【決定】的不能改，要改先問人。
2. docs 沒寫的：照互動草圖 `docs/ui-mockup/`。介面文字以 `docs/ui-mockup/src/data.js` 的 `STR` 為準。
3. 草圖也沒有的：選最簡單的做法，記進 `docs/plan/decisions.md`。

`docs/ui-mockup/` 是參考實作，不要把它的程式直接複製進正式程式。`docs/problem/` 與 `docs/prompt/` 只讀，不要修改。

## 語言

- 回覆使用者：繁體中文（台灣）。
- 程式碼註解、識別字、commit 訊息：英文。
- docs：繁體中文。

## 指令

| 指令 | 用途 |
|---|---|
| `make up` / `make down` | 起／停所有服務；網址是 `http://localhost:<WEB_PORT>`（預設 8080） |
| `make dev` | 開發模式（Vite HMR、api `--reload`） |
| `make test` | 前端 Vitest ＋ 後端 pytest |
| `make lint` | ESLint、tsc、ruff、mypy |
| `make audit` | 依賴套件安全檢查（`npm audit`、`pip-audit`） |
| `make types` | 由後端 OpenAPI 重新產生 `frontend/src/api/schema.d.ts` |
| `make e2e` | Playwright 大段落檢查（只在大段落跑） |
| `make seed` / `make logs` | 重新產生 mock 資料／看日誌 |
| `make screenshots` | 重新產生 README 用的截圖 |

開發中只跑相關的測試：`npx vitest related <file> --run --reporter=dot`、`uv run pytest <path> -q`。合併前才跑 `make test` 全部。

## 不能違反的規則

**平台**（細節見 `docs/08-platform-constraints.md`）
- 按鍵只用 `event.key` 判斷，不用 `keyCode`／`code`（`#` 和 `3` 的 code 相同）。
- 左軟鍵是 `Escape`（開選單）。右軟鍵不是按鍵事件：每個畫面與面板都是一筆瀏覽歷史，靠 `history.back()` 返回。
- 不用 `alert`、`confirm`、`prompt`；不用 GPS、推播、Service Worker（PWA 只在非 Cloud Phone 啟用）。
- 不做動畫、跑馬燈、自動輪詢（每次畫面變動都耗使用者流量）。
- 每個使用者動作立刻存進 `localStorage`，不要等關閉時才存。
- 日期由後端依國家時區算好，前端不自己判斷「今天」。

**UI**（細節見 `docs/03-ux-ui.md`）
- 焦點永遠看得見，用真正的 DOM focus；返回時依項目 ID 還原焦點。
- 字級下限：240×320 是 11px；128×160 是 10px（中文 11px）。放不下就少放、換頁或移到詳情頁，不縮字。
- 同時支援 240×320 與 128×160；版面用實際 `innerHeight`，不寫死 320。
- 不做整條按鍵提示列；同一個提示在畫面上只出現一次。
- 介面文字一律走 i18n，繁中與英文都要有，不寫死。
- 缺資料就顯示「—」與原因，不顯示 0、不補值；不是今天的資料一定要標示。

**資料與 API**（細節見 `docs/06-data.md`、`docs/04-architecture.md`）
- 資料庫與 API 的價格一律是每公斤、當地幣別；單位換算與格式化在前端。
- 地區批發價＝該地區最新交易日有報價的市場代表價的中位數，並附市場數。
- mock 資料和真實資料走同一條管線（provider → 正規化 → 檢查 → 彙整）。
- 後端的依賴方向只能是 routers → services → repositories → db；SQL 只寫在 repositories。
- 前端的 `components/` 不讀 store、不呼叫 API；`screens/` 不直接呼叫 `fetch`、不直接讀 `localStorage`。
- API 錯誤用統一格式 `{"error": {"code", "message", "request_id"}}`；前端依 `code` 顯示 i18n 文字。
- 後端 API 改了就跑 `make types`，前後端型別不能對不上。

## 工作方式

- **TDD**：紅 → 綠 → 重構。版面不寫單元測試，交給 Playwright。核心模組（後端 `services`、`ingest`；前端 `lib`、`keys`、`focus`、`store`）覆蓋率要 ≥ 90%。
- **Playwright** 只在大段落跑（計畫裡標 🔍 的任務、合併大功能前）。輸出只看 JSON 摘要，失敗時才開截圖。
- **省 token**：用精簡的測試輸出；不要重複跑已通過的測試；不要把大段輸出貼進對話。
- **Git**：
  - 每個任務一個本地分支 `feat/tNN-<name>`；小步 commit（英文 Conventional Commits）。
  - 合併前 `make lint` 與 `make test` 都要通過；用 `git merge --no-ff` 合併進本地 `main`。
  - **不 push、不開 PR、不 force push、不改寫 `main` 的歷史**。
  - 前端子 agent 只 commit 在 worktree 的 `track/frontend`，不碰 `main`。
  - `.env`、API 金鑰、`*.mmdb` 不進 Git。
- **什麼時候停下來問人**：需要金鑰或帳號、文件互相矛盾而且牽涉【決定】、同一個問題試了 3 種做法都失敗、要刪除不是自己建立的東西。停之前先在 `docs/plan/progress.md` 寫清楚。
- **行為和 docs 不一致時**：先問人；確認後同步更新 docs，包括 `docs/00-overview.md` 的決定表。
