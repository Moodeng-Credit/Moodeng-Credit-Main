// BitRepo originator vault watch (security-heartbeat, action "vault_watch", every 5 minutes).
//
// Our lending wallet holds OPERATOR_ROLE on BitRepo's OriginatorVault on Base, so anyone who got that wallet
// to sign could draw the vault's money to themselves. This check reads the vault's live state and compares it
// with the loans we recorded through Vault Lend (loans.vault_address):
//   - money out on the vault that no recorded Vault Lend loan accounts for → a draw we didn't make (critical,
//     raised only when it's still there on the next run, so the seconds between a real draw and its recording
//     never fire it)
//   - our cover going down → withdrawn or used on a write-off (high)
//   - the vault paused, or our wallet's draw permission gone → (high)
//   - normal activity (a draw or repayment of our own) → an info line in Discord #security
//
// It reads state (eth_call) rather than event logs on purpose: free Base RPC plans cap eth_getLogs to ranges
// too small to scan, or return nothing at all, which would make a log-based alarm silently blind.
//
// assessVault is pure (no Deno.* or npm: imports) so vitest covers it; the read is in vaultWatchRead.ts.

export const VAULT_ADDRESS = '0x1a59968e6B5E1c458B2Df429d2c111ed21E01443';
export const VAULT_URL = `https://app.bitrepo.xyz/originator-vaults/base/${VAULT_ADDRESS}`;
// Moodeng's lending wallet: the operator we expect to keep the draw permission.
export const VAULT_OPERATOR = '0xC1022456DFd3BF36af1dA553cd5631F9e76ca8D6';

export interface VaultSnapshot {
   principalOut: number; // USDC the vault has out on loans
   cover: number; // our first-loss USDC in the vault
   available: number; // what can be drawn right now
   paused: boolean;
   operatorCanDraw: boolean;
   recordedPrincipal: number; // principal still out on the loans we recorded via Vault Lend
   recordedLoans: number;
}

export interface VaultWatchState {
   snapshot: VaultSnapshot;
   // Unrecorded money out seen on this run (USDC). An alarm needs it on two runs in a row.
   unrecorded: number;
}

export interface VaultFinding {
   severity: 'critical' | 'high' | 'info';
   title: string;
   body: string;
}

const usd = (n: number) => `${n.toFixed(2)} USDC`;
// Half a cent of slack: on-chain amounts are whole USDC units, ours are rounded to cents.
const EPS = 0.005;

export function assessVault(now: VaultSnapshot, previous: VaultWatchState | null): { findings: VaultFinding[]; state: VaultWatchState } {
   const findings: VaultFinding[] = [];
   const unrecorded = Math.max(0, now.principalOut - now.recordedPrincipal);
   const facts = `Out: ${usd(now.principalOut)} (our recorded Vault Lend loans: ${usd(now.recordedPrincipal)} across ${now.recordedLoans}). Cover: ${usd(now.cover)}. Available to draw: ${usd(now.available)}.\n${VAULT_URL}`;

   if (unrecorded > EPS && (previous?.unrecorded ?? 0) > EPS) {
      findings.push({
         severity: 'critical',
         title: `Vault: ${usd(unrecorded)} drawn that matches no Moodeng loan`,
         body: `The BitRepo vault has more money out than every loan we recorded through Vault Lend. Someone may have drawn with our lending wallet outside the app, or a draw went to the wrong address. Ask Thomas (BitRepo) to pause the vault now, then check the vault's transactions.\n\n${facts}`
      });
   }

   if (previous && now.cover < previous.snapshot.cover - EPS) {
      findings.push({
         severity: 'high',
         title: `Vault: our cover dropped from ${usd(previous.snapshot.cover)} to ${usd(now.cover)}`,
         body: `Cover only goes down when our wallet withdraws it or BitRepo writes off a loan. If neither of us did this, ask Thomas to pause the vault.\n\n${facts}`
      });
   }

   if (now.paused && !previous?.snapshot.paused) {
      findings.push({
         severity: 'high',
         title: 'Vault: BitRepo paused draws',
         body: `Vault Lend won't work until BitRepo unpauses it.\n\n${facts}`
      });
   }

   if (!now.operatorCanDraw && (previous?.snapshot.operatorCanDraw ?? true)) {
      findings.push({
         severity: 'high',
         title: 'Vault: our lending wallet lost its draw permission',
         body: `BitRepo removed OPERATOR_ROLE from ${VAULT_OPERATOR}. Vault Lend won't work until it's granted again.\n\n${facts}`
      });
   }

   // Our own draws and repayments: one quiet line whenever the money out changes.
   if (previous && Math.abs(now.principalOut - previous.snapshot.principalOut) > EPS && findings.length === 0) {
      const delta = now.principalOut - previous.snapshot.principalOut;
      findings.push({
         severity: 'info',
         title: delta > 0 ? `Vault: ${usd(delta)} lent` : `Vault: ${usd(-delta)} of principal repaid`,
         body: facts
      });
   }

   return { findings, state: { snapshot: now, unrecorded } };
}
