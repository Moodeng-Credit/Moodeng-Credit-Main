import { assertEquals, assertStringIncludes } from 'https://deno.land/std@0.168.0/testing/asserts.ts';

import { chatTokens, geminiTokens } from './aiUsage.ts';
import { aiCostLines } from './signalReport.ts';

Deno.test('token counts from Gemini (thinking billed as output) and DeepSeek', () => {
   assertEquals(geminiTokens({ usageMetadata: { promptTokenCount: 1200, candidatesTokenCount: 80, thoughtsTokenCount: 300 } }), { input: 1200, output: 380 });
   assertEquals(geminiTokens({}), null);
   assertEquals(chatTokens({ usage: { prompt_tokens: 3000, completion_tokens: 500 } }), { input: 3000, output: 500 });
   assertEquals(chatTokens(null), null);
});

Deno.test('weekly cost lines: per pre-screening and per proof of income', () => {
   const lines = aiCostLines({
      days: 7,
      total_usd: 1.234,
      calls: 300,
      features: [
         { feature: 'prescreen_grade', calls: 22, usd: 0.5 },
         { feature: 'income_opinion', calls: 24, usd: 0.4 },
         { feature: 'prescreen_answer_tip', calls: 110, usd: 0.1 }
      ],
      prescreen_usd: 0.8,
      prescreens: 20,
      income_usd: 0.43,
      income_docs: 10
   });
   assertStringIncludes(lines[0], '$1.23 over 300 calls');
   assertStringIncludes(lines[1], 'Pre-screening $0.800 for 20 ≈ $0.040 each');
   assertStringIncludes(lines[1], 'proof of income $0.430 for 10 ≈ $0.043 each');
   assertStringIncludes(lines[2], 'prescreen_grade $0.500');
   assertEquals(aiCostLines(null), ['💸 AI costs: nothing logged yet this week.']);
});
