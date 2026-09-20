#!/usr/bin/env python3
"""Render the presentation architecture diagram without image generation.

Run: python docs/diagrams/render_architecture.py
Requires Python 3, Pillow, Noto Sans CJK TC and rsvg-convert.
All coordinates are on a 1920 x 1080 canvas. The PNG is exported at 3840 x 2160.
"""

from __future__ import annotations

import html
from pathlib import Path
import subprocess
import xml.etree.ElementTree as ET

from PIL import ImageFont


OUT = Path(__file__).resolve().parent
WIDTH, HEIGHT = 1920, 1080
FONT = "/usr/share/fonts/google-noto-sans-cjk-fonts/NotoSansCJK-Regular.ttc"
FONT_BOLD = "/usr/share/fonts/google-noto-sans-cjk-fonts/NotoSansCJK-Bold.ttc"
INK = "#183C2B"
BODY = "#435A4D"
MUTED = "#6B7F73"
BLUE = "#2969A7"
ORANGE = "#B66A1D"
PURPLE = "#8154AE"
GREY = "#7A8F82"

svg: list[str] = []
text_labels: list[str] = []
font_cache: dict[tuple[int, bool], ImageFont.FreeTypeFont] = {}

# A second, native diagrams.net export keeps boxes, labels and arrows editable.
mxfile = ET.Element("mxfile", host="app.diagrams.net", type="device")
diagram = ET.SubElement(mxfile, "diagram", id="agriprice", name="AgriPrice Architecture")
model = ET.SubElement(
    diagram, "mxGraphModel", dx="1920", dy="1080", grid="1", gridSize="10",
    guides="1", tooltips="1", connect="1", arrows="1", fold="1", page="1",
    pageScale="1", pageWidth=str(WIDTH), pageHeight=str(HEIGHT), background="#ffffff",
    math="0", shadow="0",
)
root = ET.SubElement(model, "root")
ET.SubElement(root, "mxCell", id="0")
ET.SubElement(root, "mxCell", id="1", parent="0")
cell_count = 1


def mx_shape(x: float, y: float, w: float, h: float, style: str, value: str = "") -> None:
    global cell_count
    cell_count += 1
    cell = ET.SubElement(root, "mxCell", id=str(cell_count), value=value,
                         style=style, vertex="1", parent="1")
    ET.SubElement(cell, "mxGeometry", x=str(x), y=str(y), width=str(w), height=str(h),
                  **{"as": "geometry"})


def measure(value: str, size: int, bold: bool = False) -> float:
    key = (size, bold)
    if key not in font_cache:
        font_cache[key] = ImageFont.truetype(FONT_BOLD if bold else FONT, size, index=3)
    return font_cache[key].getlength(value)


def rect(x: float, y: float, w: float, h: float, fill: str, stroke: str = "none",
         radius: int = 20, thickness: float = 1.5, dashed: bool = False) -> None:
    dash = ' stroke-dasharray="7 6"' if dashed else ""
    svg.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{radius}" '
               f'fill="{fill}" stroke="{stroke}" stroke-width="{thickness}"{dash}/>')
    mx_shape(x, y, w, h, f"rounded={int(radius > 0)};arcSize=12;fillColor={fill};"
             f"strokeColor={stroke};strokeWidth={thickness};dashed={int(dashed)};")


def ellipse(cx: float, cy: float, rx: float, ry: float, fill: str = "none",
            stroke: str = "none", thickness: float = 1.5, rotation: int = 0) -> None:
    svg.append(f'<ellipse cx="{cx}" cy="{cy}" rx="{rx}" ry="{ry}" fill="{fill}" '
               f'stroke="{stroke}" stroke-width="{thickness}" '
               f'transform="rotate({rotation} {cx} {cy})"/>')
    mx_shape(cx-rx, cy-ry, rx*2, ry*2, f"ellipse;fillColor={fill};strokeColor={stroke};"
             f"strokeWidth={thickness};rotation={rotation};")


def text(x: float, y: float, value: str, size: int = 20, color: str = BODY,
         bold: bool = False, anchor: str = "start", max_width: float | None = None) -> None:
    width = measure(value, size, bold)
    if max_width is not None and width > max_width:
        raise ValueError(f"Text too wide: {value!r}, {width:.1f} > {max_width}")
    left = x - (width / 2 if anchor == "middle" else width if anchor == "end" else 0)
    if left < 0 or left + width > WIDTH or not 0 <= y <= HEIGHT:
        raise ValueError(f"Text outside canvas: {value}")
    svg.append(f'<text x="{x}" y="{y}" font-size="{size}" fill="{color}" '
               f'font-weight="{700 if bold else 400}" text-anchor="{anchor}">'
               f'{html.escape(value)}</text>')
    text_labels.append(value)
    mx_shape(left, y-size*1.08, width+4, size*1.45,
             f"text;html=0;strokeColor=none;fillColor=none;align=left;verticalAlign=middle;"
             f"whiteSpace=wrap;rounded=0;spacing=0;fontColor={color};fontSize={size};"
             f"fontStyle={int(bold)};fontFamily=Noto Sans CJK TC;", value)


def arrow(points: list[tuple[float, float]], color: str, both: bool = False,
          width: float = 3) -> None:
    global cell_count
    marker = {BLUE: "blue", ORANGE: "orange", PURPLE: "purple", GREY: "grey"}[color]
    d = "M " + " L ".join(f"{x},{y}" for x, y in points)
    start = f' marker-start="url(#{marker})"' if both else ""
    svg.append(f'<path d="{d}" fill="none" stroke="{color}" stroke-width="{width}" '
               f'stroke-linejoin="round" stroke-linecap="round" '
               f'marker-end="url(#{marker})"{start}/>')
    cell_count += 1
    cell = ET.SubElement(root, "mxCell", id=str(cell_count), parent="1", edge="1",
                         style=f"edgeStyle=none;rounded=0;strokeColor={color};strokeWidth={width};"
                         f"endArrow=block;endFill=1;startArrow={'block' if both else 'none'};"
                         "startFill=1;endSize=9;startSize=9;")
    geo = ET.SubElement(cell, "mxGeometry", relative="1", **{"as": "geometry"})
    ET.SubElement(geo, "mxPoint", x=str(points[0][0]), y=str(points[0][1]),
                  **{"as": "sourcePoint"})
    ET.SubElement(geo, "mxPoint", x=str(points[-1][0]), y=str(points[-1][1]),
                  **{"as": "targetPoint"})
    if len(points) > 2:
        middle = ET.SubElement(geo, "Array", **{"as": "points"})
        for x, y in points[1:-1]:
            ET.SubElement(middle, "mxPoint", x=str(x), y=str(y))


def tag(cx: float, baseline: float, value: str, color: str, size: int = 18,
        fill: str = "#FFFFFF") -> None:
    width = measure(value, size) + 18
    rect(cx-width/2, baseline-size-3, width, size+12, fill, radius=7)
    text(cx, baseline, value, size, color, anchor="middle")


def raw_icon(x: float, y: float, w: float, h: float, content: str) -> None:
    # Icons are small vectors in SVG and individual movable vector images in diagrams.net.
    from urllib.parse import quote

    body = f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}">{content}</svg>'
    svg.append(f'<g transform="translate({x} {y})">{content}</g>')
    mx_shape(x, y, w, h, "shape=image;verticalLabelPosition=bottom;verticalAlign=top;"
             "imageAspect=0;aspect=fixed;image=data:image/svg+xml," + quote(body, safe="") + ";")


def build() -> None:
    rect(0, 0, WIDTH, HEIGHT, "#FFFFFF", radius=0)

    # Title and product identity.
    raw_icon(63, 62, 38, 49,
             '<path d="M19 46V20M19 30C3 28 2 13 4 7C18 8 23 17 19 30Z'
             'M19 21C19 6 30 1 36 2C37 15 29 23 19 21Z" '
             'fill="#DCECE0" stroke="#146C43" stroke-width="3" stroke-linejoin="round"/>')
    text(117, 105, "AgriPrice 系統架構與資料流程", 44, INK, True)
    text(118, 147, "按鍵查詢、背景資料更新與 Gemini 新聞摘要", 23, MUTED)
    rect(1564, 77, 298, 44, "#EEF5EF", radius=22)
    text(1713, 106, "Cloud Phone × 開放資料", 20, "#146C43", True, "middle")

    # Deployment boundaries. Only the middle region contains our four services.
    rect(56, 200, 388, 740, "#F7FAF8", "#DDE7DF", 24)
    rect(472, 200, 960, 740, "#FFFFFF", "#CCDCD1", 24, 2)
    rect(1460, 200, 404, 740, "#F8FAFC", "#DEE5EB", 24)
    text(81, 245, "使用端", 25, INK, True)
    text(498, 245, "應用伺服器", 25, INK, True)
    rect(681, 215, 174, 40, "#EEF5EF", radius=12)
    text(768, 242, "Docker Compose", 18, "#146C43", True, "middle")
    text(1485, 245, "外部資料與 AI", 25, INK, True)

    # The runtime boundary must be behind the connectors, including the JSON arrowhead.
    rect(76, 316, 348, 237, "#EEF5F0", "#CCDCD1", 18)
    text(250, 351, "CloudMosa 雲端 Chromium", 20, BODY, True, "middle", 320)

    # All connectors are drawn before their endpoint boxes.
    arrow([(176, 728), (176, 553)], GREY)
    arrow([(320, 553), (320, 728)], GREY)
    arrow([(406, 412), (510, 412)], BLUE)
    arrow([(510, 485), (406, 485)], BLUE)
    arrow([(700, 412), (784, 412)], BLUE)
    arrow([(784, 485), (700, 485)], BLUE)
    arrow([(855, 528), (855, 713)], BLUE)
    arrow([(981, 714), (981, 528)], BLUE)
    arrow([(1484, 598), (1277, 598), (1277, 710)], ORANGE, both=True)
    arrow([(1150, 815), (1039, 815)], ORANGE)
    arrow([(1404, 777), (1484, 777)], PURPLE)
    arrow([(1484, 841), (1404, 841)], PURPLE)

    # Frontend runtime and physical keypad device.
    rect(94, 378, 312, 150, "#F2F8FE", "#BFD3E6", 16)
    for rotation in (0, 60, 120):
        ellipse(134, 423, 25, 9, stroke=BLUE, thickness=2, rotation=rotation)
    ellipse(134, 423, 4, 4, BLUE)
    text(178, 435, "React", 36, "#225C92", True)
    text(118, 472, "TypeScript + Vite", 21, BODY)
    text(118, 507, "行情・走勢・比價・新聞", 20, BODY, max_width=270)

    rect(94, 728, 312, 150, "#FFFFFF", "#D2DFD6", 16)
    rect(120, 753, 52, 95, "#F2F6F3", "#5B7965", 10, 2.5)
    rect(128, 764, 36, 29, "#D8E9DC", "#9BB3A2", 3)
    ellipse(146, 805, 5, 5, "#5B7965")
    for row in range(3):
        for col in range(3):
            ellipse(133+col*13, 818+row*9, 2.2, 2.2, "#5B7965")
    text(190, 788, "按鍵型手機", 26, INK, True, max_width=192)
    text(190, 826, "農夫／商販", 21, MUTED)

    # Request-serving services.
    ellipse(512, 318, 5, 5, BLUE)
    text(527, 325, "使用者查詢", 21, BLUE, True)
    text(1025, 325, "/api/v1", 20, MUTED, anchor="end")
    rect(510, 378, 190, 150, "#F4F8F5", "#C9DACF", 16)
    rect(531, 400, 37, 37, "#E1EFE6", radius=10)
    text(549.5, 427, "C", 25, "#236A49", True, "middle")
    text(578, 433, "Caddy", 29, "#236A49", True, max_width=105)
    text(534, 473, "靜態網頁服務", 20, BODY)
    text(534, 506, "API 反向代理", 20, BODY)

    rect(784, 378, 255, 150, "#EFF8F3", "#B7D6C2", 16)
    raw_icon(804, 403, 35, 35,
             '<circle cx="17.5" cy="17.5" r="17.5" fill="#20805B"/>'
             '<path d="M20 5L9 20H16L14 31L27 15H19Z" fill="#FFFFFF"/>')
    text(850, 434, "FastAPI", 34, "#196B48", True, max_width=172)
    text(808, 473, "Python / REST API", 20, BODY, max_width=207)
    text(808, 506, "查詢、統計、比價", 20, BODY)

    # An explanatory note is plain text, not an additional deployed service.
    text(514, 672, "查詢與更新", 28, INK, True)
    text(514, 716, "分開執行", 28, INK, True)
    text(514, 763, "API 讀取已整理的資料", 19, MUTED, max_width=247)
    text(514, 796, "Worker 排程更新資料", 19, MUTED, max_width=247)

    # The database is a real vector cylinder, including a native editable draw.io shape.
    x, y, w, h, cap = 784, 710, 255, 186, 24
    svg.append(f'<path d="M{x},{y+cap} C{x},{y-cap/3} {x+w},{y-cap/3} {x+w},{y+cap} '
               f'L{x+w},{y+h-cap} C{x+w},{y+h+cap/3} {x},{y+h+cap/3} {x},{y+h-cap} Z" '
               'fill="#EFF5FB" stroke="#9AB8D3" stroke-width="2"/>')
    svg.append(f'<ellipse cx="{x+w/2}" cy="{y+cap}" rx="{w/2}" ry="{cap}" '
               'fill="#DCEAF7" stroke="#9AB8D3" stroke-width="2"/>')
    mx_shape(x, y, w, h, "shape=cylinder3;boundedLbl=1;backgroundOutline=1;size=24;"
             "fillColor=#EFF5FB;strokeColor=#9AB8D3;strokeWidth=2;")
    text(911.5, 788, "PostgreSQL", 32, "#285F8B", True, "middle", 228)
    text(911.5, 823, "SQLAlchemy 2", 20, BODY, anchor="middle")
    text(911.5, 860, "行情・匯率・新聞", 20, BODY, anchor="middle")

    # The worker owns source collection, aggregation and the news model calls.
    rect(1150, 710, 254, 186, "#FFF8ED", "#E8CB9E", 16)
    raw_icon(1174, 735, 31, 31,
             '<circle cx="15.5" cy="15.5" r="13" fill="none" stroke="#B66A1D" stroke-width="2.5"/>'
             '<path d="M15.5 7V16L22 20" fill="none" stroke="#B66A1D" stroke-width="2.5" stroke-linecap="round"/>')
    text(1218, 765, "Worker", 34, "#985716", True)
    text(1174, 804, "Python + APScheduler", 18, BODY, max_width=209)
    text(1174, 840, "HTTPX · 排程抓取", 19, BODY, max_width=209)
    text(1174, 874, "正規化 → 檢查 → 彙整", 18, BODY, max_width=209)

    # Six implemented external source integrations; activation is configurable.
    rect(1484, 278, 356, 400, "#FFFFFF", "#D8E2E9", 16)
    text(1508, 316, "API 與開放資料", 24, INK, True)
    sources = [
        ("台灣農業部", "FarmTransData API · 批發行情"),
        ("印度 Agmarknet", "行情 API · 批發市場"),
        ("馬來西亞 PriceCatcher", "CSV · 市場報價"),
        ("World Bank Pink Sheet", "XLSX · 國際月均價"),
        ("ExchangeRate-API", "JSON · 匯率"),
        ("Google News", "RSS + 新聞原文"),
    ]
    for index, (title, subtitle) in enumerate(sources):
        baseline = 356 + index * 52
        ellipse(1513, baseline-6, 3, 3, "#92A5B5")
        text(1530, baseline, title, 20, BODY, True, max_width=290)
        text(1530, baseline+23, subtitle, 16, MUTED, max_width=290)

    rect(1484, 738, 356, 158, "#F5EFFC", "#CAB5E0", 16)
    raw_icon(1507, 759, 36, 36,
             '<path d="M18 0C20.5 11 25 15.5 36 18C25 20.5 20.5 25 18 36'
             'C15.5 25 11 20.5 0 18C11 15.5 15.5 11 18 0Z" fill="#8154AE"/>')
    text(1555, 790, "Gemini API", 32, "#704299", True, max_width=265)
    text(1508, 835, "新聞摘要與作物標註", 23, BODY, max_width=310)
    text(1508, 873, "讀取原文後產生摘要", 19, MUTED)

    # Arrow labels sit on small opaque plates for legibility.
    tag(176, 650, "按鍵操作", GREY, 20, "#F7FAF8")
    tag(320, 650, "畫面更新", GREY, 20, "#F7FAF8")
    tag(458, 399, "HTTP", BLUE)
    tag(458, 511, "網頁／JSON", BLUE, 16)
    tag(742, 399, "API", BLUE)
    tag(742, 511, "JSON", BLUE, 17)
    tag(855, 625, "SQL 查詢", BLUE, 18)
    tag(981, 625, "查詢結果", BLUE, 18)
    tag(1372, 585, "排程抓取／回傳", ORANGE, 18)
    tag(1094, 799, "寫入資料", ORANGE, 18)
    tag(1444, 764, "正文", PURPLE, 18)
    tag(1444, 869, "摘要", PURPLE, 18)

    # Compact legend, with no unverified operating or performance claims.
    for x, color, caption in [(82, BLUE, "查詢與回應"), (322, ORANGE, "背景資料更新"),
                              (597, PURPLE, "Gemini 新聞摘要"), (902, GREY, "按鍵與畫面")]:
        ellipse(x, 991, 5, 5, color)
        text(x+17, 999, caption, 20, BODY)
    text(1838, 1000, "各國資料來源依設定啟用", 18, MUTED, anchor="end")
    text(1838, 1031, "Gemini 僅用於新聞摘要與作物標註", 17, MUTED, anchor="end")


def main(stem: str = "agriprice-architecture") -> None:
    build()
    marker_defs = "".join(
        f'<marker id="{name}" viewBox="0 -5 10 10" refX="9" refY="0" '
        f'markerWidth="12" markerHeight="12" orient="auto-start-reverse" markerUnits="userSpaceOnUse">'
        f'<path d="M0,-4 L9,0 L0,4 Z" fill="{color}"/></marker>'
        for name, color in [("blue", BLUE), ("orange", ORANGE), ("purple", PURPLE), ("grey", GREY)]
    )
    document = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{WIDTH}" height="{HEIGHT}" '
        f'viewBox="0 0 {WIDTH} {HEIGHT}" role="img" aria-labelledby="title description">'
        '<title id="title">AgriPrice 系統架構與資料流程</title>'
        '<desc id="description">按鍵手機透過 CloudMosa 雲端 Chromium 執行 React。'
        'Caddy 轉發請求至 FastAPI，後者查詢 PostgreSQL。Worker 抓取台灣、印度、'
        '馬來西亞行情、世界銀行月資料、匯率與新聞，整理後寫入資料庫。Gemini 處理新聞摘要與作物標註。</desc>'
        '<defs>' + marker_defs + '</defs>'
        '<style>text { font-family: "Noto Sans CJK TC", "Microsoft JhengHei", "PingFang TC", sans-serif; }</style>'
        + "\n".join(svg) + '</svg>\n'
    )
    target = OUT / f"{stem}.svg"
    target.write_text(document, encoding="utf-8")
    ET.fromstring(document)
    assert "OpenAI" not in " ".join(text_labels)
    assert all(name in " ".join(text_labels) for name in ["React", "FastAPI", "PostgreSQL", "Gemini API", "Worker"])

    drawio_path = OUT / f"{stem}.drawio"
    ET.indent(mxfile)
    ET.ElementTree(mxfile).write(drawio_path, encoding="utf-8", xml_declaration=True)

    for filename, width in [(f"{stem}.png", 3840), (f"{stem}-preview.png", 1920)]:
        subprocess.run(["rsvg-convert", "-w", str(width), "-o", str(OUT / filename), str(target)], check=True)
    subprocess.run(["rsvg-convert", "-f", "pdf", "-o", str(OUT / f"{stem}.pdf"), str(target)], check=True)
    print("Generated SVG, 4K PNG, preview PNG, PDF, and editable draw.io diagram.")


if __name__ == "__main__":
    main()
