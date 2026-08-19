import { describe, expect, it } from 'vitest';

import { traceFundFlow, type UsdcTransfer } from '../../supabase/functions/_shared/fundFlowTrace';

// Addresses modeled on the 2026-08-15 incident (MoodengCreditFraudInvestigation.pdf).
const VINCENT = '0xb08e2d00000000000000000000000000000000cc3d';
const BRANDON = '0xe5d8a900000000000000000000000000000000005516'.slice(0, 42);
const LINKDROP = '0x1111111111111111111111111111111111111111';
const COINS_PH = '0x1792240eb745b7dbc638744e5191004a2361bb37';
const PERSONAL = '0x2222222222222222222222222222222222222222';

const USDC15 = 15_000000n; // 15 USDC at 6 decimals

describe('traceFundFlow — incident replay', () => {
   it('lands on the Coins.ph deposit and ignores the net-zero Linkdrop reversal', () => {
      const transfers: UsdcTransfer[] = [
         // 1. Brandon (lender) funds Vincent — inbound, not part of the outbound trace.
         { from: BRANDON, to: VINCENT, hash: '0x725b', value: USDC15, timestamp: '2026-08-15T12:24:51Z' },
         // 2. Vincent -> Linkdrop escrow (created)…
         { from: VINCENT, to: LINKDROP, hash: '0x3281', value: USDC15, timestamp: '2026-08-15T12:43:15Z' },
         // 3. …reversed ~2 min later back to Vincent (net zero).
         { from: LINKDROP, to: VINCENT, hash: '0xaf7e', value: USDC15, timestamp: '2026-08-15T12:45:01Z' },
         // 4. Vincent -> Coins.ph deposit — the real destination.
         { from: VINCENT, to: COINS_PH, hash: '0x494a', value: USDC15, timestamp: '2026-08-15T12:46:17Z' }
      ];

      const terminals = traceFundFlow({ rootWallet: VINCENT, transfers, internalAddresses: new Set() });

      expect(terminals).toHaveLength(1);
      expect(terminals[0].address).toBe(COINS_PH);
      expect(terminals[0].hopCount).toBe(1);
      expect(terminals[0].amountOut).toBe(USDC15);
      expect(terminals[0].txHashes).toEqual(['0x494a']);
      // The Linkdrop escrow must never surface as a destination.
      expect(terminals.some((t) => t.address === LINKDROP)).toBe(false);
   });

   it('walks THROUGH an internal intermediary wallet to the external off-ramp', () => {
      const transfers: UsdcTransfer[] = [
         { from: VINCENT, to: PERSONAL, hash: '0xaaa', value: USDC15, timestamp: '2026-08-15T13:00:00Z' },
         { from: PERSONAL, to: COINS_PH, hash: '0xbbb', value: USDC15, timestamp: '2026-08-15T13:05:00Z' }
      ];

      const terminals = traceFundFlow({
         rootWallet: VINCENT,
         transfers,
         internalAddresses: new Set([PERSONAL]),
         maxHops: 3
      });

      expect(terminals).toHaveLength(1);
      expect(terminals[0].address).toBe(COINS_PH);
      expect(terminals[0].hopCount).toBe(2);
   });

   it('returns no terminal when funds only bounce back to the borrower', () => {
      const transfers: UsdcTransfer[] = [
         { from: VINCENT, to: LINKDROP, hash: '0x1', value: USDC15, timestamp: '2026-08-15T12:43:15Z' },
         { from: LINKDROP, to: VINCENT, hash: '0x2', value: USDC15, timestamp: '2026-08-15T12:45:01Z' }
      ];
      const terminals = traceFundFlow({ rootWallet: VINCENT, transfers, internalAddresses: new Set() });
      expect(terminals).toHaveLength(0);
   });
});
