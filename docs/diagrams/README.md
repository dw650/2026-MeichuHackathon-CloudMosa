# AgriPrice 架構流程圖

以程式繪製的 16:9 架構圖，呈現使用者查詢、背景更新，以及 Gemini 新聞摘要三條流程。

## 參考圖版（v2）

`agriprice-architecture-v2.*` 參考根目錄 `image.png` 的橫向配置，加入 CI/CD、
獨立的來源卡片與技術圖示。內容依程式修正：部署採 main CI 通過後更新 deploy 分支、
伺服器定時拉取；Worker 放在 Docker Compose 範圍內；Caddy 使用 C 字圖示，
不使用參考圖誤植的 Nginx 標誌；補上印度 Agmarknet。

```bash
python docs/diagrams/render_architecture_reference.py
inkscape docs/diagrams/agriprice-architecture-v2.svg --export-text-to-path --export-plain-svg --export-filename=docs/diagrams/agriprice-architecture-v2-outlined.svg
```

v2 同樣提供 4K PNG、向量 SVG、PDF 與可編輯 draw.io。

Python Worker 使用 Python 藍黃雙蛇圖示，PostgreSQL 資料庫使用大象圖示。
兩者皆以原始 SVG 嵌入，輸出檔不需連線載入圖示；draw.io 內可獨立移動與縮放。
原始圖檔存於 `assets/`，來源為 [Python 官方標誌頁](https://www.python.org/community/logos/)
與 [PostgreSQL 官方 Wiki 標誌頁](https://wiki.postgresql.org/wiki/Logo)。

## 第一版

| 檔案 | 用途 |
|---|---|
| `agriprice-architecture.png` | 3840 × 2160 PNG，可直接插入簡報，字型不受電腦環境影響 |
| `agriprice-architecture.svg` | 保留文字的向量原檔，可放大或用向量編輯器修改 |
| `agriprice-architecture-outlined.svg` | 文字轉成向量路徑，跨電腦使用時不需要安裝字型 |
| `agriprice-architecture.drawio` | diagrams.net / draw.io 可編輯版；方塊、文字、箭頭都是獨立物件 |
| `agriprice-architecture.pdf` | 向量 PDF，可列印或分享 |
| `agriprice-architecture-preview.png` | 1920 × 1080 預覽 |

資料來源依 `backend/app/ingest/registry.py`、`backend/app/ingest/intl/` 與
`backend/app/ingest/news/` 整理。包含台灣農業部、印度 Agmarknet、馬來西亞
PriceCatcher、世界銀行 Pink Sheet、匯率、Google News；實際啟用依部署設定。
AI 節點依簡報需求只呈現 Gemini。

重新產生一般版本：

```bash
python docs/diagrams/render_architecture.py
```

需要 Python 3、Pillow、Noto Sans CJK TC 與 `rsvg-convert`。
如要產生文字轉路徑的版本，另需 Inkscape：

```bash
inkscape docs/diagrams/agriprice-architecture.svg --export-text-to-path --export-plain-svg --export-filename=docs/diagrams/agriprice-architecture-outlined.svg
```

手動編輯 draw.io 檔不會同步回產生程式；重新執行產生程式會覆寫一般版本的輸出。
