# Moodeng hippo art style

How to make new Moodeng hippo pictures that match the ones already in the app.
The "Before you repay" cards (`public/fast-repay/*-v2.webp`) were made this way.

## The look

Always the **same character**. Never invent a new hippo.

- A chubby, round, grey **baby** hippo in glossy 3D (soft toy / Pixar feel).
- Very big shiny dark eyes with white sparkles.
- Rosy pink cheeks.
- Small round ears with pink insides.
- A knitted golden-brown beret.
- A small gold bell on one ear.
- A cream embroidered vest with gold buttons, and a pink belly.
- A happy, open-mouth smile with **no teeth at all**: no front teeth, no buck teeth, no tusks, just a soft pink mouth.
- One simple prop that tells the story (an hourglass, a meal tray, a phone, an ID card).
- Small extras are fine, such as a calendar with a ✓ or a green up-arrow.
- **No text, letters or numbers** in the picture. The app adds words itself, so they can be translated.
- Plain pure white background, so it cuts out cleanly. Square 1:1.

### Reference pictures (always send these with the prompt)

- `public/hippos/connect/hello.png`
- `public/hippos/connect/waiting.png`
- `public/hippos/connect/approved.png`

Without the references, Gemini draws a different, older-looking hippo, often with
a big front tooth.

## The prompt

Write one line for the scene, then paste the style block unchanged:

```
<SCENE> Draw the SAME character as these reference images, in the same glossy 3D style: a chubby, round grey baby hippo with very big shiny dark eyes with white sparkles, rosy pink cheeks, small rounded ears with pink insides, a knitted golden-brown beret, a small gold bell on one ear, a cream embroidered vest with gold buttons and a pink belly. Face: a big happy open-mouth smile like the references, with NO teeth visible at all - no front teeth, no buck teeth, no tusks; just a soft pink mouth. Extra cute and round, baby-like proportions. Full body, centered, on a plain pure white background (#FFFFFF) with nothing else. No text, letters or numbers anywhere. Square 1:1.
```

Scenes that were used:

- **Keep your loan 2+ days**: "The hippo sits happily and hugs a big shiny golden hourglass with sand flowing. Next to it, a small stack of three golden pandesal bread rolls with a green upward arrow behind them. Cheerful, patient mood."
- **Best days to pay**: "The hippo stands happily holding a tray with a steaming Filipino meal: a mound of white rice, chicken adobo and a fried egg. Next to it floats a small purple desk calendar with a big green checkmark circle (no numbers on the calendar)."

## Making one

You need Python 3 with Pillow (`pip install pillow`) and a Gemini API key. The key
is `GEMINI_API_KEY` in the Supabase DB vault. Never commit the key or print it in a log.

1. Generate 3 tries of a scene:

   ```bash
   GEMINI_API_KEY=... python3 scripts/hippo-art/generate.py wait "The hippo sits happily and hugs a big shiny golden hourglass..." --out /tmp/hippo-art
   ```

   This writes `/tmp/hippo-art/wait1.png`, `wait2.png` and `wait3.png`.

2. Pick the best one. Check the mouth closely, and throw away any try that shows a tooth.

3. Cut out the background and save it for the app:

   ```bash
   python3 scripts/hippo-art/cut.py /tmp/hippo-art/wait2.png public/fast-repay/keep-two-days-v2.webp
   ```

   The script turns the white background transparent, trims and centres the hippo,
   and saves a 480×480 WebP (around 30–60 KB).

4. When you replace a picture, give it a new file name (`-v2`, `-v3`) so phones
   don't keep showing the old one from their cache.

## Using it in the app

- Show it at about **180px** on a card (the 480px file stays sharp on phones).
- Use `alt=""`, because the words next to it already say what it means, and add `draggable={false}`.
- Put it on a light card, not a busy background. The cut-out edge is soft, so it also works in dark mode.
