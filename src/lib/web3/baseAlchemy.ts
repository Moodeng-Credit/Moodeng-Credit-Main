// Our Base mainnet Alchemy endpoint, shared by every client-side Base read.
// Prod's VITE_ALCHEMY_ID was once the literal placeholder "your_alchemy_id", which built a dead RPC
// URL, so a missing/placeholder key falls back to a known-good public Base Alchemy key
// (client-exposed by design, like every VITE_ key). A real VITE_ALCHEMY_ID still takes precedence.
const DEFAULT_BASE_ALCHEMY_ID = 'E5yDrf19k4QC9THtY7xec';
const rawAlchemyId = import.meta.env.VITE_ALCHEMY_ID?.trim();
export const BASE_ALCHEMY_ID = rawAlchemyId && rawAlchemyId !== 'your_alchemy_id' ? rawAlchemyId : DEFAULT_BASE_ALCHEMY_ID;
export const BASE_ALCHEMY_RPC_URL = `https://base-mainnet.g.alchemy.com/v2/${BASE_ALCHEMY_ID}`;
