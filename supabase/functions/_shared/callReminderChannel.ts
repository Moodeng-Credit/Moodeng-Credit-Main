// Their answer to "📱 Want a TEXT REMINDER?" that ISN'T a number (George 2026-11-27): after "Sorry, our texts
// don't reach Smart…" a borrower wrote "ok here in messenger only", and it landed as a support ticket with no
// reply. Now the AI reads it, and if they're telling us to remind them on Messenger (no texts, no other number,
// Messenger is fine) we confirm it right away with the real call time and what happens 1 hour before.
//
// Only right after the ask could have gone out: text reminders on, no number on file (the ask's own condition,
// callBooking.wantsTextReminderAsk), booked in the last 12 hours, the call still ahead, no team member writing
// to them since, a short message with a reminder-ish word, and once per booking (users.video_call_messenger_only_uid).
// Anything else, or the AI unsure → false, and the message goes on to support as before. The reply is ours,
// never the AI's: it only picks messenger / other.
import { withToday } from './aiToday.ts';
import { GEMINI_MODEL } from './geminiModel.ts';
import { lastTeamMessageAt } from './messengerBookingBot.ts';
import { sendMessengerMessage } from './sendpulse.ts';
import { formatCallTime } from './videoCall.ts';

// deno-lint-ignore no-explicit-any
type Svc = any;

const BOOKED_WITHIN_MS = 12 * 60 * 60 * 1000;
const MAX_CHARS = 200;

// Could be about where to remind them. The AI decides; this only keeps it from reading every short "ok".
const MAYBE_ABOUT_REMINDERS =
   /\b(messenger|msgr|chat|fb|facebook|dito|text|txt|sms|number|numero|smart|tnt|sun|globe|remind\w*|paalala|no thanks?|wala\s+(po\s+)?(ibang|other))\b/i;

/** Worth asking the AI about. Pure. */
export const mightBeReminderChannel = (text: string): boolean => {
   const t = text.trim();
   if (!t || t.length > MAX_CHARS || /https?:|www\./i.test(t)) return false;
   return MAYBE_ABOUT_REMINDERS.test(t);
};

// Without the AI: only the plain ways of saying it.
const PLAIN_MESSENGER_ONLY =
   /^\s*(ok(ay)?|sige|yes|oo|opo)?[\s,.!]*(po)?[\s,.!]*((just|only)\s+)?(here\s+(in|on)\s+messenger|(in|on|sa)\s+messenger|messenger|dito)(\s+(lang|only|na\s+lang|po|is\s+(fine|ok(ay)?)))*[\s.!🙏👍😊]*$/iu;
export const plainMessengerOnly = (text: string): boolean => PLAIN_MESSENGER_ONLY.test(text);

/** The system prompt. Pure. */
export const channelPrompt = (): string =>
   [
      'You read one Messenger reply from a borrower of Moodeng Credit (a small-loan app in the Philippines) who has a video call booked.',
      'Right after booking we asked: "📱 Want a TEXT REMINDER 1 hour before your call? Reply with just your mobile number."',
      'If they sent a Smart, TNT or Sun number we answered: "Sorry, our texts don\'t reach Smart, TNT or Sun numbers yet 🙏 We\'ll remind you here on Messenger. Have a Globe, TM, GOMO or DITO number? Send that one."',
      'Decide if their message means: remind me here on Messenger (they have no other number, do not want a text, Messenger is fine, "ok messenger only", "dito na lang", "no thanks").',
      'Answer "messenger" only if that is clearly what they mean. Answer "other" for anything else: a question, a problem, a different topic, wanting to change or cancel the call, promising to send another number, or anything unclear.',
      'Return JSON {"intent": "messenger" | "other"}.'
   ].join('\n');

async function askGemini(svc: Svc, text: string): Promise<'messenger' | 'other' | null> {
   try {
      const { data: key } = await svc.rpc('gemini_api_key');
      if (typeof key !== 'string' || !key) return null;
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`, {
         method: 'POST',
         headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
         signal: AbortSignal.timeout(8000),
         body: JSON.stringify({
            systemInstruction: { parts: [{ text: withToday(channelPrompt(), Date.now()) }] },
            contents: [{ role: 'user', parts: [{ text: `Borrower: ${text.trim()}` }] }],
            generationConfig: { responseMimeType: 'application/json', temperature: 0, maxOutputTokens: 1000, thinkingConfig: { thinkingLevel: 'low' } }
         })
      });
      if (!res.ok) {
         console.error('call-reminder-channel: gemini', res.status);
         return null;
      }
      const json = (await res.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string; thought?: boolean }> } }> };
      const out = (json.candidates?.[0]?.content?.parts ?? []).filter((p) => !p.thought).map((p) => p.text ?? '').join('');
      const intent = (JSON.parse(out || '{}') as { intent?: string }).intent;
      return intent === 'messenger' ? 'messenger' : intent === 'other' ? 'other' : null;
   } catch (err) {
      console.error('call-reminder-channel: gemini failed', err instanceof Error ? err.message : err);
      return null;
   }
}

/** Our confirmation: the call time and the ✅ that comes 1 hour before. Pure. */
export const messengerOnlyText = (whenText: string, locale: 'en' | 'fil'): string =>
   locale === 'fil'
      ? `👍 Sige, dito sa Messenger ka namin ire-remind!\n🗓️ Call mo: ${whenText}\n⏰ 1 oras bago nito, magpapadala kami ng ✅ dito. I-tap ito para ma-keep ang spot mo.`
      : `👍 Got it, Messenger only! We'll remind you right here.\n🗓️ Your call: ${whenText}\n⏰ 1 hour before, we'll send ✅ here. Tap it to keep your spot.`;

/** True when we answered it (so it isn't also a support ticket). Never throws. */
export const handleReminderChannelReply = async (svc: Svc, userId: string, contactId: string, text: string): Promise<boolean> => {
   try {
      if (!mightBeReminderChannel(text)) return false;
      const { data: user } = await svc
         .from('users')
         .select('video_call_booking_uid, video_call_starts_at, video_call_timezone, video_call_messenger_only_uid, loan_access_status, preferred_locale')
         .eq('id', userId)
         .maybeSingle();
      if (!user?.video_call_booking_uid || !user.video_call_starts_at || user.loan_access_status === 'rejected') return false;
      if (Date.parse(user.video_call_starts_at) <= Date.now() || user.video_call_messenger_only_uid === user.video_call_booking_uid) return false;
      // The ask only goes to people with text reminders on and no number on file.
      const { data: sms } = await svc.rpc('call_sms_status', { p_user: userId });
      const s = (sms ?? {}) as { enabled?: boolean; eligible?: boolean; number?: string | null };
      if (s.enabled !== true || s.eligible !== true || s.number) return false;
      // …and right after booking.
      const { data: booked } = await svc
         .from('call_events')
         .select('recorded_at')
         .eq('user_id', userId)
         .eq('kind', 'booked')
         .gte('recorded_at', new Date(Date.now() - BOOKED_WITHIN_MS).toISOString())
         .order('recorded_at', { ascending: false })
         .limit(1);
      const bookedAt = booked?.[0]?.recorded_at ? Date.parse(booked[0].recorded_at) : null;
      if (bookedAt === null) return false;
      // George or Emma wrote to them since: it's their conversation.
      const teamAt = await lastTeamMessageAt(svc, contactId);
      if (teamAt === undefined || (teamAt !== null && teamAt > bookedAt)) return false;

      const ai = await askGemini(svc, text);
      const intent = ai ?? (plainMessengerOnly(text) ? 'messenger' : 'other');
      if (intent !== 'messenger') return false;

      // Once per booking, claimed first so a retried webhook can't send it twice.
      const { data: claimed } = await svc
         .from('users')
         .update({ video_call_messenger_only_uid: user.video_call_booking_uid })
         .eq('id', userId)
         .eq('video_call_booking_uid', user.video_call_booking_uid)
         .or(`video_call_messenger_only_uid.is.null,video_call_messenger_only_uid.neq.${user.video_call_booking_uid}`)
         .select('id');
      if (!claimed?.length) return false;

      const { data: contact } = await svc.from('messenger_contacts').select('locale').eq('contact_id', contactId).maybeSingle();
      const locale = ((contact as { locale?: string | null } | null)?.locale ?? user.preferred_locale) === 'fil' ? 'fil' : 'en';
      const res = await sendMessengerMessage(contactId, { text: messengerOnlyText(formatCallTime(user.video_call_starts_at, user.video_call_timezone), locale) });
      if (!res.ok) console.error('call-reminder-channel: reply failed', res.reason);
      console.log('call-reminder-channel: messenger-only confirmed for', userId, ai ? 'ai' : 'plain');
      return true;
   } catch (err) {
      console.error('call-reminder-channel: failed', err instanceof Error ? err.message : err);
      return false;
   }
};
