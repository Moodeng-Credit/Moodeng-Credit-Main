export type WalletProvider =
   | 'argent'
   | 'base_wallet'
   | 'metamask'
   | 'phantom'
   | 'rainbow'
   | 'trust'
   | 'walletconnect'
   | 'unknown';

export const getWalletProviderFromConnectorName = (connectorName?: string | null): WalletProvider => {
   const normalized = (connectorName ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

   if (normalized.includes('coinbase') || normalized.includes('base')) return 'base_wallet';
   if (normalized.includes('metamask')) return 'metamask';
   if (normalized.includes('phantom')) return 'phantom';
   if (normalized.includes('walletconnect')) return 'walletconnect';
   if (normalized.includes('trust')) return 'trust';
   if (normalized.includes('rainbow')) return 'rainbow';
   if (normalized.includes('argent')) return 'argent';

   return 'unknown';
};

export const isBaseWalletProvider = (provider?: string | null) => provider === 'base_wallet';
