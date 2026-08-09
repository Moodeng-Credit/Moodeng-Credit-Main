// Web Push transport: VAPID auth (RFC 8292) + aes128gcm payload encryption
// (RFC 8291 over RFC 8188), implemented directly on WebCrypto.
//
// Deliberately dependency-free. The usual `web-push` npm package pulls in Node's
// crypto and a HTTP client we don't need; everything below is ~150 lines of
// standard WebCrypto that the Deno edge runtime supports natively, which keeps
// the function cold-start small and removes a supply-chain surface from a path
// that handles per-device key material.
//
// Pure transport — no Supabase, no message copy. See pushDelivery.ts for the
// fan-out and pruning, and pushMessages.ts for the notification text.

export type PushSubscriptionKeys = {
   endpoint: string;
   /** base64url client public key from PushSubscription.getKey('p256dh') */
   p256dh: string;
   /** base64url client auth secret from PushSubscription.getKey('auth') */
   auth: string;
};

export type WebPushResult = {
   ok: boolean;
   status: number;
   /** True when the push service says this subscription no longer exists (404/410). */
   expired: boolean;
   error?: string;
};

const encoder = new TextEncoder();

// Record size for the single-record aes128gcm body. 4096 is the value every push
// service accepts; the plaintext plus its 1-byte delimiter and 16-byte GCM tag
// must fit inside it.
const RECORD_SIZE = 4096;
const MAX_PAYLOAD_BYTES = RECORD_SIZE - 17;
const VAPID_TOKEN_TTL_SECONDS = 12 * 60 * 60;

const base64UrlToBytes = (value: string): Uint8Array => {
   const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
   const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=');
   const binary = atob(padded);
   const bytes = new Uint8Array(binary.length);
   for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
   }
   return bytes;
};

const bytesToBase64Url = (bytes: Uint8Array): string => {
   let binary = '';
   for (const byte of bytes) {
      binary += String.fromCharCode(byte);
   }
   return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const concatBytes = (...chunks: Uint8Array[]): Uint8Array => {
   const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
   const out = new Uint8Array(total);
   let offset = 0;
   for (const chunk of chunks) {
      out.set(chunk, offset);
      offset += chunk.length;
   }
   return out;
};

const hmacSha256 = async (key: Uint8Array, data: Uint8Array): Promise<Uint8Array> => {
   const cryptoKey = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
   return new Uint8Array(await crypto.subtle.sign('HMAC', cryptoKey, data));
};

// HKDF-Expand with a single-block output, which is all RFC 8291 ever needs.
const hkdfExpand = async (prk: Uint8Array, info: Uint8Array, length: number): Promise<Uint8Array> =>
   (await hmacSha256(prk, concatBytes(info, new Uint8Array([1])))).slice(0, length);

export type VapidKeys = {
   /** base64url uncompressed P-256 public key (65 bytes, 0x04-prefixed). */
   publicKey: string;
   /** base64url P-256 private scalar (32 bytes). */
   privateKey: string;
   /** Contact URI the push service can reach us on, e.g. mailto:support@moodeng.credit */
   subject: string;
};

export const getVapidKeysFromEnv = (): VapidKeys | null => {
   const publicKey = Deno.env.get('VAPID_PUBLIC_KEY')?.trim();
   const privateKey = Deno.env.get('VAPID_PRIVATE_KEY')?.trim();
   const subject = Deno.env.get('VAPID_SUBJECT')?.trim() || 'mailto:support@moodeng.credit';

   if (!publicKey || !privateKey) {
      return null;
   }

   return { publicKey, privateKey, subject };
};

// The VAPID private key is a bare 32-byte scalar; WebCrypto wants a full JWK, so
// the x/y coordinates are lifted out of the matching uncompressed public key.
const importVapidSigningKey = async (keys: VapidKeys): Promise<CryptoKey> => {
   const publicKeyBytes = base64UrlToBytes(keys.publicKey);
   if (publicKeyBytes.length !== 65 || publicKeyBytes[0] !== 0x04) {
      throw new Error('VAPID_PUBLIC_KEY must be a 65-byte uncompressed P-256 point in base64url.');
   }

   const privateKeyBytes = base64UrlToBytes(keys.privateKey);
   if (privateKeyBytes.length !== 32) {
      throw new Error('VAPID_PRIVATE_KEY must be a 32-byte P-256 scalar in base64url.');
   }

   return crypto.subtle.importKey(
      'jwk',
      {
         kty: 'EC',
         crv: 'P-256',
         d: bytesToBase64Url(privateKeyBytes),
         x: bytesToBase64Url(publicKeyBytes.slice(1, 33)),
         y: bytesToBase64Url(publicKeyBytes.slice(33, 65)),
         ext: true
      },
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['sign']
   );
};

// One JWT per push-service origin. Cached for the life of the isolate so a
// fan-out to 200 lenders signs once per origin instead of 200 times.
const vapidTokenCache = new Map<string, { token: string; expiresAt: number }>();

const buildVapidAuthorization = async (endpoint: string, keys: VapidKeys): Promise<string> => {
   const audience = new URL(endpoint).origin;
   const now = Math.floor(Date.now() / 1000);
   const cached = vapidTokenCache.get(audience);

   if (cached && cached.expiresAt - now > 60) {
      return `vapid t=${cached.token}, k=${keys.publicKey}`;
   }

   const expiresAt = now + VAPID_TOKEN_TTL_SECONDS;
   const header = bytesToBase64Url(encoder.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
   const payload = bytesToBase64Url(encoder.encode(JSON.stringify({ aud: audience, exp: expiresAt, sub: keys.subject })));
   const signingInput = `${header}.${payload}`;

   const signingKey = await importVapidSigningKey(keys);
   // WebCrypto returns the raw r||s pair, which is exactly the JWS ES256 form.
   const signature = new Uint8Array(
      await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, signingKey, encoder.encode(signingInput))
   );

   const token = `${signingInput}.${bytesToBase64Url(signature)}`;
   vapidTokenCache.set(audience, { token, expiresAt });

   return `vapid t=${token}, k=${keys.publicKey}`;
};

// RFC 8291 §3.4: derive the content key from an ephemeral ECDH with the client's
// public key, then emit a single aes128gcm record (RFC 8188 §2).
const encryptPayload = async (subscription: PushSubscriptionKeys, payload: string): Promise<Uint8Array> => {
   const plaintext = encoder.encode(payload);
   if (plaintext.length > MAX_PAYLOAD_BYTES) {
      throw new Error(`Push payload is ${plaintext.length} bytes; the aes128gcm record holds at most ${MAX_PAYLOAD_BYTES}.`);
   }

   const clientPublicKey = base64UrlToBytes(subscription.p256dh);
   const clientAuthSecret = base64UrlToBytes(subscription.auth);

   const serverKeyPair = (await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, [
      'deriveBits'
   ])) as CryptoKeyPair;
   const serverPublicKey = new Uint8Array(await crypto.subtle.exportKey('raw', serverKeyPair.publicKey));

   const importedClientKey = await crypto.subtle.importKey(
      'raw',
      clientPublicKey,
      { name: 'ECDH', namedCurve: 'P-256' },
      false,
      []
   );
   const sharedSecret = new Uint8Array(
      await crypto.subtle.deriveBits({ name: 'ECDH', public: importedClientKey }, serverKeyPair.privateKey, 256)
   );

   const salt = crypto.getRandomValues(new Uint8Array(16));

   // IKM binds the shared secret to both parties' public keys, so a swapped key
   // yields a different CEK rather than a silently decryptable payload.
   const keyInfo = concatBytes(encoder.encode('WebPush: info\0'), clientPublicKey, serverPublicKey);
   const ikm = await hkdfExpand(await hmacSha256(clientAuthSecret, sharedSecret), keyInfo, 32);

   const prk = await hmacSha256(salt, ikm);
   const contentEncryptionKey = await hkdfExpand(prk, encoder.encode('Content-Encoding: aes128gcm\0'), 16);
   const nonce = await hkdfExpand(prk, encoder.encode('Content-Encoding: nonce\0'), 12);

   const aesKey = await crypto.subtle.importKey('raw', contentEncryptionKey, { name: 'AES-GCM' }, false, ['encrypt']);
   // 0x02 is the RFC 8188 delimiter marking this as the last (and only) record.
   const ciphertext = new Uint8Array(
      await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aesKey, concatBytes(plaintext, new Uint8Array([2])))
   );

   const recordSizeBytes = new Uint8Array(4);
   new DataView(recordSizeBytes.buffer).setUint32(0, RECORD_SIZE, false);

   return concatBytes(salt, recordSizeBytes, new Uint8Array([serverPublicKey.length]), serverPublicKey, ciphertext);
};

/**
 * Encrypts and delivers one push message. Never throws on a push-service error —
 * a single dead device must not abort a fan-out — but does throw on a
 * misconfigured VAPID key, which is an operator error worth surfacing loudly.
 */
export const sendWebPush = async (
   subscription: PushSubscriptionKeys,
   payload: string,
   options: { keys: VapidKeys; ttlSeconds?: number; urgency?: 'very-low' | 'low' | 'normal' | 'high' } = {
      keys: getVapidKeysFromEnv() as VapidKeys
   }
): Promise<WebPushResult> => {
   const { keys, ttlSeconds = 12 * 60 * 60, urgency = 'normal' } = options;

   if (!keys) {
      throw new Error('VAPID keys are not configured (VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY).');
   }

   const authorization = await buildVapidAuthorization(subscription.endpoint, keys);
   const body = await encryptPayload(subscription, payload);

   try {
      const response = await fetch(subscription.endpoint, {
         method: 'POST',
         headers: {
            Authorization: authorization,
            'Content-Encoding': 'aes128gcm',
            'Content-Type': 'application/octet-stream',
            TTL: String(ttlSeconds),
            Urgency: urgency
         },
         body
      });

      if (response.ok) {
         return { ok: true, status: response.status, expired: false };
      }

      // 404/410 mean the browser threw the subscription away (uninstall, cleared
      // site data, permission revoked). The row should go with it.
      const expired = response.status === 404 || response.status === 410;
      const error = await response.text().catch(() => '');

      return { ok: false, status: response.status, expired, error: error.slice(0, 300) };
   } catch (error) {
      return {
         ok: false,
         status: 0,
         expired: false,
         error: error instanceof Error ? error.message : String(error)
      };
   }
};
