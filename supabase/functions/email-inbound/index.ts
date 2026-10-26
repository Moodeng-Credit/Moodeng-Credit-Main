import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

import { isAutomatedEmail } from '../_shared/inboundEmailFilter.ts';
import { alertTeam, postToTicket } from '../_shared/supportTickets.ts';

// Inbound-email → support ticket.
//
// support@moodeng.app lives on Namecheap Private Email (IMAP/SMTP only, no REST API). Rather
// than poll IMAP from an edge function (a bad fit for Deno Deploy's socket model), inbound mail
// is *forwarded* into a webhook provider — Resend Inbound (MX on a reply subdomain) or a
// Cloudflare Email Worker — which POSTs the parsed message here. We mirror it into the same
// widget_conversations ticket model the live chat uses (a row + a Discord forum thread), so the
// team replies to email the same way as to chat. The widget API opens channel 'email' threads in
// their own forum (its SUPPORT_EMAIL_CHANNEL_ID env var on Vercel) so they don't mix with Messenger
// and website chats in #web-support; without it they fall back to the shared forum. The message goes through the widget API's /api/message
// (_shared/supportTickets.ts), exactly like a website chat message: saved in widget_messages and posted
// by the Discord bot into the ticket thread with Reply / Resolve / Quick reply. (It used to post with
// a Discord webhook secret that was never set on this project, so no email ever reached Discord.)
//
// Replies: a team member's Reply in Discord is saved as an 'agent' message, and the existing
// nudge-away-replies sweep emails it to the sender (visitor_email). The team can also reply straight
// from the mailbox: the sender's address is on the ticket.
//
// Auth: a shared secret in the query string (?secret=EMAIL_INBOUND_SECRET), set on the webhook
// endpoint URL when you configure Resend/Cloudflare. Provider-agnostic and unguessable; combined
// with the random function URL it is a sufficient gate for a receive-only endpoint.
//
// Expected JSON body (provider-agnostic; a Cloudflare worker can be written to match it, and
// Resend Inbound's `data` envelope is unwrapped automatically):
//   {
//     "from":    "Jane Doe <jane@example.com>"  | "jane@example.com",
//     "to":      "reply+<uuid>@reply.moodeng.app" | ["support@moodeng.app", ...],
//     "subject": "Re: World ID not working",
//     "text":    "plain body",           // preferred
//     "html":    "<p>…</p>",             // fallback if no text
//     "headers": { "message-id": "<…>", "in-reply-to": "<…>", "references": "<…> <…>" }
//                 | [ { "name": "Message-ID", "value": "<…>" }, … ]
//   }

const corsHeaders = {
   'Access-Control-Allow-Origin': '*',
   'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
   'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
   new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

// Constant-time string compare so the secret can't be recovered by timing.
const timingSafeEqual = (a: string, b: string): boolean => {
   if (a.length !== b.length) return false;
   let diff = 0;
   for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
   return diff === 0;
};

const REPLY_SUBDOMAIN = Deno.env.get('EMAIL_REPLY_DOMAIN')?.trim() || 'reply.moodeng.app';

type InboundEmail = {
   fromEmail: string;
   fromName: string | null;
   toList: string[];
   subject: string;
   body: string;
   messageId: string | null;
   inReplyTo: string | null;
   references: string[];
   /** Sent by a machine (no-reply sender, mailing list, auto-reply) rather than a person. */
   automated: boolean;
};

// "Jane Doe <jane@example.com>" | "jane@example.com" -> { name, email }
const parseAddress = (raw: string): { name: string | null; email: string } => {
   const s = (raw ?? '').trim();
   const angled = s.match(/^(.*?)<([^>]+)>\s*$/);
   if (angled) {
      const name = angled[1].trim().replace(/^"|"$/g, '').trim();
      return { name: name || null, email: angled[2].trim().toLowerCase() };
   }
   return { name: null, email: s.toLowerCase() };
};

const asStringArray = (v: unknown): string[] => {
   if (Array.isArray(v)) return v.map((x) => String(x));
   if (typeof v === 'string') return [v];
   return [];
};

// headers may arrive as an object map or as an array of {name,value}. Return lowercased keys.
const readHeader = (headers: unknown, name: string): string | null => {
   const want = name.toLowerCase();
   if (Array.isArray(headers)) {
      for (const h of headers) {
         const hn = (h?.name ?? h?.key ?? '').toString().toLowerCase();
         if (hn === want) return (h?.value ?? '').toString();
      }
      return null;
   }
   if (headers && typeof headers === 'object') {
      for (const [k, val] of Object.entries(headers as Record<string, unknown>)) {
         if (k.toLowerCase() === want) return val == null ? null : String(val);
      }
   }
   return null;
};

// Extract <id> tokens from an In-Reply-To / References header value.
const extractMessageIds = (value: string | null): string[] =>
   value ? Array.from(value.matchAll(/<[^>]+>/g), (m) => m[0]) : [];

const stripHtml = (html: string): string =>
   html
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|tr|li|h[1-6])>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

// Resend's html (and sometimes text) can arrive as a data: URI (html_format: "data_uri").
const decodeDataUri = (value: string): string => {
   if (!value.startsWith('data:')) return value;
   const comma = value.indexOf(',');
   if (comma === -1) return value;
   const meta = value.slice(5, comma);
   const data = value.slice(comma + 1);
   try {
      if (meta.includes(';base64')) {
         const bytes = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
         return new TextDecoder().decode(bytes);
      }
      return decodeURIComponent(data);
   } catch {
      return value;
   }
};

// Resend's email.received webhook carries only the envelope (data.email_id, from, to, subject);
// the body and headers have to be fetched from the Receiving API. Merge them into the payload so
// parseInbound sees one complete message. No-op for other providers or a payload that already has
// a body.
const hydrateFromResend = async (payload: Record<string, unknown>): Promise<Record<string, unknown>> => {
   const data = payload.data && typeof payload.data === 'object' ? (payload.data as Record<string, unknown>) : null;
   const emailId = typeof data?.email_id === 'string' ? data.email_id : null;
   if (!data || !emailId || typeof data.text === 'string' || typeof data.html === 'string') return payload;

   const apiKey = Deno.env.get('RESEND_API_KEY');
   if (!apiKey) {
      console.error('[email-inbound] RESEND_API_KEY not set — cannot fetch the body of', emailId);
      return payload;
   }
   try {
      const res = await fetch(`https://api.resend.com/emails/receiving/${encodeURIComponent(emailId)}`, {
         headers: { Authorization: `Bearer ${apiKey}` }
      });
      if (!res.ok) {
         console.error('[email-inbound] Resend fetch failed', res.status, (await res.text()).slice(0, 300));
         return payload;
      }
      const full = (await res.json()) as Record<string, unknown>;
      return {
         ...payload,
         data: {
            ...data,
            from: full.from ?? data.from,
            to: full.to ?? data.to,
            subject: full.subject ?? data.subject,
            text: typeof full.text === 'string' ? decodeDataUri(full.text) : undefined,
            html: typeof full.html === 'string' ? decodeDataUri(full.html) : undefined,
            headers: full.headers ?? data.headers,
            message_id: full.message_id ?? data.message_id
         }
      };
   } catch (err) {
      console.error('[email-inbound] Resend fetch error', err);
      return payload;
   }
};

const parseInbound = (payload: Record<string, unknown>): InboundEmail | null => {
   // Resend wraps the message in { type, data: {...} }; a bare forward posts the fields directly.
   const d = (payload.data && typeof payload.data === 'object' ? payload.data : payload) as Record<string, unknown>;

   const fromRaw = asStringArray(d.from)[0] ?? '';
   const { name: fromName, email: fromEmail } = parseAddress(fromRaw);
   if (!fromEmail || !fromEmail.includes('@')) return null;

   const toList = asStringArray(d.to).map((t) => parseAddress(t).email);
   const subject = (typeof d.subject === 'string' ? d.subject : '').trim() || '(no subject)';

   const text = typeof d.text === 'string' ? d.text : '';
   const html = typeof d.html === 'string' ? d.html : '';
   const body = (text.trim() || (html ? stripHtml(html) : '')).trim();

   const headers = d.headers;
   const messageId = readHeader(headers, 'message-id') ?? (typeof d.message_id === 'string' ? d.message_id : null);
   const inReplyTo = extractMessageIds(readHeader(headers, 'in-reply-to'))[0] ?? null;
   const references = extractMessageIds(readHeader(headers, 'references'));

   const automated = isAutomatedEmail(fromEmail, subject, (name) => readHeader(headers, name));

   return { fromEmail, fromName, toList, subject, body, messageId, inReplyTo, references, automated };
};

// reply+<uuid>@… in any recipient address -> the reply token.
const findReplyToken = (toList: string[]): string | null => {
   for (const addr of toList) {
      const m = addr.match(/(?:reply|support)\+([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})@/i);
      if (m) return m[1].toLowerCase();
   }
   return null;
};

type Conversation = { id: string; token: string; discord_thread_id: string | null; reply_token: string; status: string };

serve(async (req) => {
   if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
   if (req.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405);

   const secret = Deno.env.get('EMAIL_INBOUND_SECRET')?.trim();
   if (!secret) {
      console.error('[email-inbound] EMAIL_INBOUND_SECRET not set — refusing to accept unauthenticated mail');
      return jsonResponse({ error: 'not_configured' }, 500);
   }
   const provided = new URL(req.url).searchParams.get('secret') ?? req.headers.get('x-inbound-secret') ?? '';
   if (!timingSafeEqual(provided, secret)) {
      return jsonResponse({ error: 'unauthorized' }, 401);
   }

   let payload: Record<string, unknown>;
   try {
      payload = await req.json();
   } catch {
      return jsonResponse({ error: 'invalid_json' }, 400);
   }

   // Resend only sends the envelope; fetch the body before parsing.
   payload = await hydrateFromResend(payload);

   const email = parseInbound(payload);
   if (!email) return jsonResponse({ error: 'unparseable_email' }, 400);
   if (email.automated) {
      console.log('[email-inbound] ignored automated mail from', email.fromEmail);
      return jsonResponse({ ok: true, ignored: 'automated' });
   }

   const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');

   // --- Idempotency: a retried webhook for the same Message-ID must not create a second
   // ticket / Discord post. Claim the id first; a unique violation means it was already handled.
   // Any other error (e.g. table not migrated yet) fails open so mail is never dropped.
   let claimedMessageId: string | null = null;
   if (email.messageId) {
      const { error: claimErr } = await supabase.from('email_inbound_processed').insert({ message_id: email.messageId });
      if (claimErr?.code === '23505') {
         console.log('[email-inbound] duplicate delivery ignored for', email.messageId);
         return jsonResponse({ ok: true, ignored: 'duplicate' });
      }
      if (claimErr) console.error('[email-inbound] could not record message id:', claimErr.message);
      else claimedMessageId = email.messageId;
   }
   // Release the claim when we fail before doing anything visible, so the provider's retry can succeed.
   const releaseClaim = async () => {
      if (claimedMessageId) await supabase.from('email_inbound_processed').delete().eq('message_id', claimedMessageId);
   };

   // --- Resolve the conversation this email belongs to -------------------------------------
   // 1) reply+<token>@ address (most reliable), 2) In-Reply-To / References message-ids.
   let conversation: Conversation | null = null;

   const replyToken = findReplyToken(email.toList);
   if (replyToken) {
      const { data } = await supabase
         .from('widget_conversations')
         .select('id, token, discord_thread_id, reply_token, status')
         .eq('reply_token', replyToken)
         .maybeSingle();
      conversation = (data as Conversation | null) ?? null;
   }

   if (!conversation) {
      const refIds = [email.inReplyTo, ...email.references].filter((x): x is string => !!x);
      if (refIds.length > 0) {
         const { data } = await supabase
            .from('widget_conversations')
            .select('id, token, discord_thread_id, reply_token, status, visitor_email')
            .in('email_last_message_id', refIds)
            .order('last_message_at', { ascending: false })
            .limit(1)
            .maybeSingle();
         // Message-ids are not secret (they travel in every quoted reply), so a header-only match
         // must come from the ticket's own visitor; anyone else opens a new ticket.
         const match = data as (Conversation & { visitor_email: string | null }) | null;
         if (match && (match.visitor_email ?? '').trim().toLowerCase() === email.fromEmail.trim().toLowerCase()) {
            conversation = match;
         }
      }
   }

   // What lands in the ticket: subject first, then the body. The sender isn't verified, so say so.
   const ticketText = `📧 ${email.subject}\n\n${email.body || '(empty email)'}`;
   const postEmail = async (conv: Conversation) => {
      if (await postToTicket(conv, ticketText)) return;
      await alertTeam(
         supabase,
         `📧 An email to support@ from ${email.fromName ? `${email.fromName} <${email.fromEmail}>` : email.fromEmail} couldn't reach the Discord support ticket:\n"${email.subject}"\n> ${email.body.slice(0, 400)}`
      );
   };

   // --- New ticket ------------------------------------------------------------------------
   if (!conversation) {
      const { data: inserted, error: insertErr } = await supabase
         .from('widget_conversations')
         .insert({
            channel: 'email',
            visitor_email: email.fromEmail,
            visitor_name: email.fromName,
            email_subject: email.subject,
            email_last_message_id: email.messageId,
            status: 'open',
            bot_context: 'Email to support@ · sender NOT verified: confirm identity before any account change · replies are emailed to them',
            last_message_at: new Date().toISOString()
         })
         .select('id, token, discord_thread_id, reply_token, status')
         .single();

      if (insertErr || !inserted) {
         console.error('[email-inbound] failed to create conversation:', insertErr?.message);
         await releaseClaim();
         return jsonResponse({ error: 'db_insert_failed' }, 500);
      }

      await postEmail(inserted as Conversation);

      return jsonResponse({
         ok: true,
         conversation_id: inserted.id,
         created: true,
         reply_to: `reply+${inserted.reply_token}@${REPLY_SUBDOMAIN}`
      });
   }

   // --- Reply on an existing ticket (the widget API reopens it and re-alerts if it was resolved) ---
   await supabase.from('widget_conversations').update({ email_last_message_id: email.messageId }).eq('id', conversation.id);
   await postEmail(conversation);

   return jsonResponse({
      ok: true,
      conversation_id: conversation.id,
      created: false,
      reply_to: `reply+${conversation.reply_token}@${REPLY_SUBDOMAIN}`
   });
});
