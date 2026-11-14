import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

import { postLoanFundedToTeam } from '../_shared/teamLoanFeed.ts'
import { checkNow, markSent, payNow, payoutStatus, recordByTxid, releasePayout } from '../_shared/idManualFunding.ts'
import { createPayoutWallet, payoutWalletStatus } from '../_shared/idPayoutWallet.ts'
import { recordVaultDraw, vaultBridgeStatus, vaultDrawQuote } from '../_shared/idVaultBridge.ts'
import { decodeUsdcTransfers, RPC_URL, rpcCall } from '../_shared/usdcTransfer.ts'

// BitRepo originator vault on Base (OriginatorVault). Moodeng's lending wallet draws loans from it straight to
// the borrower; this route checks the draw on-chain before recording it.
const BITREPO_VAULT_ADDRESS = (Deno.env.get('BITREPO_VAULT_ADDRESS') || '0x1a59968e6B5E1c458B2Df429d2c111ed21E01443').toLowerCase()

// The draw tx must have succeeded and moved exactly `amountBase` USDC from the vault to the borrower.
async function verifyVaultDraw(txHash: string, borrowerWallet: string, amountBase: bigint): Promise<string | null> {
  if (!/^0x[0-9a-fA-F]{64}$/.test(txHash)) return 'Invalid txHash'
  const receipt = await rpcCall(RPC_URL, 'eth_getTransactionReceipt', [txHash]).catch(() => null)
  if (!receipt) return 'Draw transaction not found on Base yet'
  if (receipt.status !== '0x1') return 'Draw transaction failed on-chain'
  const paid = decodeUsdcTransfers(receipt.logs).some(
    (t) => t.from === BITREPO_VAULT_ADDRESS && t.to === borrowerWallet.toLowerCase() && t.value === amountBase,
  )
  return paid ? null : 'That transaction is not a vault draw of this amount to this borrower'
}

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

declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void } | undefined

// Keeps the worker alive for work that finishes after the response has gone out.
const runAfterReply = (work: Promise<unknown>) => {
  if (typeof EdgeRuntime !== 'undefined') EdgeRuntime.waitUntil(work)
}

// The team's "Loan funded" post, then the borrower's notification, same as a lender funding it. Each
// is sent once per loan (deduped inside), and neither failing undoes the recorded funding.
// deno-lint-ignore no-explicit-any
const announceFunding = async (supabase: any, loanId: string) => {
  try {
    await postLoanFundedToTeam(supabase, loanId)
  } catch (err) {
    console.error(`admin-fund-loan: team post failed for ${loanId}: ${(err as Error).message}`)
  }
  try {
    const { error } = await supabase.functions.invoke('loan-funded-notification', { body: { loanId } })
    if (error) console.error(`admin-fund-loan: borrower notification failed for ${loanId}: ${error.message}`)
  } catch (err) {
    console.error(`admin-fund-loan: borrower notification failed for ${loanId}: ${(err as Error).message}`)
  }
}

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

    // Indonesia track: Moodeng's Openfort payout wallet on BNB Chain (_shared/idPayoutWallet.ts).
    if (body?.action === 'payout_wallet_status') return json(await payoutWalletStatus(supabase))
    if (body?.action === 'payout_wallet_create') return json(await createPayoutWallet(supabase))

    // Indonesia track: fund from the BitRepo vault on Base, bridged to BNB Chain by LI.FI (_shared/idVaultBridge.ts).
    if (typeof body?.action === 'string' && body.action.startsWith('id_vault_')) {
      const loanId = typeof body.loanId === 'string' ? body.loanId : ''
      if (!loanId) return json({ error: 'Missing loanId' }, 400)
      if (body.action === 'id_vault_quote') return json(await vaultDrawQuote(supabase, loanId))
      if (body.action === 'id_vault_draw') return json(await recordVaultDraw(supabase, loanId, String(body.txHash ?? '').trim(), callerId))
      if (body.action === 'id_vault_status') return json(await vaultBridgeStatus(supabase, loanId))
      return json({ error: 'Unknown action' }, 400)
    }

    // Indonesia track: paid by hand from Binance TH to the borrower's Walt (USDC on BNB Chain), or
    // automatically from the payout wallet (walt_payout_auto). The app confirms it on-chain itself
    // (_shared/idManualFunding.ts).
    if (typeof body?.action === 'string' && body.action.startsWith('walt_payout_')) {
      const loanId = typeof body.loanId === 'string' ? body.loanId : ''
      if (!loanId) return json({ error: 'Missing loanId' }, 400)
      if (body.action === 'walt_payout_auto') return json(await payNow(supabase, loanId, callerId))
      if (body.action === 'walt_payout_status') return json(await payoutStatus(supabase, loanId))
      if (body.action === 'walt_payout_sent') return json(await markSent(supabase, loanId, callerId))
      if (body.action === 'walt_payout_check') return json(await checkNow(supabase, loanId))
      // A stuck / failed automatic payout: BNB Chain is checked first; nothing there → paying by hand opens.
      if (body.action === 'walt_payout_release') return json(await releasePayout(supabase, loanId, callerId))
      if (body.action === 'walt_payout_txid') {
        return json(await recordByTxid(supabase, loanId, String(body.txHash ?? '').trim(), callerId))
      }
      return json({ error: 'Unknown action' }, 400)
    }

    const {
      loanId, // existing loans.id to update (loan request being funded)
      fundingMethod, // 'direct' | 'smart_contract' | 'credit_line' (BitRepo vault draw)
      txHash,
      borrowerWallet,
      principal, // USDC, major units (string|number)
      totalOwed,
      dueDate, // ISO string
      onchainLoanId,
      onchainRequestId,
      listingPrice, // salePrice (defaults to principal on the client)
      listingTxHash, // hash of listLoanNote (distinct from the mint/fund tx in hash[])
      funderWallet, // vault draws: the operator wallet, which borrowers repay and which then pays the vault
    } = body ?? {}

    if (!loanId) return json({ error: 'Missing loanId' }, 400)
    if (fundingMethod !== 'direct' && fundingMethod !== 'smart_contract' && fundingMethod !== 'credit_line') {
      return json({ error: 'Invalid fundingMethod' }, 400)
    }

    // Only an open request can be funded. A retry of the same recording (same tx hash) is a no-op
    // success, so the modal's silent retry after a lost response doesn't report a failure.
    const { data: current, error: currentError } = await supabase
      .from('loans')
      .select('loan_status, lender_user_id, funded_at, hash, market')
      .eq('id', loanId)
      .maybeSingle()
    if (currentError) return json({ error: 'Failed to load loan', details: currentError.message }, 500)
    if (!current) return json({ error: 'Loan not found' }, 404)
    // Indonesia loans are paid to the borrower's Walt (payout wallet / Binance TH, the walt_payout_*
    // actions above), never funded on Base: that would pay them twice.
    if (current.market === 'ID') {
      return json({ error: 'Indonesia loans are paid to Walt from admin (Pay to Walt card), not funded on Base' }, 409)
    }
    if (current.loan_status !== 'Requested' || current.lender_user_id || current.funded_at) {
      const existingHashes: string[] = Array.isArray(current.hash) ? current.hash : []
      if (txHash && current.loan_status === 'Lent' && existingHashes.includes(txHash)) {
        // Both follow-ups run once per loan, so this only sends what a cut-off first attempt missed.
        runAfterReply(announceFunding(supabase, loanId))
        return json({ message: 'Loan funding already recorded' }, 200)
      }
      return json({ error: 'This loan is not an open request (already funded or closed)' }, 409)
    }

    const isSmart = fundingMethod === 'smart_contract'
    const isVault = fundingMethod === 'credit_line'
    if (isVault) {
      if (!txHash || !borrowerWallet || !funderWallet || principal == null) {
        return json({ error: 'A vault draw needs txHash, borrowerWallet, funderWallet and principal' }, 400)
      }
      const amountBase = BigInt(Math.round(Number(principal) * 1e6))
      const problem = await verifyVaultDraw(String(txHash), String(borrowerWallet), amountBase)
      if (problem) return json({ error: problem }, 422)
    }

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
    if (isVault) {
      // The admin who drew is the lender of record, so the borrower's Repay pays their wallet (as with a direct
      // lend) and the BitRepo facility trigger links the loan. Admin → Credit line then pays the vault back.
      updates.lender_user_id = callerId
      updates.lender_wallet = String(funderWallet)
      updates.vault_address = BITREPO_VAULT_ADDRESS
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

    // Reply as soon as the loan is saved. The follow-ups took up to 20 seconds, and an admin whose tab
    // dropped the request in that window saw no success message and a request still on the board.
    runAfterReply(announceFunding(supabase, loanId))

    return json({ data, message: 'Loan funding recorded' }, 200)
  } catch (error) {
    return json({ error: 'Internal server error', details: (error as Error).message }, 500)
  }
})
