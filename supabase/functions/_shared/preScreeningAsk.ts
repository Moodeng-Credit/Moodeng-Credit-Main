// Pre-screening "💬 Ask more" (migration 20261119190000). On the Telegram pre-screening card:
//   💬 Ask more → 🤖 AI writes them   Gemini reads the grade (summary, answers, flags, proof of income)
//                                     and drafts up to 3 short questions
//               → ✍️ I'll type them  a reply box; what the team types is kept (same questions, same
//                                     meaning) and made simple + Taglish/Bahasa by the AI
// Since 2026-11-20 one tap sends: 💬 Ask more → the AI writes them and they go out on Messenger at once;
// ✍️ Ask something else (under what was sent) → typed, cleaned up, sent. Old cards' drafts still work.
//
// Their replies: sendpulse-events → handlePreScreeningAnswer. For 24 hours after Send, while the team
// hasn't decided and hasn't started typing in that chat themselves, what they write on Messenger is
// saved (followup_answers) and posted under the card with a short AI read. ✅ / ❌ on the card stay
// the team's call.
//
// Callbacks: pq:<ask|ai|type|send|x>:<pre_screening id>.
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

import { linkRows } from './adminCards.ts';
import { GEMINI_MODEL } from './geminiPreScreen.ts';
import { linkedRedFlag, loadLinkedAccounts } from './linkedAccounts.ts';
import { type Lang, langOf, teamStepIn } from './messengerIncomeDocReply.ts';
import { preScreeningDecisionRows } from './preScreening.ts';
import { applyPreScreeningDecision } from './preScreeningDecision.ts';
import { jobRedFlags, type MedicalRead, medicalRedFlag, type PhotoCheck, type PhotoMeta, photoRedFlags } from './prescreenV2.ts';
import { sendPushToUser } from './pushDelivery.ts';
import { sendMessengerMessage } from './sendpulse.ts';
import { callTelegramApi, sendTelegramMessage, type TelegramInlineKeyboard } from './telegram.ts';
import { MESSENGER_CHAT_URL } from './whatsappFirst.ts';

export type FollowupQuestion = { team: string; en: string; local: string | null };
type Draft = { questions: FollowupQuestion[]; card_chat: number | string; card_msg: number; by: string };
type TgUser = { id?: number; username?: string; first_name?: string; last_name?: string };
type CardQuery = {
   id: string;
   data?: string;
   from?: TgUser;
   message?: {
      chat: { id: number | string };
      message_id: number;
      text?: string;
      reply_markup?: { inline_keyboard?: TelegramInlineKeyboard };
      reply_to_message?: { message_id: number };
   };
};
type ReplyMessage = {
   message_id: number;
   chat: { id: number | string };
   from?: TgUser & { is_bot?: boolean };
   text?: string;
   reply_to_message?: { message_id: number; text?: string; from?: { is_bot?: boolean } };
};
type Row = {
   id: string;
   name: string;
   status: string;
   user_id: string | null;
   questions: Array<{ id: string; text: string }> | null;
   asks?: Record<string, unknown> | null;
   grade: {
      summary?: string;
      flags?: string[];
      answers?: Array<{
         q: string;
         transcript: string | null;
         note: string;
         seen?: { person_visible?: boolean | null } | null;
         photo?: PhotoMeta | null;
         photo_check?: PhotoCheck | null;
      }>;
      income?: { note?: string; read?: Record<string, unknown> | null } | null;
      medical?: MedicalRead | null;
   } | null;
   score: number | null;
   team_decision: string | null;
   followup_draft: Draft | null;
   followup_questions: FollowupQuestion[] | null;
   followup_sent_at: string | null;
   followup_card: { chat: number | string; msg: number } | null;
   followup_answers: Array<{ text: string; at: string }> | null;
};

const ROW_FIELDS =
   'id, name, status, user_id, questions, asks, grade, score, team_decision, followup_draft, followup_questions, followup_sent_at, followup_card, followup_answers';
const ANSWER_WINDOW_MS = 24 * 60 * 60 * 1000;
const MAX_QUESTIONS = 3;
const nameOf = (from?: TgUser) =>
   from?.username ? `@${from.username}` : [from?.first_name, from?.last_name].filter(Boolean).join(' ') || 'the team';
const firstName = (name: string) => name.trim().split(/\s+/)[0] || name;

/** pq:<step>:<id>. Pure. */
export const parseAskCallback = (data: string | undefined) => {
   const m = /^pq:(ask|ai|type|send|x):([0-9a-f-]{36})$/i.exec(data ?? '');
   return m ? { step: m[1] as 'ask' | 'ai' | 'type' | 'send' | 'x', id: m[2] } : null;
};

// The "✍️ type your questions" prompt carries what the reply needs. Pure.
const PROMPT_TAG = (id: string, cardMsg: number) => `(ref ${id} · card ${cardMsg})`;
export const parseAskPrompt = (text: string | undefined) => {
   const m = /\(ref ([0-9a-f-]{36}) · card (\d+)\)/i.exec(text ?? '');
   return m ? { id: m[1], cardMsg: Number(m[2]) } : null;
};

/** The team's typed text as separate questions: one per line, numbering stripped. Pure. */
export const splitTyped = (text: string) =>
   text
      .split(/\n+/)
      .map((l) => l.replace(/^\s*(?:\d+[.)]|[-•*])\s*/, '').trim())
      .filter((l) => l.length > 1)
      .slice(0, MAX_QUESTIONS);

/** What the model sent back, as at most 3 clean questions. Pure. */
export const cleanQuestions = (raw: unknown): FollowupQuestion[] => {
   const list = Array.isArray((raw as { questions?: unknown } | null)?.questions) ? (raw as { questions: unknown[] }).questions : [];
   const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, 400) : null);
   return list
      .map((q) => {
         const o = (q ?? {}) as Record<string, unknown>;
         const en = str(o.en);
         return en ? { team: str(o.team) ?? en, en, local: str(o.local) } : null;
      })
      .filter((q): q is FollowupQuestion => !!q)
      .slice(0, MAX_QUESTIONS);
};

/** The draft as the team sees it. Pure. */
export const draftText = (name: string, qs: FollowupQuestion[], typed: boolean) =>
   [
      `💬 Questions for ${name} — draft${typed ? ' (your questions, made simple)' : ' (AI)'}`,
      'Nothing is sent until you tap 📤 Send.',
      '',
      ...qs.flatMap((q, i) => [`${i + 1}. ${q.en}`, ...(q.local && q.local !== q.en ? [`   ${q.local}`] : [])])
   ].join('\n');

const draftButtons = (id: string): TelegramInlineKeyboard => [
   [{ text: '📤 Send on Messenger', callback_data: `pq:send:${id}` }],
   [
      { text: '✍️ Write my own', callback_data: `pq:type:${id}` },
      { text: '✖️ Cancel', callback_data: `pq:x:${id}` }
   ]
];

const INTRO: Record<Lang, (first: string) => string> = {
   en: (f) =>
      `Hi ${f}! 👋 This is the Moodeng team. Thanks for your answers. We have a few more questions before you continue — just reply here 🙏`,
   fil: (f) =>
      `Hi ${f}! 👋 Si Moodeng team ito. Salamat sa mga sagot mo. May ilang tanong pa kami bago ka magpatuloy — reply ka lang dito 🙏`,
   id: (f) =>
      `Hai ${f}! 👋 Ini tim Moodeng. Terima kasih atas jawabanmu. Ada beberapa pertanyaan lagi sebelum kamu lanjut — balas di sini saja 🙏`
};
const THANKS: Record<Lang, string> = {
   en: 'Thank you! 🙏 The team will look at your answers and message you here.',
   fil: 'Salamat! 🙏 Titingnan ng team ang mga sagot mo at magme-message kami dito.',
   id: 'Terima kasih! 🙏 Tim kami akan melihat jawabanmu dan mengabari kamu di sini.'
};

/** The Messenger message, in their language. Pure. */
export const messengerText = (name: string, qs: FollowupQuestion[], lang: Lang) =>
   [INTRO[lang](firstName(name)), '', ...qs.map((q, i) => `${i + 1}. ${lang !== 'en' && q.local ? q.local : q.en}`)].join('\n');

// ---- AI ---------------------------------------------------------------------------------------

const DRAFT_SYSTEM = `You help a small lender (Moodeng Credit: first loans of about $15 to people in the Philippines and Indonesia) decide whether to lend to someone after a short pre-screening (recorded answers + a proof of income). The team wants to ask the person a few more questions by Facebook Messenger before deciding.

You get the person's answers, the AI grade (summary, flags, proof-of-income read) and maybe "team_wrote": questions the team typed.
- If team_wrote is there: keep exactly the team's questions (same number, same meaning, same order). Only make each one short and simple and add the local version. Do not add questions of your own.
- If not: write 2 or 3 questions about what matters most for whether they can and will repay: what doesn't add up, what is vague, or what worries the team (other loans, take-home pay, what the money is really for, how they repay). Specific to them, not generic.

Each question: one short sentence, 8th-grade English, friendly and not accusing, open (not yes/no), answerable by typing a few lines on a phone. Never ask for passwords, codes, ID numbers or bank details. Don't ask what we already know from the document unless it doesn't add up.
"local" = the same question in natural Taglish (Philippines) or simple Bahasa Indonesia (market "ID").
"team" = what the question checks, in a few English words, for the team.
Reply with only json: {"questions": [{"team": "...", "en": "...", "local": "..."}]}`;

const READ_SYSTEM = `A small lender (first loans of about $15) asked someone a few more questions on Messenger after their pre-screening. You get the questions, what the AI already thought of them (summary, flags, score), and their replies so far (Tagalog, Taglish, Indonesian or English; may be split over several messages or not finished yet).
"read": at most 2 short plain English sentences: do the replies answer the questions, and does anything make repaying more or less likely? Say plainly if they dodged a question or haven't answered it yet.
"answered_all": true only if every question has a real answer (not a dodge, not "ok", not a question back).
"score": 0-100, how good a fit they are to lend to now, taking the pre-screening AND these replies together (50 = borderline). Clear, specific, believable replies that explain the worries raise it; vague, copied-looking, contradicting or dodged replies don't. Never above 50 if answered_all is false.
Reply with only json: {"read": "...", "answered_all": true | false, "score": 0-100}`;

export type AnswerRead = { read: string | null; answered_all: boolean; score: number | null };
/** Gemini's read of their replies, cleaned. Pure. */
export const toAnswerRead = (raw: unknown): AnswerRead | null => {
   const o = (raw ?? {}) as Record<string, unknown>;
   const read = typeof o.read === 'string' && o.read.trim() ? o.read.trim().slice(0, 400) : null;
   const n = typeof o.score === 'number' ? o.score : Number(o.score);
   const score = Number.isFinite(n) && o.score !== null && o.score !== '' ? Math.max(0, Math.min(100, Math.round(n))) : null;
   if (!read && score == null) return null;
   return { read, answered_all: o.answered_all === true, score };
};
/** Auto ✅: every question answered and the new score at or above the bar. Pure. */
export const shouldAutoGood = (r: AnswerRead | null, bar: number) => !!r && r.answered_all && r.score != null && r.score >= bar;

async function geminiJson(svc: SupabaseClient, system: string, input: unknown, timeoutMs: number): Promise<unknown> {
   const { data: key } = await svc.rpc('gemini_api_key');
   if (typeof key !== 'string' || !key) throw new Error('no Gemini key');
   const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      signal: AbortSignal.timeout(timeoutMs),
      body: JSON.stringify({
         systemInstruction: { parts: [{ text: system }] },
         contents: [{ role: 'user', parts: [{ text: JSON.stringify(input) }] }],
         generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.4,
            maxOutputTokens: 2000,
            thinkingConfig: { thinkingLevel: 'low' }
         }
      })
   });
   if (!res.ok) throw new Error(`gemini ${res.status}: ${(await res.text().catch(() => '')).slice(0, 200)}`);
   const json = (await res.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string; thought?: boolean }> } }> };
   const text = (json.candidates?.[0]?.content?.parts ?? [])
      .filter((p) => !p.thought && typeof p.text === 'string')
      .map((p) => p.text)
      .join('');
   return JSON.parse(text || '{}');
}

const context = (row: Row, market: string | null) => ({
   name: row.name,
   market: market ?? 'PH',
   score: row.score,
   ai_summary: row.grade?.summary ?? null,
   flags: row.grade?.flags ?? [],
   answers: (row.questions ?? []).map((q) => {
      const a = row.grade?.answers?.find((x) => x.q === q.id);
      return { question: q.text, said: a?.transcript ?? null, ai_note: a?.note ?? null };
   }),
   proof_of_income: row.grade?.income ? { note: row.grade.income.note ?? null, read: row.grade.income.read ?? null } : null,
   // v2: the medical grade (prescreenV2.ts), when they were asked.
   ...(row.grade?.medical ? { medical: row.grade.medical } : {})
});

async function draftQuestions(svc: SupabaseClient, row: Row, typed: string[] | null): Promise<FollowupQuestion[]> {
   const market = row.user_id
      ? (((await svc.from('users').select('market').eq('id', row.user_id).maybeSingle()).data as { market?: string } | null)?.market ??
        null)
      : null;
   try {
      const raw = await geminiJson(svc, DRAFT_SYSTEM, { ...context(row, market), ...(typed ? { team_wrote: typed } : {}) }, 40_000);
      const qs = cleanQuestions(raw);
      // Typed: never lose one of the team's questions to a model that dropped it.
      if (typed && qs.length !== typed.length) return typed.map((t) => ({ team: t, en: t, local: null }));
      return qs;
   } catch (err) {
      console.error('pre-screening ask: draft failed', err instanceof Error ? err.message : err);
      return typed ? typed.map((t) => ({ team: t, en: t, local: null })) : [];
   }
}

// ---- Telegram ---------------------------------------------------------------------------------

const loadRow = async (svc: SupabaseClient, id: string) =>
   ((await svc.from('pre_screenings').select(ROW_FIELDS).eq('id', id).maybeSingle()).data as Row | null) ?? null;

const messengerOf = async (svc: SupabaseClient, userId: string | null) => {
   if (!userId) return null;
   const { data } = await svc.from('users').select('messenger_psid, preferred_locale, market').eq('id', userId).maybeSingle();
   return (data as { messenger_psid: string | null; preferred_locale: string | null; market: string | null } | null) ?? null;
};

async function postDraft(svc: SupabaseClient, row: Row, chat: number | string, cardMsg: number, by: string, typed: string[] | null) {
   const qs = await draftQuestions(svc, row, typed);
   if (!qs.length) {
      await sendTelegramMessage(chat, '⚠️ The AI couldn’t write questions just now. Tap 💬 Ask more → ✍️ I’ll type them.', {
         replyToMessageId: cardMsg
      });
      return;
   }
   const draft: Draft = { questions: qs, card_chat: chat, card_msg: cardMsg, by };
   await svc.from('pre_screenings').update({ followup_draft: draft }).eq('id', row.id);
   await sendTelegramMessage(chat, draftText(row.name, qs, !!typed), { replyToMessageId: cardMsg, inlineKeyboard: draftButtons(row.id) });
}

/**
 * One tap (George 2026-11-20: "can clicking ask questions just automatically send the questions"): the
 * AI writes the questions (or cleans up the team's typed ones) and they go straight out on Messenger.
 * What was sent is posted under the card, with ✍️ to ask something else.
 */
async function askNow(svc: SupabaseClient, row: Row, chat: number | string, cardMsg: number, by: string, typed: string[] | null) {
   const qs = await draftQuestions(svc, row, typed);
   if (!qs.length) {
      await sendTelegramMessage(chat, '⚠️ The AI couldn’t write questions just now. Tap 💬 Ask more again in a minute.', { replyToMessageId: cardMsg });
      return;
   }
   const result = await sendFollowup(svc, row, qs, { chat, msg: cardMsg }, by);
   const list = qs.flatMap((q, i) => [`${i + 1}. ${q.en}`, ...(q.local && q.local !== q.en ? [`   ${q.local}`] : [])]);
   await sendTelegramMessage(
      chat,
      result.ok
         ? [`📤 Sent on Messenger by ${by}${typed ? '' : ' (AI questions)'}${result.pushed ? ' (+ push)' : ''}:`, ...list, '', 'Their replies show up here for 24 hours.'].join('\n')
         : [`⚠️ Couldn’t send on Messenger (${result.why}) — usually their 24-hour window has closed. Copy this and send it yourself:`, '', result.text].join('\n'),
      { replyToMessageId: cardMsg, inlineKeyboard: [[{ text: '✍️ Ask something else', callback_data: `pq:type:${row.id}` }]] }
   );
}

/** Sends the questions on Messenger (+ a push) and opens the 24h reply window under the card. */
async function sendFollowup(
   svc: SupabaseClient,
   row: Row,
   questions: FollowupQuestion[],
   card: { chat: number | string; msg: number },
   by: string
): Promise<{ ok: boolean; why: string; text: string; pushed: boolean }> {
   const m = await messengerOf(svc, row.user_id);
   const text = messengerText(row.name, questions, langOf(m?.preferred_locale, m?.market));
   const sent = await sendMessengerMessage(m?.messenger_psid, { text }).catch(() => ({ ok: false, reason: 'error' }));
   if (!sent.ok) return { ok: false, why: (sent as { reason?: string }).reason ?? 'failed', text, pushed: false };
   await svc
      .from('pre_screenings')
      .update({
         followup_questions: questions,
         followup_sent_at: new Date().toISOString(),
         followup_sent_by: by,
         followup_card: card,
         followup_draft: null
      })
      .eq('id', row.id);
   const push = row.user_id
      ? await sendPushToUser(svc, row.user_id, () => ({
           type: 'loan_access_decision',
           title: 'A quick question from the team 💬',
           body: 'Open Messenger and reply to Moodeng Credit.',
           url: MESSENGER_CHAT_URL,
           tag: 'prescreen-ask'
        })).catch(() => null)
      : null;
   return { ok: true, why: '', text, pushed: Boolean(push && (push as { sent?: number }).sent) };
}

/** Score under this (telegram_bot_settings.prescreen_auto_ask_below, default 50; "off" = never): ask on its own. Pure. */
export const autoAskThreshold = (setting: string | null | undefined) => {
   const v = (setting ?? '').trim().toLowerCase();
   if (v === 'off' || v === '0') return null;
   const n = Number(v);
   return v && Number.isFinite(n) && n > 0 ? n : 50;
};

// ---- Red flags: never auto ✅ (George, 2026-11-19) ------------------------------------------
// A good score doesn't count when one of these is there; the card waits for the team instead.

const FLAG_SYSTEM = `A small lender auto-approves people whose pre-screening scored well, UNLESS there is a red flag. You get their recorded answers, the AI's notes, the proof-of-income read (holder name, warnings) and maybe their later Messenger replies. Report ONLY these red flags, and only when the evidence is clear:
- "name_mismatch": the name on the proof of income is clearly a different person from the name they gave (nicknames, missing middle names, extra surnames, spelling and order differences are NOT a mismatch)
- "fake_document": the document looks made up, edited or AI-generated (a named warning or clear signs in the notes), not just blurry or short
- "sick_family": the loan is for a sick or hospitalised family member's medical costs (their OWN illness does not count)
Reply with only json: {"red_flags": [{"code": "name_mismatch" | "fake_document" | "sick_family", "why": "a few plain words"}]} — an empty list when there are none.`;

const FLAG_LABEL: Record<string, string> = {
   name_mismatch: 'name on the document doesn’t match',
   fake_document: 'document looks fake or edited',
   sick_family: 'loan for a sick family member'
};

/**
 * Red flags we can see without asking the AI: nobody on camera, a document tagged as AI-made, and (v2)
 * a high medical grade or a job photo that was late, skipped, an old file or a screen/printout. Pure.
 */
export const plainRedFlags = (grade: Row['grade'], job?: { questions?: unknown; asks?: unknown }): string[] => {
   const out: string[] = [];
   if (job) out.push(...jobRedFlags(job.questions as Parameters<typeof jobRedFlags>[0], job.asks as Parameters<typeof jobRedFlags>[1]));
   if ((grade?.answers ?? []).some((a) => a.seen?.person_visible === false)) out.push('nobody on camera in an answer');
   const medical = medicalRedFlag(grade?.medical);
   if (medical) out.push(medical);
   out.push(...photoRedFlags(grade?.answers ?? []));
   const warnings = ((grade?.income?.read as { warnings?: unknown } | null)?.warnings ?? []) as unknown[];
   if (warnings.some((w) => typeof w === 'string' && /labelled as AI-made|carries an? .+ tag/i.test(w)))
      out.push('document tagged as AI-made');
   return out;
};

/** The AI's red flags, cleaned to the known ones. Pure. */
export const toRedFlags = (raw: unknown): string[] => {
   const list = Array.isArray((raw as { red_flags?: unknown } | null)?.red_flags) ? (raw as { red_flags: unknown[] }).red_flags : [];
   return list
      .map((f) => {
         const o = (f ?? {}) as { code?: unknown; why?: unknown };
         const label = typeof o.code === 'string' ? FLAG_LABEL[o.code] : null;
         if (!label) return null;
         const why = typeof o.why === 'string' && o.why.trim() ? ` (${o.why.trim().slice(0, 80)})` : '';
         return label + why;
      })
      .filter((f): f is string => !!f);
};

/** Every red flag on this one. When the AI check fails it says so: that counts as a flag (fail closed). */
async function redFlags(svc: SupabaseClient, row: Row, replies: string[] = []): Promise<string[]> {
   const plain = plainRedFlags(row.grade, { questions: row.questions, asks: row.asks });
   // Same device / WhatsApp / Facebook / wallet / home internet as a rejected, ghosted or overdue account.
   if (row.user_id) {
      try {
         const linked = linkedRedFlag(await loadLinkedAccounts(svc, row.user_id));
         if (linked) plain.push(linked);
      } catch (err) {
         console.warn('pre-screening red flags: linked accounts failed', err instanceof Error ? err.message : err);
      }
   }
   try {
      const raw = await geminiJson(
         svc,
         FLAG_SYSTEM,
         { ...context(row, null), name_given: row.name, ...(replies.length ? { messenger_replies: replies } : {}) },
         25_000
      );
      // The medical grade already covers a sick relative: don't say it twice.
      const ai = toRedFlags(raw).filter((f) => !(plain.some((p) => p.startsWith('medical:')) && f.startsWith(FLAG_LABEL.sick_family)));
      return [...plain, ...ai];
   } catch (err) {
      console.warn('pre-screening red flags: check failed', err instanceof Error ? err.message : err);
      return [...plain, 'the AI red-flag check didn’t run'];
   }
}

/** Saves ✅ Good fit by the AI (only if nobody decided first), tells them, notes it under the card. */
async function autoGood(svc: SupabaseClient, row: Row, card: { chat: number | string; msg: number }, by: string, line: string) {
   const { data: saved } = await svc
      .from('pre_screenings')
      .update({ team_decision: 'good', team_decided_by: by, team_decided_at: new Date().toISOString(), team_reason: null })
      .eq('id', row.id)
      .is('team_decision', null)
      .select('id')
      .maybeSingle();
   if (!saved) return false;
   const result = await applyPreScreeningDecision(svc, row.id);
   await sendTelegramMessage(card.chat, `✅ Auto good fit — ${line}. ${result.summary}\nTap ❌ Not a fit on the card to overrule.`, {
      replyToMessageId: card.msg
   }).catch(() => undefined);
   return true;
}

const redFlagNote = (score: number, flags: string[], after: string) =>
   `🚩 ${score}/100${after}, but not auto-approved — red flag: ${flags.join('; ')}. Your call: ✅ or ❌ on the card.`;

/**
 * Right after a card with ✅/❌ is posted (preScreening.ts): at or above the bar with no red flags →
 * ✅ Good fit on its own; at or above with a red flag → left for the team (says why); under the bar →
 * the AI asks more on Messenger (autoAskIfWeak). Never throws.
 */
export async function autoDecideOrAsk(svc: SupabaseClient, id: string, card: { chat: number | string; msg: number }) {
   try {
      const row = await loadRow(svc, id);
      if (!row || row.score == null || row.team_decision) return;
      const { data: setting } = await svc.from('telegram_bot_settings').select('value').eq('key', 'prescreen_auto_ask_below').maybeSingle();
      const bar = autoAskThreshold((setting as { value?: string | null } | null)?.value);
      if (bar == null) return;
      if (row.score < bar) return await autoAskIfWeak(svc, id, card);
      const flags = await redFlags(svc, row);
      if (flags.length) {
         await sendTelegramMessage(card.chat, redFlagNote(row.score, flags, ''), { replyToMessageId: card.msg }).catch(() => undefined);
         return;
      }
      await autoGood(svc, row, card, `AI (${row.score}/100, no red flags)`, `${row.score}/100 (needs ${bar}), no red flags`);
   } catch (err) {
      console.error('pre-screening auto-decide failed', err instanceof Error ? err.message : err);
   }
}

/**
 * Right after a weak grade's card is posted (preScreening.ts): the AI writes the questions and sends
 * them on Messenger by itself, and says what it sent under the card. Once per pre-screening; nothing
 * when it is already decided, has no account / Messenger, or scored at or above the threshold.
 * Never throws.
 */
export async function autoAskIfWeak(svc: SupabaseClient, id: string, card: { chat: number | string; msg: number }) {
   try {
      const row = await loadRow(svc, id);
      if (!row || row.score == null || row.team_decision || row.followup_sent_at || !row.user_id) return;
      const { data: setting } = await svc.from('telegram_bot_settings').select('value').eq('key', 'prescreen_auto_ask_below').maybeSingle();
      const below = autoAskThreshold((setting as { value?: string | null } | null)?.value);
      if (below == null || row.score >= below) return;
      const m = await messengerOf(svc, row.user_id);
      if (!m?.messenger_psid) {
         await sendTelegramMessage(
            card.chat,
            `🤖 Under ${below}/100, but they have no Messenger connected — couldn’t ask more on their own.`,
            {
               replyToMessageId: card.msg
            }
         ).catch(() => undefined);
         return;
      }
      const qs = await draftQuestions(svc, row, null);
      if (!qs.length) {
         await sendTelegramMessage(card.chat, `🤖 Under ${below}/100 — the AI couldn’t write questions just now. Tap 💬 Ask more.`, {
            replyToMessageId: card.msg
         }).catch(() => undefined);
         return;
      }
      const result = await sendFollowup(svc, row, qs, card, 'AI (auto, under ' + below + ')');
      const list = qs.flatMap((q, i) => [`${i + 1}. ${q.en}`, ...(q.local && q.local !== q.en ? [`   ${q.local}`] : [])]);
      await sendTelegramMessage(
         card.chat,
         result.ok
            ? [
                 `🤖 Under ${below}/100, so the AI asked them on Messenger${result.pushed ? ' (+ push)' : ''}:`,
                 ...list,
                 '',
                 'Their replies show up here for 24 hours.'
              ].join('\n')
            : [
                 `⚠️ Under ${below}/100 — the AI tried to ask on Messenger but it failed (${result.why}). Send it yourself:`,
                 '',
                 result.text
              ].join('\n'),
         { replyToMessageId: card.msg }
      ).catch((err) => console.error('pre-screening auto-ask: post failed', err instanceof Error ? err.message : err));
   } catch (err) {
      console.error('pre-screening auto-ask failed', err instanceof Error ? err.message : err);
   }
}

/** Taps on 💬 Ask more and on the draft's buttons. True when it was one of ours. */
export const handlePreScreeningAskCallback = async (svc: SupabaseClient, query: CardQuery, adminChatIds: string[]): Promise<boolean> => {
   const parsed = parseAskCallback(query.data);
   if (!parsed) return false;
   const answer = (text: string) =>
      callTelegramApi('answerCallbackQuery', { callback_query_id: query.id, text: text.slice(0, 190) }).catch(() => undefined);
   const msg = query.message;
   if (!msg || !adminChatIds.includes(String(msg.chat.id))) {
      await answer('Not allowed here.');
      return true;
   }
   const row = await loadRow(svc, parsed.id);
   if (!row) {
      await answer('Couldn’t find that pre-screening.');
      return true;
   }
   const by = nameOf(query.from);
   const setButtons = (rows: TelegramInlineKeyboard) =>
      callTelegramApi('editMessageReplyMarkup', {
         chat_id: msg.chat.id,
         message_id: msg.message_id,
         reply_markup: { inline_keyboard: [...rows, ...linkRows(msg.reply_markup?.inline_keyboard)] }
      }).catch(() => undefined);
   const editDraft = (text: string) =>
      callTelegramApi('editMessageText', {
         chat_id: msg.chat.id,
         message_id: msg.message_id,
         text,
         reply_markup: { inline_keyboard: [] }
      }).catch(() => undefined);
   // On the card: ask/ai/type. On the draft: send/x, and type ("✍️ Write my own") — whose card is the draft's.
   const onDraft = parsed.step === 'send' || parsed.step === 'x' || (parsed.step === 'type' && !!msg.text?.startsWith('💬 Questions for'));
   // "✍️ Ask something else" sits under what was sent, which replies to the card.
   const onSent = parsed.step === 'type' && (!!msg.text?.startsWith('📤 Sent on Messenger') || !!msg.text?.startsWith('⚠️ Couldn’t send'));
   const cardMsg = onDraft
      ? (row.followup_draft?.card_msg ?? msg.reply_to_message?.message_id ?? msg.message_id)
      : onSent
        ? (msg.reply_to_message?.message_id ?? row.followup_card?.msg ?? msg.message_id)
        : msg.message_id;

   if (parsed.step === 'ask') {
      if (row.team_decision) {
         await answer('Already decided on this one.');
         return true;
      }
      const m = await messengerOf(svc, row.user_id);
      if (!m?.messenger_psid) {
         await answer(row.user_id ? 'They haven’t connected Messenger — can’t ask there.' : 'No account yet — can’t message them.');
         return true;
      }
      // A double tap mustn't send the questions twice.
      if (row.followup_sent_at && Date.now() - Date.parse(row.followup_sent_at) < 2 * 60_000) {
         await answer('Just sent — wait for their reply.');
         return true;
      }
      await answer('🤖 Writing and sending questions… (a few seconds)');
      await askNow(svc, row, msg.chat.id, cardMsg, by, null);
      return true;
   }

   // Old cards from before one-tap asking still have 🤖 AI writes them → a draft with 📤 Send.
   if (parsed.step === 'ai') {
      await Promise.all([answer('🤖 Writing questions… (a few seconds)'), setButtons(preScreeningDecisionRows(row.id))]);
      await postDraft(svc, row, msg.chat.id, cardMsg, by, null);
      return true;
   }

   if (parsed.step === 'type') {
      await Promise.all([
         answer('Type them in the reply box 👇'),
         onDraft
            ? editDraft(`${msg.text ?? ''}\n\n✍️ ${by} is writing their own instead.`)
            : onSent
              ? setButtons([])
              : setButtons(preScreeningDecisionRows(row.id)),
         callTelegramApi('sendMessage', {
            chat_id: msg.chat.id,
            text: `✍️ ${by}: type your questions for ${row.name}, one per line (up to ${MAX_QUESTIONS}). Any language is fine — the AI makes them short and simple, adds Taglish, and sends them on Messenger right away.\n${PROMPT_TAG(row.id, cardMsg)}`,
            reply_parameters: { message_id: cardMsg, allow_sending_without_reply: true },
            reply_markup: { force_reply: true, input_field_placeholder: 'Your questions, one per line…' }
         }).catch((err) => console.error('pre-screening ask: prompt failed', err instanceof Error ? err.message : err))
      ]);
      return true;
   }

   if (parsed.step === 'x') {
      await svc.from('pre_screenings').update({ followup_draft: null }).eq('id', row.id);
      await Promise.all([answer('Cancelled.'), editDraft(`${msg.text ?? ''}\n\n✖️ Cancelled by ${by} — not sent.`)]);
      return true;
   }

   // send
   const draft = row.followup_draft;
   if (!draft?.questions?.length) {
      await answer('That draft is gone — tap 💬 Ask more again.');
      return true;
   }
   await answer('📤 Sending…');
   const result = await sendFollowup(svc, row, draft.questions, { chat: draft.card_chat, msg: draft.card_msg }, by);
   if (!result.ok) {
      await editDraft(
         `${msg.text ?? ''}\n\n⚠️ Couldn’t send on Messenger (${result.why}) — usually their 24-hour window has closed. Copy this and send it yourself:\n\n${result.text}`
      );
      return true;
   }
   await editDraft(
      `${msg.text?.replace(/ — draft.*\nNothing is sent until you tap 📤 Send\./, '') ?? ''}\n\n📤 Sent on Messenger by ${by}${result.pushed ? ' (+ push)' : ''}. Their replies show up here for 24 hours.`
   );
   return true;
};

/** A reply to the "✍️ type your questions" prompt. True when it was one (handled or refused). */
export const handlePreScreeningAskReply = async (svc: SupabaseClient, message: ReplyMessage, adminChatIds: string[]): Promise<boolean> => {
   const prompt = message.reply_to_message;
   if (!prompt?.from?.is_bot) return false;
   const ref = parseAskPrompt(prompt.text);
   if (!ref) return false;
   if (!adminChatIds.includes(String(message.chat.id))) return true;
   const typed = splitTyped(message.text ?? '');
   if (!typed.length || (message.text ?? '').trim().startsWith('/')) {
      await sendTelegramMessage(message.chat.id, 'Reply with your questions as plain text, one per line.', {
         replyToMessageId: message.message_id
      });
      return true;
   }
   const row = await loadRow(svc, ref.id);
   if (!row) return true;
   await callTelegramApi('editMessageText', {
      chat_id: message.chat.id,
      message_id: prompt.message_id,
      text: '✍️ Got it — making them simple and sending…'
   }).catch(() => undefined);
   await askNow(svc, row, message.chat.id, ref.cardMsg, nameOf(message.from), typed);
   await callTelegramApi('deleteMessage', { chat_id: message.chat.id, message_id: prompt.message_id }).catch(() => undefined);
   return true;
};

// ---- Their replies on Messenger ---------------------------------------------------------------

/** Is this pre-screening waiting for their Messenger reply right now? Pure. */
export const isWaitingForReply = (row: Pick<Row, 'followup_sent_at' | 'team_decision' | 'followup_card'> | null, now: number) =>
   !!row?.followup_sent_at && !!row.followup_card && !row.team_decision && now - Date.parse(row.followup_sent_at) < ANSWER_WINDOW_MS;

/**
 * sendpulse-events: a typed Messenger message from someone the team asked follow-up questions. Saved,
 * posted under the card with a short AI read, and not also a support ticket. Never throws.
 */
export const handlePreScreeningAnswer = async (svc: SupabaseClient, userId: string, contactId: string, text: string): Promise<boolean> => {
   try {
      const { data } = await svc
         .from('pre_screenings')
         .select(ROW_FIELDS)
         .eq('user_id', userId)
         .not('followup_sent_at', 'is', null)
         .order('followup_sent_at', { ascending: false })
         .limit(1)
         .maybeSingle();
      const row = data as Row | null;
      if (!row || !isWaitingForReply(row, Date.now())) return false;
      // The team took over the chat (typed in the Page inbox / Discord ticket): their conversation now.
      if (await teamStepIn(svc, contactId, row.followup_sent_at!)) return false;

      const answers = [...(row.followup_answers ?? []), { text: text.slice(0, 2000), at: new Date().toISOString() }];
      await svc.from('pre_screenings').update({ followup_answers: answers }).eq('id', row.id);

      const qs = row.followup_questions ?? [];
      let read: AnswerRead | null = null;
      try {
         read = toAnswerRead(
            await geminiJson(
               svc,
               READ_SYSTEM,
               {
                  questions: qs.map((q) => q.en),
                  ai_summary_before: row.grade?.summary ?? null,
                  flags_before: row.grade?.flags ?? [],
                  score_before: row.score,
                  their_replies: answers.map((a) => a.text)
               },
               20_000
            )
         );
      } catch (err) {
         console.warn('pre-screening ask: read failed', err instanceof Error ? err.message : err);
      }
      const card = row.followup_card!;
      await sendTelegramMessage(
         card.chat,
         [
            `💬 ${row.name} replied on Messenger:`,
            `“${text.slice(0, 1500)}”`,
            ...(read?.read ? ['', `🤖 ${read.read}${read.score != null ? ` · now ${read.score}/100` : ''}`] : [])
         ].join('\n'),
         { replyToMessageId: card.msg }
      ).catch((err) => console.error('pre-screening ask: post reply failed', err instanceof Error ? err.message : err));

      // Answered everything and Gemini now puts them at the threshold or above: ✅ Good fit on its own
      // (they're told to keep going, same as a team ✅). Below stays with the team; ❌ is never automatic.
      const { data: setting } = await svc.from('telegram_bot_settings').select('value').eq('key', 'prescreen_auto_ask_below').maybeSingle();
      const bar = autoAskThreshold((setting as { value?: string | null } | null)?.value) ?? 50;
      if (shouldAutoGood(read, bar)) {
         const flags = await redFlags(
            svc,
            row,
            answers.map((a) => a.text)
         );
         if (flags.length) {
            await sendTelegramMessage(card.chat, redFlagNote(read!.score!, flags, ' after their answers'), {
               replyToMessageId: card.msg
            }).catch(() => undefined);
         } else if (
            await autoGood(
               svc,
               row,
               card,
               `AI (${read!.score}/100 after Messenger answers)`,
               `${read!.score}/100 after their answers (needs ${bar}), no red flags`
            )
         ) {
            return true;
         }
      }

      // Thank them once they've sent about one message per question.
      if (answers.length === Math.max(1, qs.length)) {
         const m = await messengerOf(svc, userId);
         await sendMessengerMessage(contactId, { text: THANKS[langOf(m?.preferred_locale, m?.market)] }).catch(() => undefined);
      }
      return true;
   } catch (err) {
      console.error('pre-screening ask: answer failed', err instanceof Error ? err.message : err);
      return false;
   }
};

// ---- Sweep: nudge them, remind the team (cron prescreen-sweep, every 30 min) -------------------

const HOUR = 3_600_000;
const NUDGE_AFTER_MS = 6 * HOUR;
// Their 24h Messenger window is counted from their last message, which is before we asked: past this,
// a nudge would mostly fail.
const NUDGE_UNTIL_MS = 20 * HOUR;
const REMIND_TEAM_AFTER_MS = 3 * HOUR;
const REMIND_LOOKBACK_MS = 72 * HOUR;

const NUDGE: Record<Lang, (first: string) => string> = {
   en: (f) => `Hi ${f}! 👋 Did you see our questions above? Just reply here so we can continue 🙏`,
   fil: (f) => `Hi ${f}! 👋 Nakita mo ba ang mga tanong namin sa taas? Reply ka lang dito para makapagpatuloy tayo 🙏`,
   id: (f) => `Hai ${f}! 👋 Sudah lihat pertanyaan kami di atas? Balas di sini ya supaya bisa lanjut 🙏`
};

/** Hour of the day in Bangkok (UTC+7). Pure. */
export const bangkokHour = (now: number) => new Date(now + 7 * HOUR).getUTCHours();
/** Borrowers: 08:00–21:59 Manila (07:00–20:59 Bangkok). Team: 08:00–23:59 Bangkok. Pure. */
export const borrowerDaytime = (now: number) => {
   const h = bangkokHour(now);
   return h >= 7 && h < 21;
};
export const teamDaytime = (now: number) => bangkokHour(now) >= 8;

type SweepRow = {
   id: string;
   name: string;
   user_id: string | null;
   score: number | null;
   status: string;
   graded_at: string | null;
   team_card: { chat: number | string; msg: number } | null;
   followup_card: { chat: number | string; msg: number } | null;
   followup_sent_at: string | null;
   followup_answers: Array<{ text: string }> | null;
   followup_nudged_at: string | null;
};

/** Does this one get a Messenger nudge now? Pure. */
export const needsNudge = (r: SweepRow, now: number) =>
   !!r.followup_sent_at &&
   !r.followup_nudged_at &&
   !(r.followup_answers ?? []).length &&
   now - Date.parse(r.followup_sent_at) >= NUDGE_AFTER_MS &&
   now - Date.parse(r.followup_sent_at) < NUDGE_UNTIL_MS;

/** Still waiting on their Messenger answers (the AI is handling it): no team reminder yet. Pure. */
export const waitingOnThem = (r: SweepRow, now: number) =>
   !!r.followup_sent_at && !(r.followup_answers ?? []).length && now - Date.parse(r.followup_sent_at) < ANSWER_WINDOW_MS;

/** The line under the card / in the list: where it stands. Pure. */
export const reminderState = (r: SweepRow, now: number) => {
   const answers = (r.followup_answers ?? []).length;
   if (r.followup_sent_at && answers)
      return `they answered on Messenger (${answers} message${answers === 1 ? '' : 's'}) but it’s still under the bar`;
   if (r.followup_sent_at) return 'asked on Messenger, no reply in 24 hours';
   if (!r.user_id) return 'no account yet';
   return `${r.score != null ? `${r.score}/100` : 'not graded'}, nobody has decided`;
};

export async function preScreeningSweep(svc: SupabaseClient, opts: { dry?: boolean; now?: number } = {}) {
   const now = opts.now ?? Date.now();
   const dry = opts.dry === true;
   const out = {
      nudged: [] as string[],
      nudge_failed: [] as string[],
      reminded: [] as string[],
      listed: [] as string[],
      skipped_night: false
   };
   const { data } = await svc
      .from('pre_screenings')
      .select(
         'id, name, user_id, score, status, graded_at, team_card, followup_card, followup_sent_at, followup_answers, followup_nudged_at, team_reminded_at'
      )
      .is('team_decision', null)
      .in('status', ['graded', 'failed'])
      .gte('graded_at', new Date(now - REMIND_LOOKBACK_MS).toISOString())
      .order('graded_at', { ascending: true })
      .limit(50);
   const rows = (data ?? []) as Array<SweepRow & { team_reminded_at: string | null }>;

   // 1) Nudge them on Messenger.
   if (borrowerDaytime(now)) {
      for (const r of rows.filter((x) => needsNudge(x, now))) {
         if (dry) {
            out.nudged.push(r.name);
            continue;
         }
         await svc
            .from('pre_screenings')
            .update({ followup_nudged_at: new Date(now).toISOString() })
            .eq('id', r.id);
         const m = await messengerOf(svc, r.user_id);
         const sent = await sendMessengerMessage(m?.messenger_psid, {
            text: NUDGE[langOf(m?.preferred_locale, m?.market)](firstName(r.name))
         }).catch(() => ({ ok: false, reason: 'error' }));
         if (sent.ok && r.user_id) {
            await sendPushToUser(svc, r.user_id, () => ({
               type: 'loan_access_decision',
               title: 'We’re waiting for your reply 💬',
               body: 'Open Messenger and answer Moodeng Credit’s questions.',
               url: MESSENGER_CHAT_URL,
               tag: 'prescreen-ask'
            })).catch(() => null);
         }
         (sent.ok ? out.nudged : out.nudge_failed).push(r.name);
         const card = r.followup_card ?? r.team_card;
         if (card) {
            await sendTelegramMessage(
               card.chat,
               sent.ok
                  ? `🔔 No reply after 6 hours, so we reminded ${r.name} on Messenger (+ push).`
                  : `🔔 No reply after 6 hours, and the Messenger reminder didn’t go through (${(sent as { reason?: string }).reason ?? 'failed'}) — their 24-hour window has probably closed. Text or call them if they matter.`,
               { replyToMessageId: card.msg }
            ).catch(() => undefined);
         }
      }
   }

   // 2) Remind the team about cards still without ✅/❌.
   if (!teamDaytime(now)) {
      out.skipped_night = true;
      return { ok: true, dry, ...out };
   }
   const due = rows.filter(
      (r) => !r.team_reminded_at && r.graded_at && now - Date.parse(r.graded_at) >= REMIND_TEAM_AFTER_MS && !waitingOnThem(r, now)
   );
   const unlinked: string[] = [];
   for (const r of due) {
      const card = r.team_card ?? r.followup_card;
      const line = `${r.name} — ${reminderState(r, now)}`;
      if (dry) {
         (card ? out.reminded : out.listed).push(line);
         continue;
      }
      await svc
         .from('pre_screenings')
         .update({ team_reminded_at: new Date(now).toISOString() })
         .eq('id', r.id);
      if (card) {
         const ok = await sendTelegramMessage(card.chat, `⏰ Still waiting for ✅ / ❌ — ${line}.`, { replyToMessageId: card.msg }).then(
            () => true,
            () => false
         );
         if (ok) {
            out.reminded.push(line);
            continue;
         }
      }
      unlinked.push(`• ${line}\n  https://moodeng.app/admin/pre-screening?screen=${r.id}`);
      out.listed.push(line);
   }
   if (unlinked.length && !dry) {
      const { preScreeningChat } = await import('./preScreening.ts');
      const chat = await preScreeningChat(svc);
      if (chat) {
         await sendTelegramMessage(
            chat,
            [`⏰ Pre-screenings still waiting for ✅ / ❌ (${unlinked.length}):`, ...unlinked].join('\n')
         ).catch(() => undefined);
      }
   }
   return { ok: true, dry, ...out };
}
