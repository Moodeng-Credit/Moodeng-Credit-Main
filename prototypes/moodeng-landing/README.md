# Moodeng Landing — prototype

Self-contained landing page prototype. See [PLAN.md](PLAN.md) for the full design/copy direction (trust spine, rejected copy, moment-card spec, peso decisions).

## How to run

Static, no build step:

```bash
python3 -m http.server 4322 --directory .
# then open http://localhost:4322
```

(A `landing-prototype` config also exists in `.claude/launch.json` for the preview panel.)

- `index.html` — the **working / current** version. This is what gets iterated on.
- `assets/` — hippos (PNGs), clouds (SVGs from MAKE), brand logos.

## Named drafts (so we never lose a version we liked)

Every version George explicitly likes gets frozen here as a dated snapshot, so "I liked it — do you still have the code?" always has an answer. `index.html` keeps moving; these don't.

| Name | File | Date | What it is |
|------|------|------|------------|
| **First draft idea on Tilt cards** | [drafts/tilt-cards-v1__first-draft-idea.html](drafts/tilt-cards-v1__first-draft-idea.html) | 2026-07-05 | First taste test George approved. Hero (trust-spine H1, drifting clouds, black pill CTA, "Not instant. Not pushy. Not a trap.") + **Moment Card 1** in the locked phone-frame anatomy (textured lavender panel → rotated white phone → `thinking.png` hippo peeking → "Real people can fund you $15" → Get back/Due chips w/ `≈ ₱` peso hint → black "Continue with $15" → terms-before-confirm line) + **Trust Q2 "Clear terms"** section (✓ No rollover / No overnight penalty / No fine print). Peso hints geo-gated (hide for non-PH), fallback rate ₱57/$. Display font = Archivo Black stand-in. Only 2 of 7 sections — the taste test, not the full page. |

To view a frozen draft: open its file directly, or serve it — `python3 -m http.server 4322 --directory .` then visit `/drafts/<file>`.
