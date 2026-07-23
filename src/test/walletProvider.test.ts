import { describe, expect, it } from 'vitest';

import {
   areWalletAddressesEqual,
   getBaseAccountConnector,
   getBaseWalletLockStatus,
   getWalletProviderFromConnector,
   getWalletProviderFromConnectorName,
   getWalletProviderLabel,
   hasWalletAddressOnAccount,
   isBaseWalletProvider,
   isBaseWalletReadyForRepayment,
   isConfirmedBorrowerWalletProvider,
   isConnectedToLockedBaseWallet,
   isOpenfortWalletProvider
} from '@/lib/walletProvider';

describe('walletProvider', () => {
   it('normalizes the borrower Base wallet connector', () => {
      expect(getWalletProviderFromConnectorName('Base Account')).toBe('base_wallet');
      expect(getWalletProviderFromConnector({ connectorId: 'baseAccount', connectorName: 'Coinbase Wallet' })).toBe('base_wallet');
      expect(getWalletProviderFromConnector({ connectorId: 'baseAccountSDK', connectorName: 'Coinbase Wallet' })).toBe('base_wallet');
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

   it('treats any saved account wallet address as present for account-level gates', () => {
      expect(
         hasWalletAddressOnAccount({
            walletAddress: '0xC1022456DFd3BF36af1dA553cd5631F9e76ca8D6',
            walletProvider: null
         })
      ).toBe(true);
      expect(hasWalletAddressOnAccount({ walletAddress: '   ' })).toBe(false);
      expect(hasWalletAddressOnAccount(null)).toBe(false);
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
            connectorId: 'baseAccount',
            connectorName: 'Coinbase Wallet',
            lockedAddress: '0xc1022456dfd3bf36af1da553cd5631f9e76ca8d6'
         })
      ).toBe(true);
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

   it('allows repayment when a matching Base Account is connected even if stored provider metadata is stale', () => {
      expect(
         isBaseWalletReadyForRepayment({
            connectedAddress: '0xC1022456DFd3BF36af1dA553cd5631F9e76ca8D6',
            connectorId: 'baseAccount',
            connectorName: 'Coinbase Wallet',
            wallet: {
               walletAddress: '0xc1022456dfd3bf36af1da553cd5631f9e76ca8d6',
               walletProvider: null
            }
         })
      ).toBe(true);
      expect(
         isBaseWalletReadyForRepayment({
            connectedAddress: '0xC1022456DFd3BF36af1dA553cd5631F9e76ca8D6',
            connectorName: 'Base Account',
            wallet: {
               walletAddress: '0xc1022456dfd3bf36af1da553cd5631f9e76ca8d6',
               walletProvider: null
            }
         })
      ).toBe(true);
   });

   it('does not allow repayment when the connected wallet matches but is not Base Account', () => {
      expect(
         isBaseWalletReadyForRepayment({
            connectedAddress: '0xC1022456DFd3BF36af1dA553cd5631F9e76ca8D6',
            connectorName: 'MetaMask',
            wallet: {
               walletAddress: '0xc1022456dfd3bf36af1da553cd5631f9e76ca8d6',
               walletProvider: null
            }
         })
      ).toBe(false);
   });

   it('finds the Base Account connector across RainbowKit naming variants', () => {
      expect(
         getBaseAccountConnector([
            { id: 'metaMask', name: 'MetaMask' },
            { id: 'baseAccountSDK', name: 'Coinbase Wallet' }
         ])
      ).toMatchObject({
         id: 'baseAccountSDK'
      });
      expect(getBaseAccountConnector([{ id: 'coinbaseWallet', name: 'Coinbase Wallet' }])).toBeUndefined();
   });

   it('compares wallet addresses case-insensitively', () => {
      expect(areWalletAddressesEqual('0xABCDEF', '0xabcdef')).toBe(true);
      expect(areWalletAddressesEqual('0xABCDEF', '0x123456')).toBe(false);
   });
});

describe('walletProvider — Openfort instant wallet', () => {
   it('detects the Openfort connector name (and the user-facing "Instant Wallet" alias)', () => {
      expect(getWalletProviderFromConnectorName('Openfort')).toBe('openfort');
      expect(getWalletProviderFromConnectorName('Instant Wallet')).toBe('openfort');
      expect(isOpenfortWalletProvider('openfort')).toBe(true);
      expect(isOpenfortWalletProvider('base_wallet')).toBe(false);
      expect(isOpenfortWalletProvider(null)).toBe(false);
   });

   it('labels the Openfort wallet as "Instant Wallet", never "Base Account"', () => {
      expect(getWalletProviderLabel({ provider: 'openfort' })).toBe('Instant Wallet');
   });

   it('counts Base OR Openfort as a confirmed borrower wallet, but not other wallets', () => {
      expect(isConfirmedBorrowerWalletProvider('base_wallet')).toBe(true);
      expect(isConfirmedBorrowerWalletProvider('openfort')).toBe(true);
      expect(isConfirmedBorrowerWalletProvider('metamask')).toBe(false);
      expect(isConfirmedBorrowerWalletProvider('unknown')).toBe(false);
      expect(isConfirmedBorrowerWalletProvider(null)).toBe(false);
   });

   it('treats a stored Openfort wallet as a confirmed borrower lock that needs no Base confirmation', () => {
      expect(
         getBaseWalletLockStatus({
            walletAddress: '0xC1022456DFd3BF36af1dA553cd5631F9e76ca8D6',
            walletProvider: 'openfort'
         })
      ).toMatchObject({
         address: '0xc1022456dfd3bf36af1da553cd5631f9e76ca8d6',
         hasStoredWallet: true,
         // It is NOT a Base wallet, but IS a confirmed borrower wallet → no "confirm Base" nag.
         isConfirmedBase: false,
         isConfirmedOpenfort: true,
         isConfirmedBorrowerWallet: true,
         needsConfirmation: false
      });
   });
});
