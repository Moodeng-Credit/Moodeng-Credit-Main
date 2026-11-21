// Walt P2P market prices (official read-only P2P API, key from vault secret WALT_P2P_API_KEY via
// walt_p2p_api_key()). Indonesians turn the loan's USDT into rupiah, and buy USDT to repay, on exactly
// this market, so its price is what they really get / pay — the official USD/IDR rate is ~1–2% off.
//
//   waltP2pPrice(svc, 'cashout', idr) — rupiah per USDT a merchant pays them (best BUY ad)
//   waltP2pPrice(svc, 'buy', idr)     — rupiah per USDT they pay a merchant (best SELL ad)
//
// Only online ads whose order limits fit `idr`; auto-accept (instant) ads first. null = no key, the API
// is down, or no fitting ad — callers fall back to the official rate. Cached 3 minutes per side.
// Walt's docs say p2p.walt.io, which has no DNS (checked 2026-11-12); p2p.walletbot.me answers.

// deno-lint-ignore no-explicit-any
type Svc = any;

const HOSTS = ['https://p2p.walletbot.me', 'https://p2p.walt.io'];
const PATH = '/p2p/integration-api/v1/item/online';
const CACHE_MS = 3 * 60_000;

export type P2pAd = {
   price: string;
   minAmount: string;
   maxAmount: string;
   isOnline: boolean;
   isAutoAccept?: boolean;
};

/** The best price among ads that fit `idr`: highest when they sell USDT to a merchant, lowest when they buy. */
export const pickP2pPrice = (ads: P2pAd[], side: 'cashout' | 'buy', idr: number): number | null => {
   const fits = ads.filter((a) => {
      const price = Number(a.price);
      return a.isOnline && price > 0 && Number(a.minAmount || 0) <= idr && (!Number(a.maxAmount) || idr <= Number(a.maxAmount));
   });
   const pool = fits.some((a) => a.isAutoAccept) ? fits.filter((a) => a.isAutoAccept) : fits;
   if (!pool.length) return null;
   const prices = pool.map((a) => Number(a.price));
   return side === 'cashout' ? Math.max(...prices) : Math.min(...prices);
};

/** Rupiah to the nearest Rp 100 ("Rp 89.100"). */
export const roundRp = (idr: number): number => Math.round(idr / 100) * 100;

let keyCache: { at: number; key: string | null } | null = null;
const cache: Partial<Record<'cashout' | 'buy', { at: number; ads: P2pAd[] }>> = {};

const apiKey = async (svc: Svc): Promise<string | null> => {
   if (keyCache && Date.now() - keyCache.at < 10 * 60_000) return keyCache.key;
   let key: string | null = null;
   try {
      const { data } = await svc.rpc('walt_p2p_api_key');
      key = typeof data === 'string' && data.trim() ? data.trim() : null;
   } catch {
      key = null;
   }
   keyCache = { at: Date.now(), key };
   return key;
};

const loadAds = async (svc: Svc, side: 'cashout' | 'buy'): Promise<P2pAd[] | null> => {
   const hit = cache[side];
   if (hit && Date.now() - hit.at < CACHE_MS) return hit.ads;
   const key = await apiKey(svc);
   if (!key) return null;
   // The API's side is the merchant's: they BUY USDT from someone cashing out, SELL to someone buying.
   const body = JSON.stringify({
      cryptoCurrency: 'USDT',
      fiatCurrency: 'IDR',
      side: side === 'cashout' ? 'BUY' : 'SELL',
      page: 1,
      pageSize: 20
   });
   for (const host of HOSTS) {
      try {
         const res = await fetch(`${host}${PATH}`, {
            method: 'POST',
            headers: { 'content-type': 'application/json', 'x-api-key': key, 'user-agent': 'moodeng-server/1' },
            body,
            signal: AbortSignal.timeout(6_000)
         });
         if (!res.ok) continue;
         const json = (await res.json()) as { status?: string; data?: P2pAd[] };
         if (json.status !== 'SUCCESS' || !Array.isArray(json.data)) continue;
         cache[side] = { at: Date.now(), ads: json.data };
         return json.data;
      } catch {
         // next host
      }
   }
   return null;
};

/** Rupiah per USDT on Walt P2P right now for an order of about `idr` rupiah, or null. Never throws. */
export const waltP2pPrice = async (svc: Svc, side: 'cashout' | 'buy', idr: number): Promise<number | null> => {
   try {
      const ads = await loadAds(svc, side);
      return ads ? pickP2pPrice(ads, side, idr) : null;
   } catch {
      return null;
   }
};
