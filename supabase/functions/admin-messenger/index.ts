import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

import { saveFacebookName, syncMessengerHistory } from '../_shared/messengerContactLog.ts';
import {
   findMessengerContactIdByCode,
   getMessengerContact,
   isInsideMessagingWindow,
   isSendPulseConfigured,
   listWhatsAppChats,
   listWhatsAppMessages,
   listWhatsAppTemplates,
   markWhatsAppRead,
   messengerDisplayName,
   normalizeWhatsAppPhone,
   replyWhatsAppText,
   type SendPulseContact,
   sendMessengerMessage,
   sendWhatsAppTemplateTo
} from '../_shared/sendpulse.ts';

// Admin → Borrower contacts, Messenger side (SendPulse API; the key never reaches the browser):
//   { action: 'profiles', userIds }  → each verified borrower's Facebook name + whether we're inside
//                                      Messenger's 24h window (i.e. whether "Message" can send now).
//   { action: 'send', userId, text } → sends the admin's message to that borrower on Messenger.
//   { action: 'sync_history', userIds? } → saves Facebook names + backfills messenger_contact_events
//                                      from SendPulse's chat log (_shared/messengerContactLog.ts).
// WhatsApp inbox (Admin → Support → WhatsApp), so the team can chat on the business number without the
// WhatsApp Business app:
//   { action: 'wa_chats' }                         → recent chats + which Moodeng user each one is.
//   { action: 'wa_messages', contactId, markRead?, size? } → one chat's messages (markRead when opened).
//   { action: 'wa_send', contactId, text }         → free-text reply (only inside Meta's 24h window).
//   { action: 'wa_people_search', query }           → Moodeng users by name / @username / email / phone.
//   { action: 'wa_templates' }                     → approved templates.
//   { action: 'wa_send_template', contactId | phone, name, language, params } → template to a chat or a new number.
// Active admins only — re-checked here against admin_users, like the other admin-* functions — or
// X-Admin-Token for server-side calls (pg_net), like admin-send-email.

const corsHeaders = {
   'Access-Control-Allow-Origin': '*',
   'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-admin-token',
   'Access-Control-Allow-Methods': 'POST, OPTIONS'
};
const json = (body: unknown, status = 200) =>
   new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const MAX_PROFILES = 200;
const MAX_TEXT = 2000;

// deno-lint-ignore no-explicit-any
type Svc = any;

// users.messenger_psid should hold the SendPulse contact id, but older verifications may have stored
// Facebook's numeric PSID (which SendPulse rejects). Fall back to looking the contact up by the
// one-time code the borrower verified with — the flow saved it on their SendPulse contact.
const resolveContact = async (svc: Svc, userId: string, storedId: string | null): Promise<{ id: string; contact: SendPulseContact } | null> => {
   if (storedId) {
      const contact = await getMessengerContact(storedId);
      if (contact) return { id: storedId, contact };
   }
   const { data: codes } = await svc
      .from('contact_verification_codes')
      .select('code')
      .eq('user_id', userId)
      .eq('channel', 'messenger')
      .not('verified_at', 'is', null)
      .order('verified_at', { ascending: false })
      .limit(1);
   const code = (codes as Array<{ code: string }> | null)?.[0]?.code;
   const contactId = code ? await findMessengerContactIdByCode(code) : null;
   if (!contactId) return null;
   const contact = await getMessengerContact(contactId);
   if (!contact) return null;
   // Heal the stored id so reminders and the next lookup go straight to the right contact.
   if (contactId !== storedId) await svc.from('users').update({ messenger_psid: contactId }).eq('id', userId);
   return { id: contactId, contact };
};

serve(async (req) => {
   if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
   if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

   const t0 = Date.now();
   const svc = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');

   // Auth: server-side token (X-Admin-Token = ADMIN_API_TOKEN, fail-closed), or an active admin's session.
   const adminToken = (Deno.env.get('ADMIN_API_TOKEN') ?? '').trim();
   const presentedToken = (req.headers.get('X-Admin-Token') ?? '').trim();
   if (presentedToken) {
      if (!adminToken || presentedToken !== adminToken) return json({ error: 'unauthorized' }, 401);
   } else {
      const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
      if (!token) return json({ error: 'Missing authorization token' }, 401);
      const { data: userData, error: userError } = await svc.auth.getUser(token);
      const callerId = userData?.user?.id;
      if (userError || !callerId) return json({ error: 'Invalid session' }, 401);
      const { data: adminRow } = await svc
         .from('admin_users')
         .select('user_id')
         .eq('user_id', callerId)
         .eq('active', true)
         .in('role', ['owner', 'admin', 'support'])
         .maybeSingle();
      if (!adminRow) return json({ error: 'Forbidden: admin account required' }, 403);
   }

   if (!isSendPulseConfigured()) return json({ error: 'sendpulse_not_configured' }, 503);

   const body = await req.json().catch(() => ({}));

   if (body.action === 'profiles') {
      const ids = (Array.isArray(body.userIds) ? body.userIds : []).filter((id: unknown) => typeof id === 'string').slice(0, MAX_PROFILES);
      if (!ids.length) return json({ profiles: [] });
      const { data: users } = await svc
         .from('users')
         .select('id, messenger_psid, messenger_verified_at, facebook_name')
         .in('id', ids)
         .not('messenger_verified_at', 'is', null);
      const profiles = await Promise.all(
         ((users ?? []) as Array<{ id: string; messenger_psid: string | null; facebook_name: string | null }>).map(async (u) => {
            const resolved = await resolveContact(svc, u.id, u.messenger_psid);
            const name = resolved ? messengerDisplayName(resolved.contact) : null;
            // Keep the stored name current (it can change on Facebook).
            await saveFacebookName(svc, u.id, name, u.facebook_name);
            return {
               userId: u.id,
               name: name ?? u.facebook_name,
               canMessageNow: resolved ? isInsideMessagingWindow(resolved.contact) : false,
               lastActivityAt: resolved?.contact.last_activity_at ?? null,
               found: Boolean(resolved)
            };
         })
      );
      return json({ profiles });
   }

   if (body.action === 'sync_history') {
      // Backfill Facebook names + every message each borrower sent us, from SendPulse's chat log.
      // userIds omitted → every borrower with a Messenger contact. Safe to re-run: logged messages are skipped.
      // Verified without a stored contact id too: resolveContact finds them by their verification code.
      let query = svc
         .from('users')
         .select('id, messenger_psid, facebook_name')
         .or('messenger_psid.not.is.null,messenger_verified_at.not.is.null');
      if (Array.isArray(body.userIds) && body.userIds.length) {
         query = query.in('id', body.userIds.filter((id: unknown) => typeof id === 'string').slice(0, MAX_PROFILES));
      }
      const { data: users, error } = await query.limit(MAX_PROFILES);
      if (error) return json({ error: error.message }, 500);
      const results = [];
      for (const u of (users ?? []) as Array<{ id: string; messenger_psid: string | null; facebook_name: string | null }>) {
         const resolved = await resolveContact(svc, u.id, u.messenger_psid);
         results.push(
            resolved
               ? await syncMessengerHistory(svc, u.id, resolved.id, u.facebook_name)
               : { userId: u.id, found: false, facebookName: null, added: 0, inbound: 0 }
         );
      }
      return json({ results });
   }

   if (body.action === 'send') {
      const userId = typeof body.userId === 'string' ? body.userId : '';
      const text = typeof body.text === 'string' ? body.text.trim().slice(0, MAX_TEXT) : '';
      if (!userId || !text) return json({ ok: false, reason: 'missing_fields' }, 400);
      const { data: user } = await svc.from('users').select('id, user_role, messenger_psid, messenger_verified_at').eq('id', userId).maybeSingle();
      if (!user?.messenger_verified_at) return json({ ok: false, reason: 'not_verified' });
      if (user.user_role === 'lender') return json({ ok: false, reason: 'not_borrower' });
      const resolved = await resolveContact(svc, user.id, user.messenger_psid);
      if (!resolved) return json({ ok: false, reason: 'contact_not_found' });
      const result = await sendMessengerMessage(resolved.id, { text });
      return json(result);
   }

   if (typeof body.action === 'string' && body.action.startsWith('wa_')) {
      const tAuth = Date.now() - t0;
      const result = await handleWhatsApp(svc, body);
      // Timing in the logs: where the inbox's wait goes (our auth check vs SendPulse).
      console.log(`[wa] ${body.action} auth=${tAuth}ms work=${Date.now() - t0 - tAuth}ms`);
      return json(result);
   }

   return json({ error: 'unknown_action' }, 400);
});

const WA_TEXT_MAX = 1024;

// Finish work after the response is sent (Supabase edge runtime), so the admin doesn't wait on it.
const runInBackground = (p: Promise<unknown>) => {
   const rt = (globalThis as { EdgeRuntime?: { waitUntil?: (p: Promise<unknown>) => void } }).EdgeRuntime;
   if (rt?.waitUntil) rt.waitUntil(p.catch(() => undefined));
   else void p.catch(() => undefined);
};
const WINDOW_MS = 24 * 60 * 60 * 1000;

// deno-lint-ignore no-explicit-any
const handleWhatsApp = async (svc: Svc, body: any) => {
   const contactId = typeof body.contactId === 'string' ? body.contactId.trim() : '';

   if (body.action === 'wa_chats') {
      const res = await listWhatsAppChats(100);
      if (!res.ok) return res;
      // Who each chat is in Moodeng: by the WhatsApp contact they confirmed, else by phone number
      // (private.admin_person_card — name, KYC name, activity, loans).
      const { data: people, error } = await svc.rpc('admin_whatsapp_people', {
         p_contacts: res.data.map((c) => ({ contactId: c.contactId, phone: c.phone }))
      });
      if (error) console.error('[wa] admin_whatsapp_people failed', error.message);
      // deno-lint-ignore no-explicit-any
      const byContact = new Map(((people ?? []) as any[]).map((p) => [p.contactId as string, p]));
      const chats = res.data
         .map((c) => {
            const match = byContact.get(c.contactId);
            const card = match?.card ?? null;
            return {
               ...c,
               user: card ? { userId: card.userId, username: card.username, displayName: card.displayName } : null,
               person: card,
               matchedBy: match?.matchedBy ?? null
            };
         })
         .sort((a, b) => Date.parse(b.lastAt ?? '') - Date.parse(a.lastAt ?? '') || 0);
      return { ok: true, chats };
   }

   if (body.action === 'wa_messages') {
      if (!contactId) return { ok: false, reason: 'missing_contact' };
      // Smaller pages keep the SendPulse round trip short; the inbox polls this every few seconds.
      const size = Math.min(150, Math.max(20, Number(body.size) || 60));
      const res = await listWhatsAppMessages(contactId, size, body.debug === true);
      if (!res.ok) return res;
      // Only when a teammate actually opens the chat (not on every poll), and without making them wait.
      if (body.markRead === true) runInBackground(markWhatsAppRead(contactId));
      const lastInbound = [...res.data].reverse().find((m) => m.direction === 1)?.createdAt ?? null;
      const canFreeText = lastInbound ? Date.now() - Date.parse(lastInbound) < WINDOW_MS : false;
      return { ok: true, messages: res.data, lastInboundAt: lastInbound, canFreeText };
   }

   if (body.action === 'wa_send') {
      const text = typeof body.text === 'string' ? body.text.trim() : '';
      if (!contactId || !text) return { ok: false, reason: 'missing_fields' };
      if (text.length > WA_TEXT_MAX) return { ok: false, reason: 'too_long' };
      return await replyWhatsAppText(contactId, text);
   }

   if (body.action === 'wa_people_search') {
      const q = typeof body.query === 'string' ? body.query.trim().slice(0, 80) : '';
      if (q.length < 2) return { ok: true, people: [] };
      const { data, error } = await svc.rpc('admin_people_search', { p_query: q });
      if (error) return { ok: false, reason: 'search_failed', detail: error.message };
      return { ok: true, people: data ?? [] };
   }

   if (body.action === 'wa_templates') {
      const res = await listWhatsAppTemplates();
      return res.ok ? { ok: true, templates: res.data } : res;
   }

   if (body.action === 'wa_send_template') {
      const name = typeof body.name === 'string' ? body.name.trim() : '';
      const language = typeof body.language === 'string' && body.language.trim() ? body.language.trim() : 'en';
      const params = (Array.isArray(body.params) ? body.params : []).map((p: unknown) => String(p ?? '').trim().slice(0, 300));
      if (!name) return { ok: false, reason: 'missing_template' };
      if (params.some((p: string) => !p)) return { ok: false, reason: 'missing_params' };
      if (contactId) return await sendWhatsAppTemplateTo({ contactId }, { name, language, params });
      const phone = normalizeWhatsAppPhone(body.phone);
      if (!phone) return { ok: false, reason: 'bad_phone' };
      return await sendWhatsAppTemplateTo({ phone }, { name, language, params });
   }

   return { ok: false, reason: 'unknown_action' };
};
