// Formatting for fraud-scan alerts, shared by the email and Telegram channels of
// the fraud-signal-scan edge function. Pure (no Deno APIs) so vitest can cover it.

export type FraudSignal = {
   type: string;
   severity: string;
   wallet_address?: string;
   account_count?: number;
   borrower_and_lender?: boolean;
   accounts?: Array<{ user_id: string; role?: string; email?: string; username?: string; loan_id?: string }>;
   loan_id?: string;
   tracking_id?: string;
   wallet?: string;
   user_id?: string;
   username?: string;
   asn_org?: string;
   hosting_logins?: number;
   location_a?: string;
   location_b?: string;
   distance_km?: number;
   hours_apart?: number;
   subnet_hash?: string;
   borrower_user_id?: string;
   borrower_username?: string;
   lender_user_id?: string;
   lender_username?: string;
   shared_ip_count?: number;
   // Embedded-wallet face gate (scan_wallet_face_signals).
   user_role?: string;
   stuck_count?: number;
   // Follow-the-money convergence (scan_payout_convergence).
   terminal_destination?: string;
   destination_label?: string;
   is_exchange_deposit?: boolean;
   details?: Record<string, unknown>;
};

export const describeFraudSignal = (s: FraudSignal): string => {
   switch (s.type) {
      case 'shared_wallet':
         return `Same wallet on ${s.account_count} accounts${s.borrower_and_lender ? ' — INCLUDING a borrower AND a lender' : ''}\n  wallet: ${s.wallet_address}\n  accounts: ${(s.accounts ?? [])
            .map((a) => `${a.username ?? a.user_id} (${a.role}, ${a.email ?? 'no email'})`)
            .join('; ')}`;
      case 'self_deal_wallet':
         return `Self-deal — loan ${s.tracking_id ?? s.loan_id} has the same wallet on both sides\n  wallet: ${s.wallet}`;
      case 'counterparty_shared_wallet':
         return `Loan ${s.tracking_id ?? s.loan_id}: lender & borrower share a wallet in their history\n  wallet: ${s.wallet}`;
      case 'counterparty_shared_ip':
         return `Loan ${s.tracking_id ?? s.loan_id}: lender & borrower logged in from the same IP`;
      case 'cross_role_shared_ip':
         return `Borrower ${s.borrower_username ?? s.borrower_user_id} and lender ${s.lender_username ?? s.lender_user_id} log in from the same IP (${s.shared_ip_count ?? 1} shared IP(s), no loan required) — possible self-lending setup`;
      case 'datacenter_ip':
         return `${s.username ?? s.user_id} logged in from a datacenter/hosting IP (${s.asn_org}) — ${s.hosting_logins} time(s)`;
      case 'impossible_travel':
         return `${s.username ?? s.user_id} impossible travel: ${s.location_a} → ${s.location_b} (${s.distance_km} km in ${s.hours_apart} h)`;
      case 'subnet_cluster':
         return `${s.account_count} accounts from the same network block${s.asn_org ? ` (${s.asn_org})` : ''}\n  accounts: ${(s.accounts ?? [])
            .map((a) => `${a.username ?? a.user_id} (${a.role})`)
            .join('; ')}`;
      // --- Embedded-wallet face gate ---
      case 'embedded_wallet_face_collision':
         return `Instant wallet REFUSED — this face is already enrolled on another account${
            s.borrower_and_lender ? ' — INCLUDING a borrower AND a lender (one person on both sides)' : ''
         }\n  user: ${s.user_id} (${s.user_role ?? 'unknown role'})\n  matched: ${JSON.stringify(
            (s.details as { matched_accounts?: unknown } | undefined)?.matched_accounts ?? []
         )}`;
      case 'wallet_face_unverified_self_match':
         return `Instant wallet allowed, but the scan did not confirm the account's own enrolled face\n  user: ${s.user_id} (${s.user_role ?? 'unknown role'}) — informational; review only if takeover is suspected`;
      case 'embedded_wallet_grant_stuck':
         return `${s.stuck_count} instant wallet grant(s) claimed but never completed — users may have scanned and received no wallet. Check Openfort Shield health.`;
      // --- Follow-the-money convergence ---
      case 'shared_payout_destination': {
         const dest = s.destination_label ? `${s.destination_label} (${s.terminal_destination})` : s.terminal_destination;
         const who = (s.accounts ?? [])
            .map((a) => `${a.username ?? a.user_id}${a.loan_id ? ` [loan ${a.loan_id}]` : ''}`)
            .join('; ');
         return `${s.account_count} borrower accounts' loans all cashed out to the SAME destination${
            s.is_exchange_deposit ? ' (exchange deposit)' : ''
         } — one beneficiary behind multiple borrowers\n  destination: ${dest}\n  borrowers: ${who}`;
      }
      case 'fast_offramp':
         return `Loan ${s.loan_id} cashed out to ${s.destination_label ?? 'an exchange'} ${s.hours_apart}h after funding — bust-out speed (borrower ${s.username ?? s.user_id})`;
      default:
         return `${s.type}: ${JSON.stringify(s)}`;
   }
};

export type FraudAlertMessage = {
   subject: string;
   text: string;
   // Split fields for the unified dispatcher (_shared/securityAlerts.ts): a one-line
   // `title` (no emoji — the dispatcher adds it) and the `detail` body without the
   // legacy 🚨 header, so routing through the dispatcher doesn't double the header.
   title: string;
   detail: string;
   criticalCount: number;
   warningCount: number;
};

// Critical findings (borrower+lender sharing a wallet, self-deals, counterparty
// overlap) lead; weaker IP-only signals follow.
export const buildFraudAlertMessage = (signals: FraudSignal[]): FraudAlertMessage => {
   const critical = signals.filter((s) => s.severity === 'critical');
   const warnings = signals.filter((s) => s.severity !== 'critical');

   // The detail body (everything below the header): the critical block, the
   // "worth a look" block, then the standing disclaimer.
   const detailLines: string[] = [];
   if (critical.length) {
      detailLines.push(`CRITICAL (${critical.length}):`);
      critical.forEach((s, i) => detailLines.push(`${i + 1}. ${describeFraudSignal(s)}`));
      detailLines.push('');
   }
   if (warnings.length) {
      detailLines.push(`Worth a look (${warnings.length}):`);
      warnings.forEach((s, i) => detailLines.push(`${i + 1}. ${describeFraudSignal(s)}`));
   }
   detailLines.push('');
   detailLines.push('These are detection signals, not proof — review before acting. Already-seen findings are suppressed, so each only alerts once.');

   const header = `🚨 Moodeng fraud scan — ${signals.length} new signal(s).`;
   const detail = detailLines.join('\n');

   return {
      subject: `🚨 Moodeng fraud scan: ${critical.length} critical, ${warnings.length} to review`,
      // Preserved verbatim: header, one blank line, then the detail body.
      text: `${header}\n\n${detail}`,
      title: `${signals.length} new signal(s) — ${critical.length} critical, ${warnings.length} to review`,
      detail,
      criticalCount: critical.length,
      warningCount: warnings.length
   };
};
