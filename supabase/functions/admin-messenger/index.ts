import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

import { saveFacebookName, syncMessengerHistory } from '../_shared/messengerContactLog.ts';
import {
   findMessengerContactIdByCode,
   getMessengerContact,
   isInsideMessagingWindow,
   isSendPulseConfigured,
   messengerDisplayName,
   type SendPulseContact,
   sendMessengerMessage
} from '../_shared/sendpulse.ts';

// Admin → Borrower contacts, Messenger side (SendPulse API; the key never reaches the browser):
//   { action: 'profiles', userIds }  → each verified borrower's Facebook name + whether we're inside
//                                      Messenger's 24h window (i.e. whether "Message" can send now).
//   { action: 'send', userId, text } → sends the admin's message to that borrower on Messenger.
//   { action: 'sync_history', userIds? } → saves Facebook names + backfills messenger_contact_events
//                                      from SendPulse's chat log (_shared/messengerContactLog.ts).
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
      let query = svc.from('users').select('id, messenger_psid, facebook_name').not('messenger_psid', 'is', null);
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

   return json({ error: 'unknown_action' }, 400);
});
