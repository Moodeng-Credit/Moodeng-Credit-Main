# Moodeng Landing — prototype workshop

⚠️ **The live page moved to [`public/landing/index.html`](../../public/landing/index.html)** — it deploys with the app and is served at `moodeng.app/` via the root route in `vercel.json`. Iterate on THAT file. This directory keeps the plan, drafts, and tooling.

See [PLAN.md](PLAN.md) for the full design/copy direction (trust spine, rejected copy, moment-card spec, peso decisions).

## How to run

Static, no build step:

```bash
python3 -m http.server 4322 --directory public   # from repo root
# then open http://localhost:4322/landing/
```

(The `landing-prototype` config in `.claude/launch.json` does the same for the preview panel. The page is also visible on the app dev server at `localhost:3000/landing/index.html`.)

- `../../public/landing/index.html` — the **working / current** version. This is what gets iterated on.
- `../../public/landing/assets/` — hippos, clouds, brand logos, icons, hero video, tips cards.

## Named drafts (so we never lose a version we liked)

Every version George explicitly likes gets frozen here as a dated snapshot, so "I liked it — do you still have the code?" always has an answer. `index.html` keeps moving; these don't.

| Name | File | Date | What it is |
|------|------|------|------------|
| **First draft idea on Tilt cards** | [drafts/tilt-cards-v1__first-draft-idea.html](drafts/tilt-cards-v1__first-draft-idea.html) | 2026-07-05 | First taste test George approved. Hero (trust-spine H1, drifting clouds, black pill CTA, "Not instant. Not pushy. Not a trap.") + **Moment Card 1** in the locked phone-frame anatomy (textured lavender panel → rotated white phone → `thinking.png` hippo peeking → "Real people can fund you $15" → Get back/Due chips w/ `≈ ₱` peso hint → black "Continue with $15" → terms-before-confirm line) + **Trust Q2 "Clear terms"** section (✓ No rollover / No overnight penalty / No fine print). Peso hints geo-gated (hide for non-PH), fallback rate ₱57/$. Display font = Archivo Black stand-in. Only 2 of 7 sections — the taste test, not the full page. |

To view a frozen draft: open its file directly, or serve it — `python3 -m http.server 4322 --directory .` then visit `/drafts/<file>`.
