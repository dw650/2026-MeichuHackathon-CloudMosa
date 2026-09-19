#!/usr/bin/env python3
"""把 src/ 裡的頁面、樣式和程式合併成單一個 index.html。

單一檔案才能在沒有資料夾權限的瀏覽器（例如 Flatpak 版 Brave）直接雙擊打開，
也方便傳給隊友。修改請改 src/ 底下的檔案，再執行：python3 docs/ui-mockup/build.py
"""
import re
from pathlib import Path

HERE = Path(__file__).resolve().parent
SRC = HERE / "src"


def read(name: str) -> str:
    return (SRC / name).read_text(encoding="utf-8")


def inline_css(m: re.Match) -> str:
    return f"<style>\n/* ===== {m.group(1)} ===== */\n{read(m.group(1))}</style>"


def inline_js(m: re.Match) -> str:
    body = read(m.group(1))
    if "</script" in body.lower():
        raise SystemExit(f"{m.group(1)} 含有 </script>，不能直接內嵌")
    return f"<script>\n/* ===== {m.group(1)} ===== */\n{body}</script>"


page = read("page.html")
# 只換本地檔名；Google Fonts 的網址含有 : 和 /，不會被比對到
page = re.sub(r'<link rel="stylesheet" href="([\w.-]+\.css)">', inline_css, page)
page = re.sub(r'<script src="([\w.-]+\.js)"></script>', inline_js, page)
(HERE / "index.html").write_text(page, encoding="utf-8")
print(f"wrote {HERE / 'index.html'} ({len(page):,} chars)")
