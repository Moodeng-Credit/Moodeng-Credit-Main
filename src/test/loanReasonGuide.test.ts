import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// The checker reads the bundled copy (loanReasonGuide.ts), not the .md. If someone edits the
// guide and forgets `node tools/build-loan-reason-guide.mjs`, the live checker would silently keep
// the old rules — this catches it in CI.
describe('loan reason guide', () => {
   it('the bundled guide matches loan-reason-guide.md', () => {
      const dir = resolve(__dirname, '../../supabase/functions/check-loan-input');
      const md = readFileSync(resolve(dir, 'loan-reason-guide.md'), 'utf8');
      const bundled = readFileSync(resolve(dir, 'loanReasonGuide.ts'), 'utf8');
      const match = bundled.match(/export const LOAN_REASON_GUIDE = (".*");/s);
      expect(match, 'loanReasonGuide.ts is malformed — re-run the build script').not.toBeNull();
      expect(JSON.parse(match![1])).toBe(md);
   });
});
