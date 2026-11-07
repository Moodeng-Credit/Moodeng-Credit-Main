import { useQuery } from '@tanstack/react-query';

import { getSupabaseBrowserClient } from '@/lib/supabase/client';

export const USD_IDR_PEG_QUERY_KEY = 'usd-idr-peg-rate';

export type UsdIdrPeg = { rate: number | null; fetchedAt: string | null };

/** Parses get_usd_idr_rate() — { rate, fetchedAt }, both null when the server has no fresh rate. */
export const parseUsdIdrPeg = (raw: unknown): UsdIdrPeg => {
   const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
   const rate = Number(r.rate);
   return {
      rate: r.rate != null && Number.isFinite(rate) && rate > 0 ? rate : null,
      fetchedAt: typeof r.fetchedAt === 'string' ? r.fetchedAt : null
   };
};

export const fetchUsdIdrPeg = async (): Promise<UsdIdrPeg> => {
   const { data, error } = await getSupabaseBrowserClient().rpc('get_usd_idr_rate');
   if (error) return { rate: null, fetchedAt: null };
   return parseUsdIdrPeg(data);
};

/**
 * The USD/IDR rate the SERVER prices Indonesian loans with (public.fx_rates, the rupiah peg —
 * supabase/migrations/20261107160000_indonesia_idr_peg.sql). Not the display-only rate in
 * relayWalt: a request priced with this matches what the loans insert trigger computes.
 * `rate` is null while loading or when the server has no fresh rate (then ID requests can't be sent).
 */
export function useUsdIdrPeg(enabled = true) {
   const query = useQuery({
      queryKey: [USD_IDR_PEG_QUERY_KEY],
      queryFn: fetchUsdIdrPeg,
      enabled,
      staleTime: 5 * 60_000,
      refetchInterval: enabled ? 10 * 60_000 : false
   });
   return {
      rate: query.data?.rate ?? null,
      fetchedAt: query.data?.fetchedAt ?? null,
      isLoading: enabled && query.isLoading
   };
}
