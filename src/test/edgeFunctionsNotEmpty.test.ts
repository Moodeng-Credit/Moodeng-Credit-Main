import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// On 2026-09-26 a scripted edit truncated supabase/functions/create-didit-session/index.ts to 0 bytes.
// It type-checked (an empty module is valid), merged, and was deployed, breaking every Didit check
// until it was restored. An edge function entry point is never legitimately tiny, so fail CI instead.
const FUNCTIONS_DIR = join(__dirname, '../../supabase/functions');
const MIN_BYTES = 200;

const entryPoints = readdirSync(FUNCTIONS_DIR)
   .filter((name) => !name.startsWith('_') && !name.startsWith('.'))
   .map((name) => join(FUNCTIONS_DIR, name, 'index.ts'))
   .filter((path) => {
      try {
         return statSync(path).isFile();
      } catch {
         return false;
      }
   });

describe('edge function entry points', () => {
   it('finds the functions directory', () => {
      expect(entryPoints.length).toBeGreaterThan(10);
   });

   it.each(entryPoints)('%s is not empty', (path) => {
      expect(statSync(path).size).toBeGreaterThanOrEqual(MIN_BYTES);
   });
});
