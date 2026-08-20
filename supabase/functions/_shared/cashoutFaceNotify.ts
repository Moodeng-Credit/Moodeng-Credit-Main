// Delivery for the first-cash-out face gate's MISMATCH verdict — the actual incident signal
// (see migration 20260820100000_cashout_face_gate.sql). Two channels:
//
//   - Telegram: routes through deliverSecurityAlert (source: 'kyc'), the SAME ops group every
//     other KYC/fraud alert already reaches (fraud_alert_chat_id, seeded from the KYC group) —
//     no new Telegram configuration needed.
//   - Discord: DISCORD_KYC_WEBHOOK_URL for a dedicated KYC channel, since this is a
//     face-identity verdict rather than the device/network signals the existing channels carry.
//     Falls back to DISCORD_SECURITY_WEBHOOK_URL when that isn't set, so the alert lands
//     SOMEWHERE a human looks instead of silently going nowhere — point it at its own channel
//     later by setting the KYC secret.
//
// Both are best-effort: a delivery failure must never block the refusal itself, which is already
// persisted in cashout_face_checks + fraud_signal_alerts before this is called.

import { deliverSecurityAlert } from './securityAlerts.ts';

// deno-lint-ignore no-explicit-any
type NotifySupabase = { from: (table: string) => any };

export type CashoutFaceMismatchDetails = {
   userId: string;
   username?: string | null;
   email?: string | null;
   loanId?: string | null;
   destinationAddress: string;
   amount: number;
   matchScore: number | null;
   matchedUserId?: string | null;
   matchedUsername?: string | null;
};

const formatMismatchBody = (d: CashoutFaceMismatchDetails): string => {
   const lines = [
      `Account: ${d.username ?? d.userId}${d.email ? ` (${d.email})` : ''}`,
      `Loan: ${d.loanId ?? 'unknown'}`,
      `Attempted destination: ${d.destinationAddress}`,
      `Amount: ${d.amount} USDC`,
      `Match score vs KYC portrait: ${d.matchScore ?? 'n/a'} (threshold 80)`
   ];
   if (d.matchedUserId) {
      lines.push(`⚠️ Face matches ANOTHER Moodeng account: ${d.matchedUsername ?? d.matchedUserId}`);
   }
   lines.push('Cash-out held. Review in admin → Fraud Alert Queue.');
   return lines.join('\n');
};

const postDiscordKycAlert = async (title: string, body: string): Promise<void> => {
   const webhook = Deno.env.get('DISCORD_KYC_WEBHOOK_URL') || Deno.env.get('DISCORD_SECURITY_WEBHOOK_URL');
   if (!webhook) return;
   try {
      await fetch(webhook, {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({
            embeds: [
               {
                  title,
                  description: body,
                  color: 0xe74c3c
               }
            ]
         })
      });
   } catch (err) {
      console.error('[cashoutFaceNotify] Discord KYC webhook failed:', err instanceof Error ? err.message : err);
   }
};

/**
 * Fire the mismatch alert on both channels. Never throws — the caller has already persisted the
 * refusal; this is purely "tell a human right now".
 */
export const notifyCashoutFaceMismatch = async (
   supabase: NotifySupabase,
   details: CashoutFaceMismatchDetails
): Promise<void> => {
   const title = '🔴 Cash-out face check MISMATCH — held';
   const body = formatMismatchBody(details);

   await Promise.all([
      deliverSecurityAlert(supabase, {
         source: 'kyc',
         severity: 'critical',
         title: 'Cash-out face mismatch — held',
         body
      }),
      postDiscordKycAlert(title, body)
   ]);
};

/** Informational — no reference portrait existed, so the attempt was blocked for manual review. */
export const notifyCashoutFaceBlocked = async (
   supabase: NotifySupabase,
   details: Pick<CashoutFaceMismatchDetails, 'userId' | 'username' | 'email' | 'loanId' | 'destinationAddress' | 'amount'>
): Promise<void> => {
   const title = '🟠 Cash-out face check BLOCKED — no reference face on file';
   const body = [
      `Account: ${details.username ?? details.userId}${details.email ? ` (${details.email})` : ''}`,
      `Loan: ${details.loanId ?? 'unknown'}`,
      `Attempted destination: ${details.destinationAddress}`,
      `Amount: ${details.amount} USDC`,
      'No usable KYC reference portrait — held for manual review rather than allowing self-enrollment at the gate.'
   ].join('\n');

   await Promise.all([
      deliverSecurityAlert(supabase, { source: 'kyc', severity: 'high', title: 'Cash-out face check blocked — no reference', body }),
      postDiscordKycAlert(title, body)
   ]);
};
