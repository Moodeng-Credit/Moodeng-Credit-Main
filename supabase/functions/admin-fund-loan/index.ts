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
    if (dueDate) updates.due_date = dueDate

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
      const { data: existing } = await supabase.from('loans').select('hash').eq('id', loanId).maybeSingle()
      const existingHashes: string[] = Array.isArray(existing?.hash) ? existing!.hash : []
      updates.hash = [...existingHashes, txHash]
    }

    const { data, error } = await supabase
      .from('loans')
      .update(updates)
      .eq('id', loanId)
      .select()
      .single()

    if (error) return json({ error: 'Failed to record funding', details: error.message }, 500)

    // #loans / admin channel "Loan funded" post, same as a lender funding it (once per loan).
    await postLoanFundedToTeam(supabase, loanId)

    return json({ data, message: 'Loan funding recorded' }, 200)
  } catch (error) {
    return json({ error: 'Internal server error', details: (error as Error).message }, 500)
  }
})
