// Reads the BitRepo vault's live state for the vault watch (see vaultWatch.ts). Kept apart from the pure
// check so vitest never has to resolve the npm: import.
import { VAULT_ADDRESS, VAULT_OPERATOR, type VaultSnapshot } from './vaultWatch.ts';

// deno-lint-ignore no-explicit-any
type SupabaseLike = { from: (table: string) => any };

const VAULT_ABI = [
   'function principal() view returns (uint256)',
   'function cover() view returns (uint256)',
   'function getAvailableToDraw() view returns (uint256)',
   'function paused() view returns (bool)',
   'function OPERATOR_ROLE() view returns (bytes32)',
   'function hasRole(bytes32 role, address account) view returns (bool)',
   'function getLoan(string loanId) view returns (uint256 loanPrincipal, uint256 interest, uint256 dueDate, bool pastDue, uint256 totalDueLeft)'
] as const;

export async function readVaultSnapshot(supabase: SupabaseLike, rpcUrl: string): Promise<VaultSnapshot> {
   const { createPublicClient, http, parseAbi } = await import('npm:viem@2');
   const { base } = await import('npm:viem@2/chains');
   const client = createPublicClient({ chain: base, transport: http(rpcUrl) });
   const abi = parseAbi(VAULT_ABI);
   const address = VAULT_ADDRESS as `0x${string}`;
   // deno-lint-ignore no-explicit-any
   const read = (functionName: string, args: unknown[] = []) =>
      client.readContract({ address, abi, functionName, args } as any) as Promise<any>;

   const { data: rows, error } = await supabase.from('loans').select('id').not('vault_address', 'is', null);
   if (error) throw new Error(`loans: ${error.message}`);
   const loanIds: string[] = (rows ?? []).map((r: { id: string }) => r.id);

   const [principal, cover, available, paused, role] = await Promise.all([
      read('principal'),
      read('cover'),
      read('getAvailableToDraw'),
      read('paused'),
      read('OPERATOR_ROLE')
   ]);
   const [operatorCanDraw, ...loans] = await Promise.all([
      read('hasRole', [role, VAULT_OPERATOR]),
      ...loanIds.map((id) => read('getLoan', [id]))
   ]);
   const units = (v: bigint) => Number(v) / 1e6;
   const recordedPrincipal = loans.reduce((sum: number, l: readonly [bigint, ...unknown[]]) => sum + units(l[0]), 0);

   return {
      principalOut: units(principal),
      cover: units(cover),
      available: units(available),
      paused: Boolean(paused),
      operatorCanDraw: Boolean(operatorCanDraw),
      recordedPrincipal,
      recordedLoans: loanIds.length
   };
}
