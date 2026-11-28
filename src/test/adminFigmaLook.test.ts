import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

// The light admin look is one generated stylesheet that remaps the admin's fixed dark color classes
// (scripts/gen-admin-figma-look.py). A dark background class added to the admin later would stay dark
// on the light page, so this fails until the script is run again.

const ROOT = join(process.cwd(), 'src/app/admin');
const walk = (dir: string): string[] =>
   readdirSync(dir).flatMap((name) => {
      const path = join(dir, name);
      return statSync(path).isDirectory() ? walk(path) : /\.tsx?$/.test(name) ? [path] : [];
   });

// Same rule as the script: dark, coloured backgrounds are remapped; light fills and black buttons stay.
const isDarkFill = (hex: string) => {
   const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
   const max = Math.max(r, g, b);
   const min = Math.min(r, g, b);
   const l = (max + min) / 2;
   const s = max === min ? 0 : l > 0.5 ? (max - min) / (2 - max - min) : (max - min) / (max + min);
   return l <= 0.3 && s >= 0.12;
};

describe('admin Figma look stylesheet', () => {
   it('covers every dark background class the admin uses', () => {
      const css = readFileSync(join(ROOT, 'adminFigmaLook.css'), 'utf8');
      const source = walk(ROOT)
         .map((file) => readFileSync(file, 'utf8'))
         .join('\n');
      const used = new Set(Array.from(source.matchAll(/(?<![\w:-])bg-\[(#[0-9a-fA-F]{6})\](?![/\w])/g), (m) => m[1]));
      const missing = [...used].filter((hex) => isDarkFill(hex) && !css.includes(`.bg-\\[\\${hex}\\]`));
      expect(missing, 'run: python3 scripts/gen-admin-figma-look.py').toEqual([]);
   });
});
