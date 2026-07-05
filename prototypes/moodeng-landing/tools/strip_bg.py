"""Strip baked-in checkerboard bg from George's 3D asset exports.

Same recipe as the first five icons: background = near-neutral AND light,
flood-filled from the image borders (so light highlights inside the object
survive), then trim to content + small pad, resize to max 480px.
"""
import sys
from collections import deque
from PIL import Image, ImageFilter

SRC, DST = sys.argv[1], sys.argv[2]

im = Image.open(SRC).convert("RGB")
w, h = im.size
px = im.load()

def is_bg(p):
    r, g, b = p
    mx, mn = max(r, g, b), min(r, g, b)
    return (mx - mn) <= 22 and mn >= 170  # neutral + light (checkerboard / soft shadow)

# BFS flood from all four borders
mask = bytearray(w * h)  # 1 = background
q = deque()
for x in range(w):
    for y in (0, h - 1):
        if not mask[y * w + x] and is_bg(px[x, y]):
            mask[y * w + x] = 1
            q.append((x, y))
for y in range(h):
    for x in (0, w - 1):
        if not mask[y * w + x] and is_bg(px[x, y]):
            mask[y * w + x] = 1
            q.append((x, y))
while q:
    x, y = q.popleft()
    for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
        if 0 <= nx < w and 0 <= ny < h:
            i = ny * w + nx
            if not mask[i] and is_bg(px[nx, ny]):
                mask[i] = 1
                q.append((nx, ny))

alpha = Image.frombytes("L", (w, h), bytes(0 if m else 255 for m in mask))
# soften the cut edge slightly so it doesn't look razor-sharp against tinted cards
alpha = alpha.filter(ImageFilter.GaussianBlur(1.0))

out = im.convert("RGBA")
out.putalpha(alpha)

bbox = alpha.getbbox()
pad = 6
bbox = (max(0, bbox[0] - pad), max(0, bbox[1] - pad),
        min(w, bbox[2] + pad), min(h, bbox[3] + pad))
out = out.crop(bbox)

if max(out.size) > 480:
    s = 480 / max(out.size)
    out = out.resize((round(out.size[0] * s), round(out.size[1] * s)), Image.LANCZOS)

out.save(DST, optimize=True)
print(DST, out.size)
