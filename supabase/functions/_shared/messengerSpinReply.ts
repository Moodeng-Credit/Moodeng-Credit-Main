// "SPIN" (or "SPIN CODE") typed to the Page by a known borrower → a button to their Moo-Spin.
//
// Why it exists: Messenger only lets the Page message someone for 24 hours after their last message.
// A Facebook post / video says "comment or message SPIN for a free spin": their SPIN reopens the 24
// hours, this answers it with moodeng.app/spin/CODE (the newest live campaign when they don't name
// one), and the reminders we send in the next day get through. Rules live in the database
// (migration 20261122120000_spin_wheel); mode 'team' answers only the team, 'off' answers nobody.
import { sendMessengerMessage } from './sendpulse.ts';

// deno-lint-ignore no-explicit-any
type Svc = any;

const SPIN_RE = /^\s*(?:moo-?)?spin(?:\s+([a-z0-9]{3,20}))?\s*[!.?]*\s*$/i;

/** The campaign code they typed ("SPIN PAYDAY" → "PAYDAY"), null for a plain SPIN, undefined when it isn't a spin message. */
export const parseSpinMessage = (text: string): string | null | undefined => {
   const match = SPIN_RE.exec(text);
   if (!match) return undefined;
   return match[1] ? match[1].toUpperCase() : null;
};

export const spinLink = (code: string | null): string => (code ? `https://moodeng.app/spin/${code}` : 'https://moodeng.app/spin');

export const spinReplyText = (hasCampaign: boolean): string =>
   hasCampaign
      ? '🎡 Your Moo-Spin is waiting! Read the post, answer 1 question, then spin for free food.'
      : '🎡 Moo-Spin! Tap below to see your spins and prizes.';

const modeOf = (raw: unknown): string => {
   try {
      const value = typeof raw === 'string' ? JSON.parse(raw) : null;
      return typeof value?.mode === 'string' ? value.mode : 'team';
   } catch {
      return 'team';
   }
};

/** True when the message was SPIN and we answered it (so it isn't also a support ticket). */
export const handleSpinMessage = async (svc: Svc, userId: string, contactId: string, text: string): Promise<boolean> => {
   try {
      const typedCode = parseSpinMessage(text);
      if (typedCode === undefined) return false;
      const { data: setting } = await svc.from('telegram_bot_settings').select('value').eq('key', 'spin_wheel').maybeSingle();
      const mode = modeOf(setting?.value);
      if (mode === 'off') return false;
      if (mode === 'team') {
         const { data: admin } = await svc.from('admin_users').select('user_id').eq('user_id', userId).eq('active', true).maybeSingle();
         if (!admin) return false;
      }

      const nowIso = new Date().toISOString();
      let query = svc
         .from('spin_campaigns')
         .select('code')
         .eq('active', true)
         .lte('starts_at', nowIso)
         .or(`ends_at.is.null,ends_at.gt.${nowIso}`)
         .order('created_at', { ascending: false })
         .limit(1);
      if (typedCode) query = query.eq('code', typedCode);
      const { data: campaigns } = await query;
      const code: string | null = campaigns?.[0]?.code ?? null;

      const res = await sendMessengerMessage(contactId, {
         text: spinReplyText(Boolean(code)),
         card: { title: 'Moo-Spin 🎡 Free food prizes', button: { title: 'Spin now', url: spinLink(code) } }
      });
      if (!res.ok) console.error('messenger-spin-reply: send failed', res.reason);
      return true;
   } catch (err) {
      console.error('messenger-spin-reply: failed', err instanceof Error ? err.message : err);
      return false;
   }
};
