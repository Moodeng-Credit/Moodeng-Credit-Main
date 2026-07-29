const STORAGE_KEY = 'moodeng-wallet-change-intent';
const INTENT_TTL_MS = 2 * 60 * 1000;

export const WALLET_CHANGE_FAILED_EVENT = 'moodeng:wallet-change-failed';

export type WalletChangeIntent = {
   id: string;
   previousAddress: string;
   status: 'active' | 'cancelled';
   expiresAt: number;
};

export type WalletChangeDisposition = 'same-or-initial' | 'explicit-change' | 'cancelled-change' | 'borrower-mismatch' | 'allowed';

let memoryIntent: WalletChangeIntent | null = null;

function getStorage() {
   if (typeof window === 'undefined') return null;
   try {
      return window.sessionStorage;
   } catch {
      return null;
   }
}

function writeIntent(intent: WalletChangeIntent | null) {
   memoryIntent = intent;
   const storage = getStorage();
   if (!storage) return;

   if (intent) {
      storage.setItem(STORAGE_KEY, JSON.stringify(intent));
   } else {
      storage.removeItem(STORAGE_KEY);
   }
}

export function getWalletChangeIntent(now = Date.now()): WalletChangeIntent | null {
   const storage = getStorage();
   let intent = memoryIntent;

   if (storage) {
      try {
         const stored = storage.getItem(STORAGE_KEY);
         intent = stored ? (JSON.parse(stored) as WalletChangeIntent) : null;
      } catch {
         intent = memoryIntent;
      }
   }

   if (
      !intent ||
      typeof intent.id !== 'string' ||
      typeof intent.previousAddress !== 'string' ||
      (intent.status !== 'active' && intent.status !== 'cancelled') ||
      typeof intent.expiresAt !== 'number'
   ) {
      writeIntent(null);
      return null;
   }

   if (intent.expiresAt <= now) {
      writeIntent(null);
      return null;
   }

   memoryIntent = intent;
   return intent;
}

export function beginWalletChangeIntent(previousAddress?: string | null, now = Date.now()) {
   const normalizedPreviousAddress = previousAddress?.trim().toLowerCase() ?? '';
   const id =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
         ? crypto.randomUUID()
         : `${now}-${Math.random().toString(16).slice(2)}`;

   writeIntent({
      id,
      previousAddress: normalizedPreviousAddress,
      status: 'active',
      expiresAt: now + INTENT_TTL_MS
   });

   return id;
}

export function cancelWalletChangeIntent(id: string, now = Date.now()) {
   const intent = getWalletChangeIntent(now);
   if (!intent || intent.id !== id) return;
   writeIntent({ ...intent, status: 'cancelled', expiresAt: now + INTENT_TTL_MS });
}

export function completeWalletChangeIntent(id?: string) {
   const intent = getWalletChangeIntent();
   if (!intent || (id && intent.id !== id)) return;
   writeIntent(null);
}

export function reportWalletChangeFailure(id: string, message: string) {
   completeWalletChangeIntent(id);
   if (typeof window === 'undefined') return;
   window.dispatchEvent(
      new CustomEvent(WALLET_CHANGE_FAILED_EVENT, {
         detail: { intentId: id, message }
      })
   );
}

export function getWalletChangeDisposition(params: {
   intent: WalletChangeIntent | null;
   storedAddress?: string | null;
   connectedAddress?: string | null;
   role?: 'borrower' | 'lender';
}): WalletChangeDisposition {
   const storedAddress = params.storedAddress?.trim().toLowerCase() ?? '';
   const connectedAddress = params.connectedAddress?.trim().toLowerCase() ?? '';

   if (!storedAddress || !connectedAddress || storedAddress === connectedAddress) return 'same-or-initial';

   const intentMatchesStoredWallet = params.intent?.previousAddress === storedAddress;
   if (params.intent?.status === 'cancelled' && intentMatchesStoredWallet) return 'cancelled-change';
   if (params.intent?.status === 'active' && intentMatchesStoredWallet) return 'explicit-change';
   if (params.role === 'borrower') return 'borrower-mismatch';
   return 'allowed';
}
