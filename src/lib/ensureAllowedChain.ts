import { ALLOWED_CHAIN_ID } from '@/config/wagmiConfig';
import { WALLET_CHAIN_SWITCH_TIMEOUT_MS, withTimeout } from '@/lib/withTimeout';

type SwitchChainAsync = (args: { chainId: number }) => Promise<unknown>;

/**
 * Make sure the connected wallet is on the allowed chain (Base) before a transfer.
 *
 * Reads the raw connected `chainId`, NOT `useAccount().chain`. The wagmi config
 * registers only Base, so `account.chain` resolves to `undefined` for any wallet
 * sitting on another chain (or before the chain object hydrates right after
 * connect) — which made the old `account.chain?.id !== ALLOWED_CHAIN_ID` guard a
 * dead-end: it blocked lenders on the wrong chain with a "select a network" toast,
 * even though the app is single-chain and has no network selector to satisfy it.
 *
 * When the wallet is on a different chain we ask it to switch to Base (the same
 * approach FundBridge uses), and only report failure if the switch is rejected.
 *
 * @returns true if we're on (or successfully switched to) Base; false otherwise.
 */
export async function ensureAllowedChain(
   connectedChainId: number | undefined,
   switchChainAsync: SwitchChainAsync
): Promise<boolean> {
   if (connectedChainId === ALLOWED_CHAIN_ID) return true;
   try {
      // Time-box the switch: a wallet that isn't actually reachable on this device
      // (stale/cross-device connection) would otherwise leave this awaiting forever,
      // stranding the caller before the transfer even starts.
      await withTimeout(switchChainAsync({ chainId: ALLOWED_CHAIN_ID }), WALLET_CHAIN_SWITCH_TIMEOUT_MS);
      return true;
   } catch {
      return false;
   }
}
