# Handoff: reset borrower `abigaildepocrypto-5f2668` so her first loan doesn't count

**Status: planned, not applied yet.** Nothing has been changed in the database.

## What the founder asked for

Her first loan had a problem and the team paid it for her. Her current outstanding loan is really her
first loan. So reset her: she can't claim the GrabFood voucher now, and the app should show it as
not claimable until she repays the current loan.

- Production Supabase project: `qplmmxynzxzkfxtayoqr`
- User id: `5f266893-85db-4970-9832-cb6f192f7d7e`

**Ops: do NOT buy or send either ₱50 GrabFood voucher from the Telegram alerts.**

## What's in the database now (read on 2026-09-30)

**Loans**

| Loan | Amount | Status | Notes |
|---|---|---|---|
| `9bd00e19-16c9-49e0-a86a-ba35b2a176f9` (the problem loan) | $15, repay $18 | `Paid`, `refunded_at` null | Funded and "repaid" on 2026-09-10 (lender `2371a419…`). The team paid it. |
| `e59071df-1315-4174-bf4c-cc7c91672f83` (current) | $17, repay $20 | `Unpaid` | Due 2026-10-10. Different lender `41099df3…`. |

**Voucher claims.** There are two, both `pending`:
- `255fedd8-c4fc-4e31-b923-9b0d55bf1440`: `tier_rising`, ₱50 (this is the Telegram alert).
- `7ccfedef-bed6-4c44-b73c-20084cededdf`: `first_on_time_repayment`, ₱50. This one also came from the first loan.

**Pandesal (`user_trust_points`) = 125.** Rising starts at 60. Where the 125 comes from:

| Event id | Milestone / type | Pandesal | Keep? |
|---|---|---|---|
| 137 | first-loan-request | 10 | keep |
| 138 | verify-identity | 10 | keep |
| 139 | first-funded-loan | 15 | keep (the current loan is funded) |
| 140 | first-on-time-repayment | 20 | **remove** (loan 1) |
| 141 | full-limit-credit-builder | 30 | **remove** (loan 1) |
| 142 | two-unique-lenders | 30 | **remove** (only counts because of loan 1's lender) |
| 206 | on_time_repayment for loan 1 | 10 | **remove** |

After the reset she has **35 pandesal**, which is Rookie.

**Avatar rings** (`user_rewards`): `silver-avatar-ring` needs 50 and `gold-avatar-ring` needs 120. Both came
from the inflated total, so remove them. `sync_user_rewards` grants them again automatically once she
earns the points.

## Why deleting the claims alone doesn't work

Voucher eligibility is worked out live in `public.get_my_rewards()` and `public.submit_voucher_claim()`:
- `first_on_time_repayment` is claimable when `app_private.has_on_time_repayment(user)` is true.
- `tier_rising` is claimable when `app_private.pandesal_total(user) >= 60`.

`private.sync_completed_trust_milestones` runs on every loan update and on some `users` updates (the
`is_world_id` and `cs` columns). It checks `private.is_trust_milestone_complete`, and that function
**does not skip refunded or test loans**, even though every other rule does: `has_on_time_repayment`,
`is_loan_fully_repaid`, and the frontend's `!refundedAt` filters. The 20260915 migration comment even
claims that milestones skip refunded loans. So if we only deleted her milestone rows, they would come
straight back from loan 1.

## The fix

1. Mark loan 1 with **`refunded_at`**. That's the app's existing flag for "the platform paid the lender;
   this isn't a borrower repayment". Credit progression, tiers and vouchers already skip it.
   - Also set `offplatform_settled_at`. It only changes what the lender sees: loan 1 shows as REPAID
     instead of REFUNDED, which is true because the lender was paid in full.
   - Do **not** use the admin RefundSection flow. That flow bans and KYC-blacklists the borrower.
2. Change `private.is_trust_milestone_complete` to skip refunded and test loans. This matches the
   documented intent. It only stops *future* completions for everyone and doesn't remove any
   existing ones.
3. Delete her 3 loan-1 milestone completions and their 4 point events, then set her total to what's left
   (35). The events must be deleted, not offset with negative entries. The unique key
   `(user, source_type, source_id, event_type)` would otherwise block them from being re-awarded when she
   repays the current loan.
4. Reject both pending voucher claims with an admin note. A rejected claim doesn't stop a new claim later.
5. Remove the two avatar rings.

**When she repays the current $17 loan on time**, she gets first-on-time-repayment (+20) and the
on-time repayment bonus (+10), for a total of 65. That makes her Rising again, and both ₱50 vouchers become
claimable automatically. That's the behaviour you asked for.

### SQL (run as ONE transaction, in this order)

```sql
begin;

-- 1. Milestone checker: skip refunded and test loans (same rule as has_on_time_repayment)
create or replace function private.is_trust_milestone_complete(user_id_input uuid, milestone_id_input text)
returns boolean language plpgsql security definer set search_path to '' as $function$
declare
  on_time_paid_count integer := 0; funded_count integer := 0; unique_lender_count integer := 0;
  total_repaid numeric := 0; has_unresolved_default boolean := false; credit_limit integer := 0; is_verified boolean := false;
begin
  select coalesce(u.cs, 0), coalesce(u.is_world_id::text = 'ACTIVE' or u.is_didit::text = 'ACTIVE', false)
  into credit_limit, is_verified from public.users as u where u.id = user_id_input;

  select count(*)::integer into funded_count from public.loans as l
  where l.borrower_user_id = user_id_input and l.loan_status = 'Lent'
    and l.refunded_at is null and not coalesce(l.is_test, false);

  select count(*)::integer into on_time_paid_count from public.loans as l
  where l.borrower_user_id = user_id_input and l.repayment_status = 'Paid'
    and coalesce(l.repaid_amount, 0) >= l.total_repayment_amount and l.updated_at <= l.due_date
    and l.refunded_at is null and not coalesce(l.is_test, false);

  select count(distinct l.lender_user_id)::integer into unique_lender_count from public.loans as l
  where l.borrower_user_id = user_id_input and l.loan_status = 'Lent' and l.lender_user_id is not null
    and l.refunded_at is null and not coalesce(l.is_test, false);

  select coalesce(sum(coalesce(l.repaid_amount, 0)), 0) into total_repaid from public.loans as l
  where l.borrower_user_id = user_id_input and l.repayment_status = 'Paid'
    and l.refunded_at is null and not coalesce(l.is_test, false);

  select exists (select 1 from public.loans as l
    where l.borrower_user_id = user_id_input and l.loan_status = 'Lent'
      and coalesce(l.repayment_status::text, 'Unpaid') <> 'Paid' and l.due_date < now())
  into has_unresolved_default;

  if milestone_id_input = 'verify-identity' then return is_verified;
  elsif milestone_id_input = 'first-loan-request' then
    return exists (select 1 from public.loans as l where l.borrower_user_id = user_id_input);
  elsif milestone_id_input = 'first-funded-loan' then return funded_count >= 1;
  elsif milestone_id_input = 'first-on-time-repayment' then return on_time_paid_count >= 1;
  elsif milestone_id_input = 'two-on-time-streak' then return on_time_paid_count >= 2;
  elsif milestone_id_input = 'full-limit-credit-builder' then
    return exists (select 1 from public.loans as l
      where l.borrower_user_id = user_id_input and l.repayment_status = 'Paid'
        and coalesce(l.repaid_amount, 0) >= l.total_repayment_amount and l.updated_at <= l.due_date
        and l.loan_amount in (15, 20, 40, 60, 80, 100, 120, 140)
        and l.refunded_at is null and not coalesce(l.is_test, false));
  elsif milestone_id_input = 'two-unique-lenders' then return unique_lender_count >= 2;
  elsif milestone_id_input = 'repay-100-total' then return total_repaid >= 100;
  elsif milestone_id_input = 'reach-level-three' then return is_verified and credit_limit >= 40;
  elsif milestone_id_input = 'trusted-borrower-candidate' then
    return on_time_paid_count >= 5 and unique_lender_count >= 3 and not has_unresolved_default;
  end if;
  return false;
end;
$function$;

-- 2. Loan 1: team paid it, so it's not a borrower repayment (lender still sees REPAID)
update public.loans
set refunded_at = now(),
    refund_reason = 'Team repaid this loan on the borrower''s behalf (loan had a problem). Not a borrower repayment.',
    offplatform_settled_at = now(),
    offplatform_settlement_note = 'Lender was repaid in full; the team covered it for the borrower.'
where id = '9bd00e19-16c9-49e0-a86a-ba35b2a176f9' and refunded_at is null;

-- 3. Remove the loan-1 milestones and points
delete from public.user_milestone_completions
where user_id = '5f266893-85db-4970-9832-cb6f192f7d7e'
  and milestone_id in ('first-on-time-repayment', 'full-limit-credit-builder', 'two-unique-lenders');
delete from public.trust_point_events
where user_id = '5f266893-85db-4970-9832-cb6f192f7d7e' and id in (140, 141, 142, 206);
update public.user_trust_points
set points_total = (select coalesce(sum(delta), 0) from public.trust_point_events where user_id = '5f266893-85db-4970-9832-cb6f192f7d7e'),
    last_event_id = (select max(id) from public.trust_point_events where user_id = '5f266893-85db-4970-9832-cb6f192f7d7e'),
    updated_at = now()
where user_id = '5f266893-85db-4970-9832-cb6f192f7d7e';

-- 4. Void both pending claims (a rejected claim doesn't block a new claim once she qualifies)
update public.voucher_claims
set status = 'rejected',
    admin_note = 'Voided: first loan was covered by the team, so it does not count. Claimable again after the current loan is repaid on time.'
where user_id = '5f266893-85db-4970-9832-cb6f192f7d7e' and status = 'pending'
  and reward in ('tier_rising', 'first_on_time_repayment');

-- 5. Avatar rings came from the inflated total
delete from public.user_rewards
where user_id = '5f266893-85db-4970-9832-cb6f192f7d7e' and reward_id in ('silver-avatar-ring', 'gold-avatar-ring');

-- Check that nothing grows back
select private.sync_completed_trust_milestones('5f266893-85db-4970-9832-cb6f192f7d7e');

commit;
```

### Checks after applying

```sql
select app_private.has_on_time_repayment('5f266893-85db-4970-9832-cb6f192f7d7e');  -- expect false
select app_private.pandesal_total('5f266893-85db-4970-9832-cb6f192f7d7e');         -- expect 35
select milestone_id from public.user_milestone_completions
where user_id = '5f266893-85db-4970-9832-cb6f192f7d7e';  -- expect only first-loan-request, verify-identity, first-funded-loan
select reward, status from public.voucher_claims
where user_id = '5f266893-85db-4970-9832-cb6f192f7d7e';  -- expect both rejected
```

### Follow-ups

- Add step 1 to the repo as a migration, for example
  `supabase/migrations/20260930000000_milestones_skip_refunded_loans.sql`, so the repo matches production.
- The repo's frontend already skips `refundedAt` loans (see `dashboardHelpers.ts`,
  `dashboardV2Model.ts:71`, and `loanSlice.ts`), so no UI code change is needed. Her dashboard reads
  `get_my_rewards`, so she will see Rookie and a locked voucher.
- Her credit limit `users.cs` is 20. We left it as is.
