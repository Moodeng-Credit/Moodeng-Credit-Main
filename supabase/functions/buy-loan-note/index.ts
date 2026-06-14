import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

// Records a lender's purchase of a Loan Note from Moodeng (after the on-chain
// buyLoanNote tx is confirmed) and awards off-chain IOU points.
//
// SECURITY: requires an authenticated user (the buyer). The purchase row is unique per
// loan, and award_points() is idempotent, so retries never double-credit points.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// IOU points are stored in minor units at scale 6 (matches shared/points + award_points).
const POINTS_SCALE = 10n ** 6n
const LENDER_POINTS_PER_USDC = 1n

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
    const { loanId, txHash, buyerWallet, onchainLoanId, price } = body ?? {}

    if (!loanId || !buyerWallet || price == null) {
      return json({ error: 'Missing required fields: loanId, buyerWallet, price' }, 400)
    }

    // Confirm the loan exists and is a sellable smart-contract loan.
    const { data: loan, error: loanError } = await supabase
      .from('loans')
      .select('id, is_sellable, funding_method, tracking_id')
      .eq('id', loanId)
      .maybeSingle()

    if (loanError || !loan) return json({ error: 'Loan not found' }, 404)
    if (loan.funding_method !== 'smart_contract' || !loan.is_sellable) {
      return json({ error: 'This loan is not available for purchase' }, 409)
    }

    const priceNumber = Number(price)

    // Record the purchase (unique per loan; conflict => already recorded).
    const { data: purchase, error: insertError } = await supabase
      .from('loan_note_purchases')
      .insert({
        loan_id: loanId,
        onchain_loan_id: onchainLoanId ? String(onchainLoanId) : null,
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
