# -*- coding: utf-8 -*-
"""生成鸡语声波桌面应用图标 build/icon.ico（多尺寸）与 icon.png"""

import math
from PIL import Image, ImageDraw

SIZE = 512
OUT_ICO = "build/icon.ico"
OUT_PNG = "build/icon.png"

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
ImageDraw.Draw(mask).ellipse((8, 8, SIZE - 8, SIZE - 8), fill=255)
img.putalpha(mask)

# 重新取画布（putalpha 后需重建 draw）
draw = ImageDraw.Draw(img)

# 2) 中央白色蛋形（鸡身）
cx, cy = SIZE / 2, SIZE * 0.52
egg_w, egg_h = SIZE * 0.30, SIZE * 0.40
draw.ellipse(
    [cx - egg_w, cy - egg_h * 0.78, cx + egg_w, cy + egg_h * 0.98],
    fill=(255, 255, 255, 250),
)

# 3) 鸡冠：蛋顶两片红色圆弧
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

# 4) 喙：蛋右侧橙色小三角
beak = [
    (cx + egg_w * 0.86, cy - SIZE * 0.02),
    (cx + egg_w * 1.30, cy - SIZE * 0.005),
    (cx + egg_w * 0.86, cy + SIZE * 0.03),
]
draw.polygon(beak, fill=(240, 160, 60, 255))

# 5) 眼睛：蛋右侧黑点
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

# 6) 声波：蛋上方/左侧三条白色同心弧（模拟扩散中的环境声波）
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

# 7) 声波频谱条：蛋下方三条渐短白色竖条
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

# 输出
img.save(OUT_PNG)
ico_sizes = [(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
img.save(OUT_ICO, sizes=ico_sizes)
print("icon written:", OUT_ICO, OUT_PNG)
