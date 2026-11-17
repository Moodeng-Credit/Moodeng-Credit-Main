// Proof of income on Messenger: "DOCS" typed to the Page by a known borrower, and their answers to the
// AI's questions about the document they sent (income_documents.questions, see incomeDocs.ts).
//
// Why a typed word: Messenger only lets the Page write to someone for 24 hours after THEIR last
// message, and an m.me ref tap on an existing chat isn't a message. /documents asks them to send DOCS;
// that opens the 24 hours, this answers it, and the team can follow up there.
//
// Answers: the bot asks one open question and waits (messenger_asked_at / messenger_asked_id). Only the
// first text they send after that question, within ANSWER_WINDOW_MS, counts as the answer, and the bot
// steps aside as soon as a team member writes in that chat — a Discord ticket reply or a message typed in
// the Page inbox (SendPulse echo) — or when the chat history can't be checked (lesson from the booking
// bot, Nov 15: it filed replies meant for George as screening answers).
import { lastPageInboxTypedAt, sendMessengerMessage } from './sendpulse.ts';

// deno-lint-ignore no-explicit-any
type Svc = any;

const ANSWER_WINDOW_MS = 2 * 60 * 60 * 1000;
// They sent DOCS this recently (Meta's window is 24h; keep a margin): the bot may ask when the check ends.
const CONFIRMED_WINDOW_MS = 20 * 60 * 60 * 1000;
const LOOKBACK_MS = 30 * 24 * 60 * 60 * 1000;
const DOCUMENTS_URL = 'https://moodeng.app/documents';

type Question = { id: string; team?: string; en: string; local?: string | null; kind?: 'text' | 'file' };
type Answer = { id: string };
type Doc = {
   id: string;
   status: string;
   decision: string | null;
   verdict: string | null;
   questions: Question[] | null;
   answers: Answer[] | null;
   messenger_asked_at: string | null;
   messenger_asked_id: string | null;
};
export type Lang = 'en' | 'fil' | 'id';

/** "DOCS", "docs", "Doc", "DOCS." Pure. */
export const isDocsKeyword = (text: string) => /^\s*docs?\s*[.!]*\s*$/i.test(text);

/** Their language: English if they picked it in the Messenger menu, Bahasa for Indonesia, Taglish for 'fil'. Pure. */
export const langOf = (locale: string | null | undefined, market: string | null | undefined): Lang =>
   locale === 'en' ? 'en' : market === 'ID' ? 'id' : locale === 'fil' ? 'fil' : 'en';

/** The open questions, in order. Pure. */
export const openQuestions = (doc: Pick<Doc, 'questions' | 'answers'>): Question[] => {
   const answered = new Set((doc.answers ?? []).map((a) => a.id));
   return (doc.questions ?? []).filter((q) => !answered.has(q.id));
};

/** One question in their language, with the files hint for a "can you add…" one. Pure. */
export const questionLine = (q: Question, lang: Lang) => {
   const text = lang !== 'en' && q.local ? q.local : q.en;
   const files =
      q.kind === 'file'
         ? { en: `You can add files at ${DOCUMENTS_URL}`, fil: `Pwede mong i-add ang files sa ${DOCUMENTS_URL}`, id: `Kamu bisa tambah file di ${DOCUMENTS_URL}` }[lang]
         : null;
   return files ? `${text}\n(${files})` : text;
};

const T = {
   noDoc: {
      en: `We don't see a proof of income from you yet. You can send it here: ${DOCUMENTS_URL}`,
      fil: `Wala pa kaming nakikitang proof of income mula sa'yo. Pwede mong i-send dito: ${DOCUMENTS_URL}`,
      id: `Kami belum menerima bukti penghasilan dari kamu. Kirim di sini: ${DOCUMENTS_URL}`
   },
   first: {
      en: 'Thanks, we got your proof of income ✅ One quick question, just reply here:',
      fil: 'Salamat, natanggap namin ang proof of income mo ✅ May isang tanong lang, reply ka lang dito:',
      id: 'Terima kasih, bukti penghasilan kamu sudah kami terima ✅ Satu pertanyaan singkat, balas di sini saja:'
   },
   next: { en: 'Thank you! One more:', fil: 'Salamat! Isa pa:', id: 'Terima kasih! Satu lagi:' },
   done: {
      en: "Thank you! 🙏 The team will look at your answers and message you here.",
      fil: 'Salamat! 🙏 Titingnan ng team ang mga sagot mo at magme-message kami dito.',
      id: 'Terima kasih! 🙏 Tim kami akan melihat jawabanmu dan mengabari kamu di sini.'
   },
   reading: {
      en: "Got it ✅ We're reading your document now. If we have a question, we'll ask you here.",
      fil: 'Got it ✅ Binabasa na namin ang document mo. Kung may tanong kami, dito ka namin tatanungin.',
      id: 'Siap ✅ Dokumen kamu sedang kami baca. Kalau ada pertanyaan, kami tanya di sini.'
   },
   review: {
      en: "Got it ✅ The team is reviewing your document. We'll message you here.",
      fil: 'Got it ✅ Nire-review na ng team ang document mo. Magme-message kami dito.',
      id: 'Siap ✅ Tim kami sedang memeriksa dokumen kamu. Kami kabari di sini.'
   },
   approved: { en: 'Your proof of income is approved ✅', fil: 'Approved na ang proof of income mo ✅', id: 'Bukti penghasilan kamu sudah disetujui ✅' },
   other: {
      en: `Please open ${DOCUMENTS_URL} to see what we need.`,
      fil: `Buksan mo ang ${DOCUMENTS_URL} para makita kung ano ang kailangan namin.`,
      id: `Buka ${DOCUMENTS_URL} untuk melihat apa yang kami perlukan.`
   }
} satisfies Record<string, Record<Lang, string>>;

/** What the bot says to DOCS, and which question it then waits on. Pure. */
export const docsReply = (doc: Doc | null, lang: Lang): { text: string; asks: string | null } => {
   if (!doc) return { text: T.noDoc[lang], asks: null };
   if (doc.decision === 'approved') return { text: T.approved[lang], asks: null };
   if (doc.decision || doc.verdict === 'resend') return { text: T.other[lang], asks: null };
   if (doc.status === 'pending' || doc.status === 'processing') return { text: T.reading[lang], asks: null };
   const next = openQuestions(doc)[0];
   if (next) return { text: `${T.first[lang]}\n\n${questionLine(next, lang)}`, asks: next.id };
   return { text: T.review[lang], asks: null };
};

/** Is this message the answer the bot is waiting for? (within 2 hours of the question) Pure. */
export const isAwaitedAnswer = (doc: Doc | null, now: number) =>
   !!doc &&
   !doc.decision &&
   !!doc.messenger_asked_at &&
   !!doc.messenger_asked_id &&
   now - Date.parse(doc.messenger_asked_at) < ANSWER_WINDOW_MS &&
   openQuestions(doc).some((q) => q.id === doc.messenger_asked_id);

/**
 * A team member wrote in this Messenger chat since the bot asked: typed in the Page inbox (SendPulse echo),
 * replied from the Discord ticket, or is typing there. Unknown (history unreachable) counts as yes.
 */
const teamStepIn = async (svc: Svc, contactId: string, since: string) => {
   const typed = await lastPageInboxTypedAt(contactId);
   if (typed === undefined || (typed !== null && typed > Date.parse(since))) return true;
   const { data: conv } = await svc
      .from('widget_conversations')
      .select('id, agent_typing_until')
      .eq('channel', 'messenger')
      .eq('messenger_contact_id', contactId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
   if (!conv) return false;
   if (conv.agent_typing_until && Date.parse(conv.agent_typing_until) > Date.now()) return true;
   const { count } = await svc
      .from('widget_messages')
      .select('id', { count: 'exact', head: true })
      .eq('conversation_id', conv.id)
      .eq('sender', 'agent')
      .gt('created_at', since);
   return (count ?? 0) > 0;
};

const markAsked = (svc: Svc, docId: string, questionId: string | null) =>
   svc
      .from('income_documents')
      .update({ messenger_asked_at: questionId ? new Date().toISOString() : null, messenger_asked_id: questionId })
      .eq('id', docId);

/**
 * The check just wrote questions and they already sent DOCS for this send (while it was being read): ask
 * the first open one on Messenger now. Nothing when they didn't, or the bot is already waiting. Never throws.
 */
export const askOnMessengerIfWaiting = async (svc: Svc, docId: string) => {
   try {
      const { data: doc } = (await svc
         .from('income_documents')
         .select('id, user_id, status, decision, verdict, questions, answers, messenger_asked_at, messenger_asked_id, messenger_confirmed_at')
         .eq('id', docId)
         .maybeSingle()) as { data: (Doc & { user_id: string; messenger_confirmed_at: string | null }) | null };
      if (!doc?.messenger_confirmed_at || doc.messenger_asked_id || Date.now() - Date.parse(doc.messenger_confirmed_at) > CONFIRMED_WINDOW_MS) return;
      const reply = docsReply(doc, 'en');
      if (!reply.asks) return;
      const { data: user } = await svc.from('users').select('messenger_psid, preferred_locale, market').eq('id', doc.user_id).maybeSingle();
      if (!user?.messenger_psid) return;
      const res = await sendMessengerMessage(user.messenger_psid, { text: docsReply(doc, langOf(user.preferred_locale, user.market)).text });
      if (!res.ok) return console.error('messenger-income-doc: ask after check failed', res.reason);
      await markAsked(svc, doc.id, reply.asks);
   } catch (err) {
      console.error('messenger-income-doc: ask after check failed', err instanceof Error ? err.message : err);
   }
};

/** True when the message was DOCS or an awaited answer and we handled it (so it isn't also a support ticket). */
export const handleIncomeDocMessage = async (svc: Svc, userId: string, contactId: string, text: string): Promise<boolean> => {
   try {
      const keyword = isDocsKeyword(text);
      const { data: doc } = (await svc
         .from('income_documents')
         .select('id, status, decision, verdict, questions, answers, messenger_asked_at, messenger_asked_id')
         .eq('user_id', userId)
         .gte('created_at', new Date(Date.now() - LOOKBACK_MS).toISOString())
         .order('created_at', { ascending: false })
         .limit(1)
         .maybeSingle()) as { data: Doc | null };
      if (!keyword && !isAwaitedAnswer(doc, Date.now())) return false;

      const { data: user } = await svc.from('users').select('preferred_locale, market').eq('id', userId).maybeSingle();
      const lang = langOf(user?.preferred_locale, user?.market);

      if (keyword) {
         const reply = docsReply(doc, lang);
         if (doc) {
            await svc
               .from('income_documents')
               .update({
                  messenger_confirmed_at: new Date().toISOString(),
                  ...(reply.asks ? { messenger_asked_at: new Date().toISOString(), messenger_asked_id: reply.asks } : {})
               })
               .eq('id', doc.id);
         }
         const res = await sendMessengerMessage(contactId, { text: reply.text });
         if (!res.ok) console.error('messenger-income-doc: DOCS reply failed', res.reason);
         return true;
      }

      // Their answer — unless the team has started talking with them in this chat since.
      const awaited = doc!;
      if (await teamStepIn(svc, contactId, awaited.messenger_asked_at!)) {
         await markAsked(svc, awaited.id, null);
         return false;
      }
      const { data: remaining, error } = await svc.rpc('save_income_doc_answer', {
         p_doc: awaited.id,
         p_user: userId,
         p_qid: awaited.messenger_asked_id,
         p_answer: text,
         p_via: 'messenger'
      });
      if (error || typeof remaining !== 'number' || remaining < 0) {
         if (error) console.error('messenger-income-doc: save failed', error.message);
         return false;
      }
      const next = remaining > 0 ? openQuestions({ ...awaited, answers: [...(awaited.answers ?? []), { id: awaited.messenger_asked_id! }] })[0] : null;
      if (next) await markAsked(svc, awaited.id, next.id);
      const res = await sendMessengerMessage(contactId, { text: next ? `${T.next[lang]}\n\n${questionLine(next, lang)}` : T.done[lang] });
      if (!res.ok) console.error('messenger-income-doc: reply failed', res.reason);
      return true;
   } catch (err) {
      console.error('messenger-income-doc: failed', err instanceof Error ? err.message : err);
      return false;
   }
};
