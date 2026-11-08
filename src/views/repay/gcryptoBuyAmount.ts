// GCrypto's buy price runs about 2% over the official rate, sending costs 0.01 USDC, and it
// won't send less than 1 USDC — so a top-up for the exact amount lands a few cents short and
// can't be fixed with a tiny second send. Suggest a small buffer up front.
export const suggestedBuyAmount = (shortfall: number) => Math.ceil((shortfall + 0.01) * 1.03 * 10) / 10;
