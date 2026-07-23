// Openfort embedded-wallet configuration — read once from Vite env.
//
// This whole module is the PH-borrower escape hatch: an Openfort embedded smart
// wallet a borrower can create from their existing Moodeng login, with no wallet
// app and no trip to keys.coinbase.com (which PLDT/Smart DNS-hijack — see
// src/lib/coinbaseReachability.ts). It is deliberately ADDITIVE and lives entirely
// outside the wagmi/RainbowKit/Base-Account stack so it can never regress it.
//
// Openfort's paymaster + bundler run on api.openfort.io, not keys.coinbase.com, so
// this rail is immune to the same ISP block that breaks Base Account.

import { ALLOWED_CHAIN_ID, getAllowedChainTokenConfig } from '@/config/wagmiConfig';

/** Publishable, client-safe. Identifies the Openfort project (pk_test_… / pk_live_…). */
export const OPENFORT_PUBLISHABLE_KEY = import.meta.env.VITE_OPENFORT_PUBLISHABLE_KEY?.trim() || '';

/** Shield publishable key — client-safe half of the non-custodial key-management pair. */
export const OPENFORT_SHIELD_PUBLISHABLE_KEY = import.meta.env.VITE_OPENFORT_SHIELD_PUBLISHABLE_KEY?.trim() || '';

/**
 * Gas-sponsorship policy id (ply_…). Passed to the embedded provider as
 * `feeSponsorship`, so every userOp — including the first outbound send that also
 * deploys the smart account — is gasless for the borrower. Without it the borrower
 * would need ETH they don't have, so an unset policy id disables the rail.
 */
export const OPENFORT_POLICY_ID = import.meta.env.VITE_OPENFORT_POLICY_ID?.trim() || '';

/**
 * Chain the embedded wallet operates on. Defaults to the app's single allowed chain
 * (Base) so it always matches the USDC address and the lender/borrower counterparties.
 */
export const OPENFORT_CHAIN_ID = Number(import.meta.env.VITE_OPENFORT_CHAIN_ID) || ALLOWED_CHAIN_ID;

/**
 * Endpoint that mints a Shield encryption session for AUTOMATIC recovery. It must run
 * server-side (it holds the Shield secret), so it's a Supabase edge function. Overridable
 * for local/preview; otherwise derived from the configured Supabase URL.
 */
export const OPENFORT_SHIELD_SESSION_URL =
   import.meta.env.VITE_OPENFORT_SHIELD_SESSION_URL?.trim() ||
   (import.meta.env.VITE_SUPABASE_URL ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/openfort-shield-session` : '');

/** Circle's canonical USDC deployment on Base Sepolia — only used when the rail is pointed at testnet. */
const BASE_SEPOLIA_USDC = '0x036CbD53842c5426634e7929541eC2318f3dCF7e' as const;

/**
 * The USDC contract this rail sends. Follows OPENFORT_CHAIN_ID: on the app's allowed
 * chain (Base) it reads the same token config the wagmi path uses; on Base Sepolia
 * (test-mode Openfort keys only support testnets) it uses Circle's Sepolia USDC so
 * smoke tests hit a real contract instead of the mainnet address on the wrong chain.
 */
export const getOpenfortUsdcAddress = (): `0x${string}` | null => {
   if (OPENFORT_CHAIN_ID === 84532) return BASE_SEPOLIA_USDC;
   const tokenConfig = getAllowedChainTokenConfig() as Record<string, string> | null;
   const address = tokenConfig?.USDC;
   return address ? (address as `0x${string}`) : null;
};

/**
 * Whether the Openfort rail is fully wired. Everything that surfaces it (the connect
 * option, the send path) is gated on this, so a project with no Openfort env vars
 * behaves exactly as it does today — the escape hatch simply doesn't appear.
 */
export const isOpenfortConfigured = (): boolean =>
   Boolean(OPENFORT_PUBLISHABLE_KEY && OPENFORT_SHIELD_PUBLISHABLE_KEY && OPENFORT_POLICY_ID && OPENFORT_SHIELD_SESSION_URL);

/** The stored `wallet_provider` value that marks a borrower locked to an Openfort smart account. */
export const OPENFORT_WALLET_PROVIDER = 'openfort' as const;

/** Human-facing connector name stored alongside the locked address and shown in wallet UI. */
export const OPENFORT_CONNECTOR_NAME = 'Openfort';
