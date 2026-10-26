// Renders the Messenger bot's "How to borrow" card to public/cards/how-to-borrow-{en,fil}.png.
// Run from the repo root: node scripts/cards/render-cards.mjs
import { chromium } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const template = `file://${path.join(here, 'how-to-borrow.html')}`;
const outDir = path.join(here, '..', '..', 'public', 'cards');

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1080, height: 1080 }, deviceScaleFactor: 1 });
for (const lang of ['en', 'fil']) {
   await page.goto(`${template}?lang=${lang}`);
   await page.evaluate(() => document.fonts.ready);
   await page.screenshot({ path: path.join(outDir, `how-to-borrow-${lang}.png`) });
   console.log('rendered', lang);
}
await browser.close();
