// What each AI call cost us, in tokens (George 2026-11-21: "log real AI costs"). Every Gemini / DeepSeek
// call that can report usage records one row in public.ai_usage (migration 20261121160000): which feature,
// which model, input and output tokens. Prices live in SQL (telegram_bot_settings.ai_prices, editable), so
// the weekly line in loan-weekly-digest turns these into dollars per pre-screening and per income doc.
// Fire and forget: logging can never slow or break the call it measures.

export type AiTokens = { input: number; output: number };

/** Gemini usageMetadata → tokens (thinking is billed as output). Null when it isn't there. Pure. */
export const geminiTokens = (json: unknown): AiTokens | null => {
   const u = (json as { usageMetadata?: Record<string, unknown> } | null)?.usageMetadata;
   if (!u) return null;
   const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
   return { input: n(u.promptTokenCount), output: n(u.candidatesTokenCount) + n(u.thoughtsTokenCount) };
};

/** DeepSeek / OpenAI-style usage → tokens. Null when it isn't there. Pure. */
export const chatTokens = (json: unknown): AiTokens | null => {
   const u = (json as { usage?: Record<string, unknown> } | null)?.usage;
   if (!u) return null;
   const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
   return { input: n(u.prompt_tokens), output: n(u.completion_tokens) };
};

/** Saves one row; never throws, never awaited by callers' results. */
export const logAiUsage = (feature: string, model: string, tokens: AiTokens | null) => {
   if (!tokens || (!tokens.input && !tokens.output)) return;
   const url = Deno.env.get('SUPABASE_URL');
   const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
   if (!url || !key) return;
   void fetch(`${url}/rest/v1/ai_usage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: key, Authorization: `Bearer ${key}`, Prefer: 'return=minimal' },
      body: JSON.stringify({ feature: feature.slice(0, 40), model: model.slice(0, 60), input_tokens: Math.round(tokens.input), output_tokens: Math.round(tokens.output) })
   }).catch(() => undefined);
};
