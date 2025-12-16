/**
 * Network color classes for badges and text
 * Used for displaying network information with background and text colors
 */
export const NETWORK_COLORS = {
   optimism: 'bg-red-900/20 text-red-300',
   solana: 'bg-orange-900/20 text-orange-300',
   base: 'bg-blue-900/20 text-blue-300',
   arbitrum: 'bg-yellow-900/20 text-yellow-300',
   polygon: 'bg-purple-900/20 text-purple-300',
   binance: 'bg-yellow-900/20 text-yellow-300',
   sepolia: 'bg-gray-900/20 text-gray-300',
   baseSepolia: 'bg-blue-900/20 text-blue-300',
   basesepolia: 'bg-blue-900/20 text-blue-300'
} as const;

/**
 * Network solid background colors for icon buttons
 * Used in network icon components
 */
export const NETWORK_BG_COLORS = {
   optimism: 'bg-[#FF0420]',
   solana: 'bg-[#1f1f1f]',
   base: 'bg-[#0051ff]',
   basesepolia: 'bg-[#0051ff]',
   arbitrum: 'bg-[#213147]',
   polygon: 'bg-[#6a00f5]',
   binance: 'bg-[#f3bc30]'
} as const;

const normalizeNetworkKey = (network?: string) => (network ?? '').toLowerCase().replace(/\s+/g, '');

export const getNetworkColor = (network: string): string => {
   const key = normalizeNetworkKey(network);
   return NETWORK_COLORS[key as keyof typeof NETWORK_COLORS] || 'bg-gray-900/20 text-gray-300';
};

export const getNetworkBgColor = (network: string): string => {
   const key = normalizeNetworkKey(network);
   return NETWORK_BG_COLORS[key as keyof typeof NETWORK_BG_COLORS] || 'bg-black';
};

export type NetworkType = keyof typeof NETWORK_COLORS;
