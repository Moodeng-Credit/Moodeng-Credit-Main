// Call form check (admin → Call approvals → Call sheet): once a recorded call's Zoom transcript is in,
// DeepSeek fills in its own copy of the Screening Questions form from what was actually said, and we
// compare it with the form the host filled in. Each question ends up as one of:
//   match         — the host's answer and the call agree
//   differs       — they disagree (e.g. sheet says "sari-sari stock", the borrower said "pay rent")
//   ai_only       — the call answered something the host left blank (the sheet offers "Use this")
//   not_in_call   — a must-cover box (cash in/out, repayment rules, add Emma) is ticked, but the
//                   transcript has no sign it was said: the one that matters if there's a dispute later
//   not_discussed — nothing to compare (the call didn't touch it)
// Text answers are judged by meaning (DeepSeek), everything else by fixed rules below, which the call
// sheet mirrors (src/app/admin/callFormCheck.ts) so a host's later edits re-grade without a new AI call.
// Never throws; a failure is saved on the row (form_check_error) so the sheet can say so.
import { postDiscord } from './discord.ts';
import { sendTelegramMessage, type TelegramInlineKeyboard } from './telegram.ts';

// deno-lint-ignore no-explicit-any
type SupabaseClient = any;

const MODEL = 'deepseek-v4-pro';
const MAX_TRANSCRIPT_CHARS = 60_000;

export const TEXT_FIELDS = ['fullName', 'role', 'facebookUrl', 'tiktokUrl', 'referral', 'loanUse'] as const;
export const BOX_FIELDS = ['showedCashInOut', 'informedTerms', 'addedEmma'] as const;
export type TextField = (typeof TEXT_FIELDS)[number];
export type BoxField = (typeof BOX_FIELDS)[number];
export type FormField = TextField | 'exchanges' | BoxField;
export const FORM_FIELDS: FormField[] = [...TEXT_FIELDS, 'exchanges', ...BOX_FIELDS];

export const FIELD_LABELS: Record<FormField, string> = {
   fullName: 'Full name',
   role: 'What they do',
   facebookUrl: 'Facebook',
   tiktokUrl: 'TikTok',
   referral: 'How they know us',
   loanUse: 'Loan use',
   exchanges: 'Exchange',
   showedCashInOut: 'Showed cash out & repay',
   informedTerms: 'Explained repayment & default rules',
   addedEmma: 'Added Emma & Voices Against Unfair Loan'
};

// Same list as the call sheet's exchange chips (src/app/admin/callSheetData.ts EXCHANGES).
export const EXCHANGES = ['Coins.ph', 'PDAX', 'GCash (GCrypto)', 'Maya', 'Binance', 'Bybit', 'OKX', 'Tokocrypto', 'Other'];

export type Verdict = 'match' | 'differs' | 'ai_only' | 'not_in_call' | 'not_discussed';
export type HostAnswers = Partial<Record<TextField, string>> & { exchanges?: string[] } & Partial<Record<BoxField, boolean>>;
export type FieldCheck = {
   ai: string | string[] | boolean | null; // what the call says
   host: string | string[] | boolean | null; // the host's answer at check time
   verdict: Verdict;
   evidence: string; // short quote from the transcript
};
export type FormCheck = { fields: Record<FormField, FieldCheck>; summary: string; mismatches: number };

const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

/** Map whatever exchange names the call used onto the sheet's chips. */
export const canonicalExchanges = (names: unknown): string[] => {
   if (!Array.isArray(names)) return [];
   const out = new Set<string>();
   for (const raw of names) {
      const n = text(raw).toLowerCase().replace(/\s+/g, '');
      if (!n) continue;
      const hit =
         EXCHANGES.find((ex) => ex !== 'Other' && ex.toLowerCase().replace(/\s+/g, '') === n) ??
         (n.includes('coins')
            ? 'Coins.ph'
            : n.includes('gcash') || n.includes('gcrypto')
              ? 'GCash (GCrypto)'
              : n.includes('maya') || n.includes('paymaya')
                ? 'Maya'
                : null) ??
         EXCHANGES.find((ex) => ex !== 'Other' && n.includes(ex.toLowerCase().split(/[ .(]/)[0])) ??
         'Other';
      out.add(hit);
   }
   return [...out];
};

export const exchangesVerdict = (host: string[], ai: string[]): Verdict => {
   if (!ai.length) return 'not_discussed';
   if (!host.length) return 'ai_only';
   const h = new Set(host);
   return ai.every((x) => h.has(x)) ? 'match' : 'differs';
};

export const boxVerdict = (host: boolean, ai: boolean): Verdict =>
   host ? (ai ? 'match' : 'not_in_call') : ai ? 'ai_only' : 'not_discussed';

/** sameMeaning: DeepSeek's judgement of whether the host's text means what was said (false = differs). */
export const textVerdict = (host: string, ai: string, sameMeaning: unknown): Verdict => {
   if (!ai) return 'not_discussed';
   if (!host) return 'ai_only';
   return sameMeaning === false ? 'differs' : 'match';
};

export const isMismatch = (v: Verdict) => v === 'differs' || v === 'not_in_call';

/** Turn DeepSeek's raw JSON into a FormCheck, grading against the host's answers we sent (never the
 * model's echo of them). */
export const buildFormCheck = (raw: unknown, hostAnswers: HostAnswers): FormCheck => {
   const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, any>;
   const answers = (r.answers && typeof r.answers === 'object' ? r.answers : {}) as Record<string, unknown>;
   const evidence = (r.evidence && typeof r.evidence === 'object' ? r.evidence : {}) as Record<string, unknown>;
   const same = (r.same_meaning && typeof r.same_meaning === 'object' ? r.same_meaning : {}) as Record<string, unknown>;
   const quote = (f: FormField) => text(evidence[f]).slice(0, 240);

   const fields = {} as Record<FormField, FieldCheck>;
   for (const f of TEXT_FIELDS) {
      const host = text(hostAnswers[f]);
      const ai = text(answers[f]);
      fields[f] = { ai: ai || null, host: host || null, verdict: textVerdict(host, ai, same[f]), evidence: quote(f) };
   }
   const hostEx = Array.isArray(hostAnswers.exchanges) ? hostAnswers.exchanges : [];
   const aiEx = canonicalExchanges(answers.exchanges);
   fields.exchanges = { ai: aiEx, host: hostEx, verdict: exchangesVerdict(hostEx, aiEx), evidence: quote('exchanges') };
   for (const f of BOX_FIELDS) {
      const host = Boolean(hostAnswers[f]);
      const ai = answers[f] === true;
      fields[f] = { ai, host, verdict: boxVerdict(host, ai), evidence: quote(f) };
   }
   return {
      fields,
      summary: text(r.summary).slice(0, 400),
      mismatches: FORM_FIELDS.filter((f) => isMismatch(fields[f].verdict)).length
   };
};

/** One line per mismatch, for the team alert and the risk summary's input. */
export const describeMismatches = (check: FormCheck): string[] =>
   FORM_FIELDS.filter((f) => isMismatch(check.fields[f].verdict)).map((f) => {
      const c = check.fields[f];
      if (c.verdict === 'not_in_call') return `${FIELD_LABELS[f]}: ticked on the sheet, but not heard on the call`;
      const show = (v: FieldCheck['ai']) => (Array.isArray(v) ? v.join(', ') : String(v ?? '—'));
      return `${FIELD_LABELS[f]}: sheet says "${show(c.host)}", call says "${show(c.ai)}"`;
   });

const SYSTEM_PROMPT = `You check the onboarding-call form for Moodeng Credit (small USDC loans for people in the Philippines and Indonesia). During each video call the host (George or Emma) fills in a form about the borrower. You get the call transcript and the host's form.

1. Fill in the form yourself from the transcript only. Use null (or [] / false) when the call doesn't say. Never copy the host's answers into yours unless the transcript supports them.
   - fullName: the borrower's name as said on the call
   - role: what they do for work
   - facebookUrl, tiktokUrl: only if a link or handle is actually said
   - referral: how they found Moodeng / who referred them
   - loanUse: how they'd use a loan today, in their words
   - exchanges: crypto exchanges or e-wallets they use (e.g. Coins.ph, GCash, Maya, Binance, PDAX, Tokocrypto)
   - showedCashInOut: true only if the host walked them through cashing out or repaying (e.g. the Coins.ph steps or videos)
   - informedTerms: true only if the host explained the repayment terms AND that a default is flagged and means a permanent ban across affiliated platforms
   - addedEmma: true only if adding "Emma Moodeng" and/or "Voices Against Unfair Loan" on Facebook came up and was done or agreed
2. For each text field where the host wrote an answer and the call also answers it, say whether they mean the same thing (same_meaning true/false). Different wording, spelling or language (Tagalog, Bahasa, English) with the same meaning is true.
3. For every field you filled in, give a short evidence quote from the transcript (under 20 words).

Reply with JSON only:
{"answers": {"fullName": null, "role": null, "facebookUrl": null, "tiktokUrl": null, "referral": null, "loanUse": null, "exchanges": [], "showedCashInOut": false, "informedTerms": false, "addedEmma": false}, "same_meaning": {"fullName": null, "role": null, "facebookUrl": null, "tiktokUrl": null, "referral": null, "loanUse": null}, "evidence": {}, "summary": "one sentence: does the form match the call?"}`;

const clip = (s: string, max: number) => (s.length > max ? `${s.slice(0, max)}\n[…transcript cut for length]` : s);

/** Fill in the AI copy of the form from this transcript and compare it with the host's. Saves the result
 * on call_transcripts (form_check). Returns the check, or null on failure. */
export const checkCallForm = async (svc: SupabaseClient, transcriptId: string): Promise<FormCheck | null> => {
   const fail = async (message: string) => {
      console.error('callFormCheck:', message);
      await svc
         .from('call_transcripts')
         .update({ form_check_error: message.slice(0, 500) })
         .eq('id', transcriptId);
      return null;
   };
   try {
      const apiKey = Deno.env.get('DEEPSEEK_API_KEY');
      if (!apiKey) return await fail('DEEPSEEK_API_KEY is not set');
      const { data: row } = await svc.from('call_transcripts').select('id, user_id, transcript').eq('id', transcriptId).maybeSingle();
      if (!row) return await fail('transcript not found');
      if (!row.user_id) return await fail('no borrower matched to this call');

      const { data: sheet } = await svc
         .from('call_screenings')
         .select('answers, updated_at')
         .eq('user_id', row.user_id)
         .order('updated_at', { ascending: false })
         .limit(1)
         .maybeSingle();
      const hostAnswers = ((sheet?.answers ?? {}) as HostAnswers) || {};

      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 90_000);
      let res: Response;
      try {
         res = await fetch('https://api.deepseek.com/chat/completions', {
            method: 'POST',
            signal: ctrl.signal,
            headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
               model: MODEL,
               thinking: { type: 'disabled' },
               temperature: 0.1,
               max_tokens: 1500,
               response_format: { type: 'json_object' },
               messages: [
                  { role: 'system', content: SYSTEM_PROMPT },
                  {
                     role: 'user',
                     content: `HOST'S FORM:\n${JSON.stringify(hostAnswers, null, 1)}\n\nTRANSCRIPT:\n${clip(row.transcript ?? '', MAX_TRANSCRIPT_CHARS)}`
                  }
               ]
            })
         });
      } finally {
         clearTimeout(timer);
      }
      if (!res.ok) return await fail(`DeepSeek ${res.status}`);
      const body = await res.json();
      const check = buildFormCheck(JSON.parse(body?.choices?.[0]?.message?.content ?? '{}'), hostAnswers);
      const { error } = await svc
         .from('call_transcripts')
         .update({
            form_check: check,
            form_checked_at: new Date().toISOString(),
            form_check_screening_at: sheet?.updated_at ?? null,
            form_check_error: null
         })
         .eq('id', transcriptId);
      if (error) return await fail(`saving form check: ${error.message}`);
      return check;
   } catch (err) {
      return await fail(err instanceof Error ? err.message : String(err));
   }
};

/** "📝 Call check — Maria" to Alerts Moodeng HQ and Discord #bookings once the transcript, form check
 * and risk summary are in, so whoever approves sees any mismatch first. Best effort. */
export const alertCallCheck = async (svc: SupabaseClient, transcriptId: string): Promise<void> => {
   try {
      const { data: row } = await svc
         .from('call_transcripts')
         .select('user_id, form_check, risk_level')
         .eq('id', transcriptId)
         .maybeSingle();
      if (!row?.user_id) return;
      const { data: u } = await svc.from('users').select('username, display_name').eq('id', row.user_id).maybeSingle();
      const name = [u?.display_name, u?.username ? `@${u.username}` : null].filter(Boolean).join(' · ') || 'a borrower';
      const check = row.form_check as FormCheck | null;
      const lines = check ? describeMismatches(check) : [];
      const risk = row.risk_level ? `\nAI risk: ${String(row.risk_level).toUpperCase()}` : '';
      const head = !check
         ? `📝 Call transcript in — ${name}\nThe form check didn't run; open the sheet to see the transcript.`
         : lines.length
           ? `⚠️ Call check — ${name}: ${lines.length} ${lines.length === 1 ? "thing doesn't" : "things don't"} match the call\n${lines.map((l) => `• ${l}`).join('\n')}`
           : `✅ Call check — ${name}: the form matches the call`;
      const site = (
         Deno.env.get('VITE_SITE_URL') ??
         Deno.env.get('MOODENG_APP_URL') ??
         Deno.env.get('SITE_URL') ??
         'https://moodeng.app'
      ).replace(/\/$/, '');
      const sheetUrl = `${site}/admin/calls?sheet=${row.user_id}`;
      const message = `${head}${risk}\n\nCheck the call sheet before you approve.`;
      const keyboard: TelegramInlineKeyboard = [[{ text: '📋 Open call sheet', url: sheetUrl }]];

      const { data: chatRow } = await svc.from('telegram_bot_settings').select('value').eq('key', 'team_group_chat_id').maybeSingle();
      const chatId = (chatRow?.value as string | undefined) ?? Deno.env.get('TEAM_TELEGRAM_CHAT_ID');
      if (chatId) {
         await sendTelegramMessage(chatId, message, { inlineKeyboard: keyboard }).catch((err) =>
            console.error('callFormCheck: Telegram alert failed', err instanceof Error ? err.message : err)
         );
      }
      await postDiscord({ content: `${message}\n📋 Call sheet: <${sheetUrl}>` }, { prefer: ['DISCORD_BOOKINGS_WEBHOOK_URL'] });
   } catch (err) {
      console.error('callFormCheck: alert failed', err instanceof Error ? err.message : err);
   }
};
