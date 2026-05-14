import { describe, expect, it } from 'vitest';

import {
   areWalletAddressesEqual,
   getBaseAccountConnector,
   getBaseWalletLockStatus,
   getWalletProviderLabel,
   getWalletProviderFromConnectorName,
   isBaseWalletProvider,
   isConnectedToLockedBaseWallet
} from '@/lib/walletProvider';

describe('walletProvider', () => {
   it('normalizes the borrower Base wallet connector', () => {
      expect(getWalletProviderFromConnectorName('Base Account')).toBe('base_wallet');
      expect(isBaseWalletProvider('base_wallet')).toBe(true);
   });

   it('detects non-Base wallet connectors', () => {
      expect(getWalletProviderFromConnectorName('MetaMask')).toBe('metamask');
      expect(getWalletProviderFromConnectorName('WalletConnect')).toBe('walletconnect');
      expect(getWalletProviderFromConnectorName('Coinbase Wallet')).toBe('unknown');
      expect(isBaseWalletProvider('metamask')).toBe(false);
   });

   it('shows friendly labels from stored wallet provider metadata', () => {
      expect(getWalletProviderLabel({ provider: 'base_wallet' })).toBe('Base Account');
      expect(getWalletProviderLabel({ provider: 'metamask' })).toBe('MetaMask');
      expect(getWalletProviderLabel({ connectorName: 'Coinbase Wallet' })).toBe('Coinbase Wallet');
   });

   it('can show Base Account for borrower rows that predate wallet metadata', () => {
      expect(getWalletProviderLabel({ assumeBaseAccount: true })).toBe('Base Account');
   });

   it('does not treat missing or unknown wallet providers as Base', () => {
      expect(getWalletProviderFromConnectorName(undefined)).toBe('unknown');
      expect(getWalletProviderFromConnectorName('Injected')).toBe('unknown');
      expect(isBaseWalletProvider(undefined)).toBe(false);
      expect(isBaseWalletProvider(null)).toBe(false);
      expect(isBaseWalletProvider('unknown')).toBe(false);
   });

   it('uses stored Base wallet metadata as the lock source of truth', () => {
      expect(
         getBaseWalletLockStatus({
            walletAddress: '0xC1022456DFd3BF36af1dA553cd5631F9e76ca8D6',
            walletProvider: 'base_wallet'
         })
      ).toMatchObject({
         address: '0xc1022456dfd3bf36af1da553cd5631f9e76ca8d6',
         hasStoredWallet: true,
         isConfirmedBase: true,
         needsConfirmation: false
      });
   });

   it('does not treat a saved non-Base wallet as confirmed', () => {
      expect(
         getBaseWalletLockStatus({
            walletAddress: '0xC1022456DFd3BF36af1dA553cd5631F9e76ca8D6',
            walletProvider: 'metamask'
         })
      ).toMatchObject({
         hasStoredWallet: true,
         isConfirmedBase: false,
         needsConfirmation: true
      });
   });

   it('does not trust old Coinbase Wallet connector rows as confirmed Base Account rows', () => {
      expect(
         getBaseWalletLockStatus({
            walletAddress: '0xC1022456DFd3BF36af1dA553cd5631F9e76ca8D6',
            walletConnectorName: 'Coinbase Wallet',
            walletProvider: 'base_wallet'
         })
      ).toMatchObject({
         hasStoredWallet: true,
         isConfirmedBase: false,
         needsConfirmation: true
      });
   });

   it('requires the connected Base Account address to match the locked address', () => {
      expect(
         isConnectedToLockedBaseWallet({
            connectedAddress: '0xC1022456DFd3BF36af1dA553cd5631F9e76ca8D6',
            connectorName: 'Base Account',
            lockedAddress: '0xc1022456dfd3bf36af1da553cd5631f9e76ca8d6'
         })
      ).toBe(true);
      expect(
         isConnectedToLockedBaseWallet({
            connectedAddress: '0x0000000000000000000000000000000000000000',
            connectorName: 'Base Account',
            lockedAddress: '0xc1022456dfd3bf36af1da553cd5631f9e76ca8d6'
         })
      ).toBe(false);
      expect(
         isConnectedToLockedBaseWallet({
            connectedAddress: '0xC1022456DFd3BF36af1dA553cd5631F9e76ca8D6',
            connectorName: 'MetaMask',
            lockedAddress: '0xc1022456dfd3bf36af1da553cd5631f9e76ca8d6'
         })
      ).toBe(false);
   });

   it('finds the Base Account connector across RainbowKit naming variants', () => {
      expect(
         getBaseAccountConnector([
            { id: 'metaMask', name: 'MetaMask' },
            { id: 'baseAccount', name: 'Base Account' }
         ])
      ).toMatchObject({
         id: 'baseAccount'
      });
      expect(getBaseAccountConnector([{ id: 'coinbaseWallet', name: 'Coinbase Wallet' }])).toBeUndefined();
   });

   it('compares wallet addresses case-insensitively', () => {
      expect(areWalletAddressesEqual('0xABCDEF', '0xabcdef')).toBe(true);
      expect(areWalletAddressesEqual('0xABCDEF', '0x123456')).toBe(false);
   });
});
