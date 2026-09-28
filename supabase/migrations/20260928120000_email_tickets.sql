-- Email-as-ticket support.
--
-- Inbound email to support@moodeng.app is mirrored into the same widget_conversations
-- ticket model the live chat already uses (a row + a Discord #web-support thread). These
-- columns let a conversation carry an email identity and be threaded across replies.
--
-- Written by the email-inbound edge function (this repo). The outbound half — relaying a
-- team member's Discord reply back out as an email — lives in the widget backend repo and
-- reads reply_token / email_last_message_id from here to address and thread the reply.

-- 'chat' (in-app widget, existing behaviour) or 'email' (mirrored inbound email).
alter table public.widget_conversations
   add column if not exists channel text not null default 'chat';

-- Stable per-conversation token used to build the outbound Reply-To address
-- (reply+<reply_token>@reply.moodeng.app). A customer's reply carries the token back so we
-- re-attach it to this exact conversation instead of opening a new ticket. Backfilled for
-- existing rows too — harmless, and lets any conversation be email-threaded later.
alter table public.widget_conversations
   add column if not exists reply_token uuid not null default gen_random_uuid();

-- Subject line of the email thread (kept off status/UI; used for the Discord thread name
-- and for human context).
alter table public.widget_conversations
   add column if not exists email_subject text;

-- Message-ID of the most recent inbound email on this conversation. Lets a reply that only
-- carries In-Reply-To / References (no reply-token address) still be matched to its thread.
alter table public.widget_conversations
   add column if not exists email_last_message_id text;

-- One conversation per reply token (the Reply-To routing key must be unambiguous).
create unique index if not exists widget_conversations_reply_token_key
   on public.widget_conversations (reply_token);

-- Reply-matching by email Message-ID.
create index if not exists widget_conversations_email_last_message_id_idx
   on public.widget_conversations (email_last_message_id)
   where email_last_message_id is not null;

-- Look up an open email ticket for a sender (fallback threading + de-dupe).
create index if not exists widget_conversations_email_lookup_idx
   on public.widget_conversations (channel, visitor_email)
   where channel = 'email';
