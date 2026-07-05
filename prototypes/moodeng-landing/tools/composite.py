"""Composite the flat request-card capture onto the hero photo's white phone screen.

1. Find the largest near-white connected component = the glowing screen.
2. Take its 4 corners (x+y / x-y extremes) as the perspective quad.
3. Fit the card (aspect preserved) onto a white 'screen canvas', warp into the quad.
4. Composite using the white component itself as the mask (rounded corners,
   charms overlapping the screen, etc. handled for free).
"""
import sys
from collections import deque
from PIL import Image, ImageFilter

PHOTO, CARD, OUT = sys.argv[1], sys.argv[2], sys.argv[3]

photo = Image.open(PHOTO).convert("RGB")
card = Image.open(CARD).convert("RGB")
pw, ph = photo.size
px = photo.load()

def is_white(p):
    return min(p) >= 232

# largest near-white connected component
seen = bytearray(pw * ph)
best = None
for sy in range(0, ph, 4):
    for sx in range(0, pw, 4):
        i0 = sy * pw + sx
        if seen[i0] or not is_white(px[sx, sy]):
            continue
        comp = []
        q = deque([(sx, sy)])
        seen[i0] = 1
        while q:
            x, y = q.popleft()
            comp.append((x, y))
            for nx, ny in ((x-1, y), (x+1, y), (x, y-1), (x, y+1)):
                if 0 <= nx < pw and 0 <= ny < ph:
                    j = ny * pw + nx
                    if not seen[j] and is_white(px[nx, ny]):
                        seen[j] = 1
                        q.append((nx, ny))
        if best is None or len(comp) > len(best):
            best = comp

# quad corners of the (rotated-rect-ish) component
tl = min(best, key=lambda p: p[0] + p[1])
br = max(best, key=lambda p: p[0] + p[1])
tr = max(best, key=lambda p: p[0] - p[1])
bl = min(best, key=lambda p: p[0] - p[1])
quad = [tl, tr, br, bl]
print("quad:", quad, "area:", len(best))

# mask from the component
mask = Image.new("L", (pw, ph), 0)
mpx = mask.load()
for x, y in best:
    mpx[x, y] = 255
mask = mask.filter(ImageFilter.GaussianBlur(1.0))

# screen canvas: quad's average dimensions, card fitted inside on white
def dist(a, b):
    return ((a[0]-b[0])**2 + (a[1]-b[1])**2) ** 0.5
W = round((dist(tl, tr) + dist(bl, br)) / 2)
H = round((dist(tl, bl) + dist(tr, br)) / 2)
canvas = Image.new("RGB", (W, H), "#ffffff")
card = card.crop((26, 26, card.size[0] - 26, card.size[1] - 26))  # drop rounded-corner slivers (r=22css*3x)
cw, ch = card.size
s = min(W / cw, H / ch) * 0.97
card = card.resize((round(cw * s), round(ch * s)), Image.LANCZOS)
canvas.paste(card, ((W - card.size[0]) // 2, round((H - card.size[1]) * 0.30)))  # bias toward top like a real app

# perspective coeffs: output(photo) pixel -> input(canvas) pixel
def find_coeffs(pa, pb):
    # solves for transform T with T(pa[i]) = pb[i]; PIL wants output->input
    m = []
    rhs = []
    for (x, y), (X, Y) in zip(pa, pb):
        m.append([x, y, 1, 0, 0, 0, -X * x, -X * y]); rhs.append(X)
        m.append([0, 0, 0, x, y, 1, -Y * x, -Y * y]); rhs.append(Y)
    # gaussian elimination, 8x8
    n = 8
    for c in range(n):
        piv = max(range(c, n), key=lambda r: abs(m[r][c]))
        m[c], m[piv] = m[piv], m[c]
        rhs[c], rhs[piv] = rhs[piv], rhs[c]
        d = m[c][c]
        m[c] = [v / d for v in m[c]]; rhs[c] /= d
        for r in range(n):
            if r != c and m[r][c]:
                f = m[r][c]
                m[r] = [a - f * b for a, b in zip(m[r], m[c])]
                rhs[r] -= f * rhs[c]
    return rhs

src_rect = [(0, 0), (W, 0), (W, H), (0, H)]
coeffs = find_coeffs(quad, src_rect)
layer = canvas.transform((pw, ph), Image.PERSPECTIVE, coeffs, Image.BICUBIC, fillcolor="#ffffff")

out = Image.composite(layer, photo, mask)
out.save(OUT, quality=92)
print("saved", OUT, out.size)
