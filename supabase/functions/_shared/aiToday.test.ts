import { assert, assertEquals } from 'jsr:@std/assert@1';
import { todayLine, withToday } from './aiToday.ts';

Deno.test('todayLine uses the Bangkok date', () => {
   // 2026-11-20 20:00 UTC = 2026-11-21 03:00 Bangkok
   const line = todayLine(Date.UTC(2026, 10, 20, 20));
   assert(line.startsWith('Today is Saturday 2026-11-21 (November 2026, Bangkok time).'), line);
});

Deno.test('withToday puts the date above the prompt', () => {
   const out = withToday('SYSTEM', Date.UTC(2026, 10, 20, 5));
   assert(out.startsWith('Today is Friday 2026-11-20'), out);
   assertEquals(out.endsWith('\n\nSYSTEM'), true);
});
