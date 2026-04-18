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
      name: 'Coinbase',
      iconSrc: '/icons/base-wallet.png',
      iconBg: 'bg-transparent',
      iconPadding: 'p-0',
      tag: { label: 'Top Pick', bgClass: 'bg-md-primary-300', textClass: 'text-md-primary-1200' },
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
   },
   {
      key: 'walletConnect',
      name: 'WalletConnect',
      iconSrc: '/icons/wallet_connect.png',
      iconBg: 'bg-transparent',
      iconPadding: 'p-0',
      line1: 'Universal',
      line2: '100+ wallets'
   }
];

export const getConnectorName = (key: WalletConnectorKey) => WALLET_CONNECTOR_NAMES[key];
