import { describe, expect, it } from 'vitest';
import { base, baseSepolia } from 'wagmi/chains';

import {
   ALLOWED_CHAIN_DISPLAY_NAME,
   ALLOWED_CHAIN_ID,
   BASE_USDC_ADDRESS,
   chainConfig,
   chainIdFromNetwork,
   chainsWithIcons,
   config,
   getAllowedChainConfig,
   getAllowedChainIdFromName,
   getAllowedChainTokenConfig,
   normalizeChainName,
   WALLET_CONNECTOR_NAMES
} from '@/config/wagmiConfig';
import { getBaseAccountConnector, getWalletProviderFromConnector } from '@/lib/walletProvider';

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

describe('Base Account connector wiring', () => {
   // The borrower "Connect Base Wallet" button resolves its connector by name via
   // connectorsByName.get(WALLET_CONNECTOR_NAMES.coinbase). If a RainbowKit upgrade
   // renames the baseAccount wallet, that primary lookup silently breaks. These tests
   // pin both the name-based path and the getBaseAccountConnector() fallback.
   it('labels the Base Account connector "Base Account"', () => {
      expect(WALLET_CONNECTOR_NAMES.coinbase).toBe('Base Account');
   });

   it('exposes a connector whose name matches the borrower button lookup', () => {
      const byName = config.connectors.find((c) => c.name === WALLET_CONNECTOR_NAMES.coinbase);
      expect(byName, 'no connector named "Base Account" — RainbowKit may have renamed baseAccount').toBeDefined();
      expect(byName?.id).toBe('baseAccount');
   });

   it('resolves the Base Account connector via the id/name fallback too', () => {
      const fallbackConnector = getBaseAccountConnector([...config.connectors]);
      expect(fallbackConnector, 'getBaseAccountConnector could not find the Base Account connector').toBeDefined();
      expect(fallbackConnector?.name).toBe('Base Account');
   });

   it('maps the resolved connector to the base_wallet provider', () => {
      const connector = getBaseAccountConnector([...config.connectors]);
      expect(getWalletProviderFromConnector({ connectorId: connector?.id, connectorName: connector?.name })).toBe('base_wallet');
   });
});
