// Stableyard partner API client (server-side only).
//
// Auth is HTTP Basic: username = STABLEYARD_APP_ID, password = STABLEYARD_APP_SECRET, both stored as
// edge-function secrets. Never send these to the browser, logs, or URLs.
//
// Integration flow (docs: https://docs.stableyard.fi, OpenAPI: https://docs.stableyard.fi/openapi.json):
//   1. GET  /v2/partners/config                              — verify credentials + read what's enabled
//   2. POST /v2/accounts                                     — one Universal Payment Account per user
//      (with the user's wallet as the preferred settlement wallet, so deposits can be issued)
//   3. POST /v2/accounts/{accountId}/wallets                 — link a wallet later (optional)
//   4. PUT  /v2/accounts/{accountId}/settlement-profile      — change the settlement destination
//   5. POST /v2/accounts/{accountId}/deposit-addresses       — persistent deposit address per chain
//   6. GET  /v2/accounts/{accountId}/deposits | /balances | /transactions
// Deposit lifecycle events arrive at the stableyard-webhook function (HMAC-signed, see
// verifyStableyardWebhook below). Credit a deposit only once it is `settled`.
//
// Note: Stableyard's onboarding email says "GET /v2/partners/me" — that route returns 404. The
// credential check is /v2/partners/config.

const DEFAULT_BASE_URL = 'https://prod-api.stableyard.fi';

export type StableyardResult<T = unknown> =
   | { ok: true; status: number; data: T }
   | { ok: false; status: number; error: string; code?: string; requestId?: string; data?: unknown };

const getAuthHeader = (): string | null => {
   const appId = Deno.env.get('STABLEYARD_APP_ID')?.trim();
   const appSecret = Deno.env.get('STABLEYARD_APP_SECRET')?.trim();
   if (!appId || !appSecret) return null;
   return `Basic ${btoa(`${appId}:${appSecret}`)}`;
};

export const isStableyardConfigured = () => getAuthHeader() !== null;

type RequestOptions = { body?: unknown; idempotencyKey?: string; query?: Record<string, string | number | undefined> };

export const stableyardRequest = async <T = unknown>(
   method: 'GET' | 'POST' | 'PUT',
   path: string,
   { body, idempotencyKey, query }: RequestOptions = {}
): Promise<StableyardResult<T>> => {
   const authorization = getAuthHeader();
   if (!authorization) {
      return { ok: false, status: 500, error: 'STABLEYARD_APP_ID / STABLEYARD_APP_SECRET are not set' };
   }

   const baseUrl = (Deno.env.get('STABLEYARD_API_BASE') ?? DEFAULT_BASE_URL).replace(/\/+$/, '');
   const search = new URLSearchParams();
   for (const [key, value] of Object.entries(query ?? {})) {
      if (value !== undefined && value !== '') search.set(key, String(value));
   }
   const qs = search.toString();
   const url = `${baseUrl}${path}${qs ? `?${qs}` : ''}`;

   let response: Response;
   try {
      response = await fetch(url, {
         method,
         headers: {
            Authorization: authorization,
            Accept: 'application/json',
            ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
            ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey.slice(0, 128) } : {})
         },
         body: body !== undefined ? JSON.stringify(body) : undefined,
         signal: AbortSignal.timeout(15_000)
      });
   } catch (error) {
      return { ok: false, status: 502, error: `Stableyard unreachable: ${(error as Error).message}` };
   }

   const text = await response.text();
   let data: unknown = text;
   try {
      data = text ? JSON.parse(text) : null;
   } catch {
      // Non-JSON body (e.g. a gateway error page) — keep the raw text.
   }

   if (!response.ok) {
      // Stableyard errors look like { error: { code, message, details } }.
      const envelope = data && typeof data === 'object' ? (data as Record<string, unknown>).error : null;
      const code = envelope && typeof envelope === 'object' ? (envelope as { code?: string }).code : undefined;
      // Stableyard support asks for the request ID with any failure report.
      const requestId =
         response.headers.get('x-request-id') ??
         response.headers.get('request-id') ??
         (envelope && typeof envelope === 'object' ? (envelope as { requestId?: string }).requestId : undefined) ??
         undefined;
      const message =
         (envelope && typeof envelope === 'object'
            ? (envelope as { message?: string }).message
            : typeof envelope === 'string'
              ? envelope
              : null) ||
         response.statusText ||
         'Request failed';
      return { ok: false, status: response.status, error: String(message), code, requestId, data };
   }
   return { ok: true, status: response.status, data: data as T };
};

// ---- Response shapes we read (subset of the OpenAPI schemas) ------------------------------------

export type StableyardAsset = { chainId: number; tokenAddress: string; symbol: string; decimals: number; kind?: string };

export type StableyardAccount = { id: string; externalUserId: string; status: string };

export type StableyardDepositAddress = {
   id: string;
   accountId: string;
   chainId: number;
   address: string;
   supportedAssets: StableyardAsset[];
   metadata?: { networkCode?: string; chainFamily?: string };
   status: 'active' | 'disabled';
};

export type StableyardDeposit = {
   id: string;
   accountId: string;
   depositAddressId: string;
   status: string;
   amount: { asset: StableyardAsset; amount: string };
   sourceTransfer?: { txHash: string | null; fromAddress?: string | null };
   netSettlementAmount?: { asset: StableyardAsset; amount: string } | null;
   settlement?: { status: string; txHash: string | null; settledAt: string | null; reasonCode?: string };
   txHash?: string | null;
   observedAt?: string | null;
   settledAt?: string | null;
   createdAt?: string;
};

export type StableyardDepositNetwork = {
   code: string;
   chainId: number;
   chainFamily: string;
   live: boolean;
   supportedAssets: Array<StableyardAsset & { minimumDeposit?: { amount: string } | string | null }>;
};

const accountPath = (accountId: string) => `/v2/accounts/${encodeURIComponent(accountId)}`;

export const stableyard = {
   partnerConfig: () => stableyardRequest<Record<string, unknown>>('GET', '/v2/partners/config'),
   depositNetworks: () =>
      stableyardRequest<{ networks?: StableyardDepositNetwork[] } | StableyardDepositNetwork[]>('GET', '/v2/deposit-networks'),

   createAccount: (body: Record<string, unknown>, idempotencyKey: string) =>
      stableyardRequest<{ account: StableyardAccount }>('POST', '/v2/accounts', { body, idempotencyKey }),
   getAccountByExternalId: (externalUserId: string) =>
      stableyardRequest<{ account: StableyardAccount } | StableyardAccount>(
         'GET',
         `/v2/accounts/external/${encodeURIComponent(externalUserId)}`
      ),
   linkWallets: (accountId: string, wallets: Array<Record<string, unknown>>) =>
      stableyardRequest('POST', `${accountPath(accountId)}/wallets`, { body: { wallets } }),
   setSettlementProfile: (accountId: string, body: Record<string, unknown>) =>
      stableyardRequest('PUT', `${accountPath(accountId)}/settlement-profile`, { body }),

   createDepositAddresses: (accountId: string, chainIds: number[], idempotencyKey?: string) =>
      stableyardRequest<{ accountId: string; depositAddresses: StableyardDepositAddress[] }>(
         'POST',
         `${accountPath(accountId)}/deposit-addresses`,
         { body: { chainIds }, idempotencyKey }
      ),
   listDepositAddresses: (accountId: string) =>
      stableyardRequest<{ depositAddresses: StableyardDepositAddress[] }>('GET', `${accountPath(accountId)}/deposit-addresses`, {
         query: { status: 'active', limit: 100 }
      }),
   listDeposits: (accountId: string, cursor?: string) =>
      stableyardRequest<{ deposits: StableyardDeposit[]; nextCursor?: string }>('GET', `${accountPath(accountId)}/deposits`, {
         query: { limit: 100, cursor }
      }),
   checkDeposit: (accountId: string, body: { chainId: number; depositAddress: string; transactionHash: string }) =>
      stableyardRequest<Record<string, unknown>>('POST', `${accountPath(accountId)}/deposit-addresses/check`, { body }),

   // Account-owner onboarding for fiat rails (QR payments): verify the UPA email, then KYC.
   getEmailStatus: (accountId: string) => stableyardRequest('GET', `${accountPath(accountId)}/email`),
   startEmailVerification: (accountId: string, email: string) =>
      stableyardRequest('POST', `${accountPath(accountId)}/email/verification-challenges`, { body: { email } }),
   confirmEmailVerification: (accountId: string, challengeId: string, code: string) =>
      stableyardRequest('POST', `${accountPath(accountId)}/email/verification-challenges/${encodeURIComponent(challengeId)}/confirm`, {
         body: { code }
      }),
   getKyc: (accountId: string) => stableyardRequest('GET', `${accountPath(accountId)}/kyc`),
   startKycSession: (accountId: string) => stableyardRequest('POST', `${accountPath(accountId)}/kyc/session`),

   getBalances: (accountId: string) => stableyardRequest('GET', `${accountPath(accountId)}/balances`),
   getTransactions: (accountId: string) => stableyardRequest('GET', `${accountPath(accountId)}/transactions`)
};

// ---- Webhook signature verification --------------------------------------------------------------
// x-stableyard-signature: t=<timestamp>,v1=<hex hmac-sha256>
// signed payload: `${timestamp}.${deliveryId}.${eventId}.${rawBody}`, keyed by the endpoint's whsec_ secret.

const MAX_TIMESTAMP_SKEW_SECONDS = 300;

const timingSafeEqualHex = (a: string, b: string) => {
   if (a.length !== b.length) return false;
   let diff = 0;
   for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
   return diff === 0;
};

export const hmacSha256Hex = async (secret: string, message: string) => {
   const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
   const digest = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
   return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
};

export type VerifiedStableyardWebhook = { deliveryId: string; eventId: string; eventName: string; timestamp: number };

export const verifyStableyardWebhook = async (
   rawBody: string,
   headers: Headers,
   signingSecret: string,
   nowSeconds = Math.floor(Date.now() / 1000)
): Promise<VerifiedStableyardWebhook> => {
   const signature = headers.get('x-stableyard-signature') ?? '';
   const timestampHeader = headers.get('x-stableyard-timestamp') ?? '';
   const deliveryId = headers.get('x-stableyard-delivery') ?? '';
   const eventId = headers.get('x-stableyard-event-id') ?? '';
   const eventName = headers.get('x-stableyard-event') ?? '';
   if (!signature || !timestampHeader || !deliveryId || !eventId) throw new Error('Missing Stableyard signature headers');

   const match = /^t=(\d+),v1=([a-f0-9]{64})$/i.exec(signature.trim());
   if (!match) throw new Error('Malformed webhook signature');
   const [, signedTimestamp, providedHex] = match;
   if (signedTimestamp !== timestampHeader) throw new Error('Webhook timestamp mismatch');

   const timestamp = Number(signedTimestamp);
   if (!Number.isSafeInteger(timestamp) || Math.abs(nowSeconds - timestamp) > MAX_TIMESTAMP_SKEW_SECONDS) {
      throw new Error('Webhook timestamp outside tolerance');
   }

   const expectedHex = await hmacSha256Hex(signingSecret, `${signedTimestamp}.${deliveryId}.${eventId}.${rawBody}`);
   if (!timingSafeEqualHex(expectedHex, providedHex.toLowerCase())) throw new Error('Invalid webhook signature');

   return { deliveryId, eventId, eventName, timestamp };
};
