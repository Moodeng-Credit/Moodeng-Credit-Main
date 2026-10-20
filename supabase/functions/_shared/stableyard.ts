// Stableyard partner API client (server-side only).
//
// Auth is HTTP Basic: username = STABLEYARD_APP_ID, password = STABLEYARD_APP_SECRET, both stored as
// edge-function secrets. Never send these to the browser, logs, or URLs.
//
// Integration flow (per Stableyard's production guide):
//   1. GET  /v2/partners/me                                  — verify credentials
//   2. POST /v2/accounts                                     — one Stableyard Account per user
//   3. POST /v2/accounts/{accountId}/wallets                 — link a wallet (optional)
//   4. POST /v2/accounts/{accountId}/settlement-profile      — settlement wallet (if required)
//   5. POST /v2/accounts/{accountId}/deposit-addresses       — persistent deposit address
//   6. GET  /v2/accounts/{accountId}/balances | /transactions
// Full request/response schemas: https://prod-api.stableyard.fi/v2/docs/partners

const DEFAULT_BASE_URL = 'https://prod-api.stableyard.fi';

export type StableyardResult<T = unknown> =
   | { ok: true; status: number; data: T }
   | { ok: false; status: number; error: string; data?: unknown };

const getAuthHeader = (): string | null => {
   const appId = Deno.env.get('STABLEYARD_APP_ID')?.trim();
   const appSecret = Deno.env.get('STABLEYARD_APP_SECRET')?.trim();
   if (!appId || !appSecret) return null;
   return `Basic ${btoa(`${appId}:${appSecret}`)}`;
};

export const isStableyardConfigured = () => getAuthHeader() !== null;

export const stableyardRequest = async <T = unknown>(
   method: 'GET' | 'POST',
   path: string,
   body?: Record<string, unknown>
): Promise<StableyardResult<T>> => {
   const authorization = getAuthHeader();
   if (!authorization) {
      return { ok: false, status: 500, error: 'STABLEYARD_APP_ID / STABLEYARD_APP_SECRET are not set' };
   }

   const baseUrl = (Deno.env.get('STABLEYARD_API_BASE') ?? DEFAULT_BASE_URL).replace(/\/+$/, '');
   let response: Response;
   try {
      response = await fetch(`${baseUrl}${path}`, {
         method,
         headers: {
            Authorization: authorization,
            Accept: 'application/json',
            ...(body ? { 'Content-Type': 'application/json' } : {})
         },
         body: body ? JSON.stringify(body) : undefined,
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
      const message =
         (data && typeof data === 'object' && ((data as Record<string, unknown>).message ?? (data as Record<string, unknown>).error)) ||
         response.statusText ||
         'Request failed';
      return { ok: false, status: response.status, error: String(message), data };
   }
   return { ok: true, status: response.status, data: data as T };
};

const accountPath = (accountId: string) => `/v2/accounts/${encodeURIComponent(accountId)}`;

export const stableyard = {
   partnersMe: () => stableyardRequest('GET', '/v2/partners/me'),
   createAccount: (body: Record<string, unknown>) => stableyardRequest('POST', '/v2/accounts', body),
   linkWallet: (accountId: string, body: Record<string, unknown>) => stableyardRequest('POST', `${accountPath(accountId)}/wallets`, body),
   setSettlementProfile: (accountId: string, body: Record<string, unknown>) =>
      stableyardRequest('POST', `${accountPath(accountId)}/settlement-profile`, body),
   createDepositAddress: (accountId: string, body: Record<string, unknown>) =>
      stableyardRequest('POST', `${accountPath(accountId)}/deposit-addresses`, body),
   getBalances: (accountId: string) => stableyardRequest('GET', `${accountPath(accountId)}/balances`),
   getTransactions: (accountId: string) => stableyardRequest('GET', `${accountPath(accountId)}/transactions`)
};
