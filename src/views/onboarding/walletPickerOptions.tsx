import type { WalletConnectorKey } from '@/config/wagmiConfig';
import { WALLET_CONNECTOR_NAMES } from '@/config/wagmiConfig';

export type WalletOption = {
   key: WalletConnectorKey;
   name: string;
   iconSrc: string;
   iconBg: string;
   iconPadding?: string;
   tag?: { label: string; bgClass: string; textClass: string };
   line1: string;
   line2: string;
};

export const LENDER_WALLET_OPTIONS: WalletOption[] = [
   {
      key: 'coinbase',
      name: 'Base Account',
      iconSrc: '/icons/base-account.svg',
      iconBg: 'bg-transparent',
      iconPadding: 'p-0',
      tag: { label: 'Top Pick', bgClass: 'bg-md-primary-100', textClass: 'text-md-primary-1200' },
      line1: 'Zero fees',
      line2: 'Best for beginners'
   },
   {
      key: 'phantom',
      name: 'Phantom',
      iconSrc: '/icons/phantom_wallet.png',
      iconBg: 'bg-transparent',
      iconPadding: 'p-0',
      line1: 'Sleek UI',
      line2: 'Simple & secure'
   },
   {
      key: 'metaMask',
      name: 'Metamask',
      iconSrc: '/icons/metamask_wallet.png',
      iconBg: 'bg-transparent',
      iconPadding: 'p-0',
      tag: { label: 'Popular', bgClass: 'bg-md-blue-200', textClass: 'text-md-blue-800' },
      line1: 'Universal',
      line2: 'Widely Used'
   }
   // WalletConnect was removed as a dedicated tile: its bare connect dead-ended (it needs its
   // own QR modal, which the tile path never popped), and the Instant Wallet card now fills the
   // "no app installed" slot it was meant to serve. WalletConnect is still reachable through the
   // "Other Wallets" RainbowKit modal for lenders who specifically want it.
];

export const getConnectorName = (key: WalletConnectorKey) => WALLET_CONNECTOR_NAMES[key];
