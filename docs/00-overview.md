# 00 專案總覽

> docs 的入口。開始任何工作前先讀這份，再依「文件地圖」讀相關文件。給 coding agent 的規則在根目錄的 [`CLAUDE.md`](../CLAUDE.md)。
> 最後更新：2026-09-19

## 一句話

按鍵型手機上的農產品行情 App（Cloud Phone widget）：讓農夫與商販按幾個鍵，就能看到自己地區今天的農產品價格、近期走勢，以及各地區的價格比較。

## 背景

- **比賽**：2026 梅竹黑客松 CloudMosa 組，六選一的第 3 題「農產品即時價格」。題目原文：讓農夫與商販能查詢各地的農產品即時行情，在資訊不透明的環境中，保障自身經濟利益。原始文件見 [`problem/problem.pdf`](problem/problem.pdf)。
- **平台**：CloudMosa Cloud Phone。App 是一般網頁，在 CloudMosa 機房的 Chromium 上執行，畫面傳到按鍵型手機上顯示。詳見 [08](08-platform-constraints.md)。
- **評分**：創意發想 15%、技術深度 30%、完成度 30%、實用價值 25%。技術深度加完成度占 60%，「真的能跑、真的上線」比功能多更重要。
- **使用者**：開發中國家的小農（賣方）與商販（中盤商、零售攤商）。出題方指出，很多人把按鍵機當「第二台手機」，原因是電力不穩、治安不良、環境惡劣、詐騙多。

## 目前狀態（2026-09-19）

- **baseline（T01–T39）已完成**：前後端、資料管線、全部畫面與狀態、兩種尺寸、兩國兩語，`make lint`、`make test`、`make audit`、`make e2e` 都通過。完成摘要在 [`plan/progress.md`](plan/progress.md) 最後；實作時自行決定的事項在 [`plan/decisions.md`](plan/decisions.md)。
- 下一步是 **Phase 2**（部署到公開 HTTPS、在官方 Simulator 測試，並回填 [08 §12](08-platform-constraints.md)），由人接手；通過後再做加分項。
- **CD 已提前完成**（加分項 B1，使用者要求）：dw650/2026-MeichuHackathon-CloudMosa 的 `main` CI 通過後，自動部署到 `http://203.116.30.131:3001`。這台 VM 的 80／443 被擋，還沒有 HTTPS，見 [07 §5.2](07-dev-workflow.md)。

## 關鍵決定

以下都是【決定】，實作時不要自行更改；要改請先和團隊確認。

| 主題 | 決定 | 詳見 |
|---|---|---|
| 位置單位 | **以地區為單位**：台灣＝縣市、印度＝縣（district）。市場是地區底下的細節 | [02](02-product-spec.md) |
| 價格類型 | 批發與零售兩種，全站用 `*` 切換 | [02](02-product-spec.md) |
| 地區價 | 地區內**今天有報價**的各市場代表價的**中位數**，並標出市場數 | [06](06-data.md) |
| 比價範圍 | 只在同一個國家內比較各地區；**不做跨國比價** | [02](02-product-spec.md) |
| 示範國家 | 印度（英文、印地文、盧比）與台灣（繁中、新台幣） | [06](06-data.md) |
| 資料 | 先用 mock 資料，但一定經過後端 API 與資料庫；串接真實資料是加分項 | [06](06-data.md) |
| 位置 | 不用 GPS。由 `X-Forwarded-For` 的 IP 推測地區，再請使用者確認 | [04](04-architecture.md) |
| 畫面尺寸 | 240×320 為主，同時支援 128×160；電腦版 RWD 是加分項 | [03](03-ux-ui.md) |
| 視覺 | 「收成卡片」彩色圖卡風格，每種作物有自己的 SVG 圖示 | [03](03-ux-ui.md) |
| 技術 | 前端 React + TypeScript + Vite；後端 Python FastAPI；PostgreSQL；所有服務用 docker compose 起 | [05](05-tech-stack.md) |
| 開發流程 | 本地開分支、本地 merge、不開 PR；CI 先架好，CD 最後當加分 | [07](07-dev-workflow.md) |
| 測試 | 平常用 TDD（紅→綠→重構）；大段落完成時才跑 Playwright UI 檢查 | [07](07-dev-workflow.md) |
| 不做 | 使用者輸入出價、夜間主題、到手價（扣運費估算）、賣方／買方角色、金流、帳號密碼、GPS、推播、離線、跨國比價、價格預測 | [02](02-product-spec.md) |

## 文件地圖

| 文件 | 內容 | 什麼時候讀 |
|---|---|---|
| [00-overview.md](00-overview.md) | 本文：定位、決定、名詞 | 一開始 |
| [01-research.md](01-research.md) | 題目分析、使用者與市場、既有產品教訓、往屆作品、外部意見 | 需要理解「為什麼這樣設計」時 |
| [02-product-spec.md](02-product-spec.md) | 功能範圍、畫面規格、按鍵規則、狀態、驗收條件 | 做任何功能之前 |
| [03-ux-ui.md](03-ux-ui.md) | 版面、設計 tokens、元件、焦點規則、兩種尺寸 | 寫任何畫面之前 |
| [04-architecture.md](04-architecture.md) | 系統架構、服務、API 契約、資料庫、資料夾結構 | 寫前後端程式之前 |
| [05-tech-stack.md](05-tech-stack.md) | 技術選型、理由與版本 | 建專案、加套件之前 |
| [06-data.md](06-data.md) | 資料來源、正規化、地區價算法、mock 資料規格 | 動到資料或後端計算之前 |
| [07-dev-workflow.md](07-dev-workflow.md) | 開發階段、Git、測試、CI/CD、部署、驗收 | 開始寫程式之前 |
| [08-platform-constraints.md](08-platform-constraints.md) | Cloud Phone 限制、按鍵事件、實機待驗證清單 | 處理按鍵、焦點、儲存、網路之前 |

其他資料夾：

| 資料夾 | 內容 |
|---|---|
| [`problem/`](problem/) | 原始題目與工作坊筆記。`problem.pdf`（題目與評分）、`notes.pdf`（技術規範）是準則；`cloudphone-tech-by-self.md` 是較早整理的平台查核筆記，精簡後的版本在 08 |
| [`prompt/`](prompt/) | 與外部模型（Codex、Claude）討論的 prompt 與回覆，保留作為決策紀錄 |
| [`ui-mockup/`](ui-mockup/) | 互動草圖，打開 `index.html` 即可操作。它是**視覺與互動的參考**，不是正式程式碼；正式實作用 React 重寫 |
| [`plan/`](plan/) | `baseline.md`：baseline 的任務清單（T01–T39）；`progress.md`：進度紀錄；`decisions.md`：實作時自行決定的事項 |

## 標記說明

| 標記 | 意思 |
|---|---|
| 【查核】 | 有官方文件或實際測試的來源（附連結或日期） |
| 【決定】 | 團隊已經決定；要改請先確認 |
| 【待確認】 | 還沒驗證或還沒決定；實作時要保留彈性，不要寫死 |

## 名詞表

| 名詞 | 意思 |
|---|---|
| 國家 | 資料、幣別、單位的最大範圍；比價只在同一個國家內 |
| 地區 | App 的基本單位。台灣＝縣市（例：台北市）；印度＝縣（district，例：Nashik 縣） |
| 市場 | 批發市場（印度 APMC mandi、台灣果菜批發市場），屬於某一個地區 |
| 代表價 | 單一市場某天的批發價。印度用常見價（modal price），台灣用平均價 |
| 地區價（批發） | 地區內當天有報價的各市場代表價的中位數 |
| 零售價 | 地區的零售調查價。以地區為單位，沒有市場細項 |
| 交易日 | 價格對應的市場日期（當地時間），和系統抓資料的時間不同 |
| 關注 | 使用者放在首頁「關注」分頁的作物清單 |
| LSK／RSK | 左軟鍵（觸發 `Escape` 鍵盤事件，用來開選單）／右軟鍵（返回，不是鍵盤事件） |
| QVGA／QQVGA | 240×320／128×160 螢幕 |
| 鍵帽 | 畫面上畫成實體按鍵樣子的提示，例如 `*`、`#`、數字 |
| 面板 | 從畫面底部彈出的選單：左軟鍵選單、換地區、排序 |
| baseline | 第一階段必做的範圍；完成並通過 Simulator 測試後才做加分項 |
