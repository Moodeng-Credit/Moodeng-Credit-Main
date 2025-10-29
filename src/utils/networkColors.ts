export const NETWORK_COLORS = {
   optimism: 'bg-red-900/20 text-red-300',
   solana: 'bg-orange-900/20 text-orange-300',
   base: 'bg-blue-900/20 text-blue-300',
   arbitrum: 'bg-yellow-900/20 text-yellow-300',
   polygon: 'bg-purple-900/20 text-purple-300',
   binance: 'bg-yellow-900/20 text-yellow-300',
   sepolia: 'bg-gray-900/20 text-gray-300',
   baseSepolia: 'bg-blue-900/20 text-blue-300'
} as const;

export const getNetworkColor = (network: string): string => {
   return NETWORK_COLORS[network as keyof typeof NETWORK_COLORS] || 'bg-gray-900/20 text-gray-300';
};

export type NetworkType = keyof typeof NETWORK_COLORS;
