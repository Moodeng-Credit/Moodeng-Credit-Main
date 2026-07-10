import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

// Records a lender's purchase of a Loan Note from Moodeng (after the on-chain
// buyLoanNote tx is confirmed) and awards off-chain IOU points.
//
// SECURITY: requires an authenticated user (the buyer). The purchase row is unique per
// loan, and award_points() is idempotent, so retries never double-credit points.
//
// ON-CHAIN VERIFICATION: when LOAN_MANAGER_ADDRESS is set (real mode), the recording is
// only accepted after proving on-chain that (a) the reported tx/userOp succeeded, (b) it
// was sent by the claimed buyer wallet, and (c) ownerOf(tokenId) on the LoanManager is
// that wallet — so a forged request can't mark a loan sold, steal lender status, or mint
// IOU points without actually paying. When LOAN_MANAGER_ADDRESS is unset (mock mode,
// nothing on-chain exists) verification is skipped. Price and tokenId are read from the
// loans row, never from the client.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// IOU points are stored in minor units at scale 6 (matches shared/points + award_points).
const LENDER_POINTS_PER_USDC = 1n

// Same RPC setup as confirm-loan-payment: Alchemy when the secret is set, public fallback.
const ALCHEMY_ID = Deno.env.get('ALCHEMY_ID') ?? ''
const RPC_URL = ALCHEMY_ID ? `https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_ID}` : 'https://mainnet.base.org'
// Same public bundler endpoint @base-org/account's own getPaymentStatus() calls — no secret needed.
const BUNDLER_URL = 'https://api.developer.coinbase.com/rpc/v1/base/S-fOd2n2Oi4fl4e1Crm83XeDXZ7tkg8O'
// Real mode switch: the deployed LoanManager address (see contracts/DEPLOYMENTS.md). Unset = mock.
const LOAN_MANAGER_ADDRESS = (Deno.env.get('LOAN_MANAGER_ADDRESS') ?? '').trim().toLowerCase()

const OWNER_OF_SELECTOR = '0x6352211e' // ownerOf(uint256)

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status,
  })

// price (USDC, major units) -> points delta in minor units, truncated to 6 dp.
const computePointsDelta = (price: number): bigint => {
  if (!Number.isFinite(price) || price <= 0) return 0n
  const minorUnits = BigInt(Math.round(price * 1_000_000))
  return minorUnits * LENDER_POINTS_PER_USDC
}

const rpcCall = async (url: string, method: string, params: unknown[]) => {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  })
  const body = await res.json()
  if (body.error) throw new Error(body.error.message || 'RPC error')
  return body.result
}

// Resolves either a normal tx hash or a Base Account userOp hash to { success, sender }.
// Returns null when the hash isn't found/confirmed yet (caller responds retryable 409).
const resolveReceipt = async (hash: string): Promise<{ success: boolean; sender: string } | null> => {
  const receipt = await rpcCall(RPC_URL, 'eth_getTransactionReceipt', [hash]).catch(() => null)
  if (receipt) {
    return { success: receipt.status === '0x1', sender: (receipt.from ?? '').toLowerCase() }
  }
  const userOp = await rpcCall(BUNDLER_URL, 'eth_getUserOperationReceipt', [hash]).catch(() => null)
  if (userOp) {
    return { success: Boolean(userOp.success), sender: (userOp.sender ?? '').toLowerCase() }
  }
  return null
}

// Reads ownerOf(tokenId) from the LoanManager. Throws on RPC failure (verification is
// fail-closed: no proof, no recording).
const ownerOfToken = async (tokenId: string): Promise<string> => {
  const tokenHex = BigInt(tokenId).toString(16).padStart(64, '0')
  const result = await rpcCall(RPC_URL, 'eth_call', [
    { to: LOAN_MANAGER_ADDRESS, data: `${OWNER_OF_SELECTOR}${tokenHex}` },
    'latest',
  ])
  if (typeof result !== 'string' || result.length < 42) throw new Error('ownerOf returned no owner')
  return `0x${result.slice(-40)}`.toLowerCase()
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const token = (req.headers.get('Authorization') ?? '').replace('Bearer ', '').trim()
    if (!token) return json({ error: 'Missing authorization token' }, 401)

    const { data: userData, error: userError } = await supabase.auth.getUser(token)
    const buyer = userData?.user
    if (userError || !buyer?.id) return json({ error: 'Authentication required' }, 401)

    const body = await req.json()
    const { loanId, txHash, buyerWallet } = body ?? {}

    if (!loanId || !buyerWallet) {
      return json({ error: 'Missing required fields: loanId, buyerWallet' }, 400)
    }

    // Confirm the loan exists and is a sellable smart-contract loan. Price and tokenId come
    // from this row — the client's values are never trusted.
    const { data: loan, error: loanError } = await supabase
      .from('loans')
      .select('id, is_sellable, funding_method, tracking_id, listing_price, loan_amount, onchain_loan_id')
      .eq('id', loanId)
      .maybeSingle()

    if (loanError || !loan) return json({ error: 'Loan not found' }, 404)
    if (loan.funding_method !== 'smart_contract' || !loan.is_sellable) {
      return json({ error: 'This loan is not available for purchase' }, 409)
    }

    const priceNumber = Number(loan.listing_price ?? loan.loan_amount ?? 0)
    const normalizedBuyerWallet = String(buyerWallet).trim().toLowerCase()

    // --- On-chain verification (real mode only) ---
    if (LOAN_MANAGER_ADDRESS) {
      if (!txHash) return json({ error: 'Missing txHash' }, 400)
      if (!loan.onchain_loan_id) return json({ error: 'Loan has no on-chain Loan Note' }, 409)

      const receipt = await resolveReceipt(String(txHash))
      if (!receipt) return json({ error: 'Purchase transaction is not confirmed on-chain yet' }, 409)
      if (!receipt.success) return json({ error: 'Purchase transaction failed on-chain' }, 400)
      if (receipt.sender !== normalizedBuyerWallet) {
        return json({ error: 'Transaction sender does not match the buyer wallet' }, 403)
      }

      const owner = await ownerOfToken(String(loan.onchain_loan_id))
      if (owner !== normalizedBuyerWallet) {
        return json({ error: 'Buyer wallet does not own this Loan Note on-chain' }, 403)
      }
    }

    // Record the purchase (unique per loan; conflict => already recorded).
    const { data: purchase, error: insertError } = await supabase
      .from('loan_note_purchases')
      .insert({
        loan_id: loanId,
        onchain_loan_id: loan.onchain_loan_id ? String(loan.onchain_loan_id) : null,
        buyer_user_id: buyer.id,
        buyer_wallet: buyerWallet,
        price: priceNumber,
        tx_hash: txHash ?? null,
        iou_points_awarded: 0,
      })
      .select()
      .single()

    if (insertError) {
      // Unique violation => purchase already recorded; treat as idempotent success.
      if (insertError.code === '23505') {
        return json({ message: 'Purchase already recorded', alreadyRecorded: true }, 200)
      }
      return json({ error: 'Failed to record purchase', details: insertError.message }, 500)
    }

    // Transfer Loan Note ownership + assign lender on the loan record.
    await supabase
      .from('loans')
      .update({
        loan_note_owner_wallet: buyerWallet,
        lender_user_id: buyer.id,
        lender_wallet: buyerWallet,
        is_sellable: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', loanId)

    // Award IOU points (idempotent via award_points unique index).
    const delta = computePointsDelta(priceNumber)
    let pointsTotal = 0
    if (delta > 0n) {
      const { data: pointsResult } = await supabase.rpc('award_points', {
        user_id_input: buyer.id,
        source_type_input: 'loan_note_purchase',
        source_id_input: loanId,
        event_type_input: 'loan_note_purchase',
        delta_input: delta.toString(),
        metadata_input: { tracking_id: loan.tracking_id, price: priceNumber },
      })
      const row = Array.isArray(pointsResult) ? pointsResult[0] : pointsResult
      pointsTotal = Number(row?.points_total ?? 0)

      await supabase
        .from('loan_note_purchases')
        .update({ iou_points_awarded: delta.toString() })
        .eq('id', purchase.id)
    }

    return json(
      {
        data: purchase,
        iouPointsAwarded: delta.toString(),
        pointsTotal,
        message: 'Loan Note purchase recorded',
      },
      201
    )
  } catch (error) {
    return json({ error: 'Internal server error', details: (error as Error).message }, 500)
  }
})
