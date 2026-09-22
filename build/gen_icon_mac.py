# -*- coding: utf-8 -*-
"""生成 macOS 应用图标（1024px PNG 与 ICNS）"""

import math
import sys
from PIL import Image, ImageDraw

SIZE = 1024
OUT_PNG = "build/icon-1024.png"
OUT_ICNS = "build/icon.icns"

img = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
draw = ImageDraw.Draw(img)

# 1) 圆形背景：深绿 -> 中绿 竖直渐变
top = (23, 94, 32)
bottom = (56, 142, 45)
for y in range(SIZE):
    t = y / (SIZE - 1)
    r = int(top[0] + (bottom[0] - top[0]) * t)
    g = int(top[1] + (bottom[1] - top[1]) * t)
    b = int(top[2] + (bottom[2] - top[2]) * t)
    draw.line([(0, y), (SIZE, y)], fill=(r, g, b, 255))

mask = Image.new("L", (SIZE, SIZE), 0)
ImageDraw.Draw(mask).ellipse((16, 16, SIZE - 16, SIZE - 16), fill=255)
img.putalpha(mask)

draw = ImageDraw.Draw(img)

# 2) 中央白色蛋形（鸡身）
cx, cy = SIZE / 2, SIZE * 0.52
egg_w, egg_h = SIZE * 0.30, SIZE * 0.40
draw.ellipse(
    [cx - egg_w, cy - egg_h * 0.78, cx + egg_w, cy + egg_h * 0.98],
    fill=(255, 255, 255, 250),
)

# 3) 鸡冠
comb_color = (230, 80, 60, 255)
for dx in (-0.10, 0.10):
    draw.ellipse(
        [
            cx + dx * SIZE - SIZE * 0.075,
            cy - egg_h * 0.98 - SIZE * 0.02,
            cx + dx * SIZE + SIZE * 0.075,
            cy - egg_h * 0.80,
        ],
        fill=comb_color,
    )

# 4) 喙
beak = [
    (cx + egg_w * 0.86, cy - SIZE * 0.02),
    (cx + egg_w * 1.30, cy - SIZE * 0.005),
    (cx + egg_w * 0.86, cy + SIZE * 0.03),
]
draw.polygon(beak, fill=(240, 160, 60, 255))

# 5) 眼睛
eye_x, eye_y = cx + egg_w * 0.30, cy - SIZE * 0.055
draw.ellipse(
    [
        eye_x - SIZE * 0.028,
        eye_y - SIZE * 0.028,
        eye_x + SIZE * 0.028,
        eye_y + SIZE * 0.028,
    ],
    fill=(40, 40, 40, 255),
)

# 6) 声波同心弧
wave_color = (255, 255, 255, 200)
for i, r in enumerate((0.58, 0.72, 0.86)):
    start = 180
    end = 270
    steps = 54
    pts = []
    for k in range(steps + 1):
        a = math.radians(start + (end - start) * k / steps)
        rr = r * SIZE / 2
        pts.append((cx + math.cos(a) * rr, cy + math.sin(a) * rr - SIZE * 0.02))
    draw.line(pts, fill=wave_color, width=int(SIZE * (0.010 + i * 0.004)))

# 7) 声波频谱条
bar_color = (255, 255, 255, 220)
for i, (bw, bh) in enumerate(((0.045, 0.115), (0.045, 0.16), (0.045, 0.115))):
    bx = cx - SIZE * 0.045 * 1.8 + i * SIZE * 0.05
    by = cy + egg_h * 0.72 - bh * SIZE
    draw.rounded_rectangle(
        [bx, by, bx + bw * SIZE, by + bh * SIZE],
        radius=int(SIZE * 0.012),
        fill=bar_color,
    )

# 8) 蛋上高光
draw.ellipse(
    [cx - egg_w * 0.55, cy - egg_h * 0.90, cx - egg_w * 0.10, cy - egg_h * 0.45],
    fill=(255, 255, 255, 70),
)

img.save(OUT_PNG)
img.save(OUT_ICNS, format="ICNS")
print("written:", OUT_PNG, OUT_ICNS)
