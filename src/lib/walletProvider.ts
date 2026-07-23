export type WalletProvider =
   | 'argent'
   | 'base_wallet'
   | 'metamask'
   | 'openfort'
   | 'phantom'
   | 'rainbow'
   | 'trust'
   | 'walletconnect'
   | 'unknown';

const normalizeConnectorValue = (value?: string | null) => (value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

export const getWalletProviderFromConnectorName = (connectorName?: string | null): WalletProvider => {
   const normalized = normalizeConnectorValue(connectorName);

   if (normalized === 'baseaccount' || normalized === 'basewallet') return 'base_wallet';
   if (normalized === 'openfort' || normalized === 'instantwallet') return 'openfort';
   if (normalized.includes('metamask')) return 'metamask';
   if (normalized.includes('phantom')) return 'phantom';
   if (normalized.includes('walletconnect')) return 'walletconnect';
   if (normalized.includes('trust')) return 'trust';
   if (normalized.includes('rainbow')) return 'rainbow';
   if (normalized.includes('argent')) return 'argent';

   return 'unknown';
};

export const getWalletProviderFromConnector = ({
   connectorId,
   connectorName
}: {
   connectorId?: string | null;
   connectorName?: string | null;
}): WalletProvider => {
   if (normalizeConnectorValue(connectorId).includes('baseaccount')) return 'base_wallet';
   return getWalletProviderFromConnectorName(connectorName);
};

export const isBaseWalletProvider = (provider?: string | null) => provider === 'base_wallet';

/** The Openfort embedded smart account — the PH escape-hatch borrower wallet. */
export const isOpenfortWalletProvider = (provider?: string | null) => provider === 'openfort';

/**
 * Any wallet that counts as a fully set-up borrower wallet: their locked Base Account OR an
 * Openfort embedded wallet. Borrower-gating flows (can borrow, can repay, onboarding complete)
 * should check this rather than `isBaseWalletProvider` so Openfort borrowers aren't treated as
 * having no wallet.
 */
export const isConfirmedBorrowerWalletProvider = (provider?: string | null) =>
   isBaseWalletProvider(provider) || isOpenfortWalletProvider(provider);

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
      provider && provider !== 'unknown' ? provider : connectorName ? getWalletProviderFromConnectorName(connectorName) : null;

   if (isBaseWalletProvider(resolvedProvider) || assumeBaseAccount) return 'Base Account';

   switch (resolvedProvider) {
      case 'argent':
         return 'Argent';
      case 'openfort':
         return 'Instant Wallet';
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

export const hasWalletAddressOnAccount = (wallet?: WalletRecord | null) => Boolean(normalizeWalletAddress(wallet?.walletAddress));

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
   const isConfirmedOpenfort = Boolean(address && isOpenfortWalletProvider(provider));
   // A borrower is "set up" with either a confirmed Base Account or an Openfort embedded wallet.
   const isConfirmedBorrowerWallet = isConfirmedBase || isConfirmedOpenfort;

   return {
      address,
      provider,
      hasStoredWallet: Boolean(address),
      isConfirmedBase,
      isConfirmedOpenfort,
      isConfirmedBorrowerWallet,
      // Only nag for confirmation when a stored wallet is neither a confirmed Base nor Openfort lock.
      needsConfirmation: Boolean(address && !isConfirmedBorrowerWallet)
   };
};

export const isConnectedToLockedBaseWallet = ({
   connectedAddress,
   connectorId,
   connectorName,
   lockedAddress
}: {
   connectedAddress?: string | null;
   connectorId?: string | null;
   connectorName?: string | null;
   lockedAddress?: string | null;
}) =>
   isBaseWalletProvider(getWalletProviderFromConnector({ connectorId, connectorName })) &&
   areWalletAddressesEqual(connectedAddress, lockedAddress);

export const isBaseWalletReadyForRepayment = ({
   connectedAddress,
   connectorId,
   connectorName,
   wallet
}: {
   connectedAddress?: string | null;
   connectorId?: string | null;
   connectorName?: string | null;
   wallet?: WalletRecord | null;
}) => {
   const lockStatus = getBaseWalletLockStatus(wallet);
   return (
      lockStatus.isConfirmedBase ||
      isConnectedToLockedBaseWallet({
         connectedAddress,
         connectorId,
         connectorName,
         lockedAddress: lockStatus.address
      })
   );
};

export const getBaseAccountConnector = <T extends { id?: string; name?: string }>(connectors: T[]) =>
   connectors.find((connector) => {
      const normalizedId = normalizeConnectorValue(connector.id);
      const normalizedName = normalizeConnectorValue(connector.name);
      return normalizedId.includes('baseaccount') || normalizedName === 'baseaccount' || normalizedName === 'basewallet';
   });

export const formatWalletAddressShort = (address?: string | null) => {
   const trimmed = address?.trim();
   if (!trimmed) return 'your locked Base wallet';
   return `${trimmed.slice(0, 6)}...${trimmed.slice(-4)}`;
};
