-- Proof of income: a reject from the Telegram card now carries a reason.
--
-- ❌ Reject on the card asks "what for?" — a preset reason button or a typed one (reply to the
-- bot's prompt). The reason lands in decision_reason, which kyc-cross-check puts in the borrower's
-- message, same as a decline with a reason from the admin panel.
--
-- p_card = {"chat": <chat id>, "message": <card message id>} goes along to kyc-cross-check so it
-- can say under the card which channels actually reached the borrower.
--
-- The old 3-argument version is dropped so named calls (Discord passes p_id, p_decision, p_by)
-- resolve to this one without ambiguity.
drop function if exists public.decide_income_document_from_card(uuid, text, text);

create or replace function public.decide_income_document_from_card(
  p_id uuid,
  p_decision text,
  p_by text,
  p_reason text default null,
  p_card jsonb default null
)
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
      decision_reason = case when p_decision = 'declined' then nullif(left(trim(p_reason), 300), '') end,
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
    body := jsonb_build_object('income_decision', p_id)
      || case when p_card is not null then jsonb_build_object('income_card', p_card) else '{}'::jsonb end,
    timeout_milliseconds := 30000
  );
  return jsonb_build_object('state', 'decided');
end;
$$;

revoke all on function public.decide_income_document_from_card(uuid, text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.decide_income_document_from_card(uuid, text, text, text, jsonb) to service_role;
