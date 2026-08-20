import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Returns recent USDC-on-Base transfers in/out of a wallet, for the account page's
// "Recent activity" section. Proxies Alchemy server-side so the Alchemy key never ships
// in the public frontend bundle (VITE_* vars are readable by anyone who loads the site).
//
// SECURITY: requires an authenticated user. We don't restrict which address can be
// queried — USDC transfers on Base are public on-chain data — auth just keeps this from
// being an open, unauthenticated proxy that burns the shared Alchemy quota.

const corsHeaders = {
   'Access-Control-Allow-Origin': '*',
   'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
   'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const json = (body: unknown, status = 200) =>
   new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/;
const BASE_USDC_ADDRESS = (Deno.env.get('BASE_USDC_ADDRESS') || '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913').toLowerCase();
// This project stores the Alchemy key under the frontend name VITE_ALCHEMY_ID; fall back to it.
const ALCHEMY_ID = Deno.env.get('ALCHEMY_ID') ?? Deno.env.get('VITE_ALCHEMY_ID') ?? '';
const ALCHEMY_URL = ALCHEMY_ID ? `https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_ID}` : '';
const MAX_TRANSFER_ROWS = 8;

type AlchemyTransfer = {
   hash?: string;
   value?: number | null;
   metadata?: { blockTimestamp?: string };
};

type TransferRow = { direction: 'in' | 'out'; amount: number; timestamp: string; hash: string };

async function fetchTransfers(address: string, direction: 'in' | 'out'): Promise<TransferRow[]> {
   const res = await fetch(ALCHEMY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
         id: 1,
         jsonrpc: '2.0',
         method: 'alchemy_getAssetTransfers',
         params: [
            {
               fromBlock: '0x0',
               toBlock: 'latest',
               [direction === 'in' ? 'toAddress' : 'fromAddress']: address,
               contractAddresses: [BASE_USDC_ADDRESS],
               category: ['erc20'],
               withMetadata: true,
               order: 'desc',
               maxCount: `0x${MAX_TRANSFER_ROWS.toString(16)}`
            }
         ]
      })
   });

   if (!res.ok) throw new Error(`Alchemy request failed (${res.status})`);
   const body = await res.json();
   if (body?.error) throw new Error(body.error.message || 'Alchemy request failed');
   const transfers = (body?.result?.transfers ?? []) as AlchemyTransfer[];

   return transfers
      .filter((t) => typeof t.hash === 'string' && typeof t.value === 'number' && t.value > 0)
      .map((t) => ({
         direction,
         amount: t.value as number,
         timestamp: t.metadata?.blockTimestamp ?? '',
         hash: t.hash as string
      }));
}

serve(async (req) => {
   if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
   if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

   try {
      if (!ALCHEMY_ID) return json({ error: 'Wallet activity is not configured' }, 503);

      const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
      const token = (req.headers.get('Authorization') ?? '').replace('Bearer ', '').trim();
      if (!token) return json({ error: 'Missing authorization token' }, 401);

      const { data: userData, error: userError } = await supabase.auth.getUser(token);
      if (userError || !userData?.user?.id) return json({ error: 'Authentication required' }, 401);

      const body = await req.json().catch(() => ({}));
      const address = String(body?.address ?? '').trim();
      if (!ADDRESS_PATTERN.test(address)) return json({ error: 'Invalid wallet address' }, 400);

      const normalized = address.toLowerCase();
      const [incoming, outgoing] = await Promise.all([fetchTransfers(normalized, 'in'), fetchTransfers(normalized, 'out')]);

      return json({ transfers: [...incoming, ...outgoing] });
   } catch (err) {
      console.error('[wallet-usdc-transfers] error', err);
      return json({ error: err instanceof Error ? err.message : 'Wallet activity request failed' }, 500);
   }
});
