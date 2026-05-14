import { describe, expect, it } from 'vitest';

import { getWalletProviderFromConnectorName, isBaseWalletProvider } from '@/lib/walletProvider';

describe('walletProvider', () => {
   it('normalizes the borrower Base wallet connector', () => {
      expect(getWalletProviderFromConnectorName('Coinbase Wallet')).toBe('base_wallet');
      expect(isBaseWalletProvider('base_wallet')).toBe(true);
   });

   it('detects non-Base wallet connectors', () => {
      expect(getWalletProviderFromConnectorName('MetaMask')).toBe('metamask');
      expect(getWalletProviderFromConnectorName('WalletConnect')).toBe('walletconnect');
      expect(isBaseWalletProvider('metamask')).toBe(false);
   });

   it('does not treat missing or unknown wallet providers as Base', () => {
      expect(getWalletProviderFromConnectorName(undefined)).toBe('unknown');
      expect(getWalletProviderFromConnectorName('Injected')).toBe('unknown');
      expect(isBaseWalletProvider(undefined)).toBe(false);
      expect(isBaseWalletProvider(null)).toBe(false);
      expect(isBaseWalletProvider('unknown')).toBe(false);
   });
});
