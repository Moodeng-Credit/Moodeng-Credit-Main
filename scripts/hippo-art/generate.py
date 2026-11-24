"""Generate Moodeng hippo pictures in the house style with Gemini.

Usage: GEMINI_API_KEY=... python3 scripts/hippo-art/generate.py NAME "SCENE" [--out DIR] [--tries 3]
See scripts/hippo-art/README.md.
"""
import argparse, base64, json, os, urllib.request
from concurrent.futures import ThreadPoolExecutor

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
PUBLIC = os.path.join(ROOT, 'public')
MODEL = 'gemini-3-pro-image'

# The same character every time: these pictures are sent along with the prompt.
REFS = ['hippos/connect/hello.png', 'hippos/connect/waiting.png', 'hippos/connect/approved.png']

STYLE = (
    "Draw the SAME character as these reference images, in the same glossy 3D style: a chubby, round grey baby hippo with very big "
    "shiny dark eyes with white sparkles, rosy pink cheeks, small rounded ears with pink insides, a knitted golden-brown beret, "
    "a small gold bell on one ear, a cream embroidered vest with gold buttons and a pink belly. "
    "Face: a big happy open-mouth smile like the references, with NO teeth visible at all - no front teeth, no buck teeth, no tusks; "
    "just a soft pink mouth. Extra cute and round, baby-like proportions. "
    "Full body, centered, on a plain pure white background (#FFFFFF) with nothing else. No text, letters or numbers anywhere. Square 1:1."
)


def ref_part(path):
    mime = 'image/webp' if path.endswith('.webp') else 'image/png'
    with open(os.path.join(PUBLIC, path), 'rb') as f:
        return {"inline_data": {"mime_type": mime, "data": base64.b64encode(f.read()).decode()}}


def generate(key, name, scene, out_dir, n):
    body = {
        "contents": [{"parts": [*(ref_part(r) for r in REFS), {"text": scene.strip() + ' ' + STYLE}]}],
        "generationConfig": {"responseModalities": ["IMAGE"], "imageConfig": {"aspectRatio": "1:1"}},
    }
    req = urllib.request.Request(
        f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent",
        data=json.dumps(body).encode(),
        headers={"Content-Type": "application/json", "x-goog-api-key": key},
    )
    try:
        res = json.load(urllib.request.urlopen(req, timeout=240))
    except Exception as e:
        return f'{name}{n}: error {str(e)[:150]}'
    parts = res.get('candidates', [{}])[0].get('content', {}).get('parts', [])
    images = [p.get('inlineData') or p.get('inline_data') for p in parts if 'inlineData' in p or 'inline_data' in p]
    if not images:
        return f'{name}{n}: no image returned'
    path = os.path.join(out_dir, f'{name}{n}.png')
    with open(path, 'wb') as f:
        f.write(base64.b64decode(images[0]['data']))
    return f'{name}{n}: {path}'


def main():
    ap = argparse.ArgumentParser(description='Generate Moodeng hippo art in the house style.')
    ap.add_argument('name', help='short file name, e.g. wait')
    ap.add_argument('scene', help='one or two sentences: what the hippo is doing and holding')
    ap.add_argument('--out', default='hippo-art-out', help='folder for the PNG tries')
    ap.add_argument('--tries', type=int, default=3)
    args = ap.parse_args()

    key = os.environ.get('GEMINI_API_KEY', '').strip()
    if not key:
        raise SystemExit('Set GEMINI_API_KEY (it is in the Supabase DB vault).')
    os.makedirs(args.out, exist_ok=True)
    with ThreadPoolExecutor(max_workers=args.tries) as pool:
        jobs = [pool.submit(generate, key, args.name, args.scene, args.out, n) for n in range(1, args.tries + 1)]
        for job in jobs:
            print(job.result())


if __name__ == '__main__':
    main()
