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
