// Proof of income sent as photos in the Messenger chat (George, 2026-11-21: "if they can't upload … send it
// via Messenger … can our system pick it up automatically, input it into our system and update the cards").
//
// Messenger's in-app browser on Android often can't open the photo picker, so the pre-screening and /documents
// pages offer "send it in our Messenger chat". Messenger's webhook carries each photo's URL (fbcdn, it
// expires), so we download it right away into income-docs/<user>/messenger-*.jpg and create an income
// document exactly like a /documents upload: the usual AI read, the team card, the borrower's answers.
//
// Only when we are expecting proof from them — otherwise a selfie or a meme would become a "payslip":
//   opted_in           they tapped "Send it in Messenger" (users.messenger_photo_intake_until, 2 days)
//   prescreen_skipped  their pre-screening went in without proof (last 14 days) and nothing came since
//   docs               they typed DOCS in the last 24 hours
// Several photos sent together arrive as separate messages seconds apart: they join one document, and the
// check starts ~40 s after the first one.
import { langOf } from './messengerIncomeDocReply.ts';
import { sendMessengerMessage } from './sendpulse.ts';
import { sendTelegramMessage } from './telegram.ts';

// deno-lint-ignore no-explicit-any
type Svc = any;
declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void } | undefined;

export type IntakeReason = 'opted_in' | 'prescreen_skipped' | 'docs';

const DAY = 86_400_000;
const NOTE = 'Sent on Messenger';
const JOIN_WINDOW_MS = 3 * 60_000;
const START_CHECK_AFTER_MS = 40_000;
const MAX_FILES = 6;
const MAX_BYTES = 10 * 1024 * 1024;
const DOCS_RE = /^\s*docs?\s*[.!]*\s*$/i;

type Lang = 'en' | 'fil' | 'id';
const REPLY: Record<Lang, (n: number) => string> = {
   en: (n) =>
      `Got it ✅ We received your ${n === 1 ? 'photo' : `${n} photos`}. We're checking ${n === 1 ? 'it' : 'them'} now and will message you here. Thank you! 🦛`,
   fil: (n) =>
      `Natanggap na namin ✅ ang ${n === 1 ? 'photo' : `${n} photos`} mo. Chine-check na namin ngayon at magme-message kami dito. Salamat! 🦛`,
   id: (n) => `Sudah kami terima ✅ ${n === 1 ? 'fotonya' : `${n} foto`}. Sedang kami cek, nanti kami kabari di sini. Terima kasih! 🦛`
};

/** Are we expecting proof from them right now? Pure parts are in the queries' order. */
export async function photoIntakeReason(svc: Svc, userId: string, now = Date.now()): Promise<IntakeReason | null> {
   const { data: user } = await svc.from('users').select('messenger_photo_intake_until, user_role').eq('id', userId).maybeSingle();
   if (!user || user.user_role === 'lender') return null;
   if (user.messenger_photo_intake_until && Date.parse(user.messenger_photo_intake_until) > now) return 'opted_in';

   const { data: ps } = await svc
      .from('pre_screenings')
      .select('created_at, income_files, status')
      .eq('user_id', userId)
      .in('status', ['sent', 'graded', 'failed'])
      .gte('created_at', new Date(now - 14 * DAY).toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
   if (ps && !(Array.isArray(ps.income_files) && ps.income_files.length)) {
      const { count } = await svc
         .from('income_documents')
         .select('id', { count: 'exact', head: true })
         .eq('user_id', userId)
         .gte('created_at', ps.created_at);
      if (!count) return 'prescreen_skipped';
   }

   const { data: events } = await svc
      .from('messenger_contact_events')
      .select('payload')
      .eq('user_id', userId)
      .gte('occurred_at', new Date(now - DAY).toISOString())
      .limit(50);
   const typedDocs = ((events ?? []) as Array<{ payload: { last_message?: unknown } | null }>).some(
      (e) => typeof e.payload?.last_message === 'string' && DOCS_RE.test(e.payload.last_message)
   );
   return typedDocs ? 'docs' : null;
}

/** Download one Messenger photo. Null when it isn't a usable image. */
async function download(url: string): Promise<{ bytes: Uint8Array; mime: string } | null> {
   try {
      const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
      if (!res.ok) return null;
      const mime = (res.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
      if (!/^image\/(jpeg|png|webp)$/.test(mime)) return null;
      const bytes = new Uint8Array(await res.arrayBuffer());
      return bytes.length && bytes.length <= MAX_BYTES ? { bytes, mime } : null;
   } catch {
      return null;
   }
}

const startCheck = (docId: string) => {
   const base = Deno.env.get('SUPABASE_URL') ?? '';
   const token = Deno.env.get('ADMIN_API_TOKEN') ?? '';
   const run = (async () => {
      await new Promise((r) => setTimeout(r, START_CHECK_AFTER_MS));
      // Runs once: the check only picks up a document that is still 'pending'.
      await fetch(`${base}/functions/v1/kyc-cross-check`, {
         method: 'POST',
         headers: { 'Content-Type': 'application/json', 'X-Admin-Token': token },
         body: JSON.stringify({ income_doc: docId }),
         signal: AbortSignal.timeout(100_000)
      }).catch((err) => console.error('messenger photo intake: start check failed', err instanceof Error ? err.message : err));
   })();
   if (typeof EdgeRuntime !== 'undefined') EdgeRuntime.waitUntil(run);
};

/**
 * Their photos → an income document (new, or the one they started sending in the last few minutes), a
 * reply on Messenger, and a note on their pre-screening card. Returns false when nothing usable came.
 */
export async function intakeMessengerPhotos(
   svc: Svc,
   userId: string,
   contactId: string,
   urls: string[],
   reason: IntakeReason
): Promise<boolean> {
   const saved: Array<{ path: string; name: string; mime: string; size: number }> = [];
   for (const url of urls.slice(0, MAX_FILES)) {
      const img = await download(url);
      if (!img) continue;
      const ext = img.mime === 'image/png' ? 'png' : img.mime === 'image/webp' ? 'webp' : 'jpg';
      const path = `${userId}/messenger-${crypto.randomUUID()}.${ext}`;
      const { error } = await svc.storage.from('income-docs').upload(path, img.bytes, { contentType: img.mime, upsert: false });
      if (error) {
         console.error('messenger photo intake: upload failed', error.message);
         continue;
      }
      saved.push({ path, name: `messenger-photo.${ext}`, mime: img.mime, size: img.bytes.length });
   }
   if (!saved.length) return false;

   // Photos a few seconds apart join the document they started, while it hasn't been checked yet.
   const { data: recent } = await svc
      .from('income_documents')
      .select('id, files, status')
      .eq('user_id', userId)
      .eq('note', NOTE)
      .eq('status', 'pending')
      .gte('created_at', new Date(Date.now() - JOIN_WINDOW_MS).toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
   let docId: string;
   let total: number;
   if (recent && (recent.files?.length ?? 0) < MAX_FILES) {
      const files = [...(recent.files ?? []), ...saved].slice(0, MAX_FILES);
      const { error } = await svc.from('income_documents').update({ files }).eq('id', recent.id).eq('status', 'pending');
      if (error) throw new Error(error.message);
      docId = recent.id;
      total = files.length;
   } else {
      const { data: row, error } = await svc
         .from('income_documents')
         .insert({ user_id: userId, files: saved, note: NOTE })
         .select('id')
         .single();
      if (error || !row) throw new Error(error?.message ?? 'insert failed');
      docId = row.id;
      total = saved.length;
      startCheck(docId);
   }

   const { data: user } = await svc.from('users').select('preferred_locale, market, username, display_name').eq('id', userId).maybeSingle();
   const lang = langOf(user?.preferred_locale, user?.market) as Lang;
   const sent = await sendMessengerMessage(contactId, { text: REPLY[lang](total) });
   if (!sent.ok) console.error('messenger photo intake: reply failed', sent.reason);

   // Their pre-screening went in without proof: say so under its card (once, on the first photo batch).
   if (reason === 'prescreen_skipped' && total === saved.length) {
      const { data: ps } = await svc
         .from('pre_screenings')
         .select('team_card')
         .eq('user_id', userId)
         .order('created_at', { ascending: false })
         .limit(1)
         .maybeSingle();
      const card = ps?.team_card as { chat?: number | string; msg?: number } | null;
      const who = user?.username ? `@${user.username}` : (user?.display_name ?? 'They');
      if (card?.chat && card.msg) {
         await sendTelegramMessage(
            card.chat,
            `📄 ${who} sent their proof of income on Messenger (${total} photo${total === 1 ? '' : 's'}). It's being checked now — the income document card follows.`,
            {
               replyToMessageId: card.msg
            }
         ).catch(() => undefined);
      }
   }
   return true;
}
