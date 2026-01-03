import { type ReactNode } from 'react';

import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { baseSepolia, type Chain } from 'wagmi/chains';

import { type CustomChainConfig } from '@/types/wagmiTypes';

export type { CustomChainConfig };

export const getNetworkSvg = (networkId: number) => {
   const colors: Record<number, ReactNode> = {
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

const normalizeChainName = (value?: string) => (value ?? '').toLowerCase().replace(/\s+/g, '');

// Hardcode Base Sepolia as the only supported chain.
export const ALLOWED_CHAIN_ID = baseSepolia.id;

// Convert to array for RainbowKit - only include allowed chain
export const chainsWithIcons = [chainConfig[ALLOWED_CHAIN_ID]];

const projectId = import.meta.env.VITE_WALLET_CONNECT_PROJECT_ID || 'c2f88357f7fa932dbc04481d125c00ff';

// Custom RPC URL for Base Sepolia - use Alchemy or Infura for reliable endpoints
// You can also use: https://sepolia.base.org (official but rate-limited)
// Recommended: Get a free Alchemy key at https://www.alchemy.com/
const baseSepoliaRpcUrl = import.meta.env.VITE_BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org';

// Create custom chain config with RPC
const baseSepoliaCustom = {
   ...baseSepolia,
   rpcUrls: {
      default: { http: [baseSepoliaRpcUrl] },
      public: { http: [baseSepoliaRpcUrl] }
   }
};

// RainbowKit 2.x config using getDefaultConfig (recommended approach)
// https://rainbowkit.com/docs/migration-guide#2xx-breaking-changes
console.log('[wagmiConfig] Initializing with ALLOWED_CHAIN_ID:', ALLOWED_CHAIN_ID, 'projectId:', projectId);
console.log('[wagmiConfig] Base Sepolia RPC URL:', baseSepoliaRpcUrl);
console.log('[wagmiConfig] isSecureContext:', typeof window !== 'undefined' ? window.isSecureContext : 'N/A');

export const config = getDefaultConfig({
   appName: 'Moodeng',
   projectId,
   chains: [baseSepoliaCustom],
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

export const ALLOWED_CHAIN_NAME = 'Base Sepolia';
export const ALLOWED_CHAIN_DISPLAY_NAME = getChainDisplayConfig(ALLOWED_CHAIN_ID)?.name || ALLOWED_CHAIN_NAME;
export const getAllowedChainConfig = () => chainConfig[ALLOWED_CHAIN_ID] ?? baseSepolia;
export const getAllowedChainTokenConfig = () => {
   const chain = getAllowedChainConfig();
   return chain ? { id: ALLOWED_CHAIN_ID, ...chain.tokens } : null;
};
export const getAllowedChainNormalizedKey = () => normalizeChainName(ALLOWED_CHAIN_DISPLAY_NAME);
