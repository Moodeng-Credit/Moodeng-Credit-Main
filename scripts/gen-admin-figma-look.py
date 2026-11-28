#!/usr/bin/env python3
"""Writes src/app/admin/adminFigmaLook.css: the light, Figma-style look for the whole admin.

The admin is written with fixed dark-purple Tailwind classes (bg-[#1c0a3a], text-[#a89bb8], text-white,
text-emerald-300 …) across ~100 files. Instead of editing every file, this scans them and writes one
stylesheet that remaps each of those classes when <html> has the class `admin-figma` (set by AdminGuard
from the saved look). Classes that are already light (the call sheet) are left alone.

Run after adding new color classes to the admin:  python3 scripts/gen-admin-figma-look.py
(src/test/adminFigmaLook.test.ts fails when the stylesheet is out of date.)
"""
import colorsys, glob, re, sys

ROOT = 'src/app/admin'
OUT = 'src/app/admin/adminFigmaLook.css'
SCOPE = 'html.admin-figma'

files = sorted(glob.glob(f'{ROOT}/**/*.tsx', recursive=True) + glob.glob(f'{ROOT}/**/*.ts', recursive=True))
src = '\n'.join(open(f).read() for f in files)

def esc(cls):
    return re.sub(r'([\[\]#/:.%(),])', r'\\\1', cls)

def hls(hexv):
    h = hexv.lstrip('#')
    if len(h) == 3: h = ''.join(c * 2 for c in h)
    r, g, b = (int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))
    hh, l, s = colorsys.rgb_to_hls(r, g, b)
    return hh * 360, l, s

PROP = {'bg': 'background-color', 'text': 'color', 'border': 'border-color', 'divide': 'border-color', 'decoration': 'text-decoration-color'}

def map_hex(kind, hexv):
    """New color for a fixed hex class, or None to leave it as it is."""
    hue, l, s = hls(hexv)
    purple = 235 <= hue <= 300
    if kind == 'bg':
        if l > 0.30: return None                      # light or bright fills (call sheet, pills, brand buttons) stay
        if s < 0.12: return None                      # black / grey buttons stay black
        if s > 0.25 and not purple and l > 0.12:      # dark green / red / amber tints
            return {True: '#e4f7ee'}.get(90 <= hue <= 180, '#fdeaea' if (hue < 20 or hue > 330) else '#fff3d6' if hue < 70 else '#e8f0ff')
        if l < 0.085: return '#f6f3fc'                 # page-level darks
        if l < 0.16: return '#ffffff'                  # cards
        return '#efeafb'                               # raised / hover / chips
    if kind == 'text':
        if l < 0.62: return None                       # already dark enough for a light page
        if s > 0.5 and purple: return '#6d3cff'        # lavender accents
        if s > 0.45 and 90 <= hue <= 180: return '#0f7a4d'
        if s > 0.45 and (hue < 20 or hue > 330): return '#c0312b'
        if s > 0.45 and 20 <= hue < 70: return '#9a5b00'
        if s > 0.45: return '#1f5fbf'
        if l > 0.84: return '#2a2340'
        if l > 0.70: return '#4a4360'
        return '#6f6888'
    if kind in ('border', 'divide'):
        if l > 0.45: return None
        return '#d9d0f0' if l > 0.24 else '#e7e1f4'
    if kind == 'decoration':
        return None if l > 0.45 else '#c9bdf0'
    return None

rules = []
seen = set()

def add(selector, decl):
    key = (selector, decl)
    if key not in seen:
        seen.add(key)
        rules.append(f'{selector} {{ {decl} }}')

# 1. Fixed hex classes, with their hover: / focus: / placeholder: forms.
HEX = re.compile(r'(?<![\w-])((?:hover:|focus:|placeholder:|disabled:|group-hover:)?)(bg|text|border|divide|decoration)-\[(#[0-9a-fA-F]{3,8})\](/\d+)?')
for variant, kind, hexv, alpha in sorted(set(HEX.findall(src))):
    if len(hexv) not in (4, 7): continue
    new = map_hex(kind, hexv)
    if not new: continue
    cls = f'{variant}{kind}-[{hexv}]{alpha}'
    sel = f'{SCOPE} .{esc(cls)}'
    if variant == 'hover:': sel += ':hover'
    elif variant == 'focus:': sel += ':focus'
    elif variant == 'placeholder:': sel += '::placeholder'
    elif variant == 'disabled:': sel += ':disabled'
    elif variant == 'group-hover:': sel = f'{SCOPE} .group:hover .{esc(cls)}'
    if kind == 'divide': sel += ' > * + *'
    if kind == 'bg' and alpha and new in ('#ffffff', '#f6f3fc'):
        new = f'rgb(255 255 255 / {int(alpha[1:]) / 100})'
    add(sel, f'{PROP[kind]}: {new};')

# 2. Gradients on dark headers.
for side, hexv in sorted(set(re.findall(r'(?<![\w-])(from|to|via)-\[(#[0-9a-fA-F]{6})\]', src))):
    _, l, _ = hls(hexv)
    if l < 0.3:
        var = {'from': '--tw-gradient-from', 'to': '--tw-gradient-to', 'via': '--tw-gradient-via'}[side]
        add(f'{SCOPE} .{esc(f"{side}-[{hexv}]")}', f'{var}: {"#efe9ff" if side == "from" else "#ffffff"} var(--tw-gradient-{side}-position);')

# 3. Tailwind's named colors used for status on dark: pale text → strong text, near-black tints → pale tints.
FAM = {'emerald': ('#0f7a4d', '#e4f7ee', '#a9dfc3'), 'green': ('#0f7a4d', '#e4f7ee', '#a9dfc3'), 'teal': ('#0f766e', '#e0f5f3', '#a5dcd6'),
       'amber': ('#9a5b00', '#fff3d6', '#f1d28a'), 'yellow': ('#8a6100', '#fff6d1', '#efd98a'), 'orange': ('#b45309', '#ffedd8', '#f5c99b'),
       'red': ('#c0312b', '#fdeaea', '#f3b6b3'), 'rose': ('#be123c', '#ffe9ee', '#f4b4c2'), 'pink': ('#be185d', '#fde8f1', '#f3b3cf'),
       'sky': ('#0b6fa8', '#e3f3fc', '#a8d4ee'), 'blue': ('#1d4ed8', '#e6eeff', '#b3c8f5'), 'cyan': ('#0e7490', '#e1f6fa', '#a5dce8'),
       'purple': ('#6d3cff', '#f0eaff', '#cdbcf7'), 'violet': ('#6d3cff', '#f0eaff', '#cdbcf7'), 'indigo': ('#4338ca', '#eaeaff', '#bcbcf3'),
       'fuchsia': ('#a21caf', '#fbe8fd', '#e9b3ef'), 'slate': ('#475569', '#f1f5f9', '#cbd5e1'), 'gray': ('#4b5563', '#f3f4f6', '#d1d5db'),
       'zinc': ('#52525b', '#f4f4f5', '#d4d4d8'), 'neutral': ('#525252', '#f5f5f5', '#d4d4d4'), 'stone': ('#57534e', '#f5f5f4', '#d6d3d1'), 'lime': ('#4d7c0f', '#f0f9e0', '#cbe59a')}
NAMED = re.compile(r'(?<![\w-])((?:hover:|focus:|group-hover:)?)(bg|text|border|divide|ring)-(' + '|'.join(FAM) + r')-(\d{2,3})(/\d+)?')
for variant, kind, fam, shade, alpha in sorted(set(NAMED.findall(src))):
    shade_n = int(shade)
    strong, tint, line = FAM[fam]
    new = None
    if kind == 'text' and shade_n <= 400: new = strong
    elif kind == 'bg' and shade_n >= 900: new = tint
    elif kind == 'bg' and alpha and shade_n >= 400 and int(alpha[1:]) <= 30: new = tint   # e.g. bg-amber-400/20
    elif kind in ('border', 'divide', 'ring') and shade_n >= 700: new = line
    if not new: continue
    cls = f'{variant}{kind}-{fam}-{shade}{alpha}'
    sel = f'{SCOPE} .{esc(cls)}'
    if variant == 'hover:': sel += ':hover'
    elif variant == 'focus:': sel += ':focus'
    elif variant == 'group-hover:': sel = f'{SCOPE} .group:hover .{esc(cls)}'
    if kind == 'divide': sel += ' > * + *'
    add(sel, f'{"--tw-ring-color" if kind == "ring" else PROP[kind]}: {new};')

# 4. White text becomes ink — except on an element that also has a solid, dark or bright fill of its own.
keep = set()
for m in re.finditer(r'''(['"`])((?:(?!\1)[^\\\n]|\\.)*?(?<![\w:-])text-white(?![\w/-])(?:(?!\1)[^\\\n]|\\.)*?)\1''', src):
    for bg in re.findall(r'(?<![\w:-])bg-(?:\[#[0-9a-fA-F]{3,8}\]|[a-z]+-\d{2,3})(?:/\d+)?', m.group(2)):
        hexm = re.match(r'bg-\[(#[0-9a-fA-F]{6})\]$', bg)
        named = re.match(r'bg-([a-z]+)-(\d{2,3})$', bg)
        if hexm:
            _, l, s = hls(hexm.group(1))
            if map_hex('bg', hexm.group(1)) is None and l < 0.68: keep.add(bg)   # fills that stay dark or bright: brand buttons, black buttons
        elif named and 500 <= int(named.group(2)) <= 800: keep.add(bg)

header = f'''/* GENERATED by scripts/gen-admin-figma-look.py — do not edit by hand; run the script instead.
   The light, Figma-style look for the whole admin. Applies only while <html> has the class
   "admin-figma" (AdminGuard sets it from the saved look: /admin?look=figma to turn on, ?look=off to turn off). */
'''
base = f'''
{SCOPE} body {{ background: #f6f3fc; }}
{SCOPE} main.min-h-screen {{ background: linear-gradient(180deg, #ece6ff 0, #f6f3fc 320px) #f6f3fc; color: #1c1530; }}
{SCOPE} .text-white {{ color: #1c1530; }}
{''.join(f"{SCOPE} .{esc(bg)}.text-white,{chr(10)}{SCOPE} .{esc(bg)} .text-white,{chr(10)}" for bg in sorted(keep))}{SCOPE} .bg-black.text-white {{ color: #ffffff; }}
{SCOPE} .hover\\:text-white:hover {{ color: #1c1530; }}
/* White cards lift off the lavender page the way the Figma cards do. */
{SCOPE} main [class*="rounded-2xl"][class*="border"], {SCOPE} main [class*="rounded-3xl"][class*="border"] {{ box-shadow: 0 1px 2px rgb(60 40 120 / 0.05), 0 10px 28px rgb(60 40 120 / 0.06); }}
{SCOPE} input, {SCOPE} select, {SCOPE} textarea {{ color-scheme: light; }}
/* The Calls screen reads its colors from these (see CallApprovalsSection). */
{SCOPE} {{
   --ct-card: #ffffff; --ct-deep: #f6f3fc; --ct-soft: #efeafb; --ct-line: #e7e1f4; --ct-line2: #d9d0f0;
   --ct-pill: #6d3cff; --ct-pill-hover: #7d52ff; --ct-pill-ink: #ffffff; --ct-ink: #1c1530; --ct-dim: #6f6888;
   --ct-soft-ink: #6d3cff; --ct-faint: #9a93ad; --ct-gold-text: #b06a00; --ct-gold-ink: #4a2a00;
   --ct-good: #0f7a4d; --ct-warn: #9a5b00; --ct-bad: #c0312b; --ct-link: #0b6fa8;
}}
{SCOPE} .bg-black\\/30 {{ background-color: #f1edfb; }}
'''
open(OUT, 'w').write(header + base + '\n' + '\n'.join(rules) + '\n')
print(f'{OUT}: {len(rules)} class rules, {len(keep)} keep-white fills, from {len(files)} files')
