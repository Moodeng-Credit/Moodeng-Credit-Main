import { useQuery } from '@tanstack/react-query';

import { getSupabaseBrowserClient } from '@/lib/supabase/client';

/**
 * Wallet last (supabase/migrations/20261117220000_wallet_last.sql): borrowers make their Instant
 * Wallet as the last step of the loan request (after the ID check), not at sign-up — fewer Openfort
 * wallets. Admins switch telegram_bot_settings.wallet_last on | off.
 *
 * Fails to "off" (wallet first, as before): someone who skipped the wallet is still sent to set it
 * up by the request board's usual "no wallet" path, so nobody gets stuck either way.
 */
export const fetchWalletLast = async (): Promise<boolean> => {
   const { data, error } = await getSupabaseBrowserClient().rpc('get_wallet_last');
   return !error && data === true;
};

export function useWalletLast(): { walletLast: boolean; isLoading: boolean } {
   const { data, isLoading } = useQuery({ queryKey: ['wallet-last'], queryFn: fetchWalletLast, staleTime: 60_000 });
   return { walletLast: data === true, isLoading };
}
