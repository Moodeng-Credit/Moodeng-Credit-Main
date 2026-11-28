-- Call brief: the AI's "say this back to them" summary for the host before an onboarding call
-- (admin-call-approvals action 'brief'). One per borrower, replaced when the host asks for a fresh one.
-- Team only: written and read by the edge function with the service role; no policies on purpose.
create table if not exists public.call_briefs (
  user_id uuid primary key references public.users (id) on delete cascade,
  brief jsonb not null,
  model text,
  created_at timestamptz not null default now()
);

alter table public.call_briefs enable row level security;
revoke all on public.call_briefs from anon, authenticated;
