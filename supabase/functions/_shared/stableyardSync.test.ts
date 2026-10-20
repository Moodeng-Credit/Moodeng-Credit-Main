import { assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';

import type { StableyardDeposit, StableyardDepositNetwork } from './stableyard.ts';
import { depositAddressRow, depositRow, formatAtomic, pickDepositNetworks } from './stableyardSync.ts';

const asset = (symbol: string, minimum = '1') => ({
   symbol,
   tokenAddress: `0x${symbol}`,
   decimals: 6,
   chainId: 0,
   minimumDeposit: { amount: minimum }
});

const networks: StableyardDepositNetwork[] = [
   { code: 'ethereum', chainId: 1, chainFamily: 'evm', live: true, supportedAssets: [asset('USDC', '10'), asset('ETH')] },
   { code: 'tron', chainId: 728126428, chainFamily: 'tron', live: true, supportedAssets: [asset('USDT', '5')] },
   { code: 'polygon', chainId: 137, chainFamily: 'evm', live: false, supportedAssets: [asset('USDC')] },
   { code: 'bitcoin', chainId: 10001, chainFamily: 'btc', live: true, supportedAssets: [asset('BTC')] }
];

Deno.test('pickDepositNetworks keeps our order, live networks, stablecoins only', () => {
   const picked = pickDepositNetworks(networks, [728126428, 137, 10001, 1]);
   assertEquals(
      picked.map((network) => [network.chainId, network.assets.map((a) => `${a.symbol}>=${a.minimum}`)]),
      [
         [728126428, ['USDT>=5']],
         [1, ['USDC>=10']]
      ]
   );
});

Deno.test('depositAddressRow carries catalog minimums', () => {
   const catalog = pickDepositNetworks(networks, [728126428]);
   const row = depositAddressRow(
      'user-1',
      {
         id: 'deposit_addr_1',
         accountId: 'acct_1',
         chainId: 728126428,
         address: 'TXYZ',
         status: 'active',
         supportedAssets: [{ chainId: 728126428, tokenAddress: '0xUSDT', symbol: 'USDT', decimals: 6 }],
         metadata: { networkCode: 'tron', chainFamily: 'tron' }
      },
      catalog
   );
   assertEquals([row.network_code, row.assets], ['tron', [{ symbol: 'USDT', tokenAddress: '0xUSDT', decimals: 6, minimum: '5' }]]);
});

Deno.test('depositRow maps amounts, hashes and settlement', () => {
   const deposit: StableyardDeposit = {
      id: 'deposit_1',
      accountId: 'acct_1',
      depositAddressId: 'deposit_addr_1',
      status: 'settled',
      amount: { asset: { chainId: 56, tokenAddress: '0x', symbol: 'USDT', decimals: 18 }, amount: '25000000000000000000' },
      sourceTransfer: { txHash: '0xsrc' },
      netSettlementAmount: { asset: { chainId: 8453, tokenAddress: '0x', symbol: 'USDC', decimals: 6 }, amount: '24750000' },
      settlement: { status: 'settled', txHash: '0xdst', settledAt: '2026-10-20T10:00:00Z' }
   };
   const row = depositRow('user-1', deposit);
   assertEquals(
      [row.status, row.source_chain_id, row.source_tx_hash, row.settlement_tx_hash, row.settled_at, row.net_amount_atomic],
      ['settled', 56, '0xsrc', '0xdst', '2026-10-20T10:00:00Z', '24750000']
   );
   assertEquals(formatAtomic(row.amount_atomic, row.asset_decimals, row.asset_symbol), '25 USDT');
   assertEquals(formatAtomic(row.net_amount_atomic, row.net_asset_decimals, row.net_asset_symbol), '24.75 USDC');
});

Deno.test('formatAtomic handles small and missing amounts', () => {
   assertEquals(formatAtomic('5', 6, 'USDC'), '0.000005 USDC');
   assertEquals(formatAtomic('1000000', 6), '1');
   assertEquals(formatAtomic(null, 6, 'USDC'), '? USDC');
});
