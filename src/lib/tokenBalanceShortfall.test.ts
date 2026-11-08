import { describe, expect, it } from 'vitest';

import { isTokenBalanceShortfall } from '@/lib/tokenBalanceShortfall';

// The exact reason Openfort's bundler returned for the failed $17 repayment on 2026-11-08.
const OPENFORT_SIMULATION_REVERT =
   'Transaction creation failed.\n\nDetails: UserOperation reverted during simulation with reason: 0x08c379a0000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000' +
   '2645524332303a207472616e7366657220616d6f756e7420657863656564732062616c616e63650000000000000000000000000000000000000000000000000000';

describe('isTokenBalanceShortfall', () => {
   it('recognises the hex-encoded revert from a simulated userOp', () => {
      expect(isTokenBalanceShortfall(new Error(OPENFORT_SIMULATION_REVERT))).toBe(true);
   });

   it('finds it deeper in the cause chain', () => {
      const inner = new Error(OPENFORT_SIMULATION_REVERT);
      const outer = new Error('The contract function "transfer" reverted.', {
         cause: new Error('Transaction creation failed.', { cause: inner })
      });
      expect(isTokenBalanceShortfall(outer)).toBe(true);
   });

   it('recognises the plain-text revert reason', () => {
      expect(isTokenBalanceShortfall(new Error('execution reverted: ERC20: transfer amount exceeds balance'))).toBe(true);
   });

   it('ignores unrelated failures', () => {
      expect(isTokenBalanceShortfall(new Error('Signer is not configured'))).toBe(false);
      expect(isTokenBalanceShortfall(new Error('UserOperation reverted during simulation with reason: 0x'))).toBe(false);
      expect(isTokenBalanceShortfall(null)).toBe(false);
   });
});
