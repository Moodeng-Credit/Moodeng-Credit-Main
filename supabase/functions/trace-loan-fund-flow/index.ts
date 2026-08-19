import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

import { checkCronAuth } from '../_shared/cronAuth.ts';
import { recordJobRun } from '../_shared/securityJobRuns.ts';
import { traceFundFlow, UsdcTransfer } from '../_shared/fundFlowTrace.ts';

// Follow-the-money tracer (Part A). For each recently-funded loan, ask Base (via Alchemy)
// where the borrower's USDC actually went, walk it to the external off-ramp, and record the
// terminal destination in loan_fund_flow. The convergence scan (scan_payout_convergence)
// then flags one destination fed by many borrowers — the 2026-08-15 mule pattern.
//
// Cron only. Runs behind the shared ADMIN_API_TOKEN like the other security jobs.

const JOB_NAME = 'trace-loan-fund-flow';

const corsHeaders = {
   'Access-Control-Allow-Origin': '*',
   'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
   'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const USDC_ADDRESS = (Deno.env.get('BASE_USDC_ADDRESS') || '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913').toLowerCase();
// This project stores the Alchemy key under the frontend name VITE_ALCHEMY_ID; fall back to it.
const ALCHEMY_ID = Deno.env.get('ALCHEMY_ID') ?? Deno.env.get('VITE_ALCHEMY_ID') ?? '';
const ALCHEMY_URL = ALCHEMY_ID ? `https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_ID}` : '';

const norm = (a: string | null | undefined): string => (a ?? '').trim().toLowerCase();

// One Alchemy alchemy_getAssetTransfers page. `direction` picks fromAddress (outbound) or
// toAddress (inbound — needed so the walker can see net-zero reversals back to the root).
const fetchTransfersPage = async (
   address: string,
   direction: 'from' | 'to',
   pageKey?: string
): Promise<{ transfers: UsdcTransfer[]; pageKey?: string }> => {
   const params: Record<string, unknown> = {
      fromBlock: '0x0',
      toBlock: 'latest',
      category: ['erc20'],
      contractAddresses: [USDC_ADDRESS],
      withMetadata: true,
      excludeZeroValue: true,
      maxCount: '0x3e8', // 1000
      order: 'asc'
   };
   if (direction === 'from') params.fromAddress = address;
   else params.toAddress = address;
   if (pageKey) params.pageKey = pageKey;

   const res = await fetch(ALCHEMY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'alchemy_getAssetTransfers', params: [params] })
   });
   const json = await res.json();
   const raw = (json?.result?.transfers ?? []) as Array<Record<string, unknown>>;
   const transfers: UsdcTransfer[] = raw.map((t) => {
      const rawValue = (t.rawContract as { value?: string } | undefined)?.value ?? '0x0';
      const meta = (t.metadata as { blockTimestamp?: string } | undefined)?.blockTimestamp;
      return {
         from: norm(t.from as string),
         to: norm(t.to as string),
         hash: String(t.hash ?? ''),
         value: rawValue && rawValue !== '0x' ? BigInt(rawValue) : 0n,
         timestamp: meta ?? new Date().toISOString()
      };
   });
   return { transfers, pageKey: json?.result?.pageKey as string | undefined };
};

// All pages, both directions, for one address. Capped so a hot address can't run forever.
const fetchAddressTransfers = async (address: string): Promise<UsdcTransfer[]> => {
   const all: UsdcTransfer[] = [];
   for (const direction of ['from', 'to'] as const) {
      let pageKey: string | undefined;
      let pages = 0;
      do {
         const page = await fetchTransfersPage(address, direction, pageKey);
         all.push(...page.transfers);
         pageKey = page.pageKey;
      } while (pageKey && ++pages < 5);
   }
   return all;
};

serve(async (req) => {
   if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
   if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: corsHeaders });
   }

   // Dedicated token (not the shared ADMIN_API_TOKEN) so this function's auth is isolated
   // from the other security crons. Deployed with verify_jwt=false, so this header check —
   // not the gateway — is what protects it.
   const auth = checkCronAuth(req, Deno.env.get('TRACE_CRON_TOKEN'), corsHeaders);
   if (!auth.ok) return auth.response;

   const startedAt = new Date().toISOString();
   const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');

   if (!ALCHEMY_URL) {
      await recordJobRun(supabase, JOB_NAME, { startedAt, ok: false, detail: { error: 'no-alchemy-id' } });
      return new Response(JSON.stringify({ ok: false, skipped: 'no-alchemy-id' }), { status: 200, headers: corsHeaders });
   }

   const body = await req.json().catch(() => ({}));
   const lookbackDays = typeof body.lookbackDays === 'number' ? body.lookbackDays : 7;
   const maxHops = typeof body.maxHops === 'number' ? body.maxHops : 3;
   const maxLoans = typeof body.maxLoans === 'number' ? body.maxLoans : 50;

   try {
      // Loans funded in the window that we haven't traced in the last 6h.
      const since = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000).toISOString();
      const { data: loans, error: loansErr } = await supabase
         .from('loans')
         .select('id, tracking_id, borrower_user_id, borrower_wallet, funded_at, loan_amount')
         .eq('loan_status', 'Lent')
         .gte('funded_at', since)
         .not('borrower_wallet', 'is', null)
         .order('funded_at', { ascending: false })
         .limit(maxLoans);
      if (loansErr) throw loansErr;

      // Our own wallets — the walker passes THROUGH these to find the external off-ramp.
      const { data: walletRows } = await supabase.from('wallet_usage_log').select('wallet_address');
      const internal = new Set<string>((walletRows ?? []).map((w) => norm(w.wallet_address as string)).filter(Boolean));

      // Exchange deposit addresses we can label.
      const { data: exch } = await supabase.from('known_exchange_addresses').select('address, label');
      const exchangeMap = new Map<string, string>((exch ?? []).map((e) => [norm(e.address as string), e.label as string]));

      let traced = 0;
      let terminalsFound = 0;
      for (const loan of loans ?? []) {
         const root = norm(loan.borrower_wallet as string);
         if (!root) continue;

         // Fetch the root's transfers, then expand through any internal intermediary wallets.
         const collected: UsdcTransfer[] = [];
         const fetched = new Set<string>();
         let frontier = [root];
         for (let hop = 0; hop < maxHops && frontier.length; hop++) {
            const nextFrontier: string[] = [];
            for (const addr of frontier) {
               if (fetched.has(addr)) continue;
               fetched.add(addr);
               const transfers = await fetchAddressTransfers(addr);
               collected.push(...transfers);
               // Only expand internal destinations (our own wallets) — never crawl an exchange.
               for (const t of transfers) {
                  const dest = norm(t.to);
                  if (dest && dest !== root && internal.has(dest) && !fetched.has(dest)) nextFrontier.push(dest);
               }
            }
            frontier = nextFrontier;
         }

         const terminals = traceFundFlow({ rootWallet: root, transfers: collected, internalAddresses: internal, maxHops });
         traced++;
         if (!terminals.length) continue;

         const rows = terminals.map((term) => ({
            loan_id: loan.id,
            borrower_user_id: loan.borrower_user_id,
            borrower_wallet: root,
            terminal_destination: term.address,
            destination_label: exchangeMap.get(term.address) ?? null,
            is_exchange_deposit: exchangeMap.has(term.address),
            hop_count: term.hopCount,
            tx_hashes: term.txHashes,
            amount_out: term.amountOut.toString(),
            funded_at: loan.funded_at,
            first_out_at: term.firstOutAt,
            scanned_at: new Date().toISOString()
         }));
         terminalsFound += rows.length;
         const { error: upErr } = await supabase.from('loan_fund_flow').upsert(rows, { onConflict: 'loan_id,terminal_destination' });
         if (upErr) console.error('[trace-loan-fund-flow] upsert failed for loan', loan.id, upErr.message);
      }

      await recordJobRun(supabase, JOB_NAME, {
         startedAt,
         ok: true,
         signalCount: terminalsFound,
         detail: { loansConsidered: (loans ?? []).length, traced, terminalsFound }
      });
      return new Response(JSON.stringify({ ok: true, traced, terminalsFound }), { status: 200, headers: corsHeaders });
   } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await recordJobRun(supabase, JOB_NAME, { startedAt, ok: false, detail: { error: message } });
      return new Response(JSON.stringify({ ok: false, error: message }), { status: 500, headers: corsHeaders });
   }
});
