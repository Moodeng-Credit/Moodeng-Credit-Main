// Public surface of the Openfort embedded-wallet rail.
export {
   OPENFORT_CHAIN_ID,
   OPENFORT_CONNECTOR_NAME,
   OPENFORT_WALLET_PROVIDER,
   isOpenfortConfigured
} from '@/lib/web3/openfort/config';
export { OpenfortProvider, useOpenfort, type OpenfortStatus } from '@/lib/web3/openfort/OpenfortContext';
export {
   ensureEmbeddedWalletReady,
   exportEmbeddedPrivateKey,
   sendUsdcFromEmbeddedWallet
} from '@/lib/web3/openfort/embeddedWallet';
export { useCreateInstantWallet, type InstantWalletReturnTo } from '@/lib/web3/openfort/useCreateInstantWallet';
export {
   WALLET_GATE_CODE,
   WalletGateError,
   hasEmbeddedWallet,
   isRetryableGateCode,
   needsWalletFaceScan,
   startWalletFaceScan,
   syncWalletFaceStatus,
   walletFaceStatusCopy,
   type WalletGateCode
} from '@/lib/web3/openfort/walletFaceGate';
