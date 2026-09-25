// Outbound Facebook Messenger via SendPulse — the same bot that runs the one-tap "Confirm Facebook"
// flow (docs/HANDOFF_BORROWER_VERIFICATION.md §6). users.messenger_psid holds the SendPulse contact
// id captured at verification, so we can message a borrower back without Meta App Review.
//
// THE RULE THAT SHAPES EVERYTHING HERE: Messenger only allows free-form messages within 24 hours of
// the person's last interaction with the Page. Meta retired the "event reminder" message tags on
// 2026-04-27 (CONFIRMED_EVENT_UPDATE etc. now fail with error 100), and their replacement — Utility
// Templates — needs Meta's own approval. So we check the contact's last_activity_at first and only
// send inside the window (with a margin). Outside it we skip quietly; push + Telegram still go out.
//
// Credentials (SendPulse → Account settings → API), either:
//   SENDPULSE_API_KEY                        — a static "sp_apikey_…" key, sent as the Bearer token; or
//   SENDPULSE_API_ID + SENDPULSE_API_SECRET  — OAuth client credentials, exchanged for an hour-long token.
// Unset → every call is a no-op returning { ok: false, reason: 'not_configured' }. Never throws.

const API = 'https://api.sendpulse.com';
// Stay clear of the 24h edge so a slow send never lands just outside it.
const WINDOW_MS = 23 * 60 * 60 * 1000;

export type SendPulseResult = { ok: true } | { ok: false; reason: string };

let cachedToken: { value: string; expiresAt: number } | null = null;

export const isSendPulseConfigured = () =>
   Boolean(
      Deno.env.get('SENDPULSE_API_KEY')?.trim() ||
         (Deno.env.get('SENDPULSE_API_ID')?.trim() && Deno.env.get('SENDPULSE_API_SECRET')?.trim())
   );

const getToken = async (): Promise<string | null> => {
   const staticKey = Deno.env.get('SENDPULSE_API_KEY')?.trim();
   if (staticKey) return staticKey;
   if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value;
   const clientId = Deno.env.get('SENDPULSE_API_ID')?.trim();
   const clientSecret = Deno.env.get('SENDPULSE_API_SECRET')?.trim();
   if (!clientId || !clientSecret) return null;

   const res = await fetch(`${API}/oauth/access_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ grant_type: 'client_credentials', client_id: clientId, client_secret: clientSecret })
   });
   const body = await res.json().catch(() => null);
   if (!res.ok || !body?.access_token) {
      console.error('[sendpulse] token request failed', res.status);
      return null;
   }
   cachedToken = { value: body.access_token, expiresAt: Date.now() + Number(body.expires_in ?? 3600) * 1000 };
   return cachedToken.value;
};

export type SendPulseContact = {
   id: string;
   status?: number; // 1 active, 2 unsubscribed, 3 disabled
   last_activity_at?: string | null;
   unsubscribed_at?: string | null;
   channel_data?: { name?: string; first_name?: string; last_name?: string | null };
};

export const getMessengerContact = async (contactId: string): Promise<SendPulseContact | null> => {
   try {
      const token = await getToken();
      if (!token) return null;
      const res = await fetch(`${API}/messenger/contacts/get?id=${encodeURIComponent(contactId)}`, {
         headers: { Authorization: `Bearer ${token}` }
      });
      const body = await res.json().catch(() => null);
      return res.ok && body?.data ? (body.data as SendPulseContact) : null;
   } catch (err) {
      console.error('[sendpulse] contacts/get failed', err instanceof Error ? err.message : err);
      return null;
   }
};

// The bot behind the "Confirm Facebook" flow (Moodeng Credit Page).
export const SENDPULSE_BOT_ID = Deno.env.get('SENDPULSE_BOT_ID')?.trim() || '81acb48b-e32c-4c85-b29f-0efae2ca2716';

// The flow stores the borrower's one-time code on their SendPulse contact as the `mdng_code`
// variable. Looking the contact up by that code gives the SendPulse contact id — the only id the
// send API accepts (Facebook's numeric PSID is rejected) — whatever the flow's API request sends us.
export const findMessengerContactIdByCode = async (code: string): Promise<string | null> => {
   try {
      const token = await getToken();
      if (!token || !code) return null;
      const url =
         `${API}/messenger/contacts/getByVariable?bot_id=${encodeURIComponent(SENDPULSE_BOT_ID)}` +
         `&variable_name=mdng_code&variable_value=${encodeURIComponent(code)}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      const body = await res.json().catch(() => null);
      const contacts = (res.ok && Array.isArray(body?.data) ? body.data : []) as Array<{ id?: string }>;
      return contacts.length === 1 && contacts[0].id ? contacts[0].id : null;
   } catch (err) {
      console.error('[sendpulse] getByVariable failed', err instanceof Error ? err.message : err);
      return null;
   }
};

// The Facebook profile name SendPulse holds for this contact — shown to admins next to the KYC name.
export const messengerDisplayName = (contact: SendPulseContact | null) => {
   const data = contact?.channel_data;
   return data?.name || [data?.first_name, data?.last_name].filter(Boolean).join(' ') || null;
};

export const isInsideMessagingWindow = (contact: SendPulseContact | null, now = Date.now()) => {
   if (!contact?.last_activity_at || (contact.status !== undefined && contact.status !== 1)) return false;
   const last = Date.parse(contact.last_activity_at);
   if (Number.isNaN(last)) return false;
   // unsubscribed_at stays set after someone subscribes again. When SendPulse says the contact is
   // active (status 1) and they've written to us since, the old unsubscribe no longer applies;
   // without that confirmation, any unsubscribe still blocks.
   if (contact.unsubscribed_at) {
      const unsubscribed = Date.parse(contact.unsubscribed_at);
      if (contact.status !== 1 || Number.isNaN(unsubscribed) || unsubscribed >= last) return false;
   }
   return now - last < WINDOW_MS;
};

export type MessengerCard = { title: string; subtitle?: string; button: { title: string; url: string } };

// /contacts/send bodies: a plain text message, or a one-card template carrying a link button.
// Messenger caps card titles and subtitles at 80 chars and button titles at 20.
export const buildTextPayload = (contactId: string, text: string) => ({
   contact_id: contactId,
   message: { type: 'RESPONSE', content_type: 'message', text }
});

export const buildCardPayload = (contactId: string, card: MessengerCard) => ({
   contact_id: contactId,
   message: {
      type: 'RESPONSE',
      content_type: 'template',
      data: {
         attachment: {
            type: 'template',
            payload: {
               template_type: 'generic',
               elements: [
                  {
                     title: card.title.slice(0, 80),
                     ...(card.subtitle ? { subtitle: card.subtitle.slice(0, 80) } : {}),
                     buttons: [{ type: 'web_url', title: card.button.title.slice(0, 20), url: card.button.url }]
                  }
               ]
            }
         }
      }
   }
});

const postSend = async (token: string, payload: unknown) => {
   const res = await fetch(`${API}/messenger/contacts/send`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
   });
   const body = await res.json().catch(() => null);
   if (!res.ok || body?.success === false) {
      console.error('[sendpulse] contacts/send failed', res.status, JSON.stringify(body)?.slice(0, 300));
      return false;
   }
   return true;
};

// Sends `text` (if any) and then `card` (if any) — only inside the 24h window.
export const sendMessengerMessage = async (
   contactId: string | null | undefined,
   content: { text?: string; card?: MessengerCard }
): Promise<SendPulseResult> => {
   if (!contactId) return { ok: false, reason: 'no_contact' };
   if (!isSendPulseConfigured()) return { ok: false, reason: 'not_configured' };
   try {
      const contact = await getMessengerContact(contactId);
      if (!contact) return { ok: false, reason: 'contact_not_found' };
      if (!isInsideMessagingWindow(contact)) return { ok: false, reason: 'outside_24h_window' };

      const token = await getToken();
      if (!token) return { ok: false, reason: 'auth_failed' };
      if (content.text && !(await postSend(token, buildTextPayload(contactId, content.text)))) return { ok: false, reason: 'send_failed' };
      if (content.card && !(await postSend(token, buildCardPayload(contactId, content.card)))) return { ok: false, reason: 'send_failed' };
      return { ok: true };
   } catch (err) {
      console.error('[sendpulse] send threw', err instanceof Error ? err.message : err);
      return { ok: false, reason: 'send_failed' };
   }
};
