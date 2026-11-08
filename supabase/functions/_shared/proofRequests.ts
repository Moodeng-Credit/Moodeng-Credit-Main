import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

import { postDiscord } from './discord.ts';
import { sendPushToUser } from './pushDelivery.ts';
import { sendMessengerMessage } from './sendpulse.ts';
import { sendTelegramMessage } from './telegram.ts';

// Proof requests (see the proof_requests migration): the team asks a new applicant to back up what
// they said on the call, with one link (moodeng.app/proof/<token>). No automatic checks — this only
//   send   tells the applicant on push / Messenger / Telegram (whichever they have) with the link
//   ping   tells the team (Telegram KYC chat + Discord #kyc) when they've sent it, with a summary
// Both ride on kyc-cross-check: {"proof_request_send": id} and {"proof_request": id}.

const ADMIN_URL = 'https://moodeng.app/admin/proof-requests';
export const proofLink = (token: string) => `https://moodeng.app/proof/${token}`;

type Item = { id: string; kind: 'proof' | 'question'; label: string; hint?: string | null };
type Answer = { text?: string; missing?: boolean };
type FileRow = { item: string };

/** What the applicant is told when the link goes out (first time or "Ask again"). Pure. */
export const sendMessage = (items: Item[], askAgainNote: string | null) => {
   const proofs = items.filter((i) => i.kind === 'proof').length;
   const questions = items.length - proofs;
   const what = [
      proofs ? `${proofs} ${proofs === 1 ? 'document' : 'documents'}` : '',
      questions ? `${questions} ${questions === 1 ? 'question' : 'questions'}` : ''
   ]
      .filter(Boolean)
      .join(' and ');
   return askAgainNote
      ? { title: 'We need a bit more from you', body: `${askAgainNote} Tap below to add it — it only takes a minute.` }
      : {
           title: 'One more step for your loan 📎',
           body: `Thanks for the call! Please send ${what} to back up what you told us. It takes about 2 minutes, no sign-in needed.`
        };
};

/** The team's summary of a send, one line per item. Pure. */
export const summaryLines = (items: Item[], answers: Record<string, Answer>, files: FileRow[]) =>
   items.map((item) => {
      const a = answers[item.id] ?? {};
      if (item.kind === 'question') return `❓ ${item.label}\n   “${(a.text ?? '').slice(0, 200)}”`;
      const n = files.filter((f) => f.item === item.id).length;
      if (a.missing) return `⚠️ ${item.label} — can’t send: “${(a.text ?? '').slice(0, 200)}”`;
      return `📎 ${item.label} — ${n} ${n === 1 ? 'file' : 'files'}${a.text ? ` · “${a.text.slice(0, 120)}”` : ''}`;
   });

const personOf = (user: { username?: string | null; display_name?: string | null } | null, id: string) =>
   user?.display_name?.trim() || (user?.username ? `@${user.username}` : id.slice(0, 8));

/** Send the link to the applicant on every channel they have. */
export const sendProofRequest = async (supabase: SupabaseClient, id: string) => {
   const { data: row } = await supabase
      .from('proof_requests')
      .select('id, token, user_id, items, status, review, review_note')
      .eq('id', id)
      .maybeSingle();
   if (!row || row.status !== 'open') return { ok: false, error: 'not open' };
   const { data: user } = await supabase
      .from('users')
      .select('id, chat_id, notif_account_activity, messenger_psid')
      .eq('id', row.user_id)
      .maybeSingle();
   const msg = sendMessage(row.items as Item[], row.review === 'ask_again' ? row.review_note : null);
   const url = proofLink(row.token);
   const button = 'Send my proof';
   const sent: string[] = [];

   try {
      await sendPushToUser(
         supabase,
         row.user_id,
         () => ({ type: 'proof_request', title: msg.title, body: msg.body, url, tag: `proof-${row.id}` }),
         {
            urgency: 'high'
         }
      );
      sent.push('push');
   } catch (err) {
      console.error('proof request push failed', err);
   }
   const messenger = await sendMessengerMessage(user?.messenger_psid, {
      text: `${msg.title}\n${msg.body}`,
      card: { title: msg.title, button: { title: button, url } }
   });
   if (messenger.ok) sent.push('Messenger');
   if (user?.chat_id && user.notif_account_activity !== false) {
      try {
         await sendTelegramMessage(user.chat_id, `${msg.title}\n\n${msg.body}`, { inlineKeyboard: [[{ text: button, url }]] });
         sent.push('Telegram');
      } catch (err) {
         console.error('proof request telegram failed', err);
      }
   }
   await supabase.from('proof_requests').update({ sent_at: new Date().toISOString(), sent_via: sent }).eq('id', id);
   return { ok: true, sent, messenger: messenger.ok ? 'sent' : messenger.reason };
};

/** Tell the team a send came in. */
export const pingProofRequest = async (supabase: SupabaseClient, id: string) => {
   const { data: row } = await supabase
      .from('proof_requests')
      .select('id, user_id, items, answers, files, submit_count, created_by')
      .eq('id', id)
      .maybeSingle();
   if (!row) return { ok: false, error: 'not found' };
   const [{ data: user }, { data: chat }] = await Promise.all([
      supabase.from('users').select('username, display_name').eq('id', row.user_id).maybeSingle(),
      supabase.from('telegram_bot_settings').select('value').eq('key', 'kyc_alert_chat_id').maybeSingle()
   ]);
   const who = personOf(user, row.user_id);
   const lines = summaryLines(row.items as Item[], (row.answers ?? {}) as Record<string, Answer>, (row.files ?? []) as FileRow[]);
   const head = `📎 Proof sent by ${who}${row.submit_count > 1 ? ` (again, #${row.submit_count})` : ''}${row.created_by ? ` · asked by ${row.created_by}` : ''}`;
   const text = [head, ...lines].join('\n');
   if (chat?.value) {
      await sendTelegramMessage(chat.value, text.slice(0, 3900), { inlineKeyboard: [[{ text: '👀 Review', url: ADMIN_URL }]] }).catch(
         (err) => console.error('proof request ping failed', err)
      );
   }
   await postDiscord(
      { embeds: [{ title: `📎 Proof sent — ${who}`, description: `${lines.join('\n').slice(0, 3800)}\n${ADMIN_URL}`, color: 0x6b55f7 }] },
      { prefer: ['DISCORD_KYC_WEBHOOK_URL'] }
   ).catch(() => undefined);
   return { ok: true };
};
