import { getMessengerChatMessages, getMessengerContact, messengerDisplayName, type SendPulseChatMessage } from './sendpulse.ts';

// Who a borrower is on Facebook and every time they contacted us on Messenger
// (users.facebook_name + messenger_contact_events, migration 20261011190000), and everyone else who
// writes to the Page (messenger_contacts, migration 20261023120000).
//   - sendpulse-events logs each subscribe / message live (source 'webhook').
//   - sendpulse-messenger-verify saves the name and claims the contact's earlier rows on connect.
//   - admin-messenger 'sync_history' backfills from SendPulse's chat log (source 'history').

// deno-lint-ignore no-explicit-any
type Svc = any;

export type ContactKind = 'subscribe' | 'message';

// A webhook row and the same message read back from the chat log can be stamped a little apart.
export const SAME_MESSAGE_MS = 2 * 60 * 1000;

export type LoggedRow = { id: number; occurred_at: string; sendpulse_message_id: string | null };
export type HistoryPlan = {
   inserts: Array<{ sendpulse_message_id: string | null; occurred_at: string }>;
   // Webhook rows that are the same message: give them the SendPulse id so the next sync skips them.
   claims: Array<{ id: number; sendpulse_message_id: string }>;
};

// Which inbound chat-log messages are new, given what's already logged for this contact.
export const planHistoryRows = (messages: SendPulseChatMessage[], logged: LoggedRow[]): HistoryPlan => {
   const knownIds = new Set(logged.map((r) => r.sendpulse_message_id).filter(Boolean));
   // Webhook rows not yet tied to a SendPulse message; each can absorb at most one message.
   const open = logged.filter((r) => !r.sendpulse_message_id).map((r) => ({ id: r.id, at: Date.parse(r.occurred_at) }));
   const plan: HistoryPlan = { inserts: [], claims: [] };
   for (const m of messages) {
      if (m.direction !== 1 || !m.created_at) continue;
      const at = Date.parse(m.created_at);
      if (Number.isNaN(at)) continue;
      const messageId = m.id ? String(m.id) : null;
      if (messageId && knownIds.has(messageId)) continue;
      const match = open.findIndex((r) => Math.abs(r.at - at) <= SAME_MESSAGE_MS);
      if (match >= 0) {
         const [row] = open.splice(match, 1);
         if (messageId) plan.claims.push({ id: row.id, sendpulse_message_id: messageId });
         continue;
      }
      plan.inserts.push({ sendpulse_message_id: messageId, occurred_at: new Date(at).toISOString() });
      if (messageId) knownIds.add(messageId);
   }
   return plan;
};

// Saves the Facebook name when it differs from `current` (what's stored now). Never blanks a stored name.
export const saveFacebookName = async (svc: Svc, userId: string, name: string | null, current?: string | null) => {
   const clean = name?.trim();
   if (!clean || clean === current) return;
   const { error } = await svc.from('users').update({ facebook_name: clean }).eq('id', userId);
   if (error) console.error('messengerContactLog: save name failed', error.message);
};

// One subscribe / message from the person, as it happens. Returns the borrower it belongs to, if any.
export const logMessengerContact = async (
   svc: Svc,
   contactId: string,
   kind: ContactKind,
   at: number,
   payload: Record<string, unknown> | null = null
): Promise<{ userId: string; facebookName: string | null } | null> => {
   const { data: users } = await svc.from('users').select('id, facebook_name').eq('messenger_psid', contactId).limit(1);
   const user = (users as Array<{ id: string; facebook_name: string | null }> | null)?.[0] ?? null;
   const { error } = await svc.from('messenger_contact_events').insert({
      user_id: user?.id ?? null,
      contact_id: contactId,
      kind,
      source: 'webhook',
      occurred_at: new Date(at).toISOString(),
      ...(payload ? { payload } : {})
   });
   if (error) console.error('messengerContactLog: insert failed', error.message);
   return user ? { userId: user.id, facebookName: user.facebook_name } : null;
};

// On connect: rows logged while the contact was still a stranger now belong to this borrower.
export const claimContactRows = async (svc: Svc, userId: string, contactId: string) => {
   const { error } = await svc.from('messenger_contact_events').update({ user_id: userId }).eq('contact_id', contactId).is('user_id', null);
   if (error) console.error('messengerContactLog: claim rows failed', error.message);
   const now = new Date().toISOString();
   const { error: contactError } = await svc
      .from('messenger_contacts')
      .upsert({ contact_id: contactId, user_id: userId, linked_at: now, last_seen_at: now }, { onConflict: 'contact_id' });
   if (contactError) console.error('messengerContactLog: link contact failed', contactError.message);
};

// Everyone who messages the Page, registered or not (messenger_contacts, migration 20261023120000).
// `lookupName` (a SendPulse API call) only runs when we don't have their name yet. `isNew` is true the
// first time this contact is ever seen.
export const rememberMessengerContact = async (
   svc: Svc,
   contactId: string,
   kind: ContactKind,
   at: number,
   userId: string | null,
   lookupName: () => Promise<string | null>
): Promise<{ isNew: boolean; facebookName: string | null }> => {
   const seenAt = new Date(at).toISOString();
   const { data: existing } = await svc
      .from('messenger_contacts')
      .select('facebook_name, last_seen_at, message_count, user_id')
      .eq('contact_id', contactId)
      .maybeSingle();
   const row = existing as { facebook_name: string | null; last_seen_at: string; message_count: number; user_id: string | null } | null;
   const facebookName = row?.facebook_name || (await lookupName())?.trim() || null;
   if (!row) {
      const { data: inserted, error } = await svc
         .from('messenger_contacts')
         .upsert(
            {
               contact_id: contactId,
               facebook_name: facebookName,
               first_seen_at: seenAt,
               last_seen_at: seenAt,
               message_count: kind === 'message' ? 1 : 0,
               user_id: userId,
               linked_at: userId ? new Date().toISOString() : null
            },
            { onConflict: 'contact_id', ignoreDuplicates: true }
         )
         .select('contact_id');
      if (error) console.error('messengerContactLog: remember contact failed', error.message);
      return { isNew: Boolean(inserted?.length), facebookName };
   }
   const { error } = await svc
      .from('messenger_contacts')
      .update({
         last_seen_at: Date.parse(row.last_seen_at) > at ? row.last_seen_at : seenAt,
         message_count: row.message_count + (kind === 'message' ? 1 : 0),
         ...(facebookName && facebookName !== row.facebook_name ? { facebook_name: facebookName } : {}),
         ...(userId && !row.user_id ? { user_id: userId, linked_at: new Date().toISOString() } : {})
      })
      .eq('contact_id', contactId);
   if (error) console.error('messengerContactLog: update contact failed', error.message);
   return { isNew: false, facebookName };
};

export type SyncResult = { userId: string; found: boolean; facebookName: string | null; added: number; inbound: number };

// Backfill one borrower from SendPulse: their Facebook name and every message they ever sent us.
export const syncMessengerHistory = async (svc: Svc, userId: string, contactId: string, storedName: string | null): Promise<SyncResult> => {
   const contact = await getMessengerContact(contactId);
   if (!contact) return { userId, found: false, facebookName: null, added: 0, inbound: 0 };
   const facebookName = messengerDisplayName(contact);
   await saveFacebookName(svc, userId, facebookName, storedName);
   await claimContactRows(svc, userId, contactId);

   const messages = await getMessengerChatMessages(contactId);
   if (!messages) return { userId, found: true, facebookName, added: 0, inbound: 0 };
   const { data: logged } = await svc
      .from('messenger_contact_events')
      .select('id, occurred_at, sendpulse_message_id')
      .eq('contact_id', contactId);
   const plan = planHistoryRows(messages, (logged ?? []) as LoggedRow[]);
   for (const claim of plan.claims) {
      await svc.from('messenger_contact_events').update({ sendpulse_message_id: claim.sendpulse_message_id }).eq('id', claim.id);
   }
   if (plan.inserts.length) {
      const { error } = await svc
         .from('messenger_contact_events')
         .insert(plan.inserts.map((row) => ({ ...row, user_id: userId, contact_id: contactId, kind: 'message', source: 'history' })));
      if (error) console.error('messengerContactLog: history insert failed', error.message);
   }
   return {
      userId,
      found: true,
      facebookName,
      added: plan.inserts.length,
      inbound: messages.filter((m) => m.direction === 1).length
   };
};
