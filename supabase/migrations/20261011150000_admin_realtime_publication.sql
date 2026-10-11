-- Admin panel live states: stream state changes on the tables the admin tabs show.
--
-- Realtime postgres_changes respects RLS, so each subscriber only receives rows it can SELECT.
-- Admins read these through app_private.is_moodeng_admin() / private.current_user_is_admin().
-- Non-admin reach per table (unchanged by this migration — same rows a plain SELECT returns):
--   users                       own row only
--   loans                       own loans + public listings (Requested / is_sellable), already public
--   loan_access_requests        own rows only
--   voucher_claims              own rows only
--   admin_account_restrictions  own row only
--   loan_refunds, admin_audit_logs, account_status_audit_logs   admins only

-- loan_access_requests had no admin SELECT policy (admin reads went through edge functions),
-- so admins would get no realtime events for it. Read-only, admins only.
drop policy if exists "Admins read loan access requests" on public.loan_access_requests;
create policy "Admins read loan access requests"
   on public.loan_access_requests
   for select
   to authenticated
   using (app_private.is_moodeng_admin());

do $$
declare
   t text;
begin
   foreach t in array array[
      'users',
      'loans',
      'loan_access_requests',
      'voucher_claims',
      'loan_refunds',
      'admin_account_restrictions',
      'admin_audit_logs',
      'account_status_audit_logs'
   ]
   loop
      if not exists (
         select 1 from pg_publication_tables
         where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
      ) then
         execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
   end loop;
end $$;
