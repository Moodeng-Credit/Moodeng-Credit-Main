"""Track the white phone screen across frames and composite the Moodeng card on it.

Frame 1: full-frame search for the largest near-white blob (like composite.py).
Later frames: search only inside the previous quad's bbox + margin (phone sways gently).
Corners smoothed with EMA to kill per-frame jitter.
"""
import os, sys
from collections import deque
from PIL import Image, ImageFilter

FRAMES, OUT_DIR, CARD_PATH = "frames", "out", "phone-flat-crop.png"

card_src = Image.open(CARD_PATH).convert("RGB")
card_src = card_src.crop((26, 26, card_src.size[0] - 26, card_src.size[1] - 26))

def find_quad(im, bbox=None, thresh=232):
    pw, ph = im.size
    px = im.load()
    x0, y0, x1, y1 = bbox or (0, 0, pw, ph)
    x0, y0 = max(0, x0), max(0, y0)
    x1, y1 = min(pw, x1), min(ph, y1)
    seen = bytearray(pw * ph)
    best = None
    step = 4
    for sy in range(y0, y1, step):
        for sx in range(x0, x1, step):
            if seen[sy * pw + sx] or min(px[sx, sy]) < thresh:
                continue
            comp = []
            q = deque([(sx, sy)])
            seen[sy * pw + sx] = 1
            while q:
                x, y = q.popleft()
                comp.append((x, y))
                for nx, ny in ((x-1, y), (x+1, y), (x, y-1), (x, y+1)):
                    if x0 <= nx < x1 and y0 <= ny < y1:
                        j = ny * pw + nx
                        if not seen[j] and min(px[nx, ny]) >= thresh:
                            seen[j] = 1
                            q.append((nx, ny))
            if best is None or len(comp) > len(best):
                best = comp
    if best is None or len(best) < 2000:
        return None, None
    tl = min(best, key=lambda p: p[0] + p[1])
    br = max(best, key=lambda p: p[0] + p[1])
    tr = max(best, key=lambda p: p[0] - p[1])
    bl = min(best, key=lambda p: p[0] - p[1])
    return [tl, tr, br, bl], best

def find_coeffs(pa, pb):
    m, rhs = [], []
    for (x, y), (X, Y) in zip(pa, pb):
        m.append([x, y, 1, 0, 0, 0, -X * x, -X * y]); rhs.append(X)
        m.append([0, 0, 0, x, y, 1, -Y * x, -Y * y]); rhs.append(Y)
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

def dist(a, b):
    return ((a[0]-b[0])**2 + (a[1]-b[1])**2) ** 0.5

files = sorted(f for f in os.listdir(FRAMES) if f.endswith(".png"))
prev_quad = None   # EMA-smoothed corners (floats)
bbox = None
ALPHA = 0.35       # EMA weight for new measurement

last_comp = None
for i, name in enumerate(files):
    im = Image.open(os.path.join(FRAMES, name)).convert("RGB")
    quad_meas = comp = None
    for try_bbox, thr in ((bbox, 232), (bbox, 215), (None, 232), (None, 210)):
        quad_meas, comp = find_quad(im, try_bbox, thr)
        if quad_meas:
            break
    if quad_meas is None:
        # lost track this frame: reuse previous geometry
        quad_meas = [tuple(p) for p in prev_quad]
        comp = last_comp
    last_comp = comp
    if prev_quad is None:
        quad = [list(map(float, p)) for p in quad_meas]
    else:
        quad = [[pq[0] + ALPHA * (qm[0] - pq[0]), pq[1] + ALPHA * (qm[1] - pq[1])]
                for pq, qm in zip(prev_quad, quad_meas)]
    prev_quad = quad
    xs = [p[0] for p in quad_meas]; ys = [p[1] for p in quad_meas]
    bbox = (int(min(xs)) - 30, int(min(ys)) - 30, int(max(xs)) + 31, int(max(ys)) + 31)

    tl, tr, br, bl = quad
    W = round((dist(tl, tr) + dist(bl, br)) / 2)
    H = round((dist(tl, bl) + dist(tr, br)) / 2)
    canvas = Image.new("RGB", (W, H), "#ffffff")
    cw, ch = card_src.size
    s = min(W / cw, H / ch) * 0.97
    card = card_src.resize((round(cw * s), round(ch * s)), Image.LANCZOS)
    canvas.paste(card, ((W - card.size[0]) // 2, round((H - card.size[1]) * 0.30)))

    mask = Image.new("L", im.size, 0)
    mpx = mask.load()
    for x, y in comp:
        mpx[x, y] = 255
    mask = mask.filter(ImageFilter.GaussianBlur(0.8))

    coeffs = find_coeffs(quad, [(0, 0), (W, 0), (W, H), (0, H)])
    layer = canvas.transform(im.size, Image.PERSPECTIVE, coeffs, Image.BICUBIC, fillcolor="#ffffff")
    Image.composite(layer, im, mask).save(os.path.join(OUT_DIR, name))
    if i % 24 == 0:
        print(i, name, "quad", [tuple(round(v) for v in p) for p in quad], flush=True)

print("done", len(files))
