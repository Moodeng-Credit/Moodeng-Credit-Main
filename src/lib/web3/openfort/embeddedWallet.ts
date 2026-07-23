// The imperative operations on a borrower's Openfort embedded smart account.
//
// Everything here goes through the Openfort EIP-1193 provider, which is configured with
// `feeSponsorship` (our gas policy) so the borrower never needs ETH — the paymaster covers
// gas, including the very first send that also deploys the smart account. None of it touches
// wagmi/RainbowKit, so the Base rail is untouched.

import { AccountTypeEnum, ChainTypeEnum, type EmbeddedAccount, EmbeddedState, type Provider, RecoveryMethod } from '@openfort/openfort-js';
import { type Chain, createWalletClient, custom, erc20Abi, parseUnits } from 'viem';
import { base, baseSepolia } from 'viem/chains';

import { getOpenfortClient } from '@/lib/web3/openfort/client';
import { OPENFORT_CHAIN_ID, OPENFORT_POLICY_ID, getOpenfortUsdcAddress } from '@/lib/web3/openfort/config';
import { createShieldEncryptionSession } from '@/lib/web3/openfort/shieldSession';

// The viem chain the embedded wallet transacts on, resolved from config so test mode (Base
// Sepolia) and prod (Base mainnet) both build a correctly-chained wallet client.
const openfortChain: Chain = OPENFORT_CHAIN_ID === baseSepolia.id ? baseSepolia : base;

// Route Openfort's reads through our provisioned Alchemy endpoint when we have one — same
// non-blocked infra the wagmi transports use (src/config/wagmiConfig.tsx). Falls back to
// Openfort's managed RPC (api.openfort.io, also not ISP-blocked) when no key is set.
const ALCHEMY_ID = import.meta.env.VITE_ALCHEMY_ID ?? '';
const openfortChains: Record<number, string> | undefined =
   OPENFORT_CHAIN_ID === base.id && ALCHEMY_ID ? { [base.id]: `https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_ID}` } : undefined;

// Dedupe concurrent provisioning: both the connect tap and an on-demand send can trigger it, and
// a rapid connect-then-pay must not mint two Shield sessions or run configure() twice. Callers
// racing while one is in flight share its promise.
let provisionInFlight: Promise<EmbeddedAccount> | null = null;

/**
 * Ensure the signed-in Supabase user has a ready non-custodial smart account and return it.
 * Idempotent: `configure` recovers the user's existing account when there is one, or creates
 * it on first use. Recovery is AUTOMATIC (self-custodial, no password for the user to lose),
 * unlocked by a one-time Shield session minted server-side.
 */
export const provisionEmbeddedWallet = async (): Promise<EmbeddedAccount> => {
   if (provisionInFlight) return provisionInFlight;

   provisionInFlight = (async () => {
      const openfort = getOpenfortClient();
      const encryptionSession = await createShieldEncryptionSession();
      return openfort.embeddedWallet.configure({
         chainId: OPENFORT_CHAIN_ID,
         chainType: ChainTypeEnum.EVM,
         accountType: AccountTypeEnum.SMART_ACCOUNT,
         recoveryParams: { recoveryMethod: RecoveryMethod.AUTOMATIC, encryptionSession }
      });
   })();

   try {
      return await provisionInFlight;
   } finally {
      provisionInFlight = null;
   }
};

/**
 * Return the ready smart account, provisioning (recovering) it only if the SDK isn't already
 * in the READY state. This lets the send path work after a page reload without another connect
 * tap, and avoids minting a fresh Shield session on every send when one is already live.
 */
export const ensureEmbeddedWalletReady = async (): Promise<EmbeddedAccount> => {
   const openfort = getOpenfortClient();
   const state = await openfort.embeddedWallet.getEmbeddedState();
   if (state === EmbeddedState.READY) {
      return openfort.embeddedWallet.get();
   }
   return provisionEmbeddedWallet();
};

/** The sponsored EIP-1193 provider for the (already-configured) embedded wallet. */
export const getEmbeddedProvider = async (): Promise<Provider> => {
   const openfort = getOpenfortClient();
   return openfort.embeddedWallet.getEthereumProvider({
      feeSponsorship: OPENFORT_POLICY_ID || undefined,
      chains: openfortChains
   });
};

/**
 * Send USDC from the embedded smart account as a gasless, sponsored userOp.
 * Returns the transaction/userOp hash to store as the loan/withdrawal `hash`, matching
 * the shape the wagmi and Base Pay paths return.
 */
export const sendUsdcFromEmbeddedWallet = async ({ to, usdAmount }: { to: string; usdAmount: string }): Promise<`0x${string}`> => {
   const usdc = getOpenfortUsdcAddress();
   if (!usdc) throw new Error('USDC is not configured for the active chain.');

   const account = await ensureEmbeddedWalletReady();
   const provider = await getEmbeddedProvider();
   const walletClient = createWalletClient({
      account: account.address as `0x${string}`,
      chain: openfortChain,
      transport: custom(provider)
   });

   // USDC is 6 decimals. The provider turns this eth_sendTransaction into a sponsored
   // ERC-4337 userOp (paymaster pays gas), deploying the account on the first send.
   return walletClient.writeContract({
      address: usdc,
      abi: erc20Abi,
      functionName: 'transfer',
      args: [to as `0x${string}`, parseUnits(usdAmount, 6)]
   });
};

/**
 * Export the embedded wallet's private key so the borrower can leave Moodeng entirely
 * (import into MetaMask/Trust). This is what makes the wallet genuinely self-custodial —
 * surfaced in the wallet settings UI, never logged.
 */
export const exportEmbeddedPrivateKey = async (): Promise<string> => {
   const openfort = getOpenfortClient();
   return openfort.embeddedWallet.exportPrivateKey();
};

/** Clears the embedded signer + Openfort auth for this device (does not delete the wallet). */
export const logoutEmbeddedWallet = async (): Promise<void> => {
   const openfort = getOpenfortClient();
   await openfort.auth.logout();
};
