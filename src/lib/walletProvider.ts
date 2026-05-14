export type WalletProvider = 'argent' | 'base_wallet' | 'metamask' | 'phantom' | 'rainbow' | 'trust' | 'walletconnect' | 'unknown';

export const getWalletProviderFromConnectorName = (connectorName?: string | null): WalletProvider => {
   const normalized = (connectorName ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

   if (normalized === 'baseaccount' || normalized === 'basewallet') return 'base_wallet';
   if (normalized.includes('metamask')) return 'metamask';
   if (normalized.includes('phantom')) return 'phantom';
   if (normalized.includes('walletconnect')) return 'walletconnect';
   if (normalized.includes('trust')) return 'trust';
   if (normalized.includes('rainbow')) return 'rainbow';
   if (normalized.includes('argent')) return 'argent';

   return 'unknown';
};

export const isBaseWalletProvider = (provider?: string | null) => provider === 'base_wallet';

export const getWalletProviderLabel = ({
   connectorName,
   provider,
   assumeBaseAccount = false
}: {
   connectorName?: string | null;
   provider?: string | null;
   assumeBaseAccount?: boolean;
}) => {
   const resolvedProvider =
      provider && provider !== 'unknown'
         ? provider
         : connectorName
           ? getWalletProviderFromConnectorName(connectorName)
           : null;

   if (isBaseWalletProvider(resolvedProvider) || assumeBaseAccount) return 'Base Account';

   switch (resolvedProvider) {
      case 'argent':
         return 'Argent';
      case 'metamask':
         return 'MetaMask';
      case 'phantom':
         return 'Phantom';
      case 'rainbow':
         return 'Rainbow';
      case 'trust':
         return 'Trust Wallet';
      case 'walletconnect':
         return 'WalletConnect';
      default:
         return connectorName?.trim() || 'Wallet';
   }
};

export const normalizeWalletAddress = (address?: string | null) => {
   const trimmed = address?.trim();
   return trimmed ? trimmed.toLowerCase() : null;
};

export const areWalletAddressesEqual = (first?: string | null, second?: string | null) => {
   const normalizedFirst = normalizeWalletAddress(first);
   const normalizedSecond = normalizeWalletAddress(second);

   return Boolean(normalizedFirst && normalizedSecond && normalizedFirst === normalizedSecond);
};

type WalletRecord = {
   walletAddress?: string | null;
   walletProvider?: string | null;
   walletConnectorName?: string | null;
};

export const getStoredWalletProvider = (wallet?: WalletRecord | null): WalletProvider | null => {
   if (!wallet) return null;
   const connectorProvider = wallet.walletConnectorName ? getWalletProviderFromConnectorName(wallet.walletConnectorName) : null;

   if (connectorProvider) {
      if (connectorProvider !== 'unknown') return connectorProvider;
      if (wallet.walletProvider === 'base_wallet') return 'unknown';
   }

   if (wallet.walletProvider && wallet.walletProvider !== 'unknown') return wallet.walletProvider as WalletProvider;
   return null;
};

export const getBaseWalletLockStatus = (wallet?: WalletRecord | null) => {
   const address = normalizeWalletAddress(wallet?.walletAddress);
   const provider = getStoredWalletProvider(wallet);
   const isConfirmedBase = Boolean(address && isBaseWalletProvider(provider));

   return {
      address,
      provider,
      hasStoredWallet: Boolean(address),
      isConfirmedBase,
      needsConfirmation: Boolean(address && !isConfirmedBase)
   };
};

export const isConnectedToLockedBaseWallet = ({
   connectedAddress,
   connectorName,
   lockedAddress
}: {
   connectedAddress?: string | null;
   connectorName?: string | null;
   lockedAddress?: string | null;
}) => isBaseWalletProvider(getWalletProviderFromConnectorName(connectorName)) && areWalletAddressesEqual(connectedAddress, lockedAddress);

export const getBaseAccountConnector = <T extends { id?: string; name?: string }>(connectors: T[]) =>
   connectors.find((connector) => connector.id === 'baseAccount' || connector.name === 'Base Account');

export const formatWalletAddressShort = (address?: string | null) => {
   const trimmed = address?.trim();
   if (!trimmed) return 'your locked Base wallet';
   return `${trimmed.slice(0, 6)}...${trimmed.slice(-4)}`;
};
