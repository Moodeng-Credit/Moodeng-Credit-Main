import { describe, expect, it } from 'vitest';
import { base, baseSepolia } from 'wagmi/chains';

import {
   ALLOWED_CHAIN_DISPLAY_NAME,
   ALLOWED_CHAIN_ID,
   BASE_USDC_ADDRESS,
   chainConfig,
   chainIdFromNetwork,
   chainsWithIcons,
   getAllowedChainConfig,
   getAllowedChainIdFromName,
   getAllowedChainTokenConfig,
   normalizeChainName
} from '@/config/wagmiConfig';

describe('wagmiConfig allowed chain', () => {
   it('defaults loan wallets to Base mainnet USDC', () => {
      expect(ALLOWED_CHAIN_ID).toBe(base.id);
      expect(ALLOWED_CHAIN_DISPLAY_NAME).toBe('Base');
      expect(chainsWithIcons).toHaveLength(1);
      expect(chainsWithIcons[0].id).toBe(base.id);
      expect(getAllowedChainConfig().id).toBe(base.id);
      expect(getAllowedChainTokenConfig()).toMatchObject({
         id: base.id,
         USDC: BASE_USDC_ADDRESS
      });
   });

   it('does not allow legacy Base Sepolia env values for loan wallets', () => {
      expect(chainConfig[baseSepolia.id]).toBeUndefined();
      expect(getAllowedChainIdFromName('Base Sepolia')).toBe(base.id);
      expect(getAllowedChainIdFromName('Base_Sepolia')).toBe(base.id);
      expect(getAllowedChainIdFromName('basesepolia')).toBe(base.id);
      expect(chainIdFromNetwork('Base Sepolia')).toBeUndefined();
   });

   it('normalizes explicit Base names without punctuation or casing sensitivity', () => {
      expect(normalizeChainName('Base_Sepolia')).toBe('basesepolia');
      expect(getAllowedChainIdFromName(' Base ')).toBe(base.id);
      expect(chainIdFromNetwork('base')).toBe(String(base.id));
   });
});
