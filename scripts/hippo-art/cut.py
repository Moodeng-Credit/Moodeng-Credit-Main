"""Cut a white-background hippo picture into a transparent 480x480 WebP for the app.

Usage: python3 scripts/hippo-art/cut.py IN.png OUT.webp
See scripts/hippo-art/README.md.
"""
import sys
from collections import deque
from PIL import Image, ImageFilter
src, dst = sys.argv[1], sys.argv[2]
im = Image.open(src).convert('RGB')
W, H = im.size
px = im.load()
# Background = near-white pixels connected to the border.
def bgish(p): return min(p) >= 232 and max(p) - min(p) <= 18
mask = Image.new('L', (W, H), 255)  # 255 = keep
m = mask.load()
seen = bytearray(W * H)
q = deque()
for x in range(W):
    q.append((x, 0)); q.append((x, H - 1))
for y in range(H):
    q.append((0, y)); q.append((W - 1, y))
while q:
    x, y = q.popleft()
    i = y * W + x
    if seen[i]: continue
    seen[i] = 1
    if not bgish(px[x, y]): continue
    m[x, y] = 0
    if x > 0: q.append((x - 1, y))
    if x < W - 1: q.append((x + 1, y))
    if y > 0: q.append((x, y - 1))
    if y < H - 1: q.append((x, y + 1))
# Soften the cut edge a little (no white halo).
mask = mask.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(1.2))
out = im.convert('RGBA'); out.putalpha(mask)
bbox = out.getbbox()
out = out.crop(bbox)
side = max(out.size) + 24
canvas = Image.new('RGBA', (side, side), (0, 0, 0, 0))
canvas.paste(out, ((side - out.size[0]) // 2, (side - out.size[1]) // 2), out)
canvas = canvas.resize((480, 480), Image.LANCZOS)
canvas.save(dst, 'WEBP', quality=88, method=6)
print(dst, canvas.size)
