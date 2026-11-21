-- Proof of income: decide from the Telegram card.
--
-- A result that waits for the team now carries ✅ Approve / ❌ Reject buttons in the KYC group
-- (supabase/functions/_shared/incomeDocCards.ts). telegram-webhook saves the tap through this
-- function: same effect as decide_income_document() in the admin panel — the decision lands on the
-- row and kyc-cross-check tells the borrower (push, Messenger, Telegram) — but called with the
-- service role, with the tapper's Telegram name as decided_by.
--
-- Unlike the admin panel it never overwrites: a document that already has a decision (admin panel,
-- another tap, or approved automatically) is left alone and the card shows who decided it. The row
-- lock makes two people tapping at once decide it — and message the borrower — only once.
create or replace function public.decide_income_document_from_card(p_id uuid, p_decision text, p_by text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  doc record;
begin
  if p_decision not in ('approved', 'declined') then raise exception 'approved or declined'; end if;

  select d.decision, d.decided_by into doc from public.income_documents d where d.id = p_id for update;
  if not found then return jsonb_build_object('state', 'not_found'); end if;
  if doc.decision is not null then
    return jsonb_build_object('state', 'already', 'decision', doc.decision, 'by', doc.decided_by);
  end if;

  update public.income_documents
  set decision = p_decision,
      decision_reason = null,
      decided_at = now(),
      decided_by = coalesce(nullif(left(trim(p_by), 80), ''), 'Telegram'),
      notified_at = null
  where id = p_id;

  perform net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'SUPABASE_PROJECT_URL' limit 1)
      || '/functions/v1/kyc-cross-check',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Admin-Token', (select decrypted_secret from vault.decrypted_secrets where name = 'ADMIN_API_TOKEN' limit 1)
    ),
    body := jsonb_build_object('income_decision', p_id),
    timeout_milliseconds := 30000
  );
  return jsonb_build_object('state', 'decided');
end;
$$;

revoke all on function public.decide_income_document_from_card(uuid, text, text) from public, anon, authenticated;
grant execute on function public.decide_income_document_from_card(uuid, text, text) to service_role;
