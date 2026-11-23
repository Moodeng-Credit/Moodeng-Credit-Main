import { CONNECT_URL } from './loanAccess.ts';
import { FOLLOW_UP_TEMPLATE, normalizeWhatsAppPhone, sendWhatsAppTemplateTo } from './sendpulse.ts';

// The booking link, everywhere we tell someone to book their call (George, 2026-11-23).
//
// A borrower approved by the AI at 21:47 BKK on Nov 22 messaged on WhatsApp the next day: "I'm not able
// to book a call". Nothing blocked them; they never found the booking screen (their screenshot was the
// Account tab). The ✅ message only said "open moodeng.app", and Messenger is often past its 24h window
// by then, while WhatsApp (the line they actually use) got nothing. So:
//   - the ✅ Good fit message carries the direct link (preScreeningDecision.ts tellGoodFit),
//   - it and the book-your-call reminders (bookCallNudge.ts) also go out on WhatsApp, through the
//     approved `moodeng_follow_up` template, which works outside WhatsApp's 24h window.
// deno-lint-ignore no-explicit-any
type SupabaseClient = any;

export const BOOK_CALL_URL = CONNECT_URL;

// The taps people miss on the way: the goal sentence, "I'll be ready ✓", then Continue.
const HOW_TO = 'Type what the loan is for, tap "Next: book your call", tap "I\'ll be ready ✓", then pick a time and tap Continue.';

export type BookCallKind = 'good_fit' | 'reminder';

/** {{2}} of the WhatsApp `moodeng_follow_up` template: one line (Meta refuses new lines in a parameter). Pure. */
export const bookCallWhatsAppText = (kind: BookCallKind) =>
   (kind === 'reminder'
      ? "Reminder: you passed the first check but haven't booked your 15-min video call yet. You pick the time, there is no invite to wait for. "
      : 'Good news! You passed the first check. Next: book your 15-min video call. ') + `Open ${BOOK_CALL_URL} - ${HOW_TO}`;

/** The ✅ Good fit Messenger text (English + Filipino) with the link. Pure. */
export const goodFitMessengerText = () =>
   `🎉 Good news! The Moodeng team looked at your answers. Next: book your 15-min call here: ${BOOK_CALL_URL}\n${HOW_TO}\n\n` +
   `🎉 Magandang balita! Pwede ka nang tumuloy. Mag-book ng 15-min call dito: ${BOOK_CALL_URL}`;

export const firstNameOf = (displayName: string | null | undefined, username: string | null | undefined) =>
   (displayName ?? '').trim().split(/\s+/)[0] || (username ?? '').trim() || 'there';

export type WaPerson = {
   display_name?: string | null;
   username?: string | null;
   whatsapp_contact_id?: string | null;
   whatsapp_number?: string | null;
   whatsapp_verified_at?: string | null;
};

export const WA_PERSON_COLUMNS = 'display_name, username, whatsapp_contact_id, whatsapp_number, whatsapp_verified_at';

/** Their WhatsApp chat, else their verified number. Null when there's no WhatsApp to use. Pure. */
export const whatsAppTarget = (u: WaPerson | null | undefined): { contactId: string } | { phone: string } | null => {
   if (u?.whatsapp_contact_id) return { contactId: u.whatsapp_contact_id };
   const phone = u?.whatsapp_verified_at ? normalizeWhatsAppPhone(u.whatsapp_number) : null;
   return phone ? { phone } : null;
};

/** The booking link on WhatsApp (approved follow-up template). False when not sent. Never throws. */
export async function sendBookCallWhatsApp(u: WaPerson | null | undefined, kind: BookCallKind): Promise<boolean> {
   const target = whatsAppTarget(u);
   if (!target) return false;
   try {
      const res = await sendWhatsAppTemplateTo(target, {
         name: FOLLOW_UP_TEMPLATE.name,
         language: FOLLOW_UP_TEMPLATE.language,
         params: [firstNameOf(u?.display_name, u?.username), bookCallWhatsAppText(kind)]
      });
      if (!res.ok) console.error('book call link: WhatsApp failed', JSON.stringify(res).slice(0, 300));
      return res.ok;
   } catch (err) {
      console.error('book call link: WhatsApp threw', err instanceof Error ? err.message : err);
      return false;
   }
}

/** Loads their WhatsApp details, then sends the link. Never throws. */
export async function sendBookCallWhatsAppTo(svc: SupabaseClient, userId: string, kind: BookCallKind): Promise<boolean> {
   try {
      const { data } = await svc.from('users').select(WA_PERSON_COLUMNS).eq('id', userId).maybeSingle();
      return await sendBookCallWhatsApp(data as WaPerson | null, kind);
   } catch (err) {
      console.error('book call link: WhatsApp lookup failed', err instanceof Error ? err.message : err);
      return false;
   }
}
