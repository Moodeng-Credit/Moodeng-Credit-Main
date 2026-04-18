import { type ReactNode } from 'react';

import { connectorsForWallets } from '@rainbow-me/rainbowkit';
import {
   argentWallet,
   coinbaseWallet,
   metaMaskWallet,
   phantomWallet,
   rainbowWallet,
   trustWallet,
   walletConnectWallet
} from '@rainbow-me/rainbowkit/wallets';
import { createConfig, http } from 'wagmi';
import { arbitrum, base, baseSepolia, bsc, type Chain, optimism, polygon, sepolia } from 'wagmi/chains';

import { type CustomChainConfig } from '@/types/wagmiTypes';

export type { CustomChainConfig };

export const getNetworkSvg = (networkId: number) => {
   const colors: Record<number, ReactNode> = {
      [sepolia.id]: (
         <svg width="30px" height="30px" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <g fill="#627EEA">
               <polygon points="12,2 12,8.5 18,11.5" />
               <polygon points="12,2 6,11.5 12,8.5" />
               <polygon points="12,15.5 12,22 18,13.5" />
               <polygon points="12,22 6,13.5 12,15.5" />
               <polygon points="12,14 18,11.5 12,8.5" />
               <polygon points="6,11.5 12,14 12,8.5" />
            </g>
         </svg>
      ),
      [optimism.id]: (
         <svg width="30px" height="30px" viewBox="0 0 28 15" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
               d="M14.4695 14.6399C14.3165 14.6399 14.2145 14.589 14.1635 14.4869C14.0615 14.3849 14.0615 14.2829 14.0615 14.1299L16.7135 1.53295C16.7645 1.37995 16.8155 1.27795 16.9175 1.17595C17.0195 1.07395 17.1725 1.02295 17.2745 1.02295H22.4255C23.1905 1.02295 23.9045 1.12495 24.5675 1.27795C25.2305 1.48195 25.7405 1.73695 26.1995 2.09395C26.6075 2.45095 26.9135 2.96095 27.0665 3.52195C27.2195 4.08295 27.2195 4.74595 27.0665 5.45995C26.7605 6.93895 26.0975 8.06095 25.0775 8.77495C24.1085 9.48895 22.7825 9.84595 21.0995 9.84595H18.4985L17.6315 14.0789C17.5805 14.2319 17.5295 14.3339 17.4275 14.4359C17.3255 14.5379 17.2235 14.589 17.0705 14.589H14.4695V14.6399ZM19.0595 7.24495H21.3035C21.8135 7.24495 22.3235 7.09195 22.7315 6.83695C23.1395 6.53095 23.4455 6.12295 23.5475 5.56195C23.5985 5.20495 23.6495 4.94995 23.5985 4.69495C23.5475 4.43995 23.4455 4.23595 23.1905 4.08295C22.9865 3.92995 22.6295 3.82795 22.1705 3.82795H19.8245L19.0595 7.24495Z"
               fill="#FF0420"
            />
            <path
               d="M6.15647 14.8439C5.34047 14.8439 4.57548 14.7419 3.91248 14.5379C3.19848 14.3339 2.63748 13.9769 2.12748 13.5689C1.66848 13.1099 1.31148 12.5999 1.10748 11.9369C0.903476 11.2739 0.903476 10.5089 1.00548 9.6419C1.10748 9.0809 1.20948 8.5199 1.31148 7.9589C1.46448 7.3979 1.56648 6.8369 1.71948 6.2759C2.12748 4.5419 2.89248 3.2159 4.01448 2.2979C5.13648 1.3799 6.61548 0.920898 8.50248 0.920898C9.31848 0.920898 10.0835 1.0229 10.7465 1.2779C11.4605 1.4819 12.0215 1.8389 12.5315 2.2979C13.0415 2.7569 13.3475 3.3179 13.5515 3.9809C13.7555 4.6439 13.8065 5.4089 13.6535 6.2759C13.5515 6.8369 13.4495 7.3979 13.3475 7.9589C13.2455 8.4689 13.0925 9.0299 12.9905 9.5399C12.5315 11.3249 11.7665 12.6509 10.6445 13.5179C9.52248 14.3849 8.04347 14.8439 6.15647 14.8439ZM6.41147 12.0389C7.12547 12.0389 7.73748 11.8349 8.24748 11.4269C8.75748 11.0189 9.16548 10.3559 9.36948 9.4379C9.52248 8.8769 9.62447 8.3159 9.72647 7.8059C9.82847 7.2959 9.93048 6.7859 10.0325 6.2249C10.1855 5.3069 10.1345 4.6439 9.77748 4.2359C9.47148 3.8279 8.96148 3.6239 8.24748 3.6239C7.53348 3.6239 6.92147 3.8279 6.41147 4.2359C5.90147 4.6439 5.54448 5.3069 5.28948 6.2249C5.13648 6.7859 5.03447 7.2959 4.88147 7.8059C4.77947 8.3159 4.67748 8.8259 4.57548 9.4379C4.42248 10.3559 4.47348 11.0189 4.83048 11.4269C5.18748 11.8349 5.69747 12.0389 6.41147 12.0389Z"
               fill="#FF0420"
            />
         </svg>
      ),
      [base.id]: (
         <svg width="30px" height="30px" viewBox="0 0 21 21" fill="none" xmlns="http://www.w3.org/2000/svg">
            <g clipPath="url(#clip0_354_1442)">
               <path
                  d="M10.5 21C16.299 21 21 16.299 21 10.5C21 4.70101 16.299 0 10.5 0C4.70101 0 0 4.70101 0 10.5C0 16.299 4.70101 21 10.5 21Z"
                  fill="white"
               />
               <path
                  d="M10.5462 17.7966C14.6159 17.7966 17.9149 14.5032 17.9149 10.4406C17.9149 6.37808 14.6159 3.08472 10.5462 3.08472C6.68517 3.08472 3.51771 6.0491 3.20312 9.82232H12.9429V11.059H3.20312C3.51771 14.8322 6.68517 17.7966 10.5462 17.7966Z"
                  fill="#0052FF"
               />
            </g>
            <defs>
               <clipPath id="clip0_354_1442">
                  <rect width="21" height="21" fill="white" />
               </clipPath>
            </defs>
         </svg>
      ),
      [baseSepolia.id]: (
         <svg width="30px" height="30px" viewBox="0 0 21 21" fill="none" xmlns="http://www.w3.org/2000/svg">
            <g clipPath="url(#clip0_354_1442)">
               <path
                  d="M10.5 21C16.299 21 21 16.299 21 10.5C21 4.70101 16.299 0 10.5 0C4.70101 0 0 4.70101 0 10.5C0 16.299 4.70101 21 10.5 21Z"
                  fill="white"
               />
               <path
                  d="M10.5462 17.7966C14.6159 17.7966 17.9149 14.5032 17.9149 10.4406C17.9149 6.37808 14.6159 3.08472 10.5462 3.08472C6.68517 3.08472 3.51771 6.0491 3.20312 9.82232H12.9429V11.059H3.20312C3.51771 14.8322 6.68517 17.7966 10.5462 17.7966Z"
                  fill="#0052FF"
               />
            </g>
            <defs>
               <clipPath id="clip0_354_1442">
                  <rect width="21" height="21" fill="white" />
               </clipPath>
            </defs>
         </svg>
      ),
      [arbitrum.id]: (
         <svg width="30px" height="30px" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2500 2500" fill="none">
            <rect width="2500" height="2500" fill="none" />
            <path
               fill="#213147"
               d="M226,760v980c0,63,33,120,88,152l849,490c54,31,121,31,175,0l849-490c54-31,88-89,88-152V760
    c0-63-33-120-88-152l-849-490c-54-31-121-31-175,0L314,608c-54,31-87,89-87,152H226z"
            />
            <path fill="#12AAFF" d="M1435,1440l-121,332c-3,9-3,19,0,29l208,571l241-139l-289-793C1467,1422,1442,1422,1435,1440z" />
            <path fill="#12AAFF" d="M1678,882c-7-18-32-18-39,0l-121,332c-3,9-3,19,0,29l341,935l241-139L1678,883V882z" />
            <path
               fill="#9DCCED"
               d="M1250,155c6,0,12,2,17,5l918,530c11,6,17,18,17,30v1060c0,12-7,24-17,30l-918,530c-5,3-11,5-17,5
    s-12-2-17-5l-918-530c-11-6-17-18-17-30V719c0-12,7-24,17-30l918-530c5-3,11-5,17-5l0,0V155z M1250,0c-33,0-65,8-95,25L237,555
    c-59,34-95,96-95,164v1060c0,68,36,130,95,164l918,530c29,17,62,25,95,25s65-8,95-25l918-530c59-34,95-96,95-164V719
    c0-68-36-130-95-164L1344,25c-29-17-62-25-95-25l0,0H1250z"
            />
            <polygon fill="#213147" points="642,2179 727,1947 897,2088 738,2234" />
            <path fill="#FFFFFF" d="M1172,644H939c-17,0-33,11-39,27L401,2039l241,139l550-1507c5-14-5-28-19-28L1172,644z" />
            <path fill="#FFFFFF" d="M1580,644h-233c-17,0-33,11-39,27L738,2233l241,139l620-1701c5-14-5-28-19-28V644z" />
         </svg>
      ),
      [polygon.id]: (
         <svg width="30px" height="30px" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 178 161" fill="none">
            <path
               fill="#8247E5"
               d="M66.8,54.7l-16.7-9.7L0,74.1v58l50.1,29l50.1-29V41.9L128,25.8l27.8,16.1v32.2L128,90.2l-16.7-9.7v25.8
        l16.7,9.7l50.1-29V29L128,0L77.9,29v90.2l-27.8,16.1l-27.8-16.1V86.9l27.8-16.1l16.7,9.7V54.7z"
            />
         </svg>
      ),
      [bsc.id]: (
         <svg width="30px" height="30px" viewBox="0 0 24 24" role="img" xmlns="http://www.w3.org/2000/svg">
            <path
               fill="#F3BA2F"
               d="m16.624 13.92 2.717 2.716-7.353 7.353-7.352-7.352 2.717-2.717 4.636 4.66 4.635-4.66zm4.637-4.636L24 12l-2.715 2.716L18.568 12l2.693-2.716zm-9.272 0 2.716 2.692-2.717 2.717L9.272 12l2.716-2.715zm-9.273 0L5.41 12l-2.692 2.692L0 12l2.716-2.716zM11.99.01l7.352 7.33-2.717 2.715-4.636-4.636-4.635 4.66-2.717-2.716L11.989.011z"
            />
         </svg>
      )
   };
   return colors[networkId] || <i className="fas fa-gem text-white text-lg"></i>;
};

export const chainConfig: Record<number, CustomChainConfig> = {
   // [sepolia.id]: {
   //    ...sepolia,
   //    iconBackground: '#627EEA',
   //    displayName: 'Sepolia',
   //    shortName: 'SEP',
   //    color: 'bg-gray-600',
   //    bgColor: 'bg-gray-600',
   //    textColor: 'text-gray-600',
   //    tokens: {
   //       Link: '0x779877A7B0D9E8603169DdbD7836e478b4624789',
   //       USDC: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',
   //       USDT: '0x94b008aa00579c1307b0ef2c499ad98a8ce58e58'
   //    }
   // },
   // [polygon.id]: {
   //    ...polygon,
   //    iconBackground: '#8247E5',
   //    displayName: 'Polygon',
   //    shortName: 'POL',
   //    color: 'bg-[#6a00f5]',
   //    bgColor: 'bg-[#6a00f5]',
   //    textColor: 'text-[#6a00f5]',
   //    tokens: {
   //       USDC: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
   //       USDT: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F'
   //    }
   // },
   [base.id]: {
      ...base,
      iconBackground: '#0052FF',
      displayName: 'Base',
      shortName: 'BASE',
      color: 'bg-[#0051ff]',
      bgColor: 'bg-[#0051ff]',
      textColor: 'text-[#0051ff]',
      tokens: {
         USDC: import.meta.env.VITE_BASE_USDC_ADDRESS || '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913'
      }
   },
   // [arbitrum.id]: {
   //    ...arbitrum,
   //    iconBackground: '#2D374B',
   //    displayName: 'Arbitrum',
   //    shortName: 'ARB',
   //    color: 'bg-[#213147]',
   //    bgColor: 'bg-[#213147]',
   //    textColor: 'text-[#213147]',
   //    tokens: {
   //       USDC: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
   //       USDT: '0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9'
   //    }
   // },
   // [optimism.id]: {
   //    ...optimism,
   //    iconBackground: '#FF0420',
   //    displayName: 'Optimism',
   //    shortName: 'OP',
   //    color: 'bg-[#FF0420]',
   //    bgColor: 'bg-[#FF0420]',
   //    textColor: 'text-[#FF0420]',
   //    tokens: {
   //       USDC: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',
   //       USDT: '0x94b008aa00579c1307b0ef2c499ad98a8ce58e58'
   //    }
   // },
   // [bsc.id]: {
   //    ...bsc,
   //    iconBackground: '#F3BA2F',
   //    displayName: 'BSC',
   //    shortName: 'BSC',
   //    color: 'bg-[#f3bc30]',
   //    bgColor: 'bg-[#f3bc30]',
   //    textColor: 'text-[#f3bc30]',
   //    tokens: {
   //       BUSD: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56',
   //       USDT: '0x55d398326f99059fF775485246999027B3197955'
   //    }
   // },
   [baseSepolia.id]: {
      ...baseSepolia,
      iconBackground: '#0052FF',
      displayName: 'Base Sepolia',
      shortName: 'BASE SEP',
      color: 'bg-[#0051ff]',
      bgColor: 'bg-[#0051ff]',
      textColor: 'text-[#0051ff]',
      tokens: {
         USDC: import.meta.env.VITE_BASE_SEPOLIA_USDC_ADDRESS || '0x036CbD53842c5426634e7929541eC2318f3dCF7e'
      }
   }
};

// Calculate allowed chain before using it
const normalizeChainName = (value?: string) => (value ?? '').toLowerCase().replace(/\s+/g, '');
const allowedChainEnvName = (import.meta.env.VITE_ALLOWED_CHAIN_NAME || 'Base Sepolia').trim();
const normalizedAllowedChainName = normalizeChainName(allowedChainEnvName);
const allowedChainEntry = Object.entries(chainConfig).find(
   ([, chain]) => normalizeChainName(chain.displayName) === normalizedAllowedChainName
);
export const ALLOWED_CHAIN_ID = allowedChainEntry ? parseInt(allowedChainEntry[0], 10) : baseSepolia.id;

// Convert to array for RainbowKit - only include allowed chain
export const chainsWithIcons = [chainConfig[ALLOWED_CHAIN_ID]];

export const WALLET_CONNECTOR_NAMES = {
   coinbase: 'Coinbase Wallet',
   metaMask: 'MetaMask',
   phantom: 'Phantom',
   walletConnect: 'WalletConnect'
} as const;

export type WalletConnectorKey = keyof typeof WALLET_CONNECTOR_NAMES;

const walletConnectProjectId = import.meta.env.VITE_WALLET_CONNECT_PROJECT_ID || '';

const connectors = connectorsForWallets(
   [
      {
         groupName: 'Recommended',
         wallets: [coinbaseWallet, metaMaskWallet, phantomWallet, walletConnectWallet]
      },
      {
         groupName: 'Other',
         wallets: [trustWallet, rainbowWallet, argentWallet]
      }
   ],
   {
      appName: 'Moodeng',
      projectId: walletConnectProjectId
   }
);

const chainsTuple = chainsWithIcons as unknown as [Chain, ...Chain[]];

export const config = createConfig({
   chains: chainsTuple,
   connectors,
   transports: Object.fromEntries(chainsTuple.map((chain) => [chain.id, http()])),
   ssr: false
});

// Helper functions for accessing chain data
export const getChainConfig = (chainId: number) => (chainConfig as Record<number, CustomChainConfig>)[chainId];
export const getChainDisplayConfig = (chainId: number) => {
   const chain = (chainConfig as Record<number, CustomChainConfig>)[chainId];
   return chain
      ? {
           name: chain.displayName,
           shortName: chain.shortName,
           color: chain.color,
           bgColor: chain.bgColor,
           textColor: chain.textColor
        }
      : null;
};
export const getTokenAddresses = (chainId: number) => (chainConfig as Record<number, CustomChainConfig>)[chainId]?.tokens || {};

export const chainDisplayConfig = Object.fromEntries(
   Object.entries(chainConfig).map(([id, chain]: [string, CustomChainConfig]) => [
      id,
      {
         name: chain.displayName,
         shortName: chain.shortName,
         color: chain.color,
         bgColor: chain.bgColor,
         textColor: chain.textColor
      }
   ])
);

export const tokenAddresses = Object.fromEntries(
   Object.entries(chainConfig).map(([id, chain]: [string, CustomChainConfig]) => [
      Object.keys(chainConfig)
         .find((key) => (chainConfig as Record<number, CustomChainConfig>)[parseInt(key)] === chain)
         ?.toLowerCase() || id,
      {
         id: parseInt(id),
         ...chain.tokens
      }
   ])
);

export const chainIdFromNetwork = (network: string) => {
   const chain = Object.values(chainConfig).find(
      (value: CustomChainConfig) => value.displayName.toLowerCase().replace(' ', '') === network.toLowerCase().replace(' ', '')
   );
   return chain ? Object.keys(chainConfig).find((key) => chainConfig[parseInt(key)] === chain) : undefined;
};

export const ALLOWED_CHAIN_NAME = allowedChainEnvName;
export const ALLOWED_CHAIN_DISPLAY_NAME = getChainDisplayConfig(ALLOWED_CHAIN_ID)?.name || ALLOWED_CHAIN_NAME;
export const getAllowedChainConfig = () => chainConfig[ALLOWED_CHAIN_ID] ?? baseSepolia;
export const getAllowedChainTokenConfig = () => {
   const chain = getAllowedChainConfig();
   return chain ? { id: ALLOWED_CHAIN_ID, ...chain.tokens } : null;
};
export const getAllowedChainNormalizedKey = () => normalizeChainName(ALLOWED_CHAIN_DISPLAY_NAME);
