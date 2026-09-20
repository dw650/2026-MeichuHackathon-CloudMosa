#!/usr/bin/env python3
"""Draw a horizontal architecture diagram using image.png as a layout reference.

The content is checked against the repository: CI/CD uses a polled deploy branch,
the worker is inside Compose, India is connected, and Gemini is the only AI node.
Run: python docs/diagrams/render_architecture_reference.py
"""

import re
import xml.etree.ElementTree as ET

import render_architecture as d


INK = "#142F4A"
BODY = "#3B5268"
MUTED = "#667D90"
BLUE = "#0879C2"
ORANGE = "#C87117"
PURPLE = "#8151BF"
GREY = "#778B9C"


def asset_icon(name: str, x: float, y: float, w: float, h: float) -> None:
    """Embed the original vector artwork in both SVG and movable draw.io images."""
    icon = ET.parse(d.OUT / "assets" / f"{name}.svg").getroot()
    if "viewBox" not in icon.attrib:
        dimensions = []
        for axis in ("width", "height"):
            match = re.fullmatch(r"([\d.]+)(pt|px)?", icon.attrib[axis])
            if match is None:
                raise ValueError(f"Unsupported SVG dimension: {icon.attrib[axis]}")
            dimensions.append(float(match[1]) * (96 / 72 if match[2] == "pt" else 1))
        icon.set("viewBox", f"0 0 {dimensions[0]} {dimensions[1]}")
    icon.set("width", str(w))
    icon.set("height", str(h))
    icon.set("preserveAspectRatio", "xMidYMid meet")
    for child in list(icon):
        if child.tag.rsplit("}", 1)[-1] in {"metadata", "namedview"}:
            icon.remove(child)
    # Keep gradient and path identifiers unique in the containing diagram.
    ids = {element.get("id"): f"{name}-{element.get('id')}"
           for element in icon.iter() if element.get("id")}
    for element in icon.iter():
        for key, value in list(element.attrib.items()):
            if key == "id":
                value = ids[value]
            else:
                for old, new in ids.items():
                    value = value.replace(f"url(#{old})", f"url(#{new})")
                    if value == f"#{old}":
                        value = f"#{new}"
            element.set(key, value)
    d.raw_icon(x, y, w, h, ET.tostring(icon, encoding="unicode"))


def branch_icon(x: float, y: float, color: str = GREY) -> None:
    d.raw_icon(x, y, 30, 36,
               f'<path d="M8 5V31M8 22C8 14 24 19 24 7" stroke="{color}" '
               'stroke-width="2.5" fill="none"/>'
               f'<g fill="#FFFFFF" stroke="{color}" stroke-width="2.5">'
               '<circle cx="8" cy="5" r="4"/><circle cx="8" cy="31" r="4"/>'
               '<circle cx="24" cy="7" r="4"/></g>')


def bolt(x: float, y: float, size: float) -> None:
    d.raw_icon(x, y, size, size,
               f'<g transform="scale({size/35})">'
               '<circle cx="17.5" cy="17.5" r="17.5" fill="#059B91"/>'
               '<path d="M20 5L9 20H16L14 31L27 15H19Z" fill="#FFFFFF"/></g>')


def cloud_icon(x: float, y: float, color: str = BLUE) -> None:
    d.raw_icon(x, y, 39, 29,
               '<path d="M10 27C-3 27-2 11 8 10C8-3 28-3 30 11'
               f'C43 12 41 27 30 27Z" fill="{color}"/>')


def build_reference() -> None:
    d.rect(0, 0, 1920, 1080, "#FFFFFF", radius=0)
    d.text(960, 79, "AgriPrice 農價｜系統技術架構圖", 44, INK, True, "middle")
    d.text(960, 121, "技術元件、職責與資料流向", 24, MUTED, anchor="middle")

    # The upper lane is the delivery flow, separate from runtime traffic.
    d.rect(38, 151, 1456, 154, "#F4F7FA", "#C8D5DF", 18)
    d.text(59, 183, "CI/CD 部署流程", 22, INK, True)
    ci_cards = [(62, 270), (424, 300), (812, 225), (1128, 340)]
    for x, width in ci_cards:
        d.rect(x, 205, width, 78, "#FFFFFF", "#C6D4E0", 12)
    branch_icon(79, 226, "#2E445B")
    d.text(121, 239, "GitHub Repository", 21, INK, True, max_width=195)
    d.text(121, 267, "程式碼版本管理", 17, MUTED)
    d.raw_icon(443, 222, 30, 37,
               '<path d="M7 7V29H24" fill="none" stroke="#0879C2" stroke-width="2.5"/>'
               '<g fill="#FFFFFF" stroke="#0879C2" stroke-width="2.5">'
               '<circle cx="7" cy="7" r="5"/><circle cx="7" cy="29" r="5"/>'
               '<circle cx="24" cy="29" r="5"/></g>')
    d.text(484, 240, "GitHub Actions", 24, INK, True, max_width=223)
    d.text(484, 267, "Lint / Test / Build", 18, MUTED)
    d.text(836, 240, "deploy 分支", 25, INK, True)
    d.text(836, 267, "main 通過 CI 的版本", 17, MUTED, max_width=180)
    cloud_icon(1147, 224, GREY)
    d.text(1201, 240, "應用伺服器（VM）", 24, INK, True, max_width=250)
    d.text(1150, 268, "定時拉取、部署與健康檢查", 18, MUTED, max_width=296)
    d.arrow([(332, 245), (424, 245)], GREY)
    d.arrow([(724, 245), (812, 245)], GREY)
    d.arrow([(1037, 245), (1128, 245)], GREY)
    d.tag(378, 231, "push", GREY, 17, "#F4F7FA")
    d.tag(768, 231, "CI 通過", GREY, 16, "#F4F7FA")
    d.tag(1082, 231, "每分鐘", GREY, 16, "#F4F7FA")

    # Runtime boundaries precede all connectors, so they cannot hide arrowheads.
    d.rect(666, 357, 830, 606, "#F5F9FC", "#98B5CB", 22, 2)
    d.raw_icon(704, 378, 51, 33,
               '<g fill="#0879C2"><rect x="5" y="10" width="9" height="8" rx="1"/>'
               '<rect x="16" y="10" width="9" height="8" rx="1"/>'
               '<rect x="27" y="10" width="9" height="8" rx="1"/>'
               '<rect x="16" y="0" width="9" height="8" rx="1"/>'
               '<rect x="27" y="0" width="9" height="8" rx="1"/>'
               '<path d="M1 20H39C42 20 43 15 48 15L49 20H51C48 31 42 33 20 33C8 33 2 29 1 20Z"/></g>')
    d.text(769, 410, "Docker Compose", 30, INK, True)
    d.text(1458, 408, "四個容器服務", 19, MUTED, anchor="end")
    d.arrow([(1298, 305), (1298, 357)], GREY)
    d.tag(1382, 339, "部署服務", GREY, 18)

    # A cloud-shaped boundary explicitly places React in CloudMosa's browser.
    d.raw_icon(246, 356, 376, 427,
               '<path d="M26 92C-3 73 11 37 39 38C42 9 81 4 99 23'
               'C122-12 177-2 186 33C215 2 263 19 267 47'
               'C310 24 354 54 347 91C373 95 383 120 368 144'
               'V390Q368 419 337 419H40Q10 419 10 390V129C-2 114 6 96 26 92Z" '
               'fill="#EEF8FF" stroke="#8BBFE4" stroke-width="2.5"/>')
    cloud_icon(286, 423, BLUE)
    d.text(337, 434, "CloudMosa", 24, INK, True)
    d.text(337, 462, "雲端 Chromium", 19, MUTED)

    # Request and response arrows use the same horizontal lanes across all four components.
    d.arrow([(198, 554), (282, 554)], BLUE)
    d.arrow([(282, 634), (198, 634)], BLUE)
    d.arrow([(588, 554), (711, 554)], BLUE)
    d.arrow([(711, 634), (588, 634)], BLUE)
    d.arrow([(876, 554), (980, 554)], BLUE)
    d.arrow([(980, 634), (876, 634)], BLUE)
    d.arrow([(1194, 554), (1284, 554)], BLUE)
    d.arrow([(1284, 634), (1194, 634)], BLUE)

    # Aggregated sources connect only to the worker. No source line crosses the SQL flow.
    d.arrow([(1542, 744), (1515, 744), (1515, 824), (1460, 824)], ORANGE, both=True)
    d.arrow([(1370, 811), (1370, 718)], ORANGE)
    d.arrow([(1460, 865), (1542, 865)], PURPLE)
    d.arrow([(1542, 916), (1460, 916)], PURPLE)

    # Physical handset.
    d.rect(38, 473, 160, 280, "#F0F8EC", "#AECDA0", 16)
    d.rect(87, 505, 62, 123, "#40554C", "#294036", 11, 2)
    d.rect(95, 518, 46, 47, "#C8E3BE", "#A7C6A0", 5)
    d.ellipse(118, 581, 6, 6, "#ADC3BA")
    for row in range(3):
        for col in range(3):
            d.rect(97+col*15, 594+row*9, 10, 5, "#ADC3BA", radius=2)
    d.text(118, 674, "按鍵型手機", 24, INK, True, "middle", 145)
    d.text(118, 712, "農夫／商販", 20, BODY, anchor="middle")

    # React, Caddy and API services are visually consistent, without mixing vendor logos.
    d.rect(282, 485, 306, 243, "#F6FBFF", "#6FB2E2", 16, 2)
    for rotation in (0, 60, 120):
        d.ellipse(435, 540, 36, 13, stroke=BLUE, thickness=2.7, rotation=rotation)
    d.ellipse(435, 540, 5.5, 5.5, BLUE)
    d.text(435, 611, "React 前端", 34, INK, True, "middle")
    d.text(435, 652, "TypeScript + Vite", 21, BODY, anchor="middle")
    d.text(435, 695, "行情・走勢・比價・新聞", 20, BODY, anchor="middle", max_width=280)

    d.rect(711, 492, 165, 228, "#FFFFFF", "#B0C7D8", 14, 2)
    d.rect(765, 521, 57, 57, "#E1EFE7", radius=14)
    d.text(793.5, 563, "C", 39, "#29744E", True, "middle")
    d.text(793.5, 617, "Caddy", 31, INK, True, "middle")
    d.text(793.5, 659, "前端靜態檔", 19, BODY, anchor="middle")
    d.text(793.5, 693, "反向代理", 19, BODY, anchor="middle")

    d.rect(980, 492, 214, 228, "#F0FBF8", "#5DB9B0", 14, 2)
    bolt(1060, 521, 54)
    d.text(1087, 617, "FastAPI", 35, INK, True, "middle")
    d.text(1087, 660, "Python / REST API", 19, BODY, anchor="middle", max_width=191)
    d.text(1087, 695, "查詢、統計與比價", 19, BODY, anchor="middle")

    x, y, w, h, cap = 1284, 452, 176, 266, 24
    d.svg.append(f'<path d="M{x},{y+cap} C{x},{y-cap/3} {x+w},{y-cap/3} {x+w},{y+cap} '
                 f'L{x+w},{y+h-cap} C{x+w},{y+h+cap/3} {x},{y+h+cap/3} {x},{y+h-cap} Z" '
                 'fill="#ECF6FF" stroke="#5B9BCB" stroke-width="2.2"/>')
    d.svg.append(f'<ellipse cx="{x+w/2}" cy="{y+cap}" rx="{w/2}" ry="{cap}" '
                 'fill="#CAE4F8" stroke="#5B9BCB" stroke-width="2.2"/>')
    d.mx_shape(x, y, w, h, "shape=cylinder3;boundedLbl=1;size=24;fillColor=#ECF6FF;strokeColor=#5B9BCB;strokeWidth=2;")
    asset_icon("postgresql", 1339, 506, 66, 68)
    d.text(1372, 607, "PostgreSQL", 23, INK, True, "middle", 164)
    d.text(1372, 641, "資料庫", 24, INK, True, "middle")
    d.text(1372, 671, "行情・匯率", 18, BODY, anchor="middle")
    d.text(1372, 699, "新聞・歷史價格", 18, BODY, anchor="middle")

    # The worker stays inside Compose and writes every result, including news, to PostgreSQL.
    d.rect(1000, 811, 460, 124, "#FFF8EF", "#DEC092", 15, 2)
    asset_icon("python", 1022, 831, 48, 58)
    d.text(1084, 861, "Python Worker", 31, INK, True)
    d.text(1438, 891, "APScheduler + HTTPX", 20, BODY, anchor="end")
    d.text(1024, 917, "排程抓取 → 正規化 → 檢查 → 彙整", 19, BODY, max_width=413)

    # Named external sources are separate cards, matching the reference's scan-friendly layout.
    d.rect(1542, 151, 340, 620, "#FFFAF1", "#E9BB7E", 18, 2)
    d.ellipse(1577, 190, 18, 18, stroke=BLUE, thickness=2)
    d.ellipse(1577, 190, 8, 18, stroke=BLUE, thickness=1.5)
    d.ellipse(1577, 190, 18, 7, stroke=BLUE, thickness=1.5)
    d.text(1610, 199, "外部資料來源", 27, INK, True)
    d.text(1712, 231, "資料來源依設定啟用", 18, MUTED, anchor="middle")
    sources = [
        ("台灣農業部 API", "FarmTransData · 批發行情"),
        ("印度 Agmarknet API", "批發市場行情"),
        ("馬來西亞 PriceCatcher", "CSV 開放資料 · 市場報價"),
        ("World Bank Pink Sheet", "XLSX 月資料 · 國際價格"),
        ("ExchangeRate-API", "匯率資料"),
        ("Google News RSS", "農業新聞與原文"),
    ]
    for index, (title, subtitle) in enumerate(sources):
        top = 248 + index * 83
        d.rect(1558, top, 308, 71, "#FFFFFF", "#CCD9E1", 10)
        d.text(1574, top+30, title, 21, INK, True, max_width=276)
        d.text(1574, top+56, subtitle, 17, BODY, max_width=276)

    # Gemini is the sole model provider in this presentation.
    d.rect(1542, 833, 340, 127, "#F7F0FF", "#B799DC", 16, 2)
    d.raw_icon(1564, 854, 37, 37,
               '<path d="M18.5 0C21 11 26 16 37 18.5C26 21 21 26 18.5 37'
               'C16 26 11 21 0 18.5C11 16 16 11 18.5 0Z" fill="#8151BF"/>')
    d.text(1618, 885, "Gemini API", 31, INK, True, max_width=249)
    d.text(1566, 933, "新聞摘要・作物標籤", 22, BODY)

    # Flow labels are short enough to fit within the connector gaps.
    for cx, baseline, label, size in [
        (240, 541, "按鍵操作", 17), (240, 663, "畫面更新", 17),
        (649, 541, "REST API", 18), (649, 663, "網頁／JSON", 17),
        (928, 541, "API 查詢", 17), (928, 663, "JSON 回應", 17),
        (1239, 541, "SQL 查詢", 17), (1239, 663, "查詢結果", 17),
    ]:
        d.tag(cx, baseline, label, BLUE, size)
    d.tag(1515, 790, "抓取／回傳", ORANGE, 15)
    d.tag(1370, 775, "行情／摘要寫入", ORANGE, 18, "#F5F9FC")
    d.tag(1501, 851, "正文", PURPLE, 17)
    d.tag(1501, 944, "摘要", PURPLE, 17)

    # The legend is outside every runtime boundary, with no extra service implied.
    d.rect(38, 824, 580, 139, "#FBFCFE", "#D6E0E8", 15)
    d.text(60, 857, "箭頭說明", 21, INK, True)
    for x, y, color, caption in [
        (62, 895, BLUE, "使用者查詢與回應"), (330, 895, ORANGE, "背景抓取與資料寫入"),
        (62, 936, PURPLE, "Gemini 新聞摘要與標籤"), (330, 936, GREY, "CI/CD 建置與部署"),
    ]:
        d.arrow([(x, y-7), (x+45, y-7)], color)
        d.text(x+60, y, caption, 17, BODY)
    d.text(47, 1015, "API 讀取整理後的資料；Worker 持續依排程更新。", 20, MUTED)
    d.text(1879, 1015, "Gemini 產生的摘要經 Worker 存入資料庫，再由 API 提供查詢。", 18, MUTED, anchor="end")


if __name__ == "__main__":
    d.INK, d.BODY, d.MUTED = INK, BODY, MUTED
    d.BLUE, d.ORANGE, d.PURPLE, d.GREY = BLUE, ORANGE, PURPLE, GREY
    d.build = build_reference
    d.main("agriprice-architecture-v2")
