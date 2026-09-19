# 進度紀錄

> 每完成一個任務就在最下面加一行，只增不改。格式：
> `- YYYY-MM-DD TNN 完成：一句話說明做了什麼（commit 短 hash）`
> 卡住時也要寫：`- YYYY-MM-DD TNN 卡住：卡在哪裡、試過什麼、需要人做什麼`

- 2026-09-19 T01 完成：資料夾結構、.gitignore、.env.example、Makefile（up／down／logs）、compose 只有 db（綁 127.0.0.1:${DB_PORT}），make up 後 db healthy（e76c204）
- 2026-09-19 T02 完成：uv 專案、FastAPI（factory）、pydantic-settings、統一錯誤格式與 X-Request-ID middleware、/api/v1/health、Alembic、Dockerfile、compose api、make test／lint（後端）（dc60f4d）
