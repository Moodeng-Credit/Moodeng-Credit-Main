import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

import { postLoanFundedToTeam } from '../_shared/teamLoanFeed.ts'

// Records a loan funded by a Moodeng admin (direct transfer OR smart-contract /
// LoanManager). SECURITY: this route is the real boundary — it independently verifies
// the caller is an active owner/admin in admin_users before recording anything.
// Frontend hiding of the funding modal is convenience only.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status,
  })

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // --- Verify caller is an admin account ---
    const token = (req.headers.get('Authorization') ?? '').replace('Bearer ', '').trim()
    if (!token) return json({ error: 'Missing authorization token' }, 401)

    const { data: userData, error: userError } = await supabase.auth.getUser(token)
    const callerId = userData?.user?.id
    if (userError || !callerId) return json({ error: 'Invalid session' }, 401)
    // Same gate as the other admin-* functions (admin_users), not a hard-coded email list. Funding
    // moves money, so owners and admins only, not support.
    const { data: adminRow } = await supabase
      .from('admin_users')
      .select('user_id')
      .eq('user_id', callerId)
      .eq('active', true)
      .in('role', ['owner', 'admin'])
      .maybeSingle()
    if (!adminRow) return json({ error: 'Forbidden: admin account required' }, 403)

    const body = await req.json()
    const {
      loanId, // existing loans.id to update (loan request being funded)
      fundingMethod, // 'direct' | 'smart_contract'
      txHash,
      borrowerWallet,
      principal, // USDC, major units (string|number)
      totalOwed,
      dueDate, // ISO string
      onchainLoanId,
      onchainRequestId,
      listingPrice, // salePrice (defaults to principal on the client)
      listingTxHash, // hash of listLoanNote (distinct from the mint/fund tx in hash[])
    } = body ?? {}

    if (!loanId) return json({ error: 'Missing loanId' }, 400)
    if (fundingMethod !== 'direct' && fundingMethod !== 'smart_contract') {
      return json({ error: 'Invalid fundingMethod' }, 400)
    }

    // Only an open request can be funded. A retry of the same recording (same tx hash) is a no-op
    // success, so the modal's silent retry after a lost response doesn't report a failure.
    const { data: current, error: currentError } = await supabase
      .from('loans')
      .select('loan_status, lender_user_id, funded_at, hash')
      .eq('id', loanId)
      .maybeSingle()
    if (currentError) return json({ error: 'Failed to load loan', details: currentError.message }, 500)
    if (!current) return json({ error: 'Loan not found' }, 404)
    if (current.loan_status !== 'Requested' || current.lender_user_id || current.funded_at) {
      const existingHashes: string[] = Array.isArray(current.hash) ? current.hash : []
      if (txHash && current.loan_status === 'Lent' && existingHashes.includes(txHash)) {
        return json({ message: 'Loan funding already recorded' }, 200)
      }
      return json({ error: 'This loan is not an open request (already funded or closed)' }, 409)
    }

    const isSmart = fundingMethod === 'smart_contract'

    const updates: Record<string, unknown> = {
      funding_method: fundingMethod,
      loan_status: 'Lent',
      funded_at: new Date().toISOString(),
      // An admin funding a request is a deliberate decision; it's no longer on hold.
      on_hold_since: null,
      on_hold_reason: null,
      updated_at: new Date().toISOString(),
    }
    if (borrowerWallet) updates.borrower_wallet = borrowerWallet
    if (principal != null) updates.loan_amount = Number(principal)
    if (totalOwed != null) updates.total_repayment_amount = Number(totalOwed)
    // Stored as midnight UTC on the due day, like every other loan (see src/lib/loanDeadline.ts);
    // the client sends `${date}T23:59:59Z`, which would push the deadline a day late.
    if (dueDate) {
      const day = String(dueDate).slice(0, 10)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return json({ error: 'Invalid dueDate' }, 400)
      updates.due_date = `${day}T00:00:00.000Z`
    }

    if (isSmart) {
      updates.onchain_loan_id = onchainLoanId ? String(onchainLoanId) : null
      updates.onchain_request_id = onchainRequestId ?? null
      // Moodeng (the originator) holds the Loan Note until a lender buys it.
      // Null = Moodeng-held; set to the lender wallet at purchase time.
      updates.loan_note_owner_wallet = null
      // Liquidity Relay: default the listing/sale price to PRINCIPAL (not totalOwed) so the
      // lender refills exactly what Moodeng fronted; their upside is totalOwed - principal.
      updates.listing_price = listingPrice != null ? Number(listingPrice) : Number(principal ?? 0)
      if (listingTxHash) updates.listing_tx_hash = listingTxHash
      updates.is_sellable = true
    } else {
      // Direct/manual funding never produces a sellable Loan Note.
      updates.is_sellable = false
    }

    // Append tx hash to the loan's hash[] array.
    if (txHash) {
      const existingHashes: string[] = Array.isArray(current.hash) ? current.hash : []
      updates.hash = [...existingHashes, txHash]
    }

    // Conditional on the request still being open, so a lender funding it at the same moment can't
    // be overwritten.
    const { data, error } = await supabase
      .from('loans')
      .update(updates)
      .eq('id', loanId)
      .eq('loan_status', 'Requested')
      .is('lender_user_id', null)
      .select()
      .maybeSingle()

    if (error) return json({ error: 'Failed to record funding', details: error.message }, 500)
    if (!data) return json({ error: 'This loan was funded by someone else a moment ago' }, 409)

    // #loans / admin channel "Loan funded" post, same as a lender funding it (once per loan).
    await postLoanFundedToTeam(supabase, loanId)
    // Tell the borrower, same as a lender funding it (deduped per loan inside the function).
    const { error: notifyError } = await supabase.functions.invoke('loan-funded-notification', { body: { loanId } })
    if (notifyError) console.error(`admin-fund-loan: borrower notification failed for ${loanId}: ${notifyError.message}`)

    return json({ data, message: 'Loan funding recorded' }, 200)
  } catch (error) {
    return json({ error: 'Internal server error', details: (error as Error).message }, 500)
  }
})
