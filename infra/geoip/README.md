# IP 地理資料庫

`GET /api/v1/locate` 用使用者的網路位址推測地區（F17）。推測要查一個本機的 IP 地理資料庫（mmdb 格式）；**檔案不在 Git 裡**，需要時自己下載。沒有檔案時 api 照常啟動，`/locate` 一律回傳「推測不到」（`null`），前端改成讓使用者自己選國家與地區。

## 下載（免註冊）

預設用 [DB-IP](https://db-ip.com/db/download/ip-to-city-lite) 的 **IP to City Lite**，每月更新，不需要帳號：

```bash
make geoip                     # 下載本月版本到 infra/geoip/city.mmdb
docker compose restart api     # 讓 api 載入新檔案
```

也可以手動下載：

```bash
curl -fL https://download.db-ip.com/free/dbip-city-lite-2026-09.mmdb.gz | gunzip > infra/geoip/city.mmdb
```

- compose 把 `infra/geoip/` 唯讀掛到 api 容器的 `/data/geoip/`，api 讀 `GEOIP_DB_PATH`（預設 `/data/geoip/city.mmdb`）。
- 授權是 CC BY 4.0，使用時要標示「IP Geolocation by DB-IP」。
- 也可以改用 MaxMind GeoLite2 City（需要註冊帳號），格式相同，放到同一個路徑即可。

## 注意

- `*.mmdb` 已列在 `.gitignore`，不要加進 Git。
- 測試不依賴這個檔案：單元測試用假的查詢介面。
- IP 只用來推測位置，不保存、不寫進日誌。
