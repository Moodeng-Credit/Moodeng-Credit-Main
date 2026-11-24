import { useQuery } from '@tanstack/react-query';

import { getSupabaseBrowserClient } from '@/lib/supabase/client';

/**
 * Vault direct repay (supabase/migrations/20261124150000_vault_direct_repay.sql): Instant Wallet
 * repays of BitRepo-vault loans go straight into the vault. Admins switch
 * telegram_bot_settings.vault_direct_repay off | all | user ids (test).
 *
 * Fails to off: the repay then goes to the lending wallet as before, which always works.
 */
export const fetchVaultDirectRepay = async (): Promise<boolean> => {
   const { data, error } = await getSupabaseBrowserClient().rpc('get_vault_direct_repay');
   return !error && data === true;
};

export function useVaultDirectRepay(): boolean {
   const { data } = useQuery({ queryKey: ['vault-direct-repay'], queryFn: fetchVaultDirectRepay, staleTime: 60_000 });
   return data === true;
}
