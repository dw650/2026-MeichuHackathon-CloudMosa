# 01 研究與設計依據

> 這份說明「為什麼這樣設計」。規格本身在 [02](02-product-spec.md)，這裡只放背景、證據與取捨。
> 研究日期：2026-09-19。

## 1. 題目解讀

### 1.1 出題方的關鍵洞察【查核】

出題方的數據顯示，搭載 Cloud Phone 的手機中，市占最大的品牌是 Nokia，而且許多使用者早就有智慧型手機。按鍵機被當成「第二台手機」，原因有四個：

| 痛點 | 內容 | 本 App 的對應 |
|---|---|---|
| 電力不穩 | 常停電，智慧型手機沒電；按鍵機電池撐數天到數週 | 打開就看到價格，按鍵少、使用時間短；不做任何持續動畫 |
| 治安不良 | 在公共場所拿出智慧型手機容易被搶 | 在市場裡不必拿出智慧型手機，就能查價比價 |
| 環境惡劣 | 沙塵、高溫、潮濕、高強度工作 | 全程實體按鍵操作（手濕、手髒、戴手套都能按）；高對比、大數字 |
| 金融安全 | 詐騙、惡意軟體多 | 不碰金流、不要密碼、不收個資；每個價格都標來源和日期 |

題目要求：為這台作為「生活保險與核心工具」的第二台手機，打造**功能完整、體驗良好**的 App。

### 1.2 題目三的拆解

> 農產品即時價格：讓農夫與商販能查詢各地的農產品即時行情，在資訊不透明的環境中，保障自身經濟利益。

- **兩種使用者**：農夫（賣方），商販（進貨也出貨）。
- **各地**：要能跨地點比較 → 本 App 以「地區」為單位，並有各地區排行。
- **即時**：官方資料最快也只到「每日」（見 [06](06-data.md)），所以「即時」誠實地定義為「當天最新可得的行情，並標出日期與時間」，不宣稱逐筆即時。
- **資訊不透明**：農民不知道行情，中盤商知道 → App 給出可核對的參考價與「別的地方賣多少」。

### 1.3 評分標準與對應【查核】

| 項目 | 比重 | 我們的重點 |
|---|---|---|
| 創意發想 | 15% | 四大痛點落到具體設計；為按鍵機設計的互動（九宮格＝鍵盤、鍵帽提示、`*`／`#` 功能鍵） |
| 技術深度 | 30% | 前後端分離、真的資料管線（抓取 → 正規化 → 中位數彙整 → API）、docker compose、CI |
| 完成度 | 30% | 真的能部署、只用按鍵走完所有流程、載入／錯誤／缺資料都有處理、兩種尺寸 |
| 實用價值 | 25% | 對應生存情境、規模數據、可複製到其他國家（換地區包即可） |

## 2. 平台與市場【查核】

- CloudMosa：2009 年創立，Puffin 瀏覽器，累計下載超過 2 億次；創辦人是台大電機畢業的沈修平。
- Cloud Phone：2026 年 3 月的報導中有 300 萬以上使用者，裝置最便宜約 12 美元；前幾大市場是印度、越南、孟加拉，其次是南非、菲律賓。使用者最常用 YouTube、TikTok。
- 平台上民生、生產力類的 widget 相對少，農產品價格有差異化空間。

## 3. 規模數據（簡報用）【查核】

- 全球約 6.08 億個農場，84% 小於 2 公頃（Lowder et al. 2021）。
- 印度約 1.46 億農戶，86% 是小農或邊際農（2015-16 農業普查）；約 3.5 億人使用按鍵型手機。
- 撒哈拉以南非洲在 2023 年，只有 51% 的行動連線是智慧型手機（GSMA 2024）。

## 4. 價格資訊有沒有用：研究證據【查核】

**有效果的研究**：
- Jensen 2007（印度喀拉拉邦漁民）：利潤增加 8%，消費價格下降 4%。
- Aker 2010（尼日穀物）：市場間價差縮小 10–16%。
- Goyal 2010（印度 e-Choupal 黃豆）：售價提高 1–3%。
- Svensson & Yanagizawa 2009（烏干達廣播）：玉米產地價提高 15%。
- Courtois & Subervie 2015（迦納 Esoko）：玉米售價提高 10%、花生 7%。

**沒效果或結果混雜的研究**：
- Fafchamps & Minten 2012（印度 RML 簡訊服務）：沒有效果。
- Mitra et al. 2018（西孟加拉馬鈴薯）：沒有效果。
- Tigo Kilimo 評估（坦尚尼亞）：有去議價的農民並沒有比較常拿到好價格；70% 的回訪使用者說商人不肯改價。

**結論**：價格資訊能讓市場更有效率，但農民本身能不能多賺，關鍵在於**有沒有別的地方可以賣**。所以本 App 的核心不只是「看價格」，而是「比各地區」：讓使用者知道別處的價格。

## 5. 既有農業價格服務的教訓【查核】

- 很多已經收掉：印度 Reuters Market Light、Nokia Life Tools、WeFarm；迦納 Esoko 還在，但約 2016 年就不再單獨賣價格資料。
- 農民不會付訂閱費；存活的服務多由政府或捐助單位出資，或和貸款、農資綁在一起。→ 延伸潛力的商業模式講**政府、NGO、合作社合作**，不講向農民收費。
- 收集價格是最大成本。→ 用官方開放資料，成本最低。
- 識字率低的地區，語音比文字有效。→ 語音播報列為加分項。

## 6. 2025 往屆作品的教訓【查核】

四個 2025 參賽 repository（CloudNest、CoinMind、廣播 App、meichuhackathon）的共同問題：

- **部署是最大弱點**：拿開發伺服器上線、部署設定壞掉、HTTPS 頁面呼叫 HTTP API。→ 本 App 前後端同一個 HTTPS 網域、docker compose 一鍵起、CI 先架。
- **假資料和空頁面**：聊天、通知是寫死的；有些頁面沒做。→ 少做幾頁，但每頁都用後端 API 的真資料流程。
- **版面**：字小到 6–9px、只做固定 240×320、拿掉焦點框、載入失敗停在 Loading。→ 字級下限、兩種尺寸、焦點永遠可見、每個狀態都有出口。
- **做得好的**：每個畫面自己定義軟鍵標籤；選中項目有外框並捲到可見範圍；每個列表都有載入中、錯誤、空資料三種狀態；伺服器排程簡訊繞過沒有推播的限制。

## 7. 外部意見與我們的取捨

我們兩次請外部模型（Codex、一個沒有對話背景的 Claude）獨立給建議，原文在 [`prompt/`](prompt/)。重要的採用與不採用：

| 議題 | 外部建議 | 我們的決定 |
|---|---|---|
| UI/UX 是否決勝 | 重要，但不等於裝飾；60% 分數在工程 | 採用：心力放在互動品質、狀態、兩種尺寸 |
| 批零價差 | 不能說成「中間商拿走的錢」 | 採用：baseline 不顯示價差百分比，「資料說明」寫明差額不是利潤 |
| 地區價算法 | 各市場代表價的中位數，並標樣本數 | 採用 |
| `#` 在比價頁 | 打開排序面板（1–4），不是輪流切換 | 採用 |
| 首頁換地區 | 打開清單，不要盲目輪流切換 | 採用 |
| 語言首頁 | 三個語言加「其他」；手機語言排第一 | 採用 |
| 全球比價 | 降為「國際參考價」加分頁 | 採用；比價只在同一國家內 |
| 比較範圍 | 附近／同城／全國三種 | 不採用；只做各地區排行，排序可選距離 |
| 線框文字密度 | 每屏 2–3 筆、很多說明文字 | 不採用；每屏 4–5 筆，說明集中到「關於與資料說明」頁 |
| 印地文 | 列入 baseline 完整翻譯 | 未決定；baseline 先做繁中與英文，印地文標「尚未提供」 |

## 來源

- 題目：[`problem/problem.pdf`](problem/problem.pdf)・工作坊：[`problem/notes.pdf`](problem/notes.pdf)
- 市場：[Connecting Africa（2026-03）](https://www.connectingafrica.com/cloud-networking/cloudmosa-s-cloud-based-phones-are-gaining-traction-in-sa)・[CloudMosa](https://www.cloudmosa.com/overview)
- 規模：[Lowder et al. 2021](https://ideas.repec.org/a/eee/wdevel/v142y2021ics0305750x2100067x.html)・[GSMA SSA 2024](https://event-assets.gsma.com/pdf/GSMA_ME_SSA_2024_Web.pdf)・[TechCrunch 2024](https://techcrunch.com/2024/07/13/india-clings-to-cheap-feature-phones-as-brands-struggle-to-tap-new-smartphone-buyers/)
- 證據：[Aker 2010](https://www.aeaweb.org/articles?id=10.1257%2Fapp.2.3.46)・[Fafchamps & Minten 2012](https://academic.oup.com/wber/article-abstract/26/3/383/1672216)・[Hildebrandt et al. 2023](https://ideas.repec.org/a/eee/deveco/v164y2023ics030438782300055x.html)・[Tigo Kilimo 評估（GSMA）](https://www.gsma.com/solutions-and-impact/connectivity-for-good/mobile-for-development/wp-content/uploads/2015/09/GSMA_Tigo_Kilimo_IE.pdf)
- 既有產品：[Esoko 前 CEO 訪談](https://nextbillion.net/why-we-broke-up-the-company-a-former-ceo-of-m-agri-pioneer-esoko-explains/)・[Reuters Market Light](https://en.wikipedia.org/wiki/Reuters_Market_Light)
- 往屆作品：[CloudNest](https://github.com/mch-cloudmosa-team4/CloudNest)・[CoinMind](https://github.com/awkward-willy/CloudMosa_Hackathon)・[廣播 App](https://github.com/YuanWang08/CloudMosa-2025-MeichuHackathon)・[meichuhackathon](https://github.com/cca814/meichuhackathon)
