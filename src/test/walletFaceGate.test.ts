import { describe, expect, it } from 'vitest';

import {
   hasEmbeddedWallet,
   isRetryableGateCode,
   needsWalletFaceScan,
   WALLET_GATE_CODE,
   WalletGateError,
   walletFaceStatusCopy
} from '@/lib/web3/openfort/walletFaceGate';
import type { User } from '@/types/authTypes';

const user = (overrides: Partial<User> = {}) => overrides as User;

describe('walletFaceGate', () => {
   describe('hasEmbeddedWallet', () => {
      it('recognizes an account locked to an Openfort smart account', () => {
         expect(hasEmbeddedWallet(user({ walletProvider: 'openfort', walletAddress: '0xabc' }))).toBe(true);
      });

      it('does not count a Base Account or a provider with no address', () => {
         expect(hasEmbeddedWallet(user({ walletProvider: 'base_wallet', walletAddress: '0xabc' }))).toBe(false);
         expect(hasEmbeddedWallet(user({ walletProvider: 'openfort' }))).toBe(false);
         expect(hasEmbeddedWallet(null)).toBe(false);
      });
   });

   describe('needsWalletFaceScan', () => {
      it('requires a scan for a first-time creation', () => {
         expect(needsWalletFaceScan(user({}))).toBe(true);
         expect(needsWalletFaceScan(user({ walletProvider: 'base_wallet', walletAddress: '0xabc' }))).toBe(true);
      });

      it('skips the scan when a live approval is on file', () => {
         expect(needsWalletFaceScan(user({ walletFaceStatus: 'APPROVED' }))).toBe(false);
      });

      // The important one: recovery runs on every page reload and before every send. Gating
      // it would lock existing holders out of their own money.
      it('never gates recovery of an existing embedded wallet', () => {
         const holder = user({ walletProvider: 'openfort', walletAddress: '0xabc', walletFaceStatus: 'CONSUMED' });
         expect(needsWalletFaceScan(holder)).toBe(false);
      });

      it('re-gates once an approval has been spent and no wallet exists', () => {
         expect(needsWalletFaceScan(user({ walletFaceStatus: 'CONSUMED' }))).toBe(true);
      });

      it('gates a refused scan', () => {
         expect(needsWalletFaceScan(user({ walletFaceStatus: 'DUPLICATE' }))).toBe(true);
         expect(needsWalletFaceScan(user({ walletFaceStatus: 'MISMATCH' }))).toBe(true);
         expect(needsWalletFaceScan(user({ walletFaceStatus: 'PENDING' }))).toBe(true);
      });
   });

   describe('isRetryableGateCode', () => {
      it('lets a poor capture be retried', () => {
         expect(isRetryableGateCode(WALLET_GATE_CODE.FACE_DECLINED)).toBe(true);
         expect(isRetryableGateCode(WALLET_GATE_CODE.FACE_REQUIRED)).toBe(true);
      });

      // Retrying these only burns another Didit session — the answer cannot change.
      it('treats an identity collision as terminal', () => {
         expect(isRetryableGateCode(WALLET_GATE_CODE.FACE_DUPLICATE)).toBe(false);
         expect(isRetryableGateCode(WALLET_GATE_CODE.FACE_MISMATCH)).toBe(false);
         expect(isRetryableGateCode(undefined)).toBe(false);
      });
   });

   describe('walletFaceStatusCopy', () => {
      it('offers a retry only where one can help', () => {
         expect(walletFaceStatusCopy('DECLINED').canRetry).toBe(true);
         expect(walletFaceStatusCopy('DUPLICATE').canRetry).toBe(false);
         expect(walletFaceStatusCopy('MISMATCH').canRetry).toBe(false);
      });

      it('explains a duplicate without accusing the user', () => {
         const copy = walletFaceStatusCopy('DUPLICATE');
         expect(copy.title).toMatch(/already has a wallet/i);
         expect(copy.body).toMatch(/one Moodeng instant wallet/i);
      });
   });

   describe('WalletGateError', () => {
      it('carries the server code so callers can route on it', () => {
         const err = new WalletGateError('nope', WALLET_GATE_CODE.FACE_DUPLICATE);
         expect(err).toBeInstanceOf(Error);
         expect(err.code).toBe('FACE_DUPLICATE');
         expect(err.name).toBe('WalletGateError');
      });
   });
});
