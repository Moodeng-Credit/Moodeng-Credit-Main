// Formatting for fraud-scan alerts, shared by the email and Telegram channels of
// the fraud-signal-scan edge function. Pure (no Deno APIs) so vitest can cover it.

export type FraudSignal = {
   type: string;
   severity: string;
   wallet_address?: string;
   account_count?: number;
   borrower_and_lender?: boolean;
   accounts?: Array<{ user_id: string; role: string; email?: string; username?: string }>;
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
      default:
         return `${s.type}: ${JSON.stringify(s)}`;
   }
};

export type FraudAlertMessage = {
   subject: string;
   text: string;
   criticalCount: number;
   warningCount: number;
};

// Critical findings (borrower+lender sharing a wallet, self-deals, counterparty
// overlap) lead; weaker IP-only signals follow.
export const buildFraudAlertMessage = (signals: FraudSignal[]): FraudAlertMessage => {
   const critical = signals.filter((s) => s.severity === 'critical');
   const warnings = signals.filter((s) => s.severity !== 'critical');

   const lines: string[] = [];
   lines.push(`🚨 Moodeng fraud scan — ${signals.length} new signal(s).`);
   lines.push('');
   if (critical.length) {
      lines.push(`CRITICAL (${critical.length}):`);
      critical.forEach((s, i) => lines.push(`${i + 1}. ${describeFraudSignal(s)}`));
      lines.push('');
   }
   if (warnings.length) {
      lines.push(`Worth a look (${warnings.length}):`);
      warnings.forEach((s, i) => lines.push(`${i + 1}. ${describeFraudSignal(s)}`));
   }
   lines.push('');
   lines.push('These are detection signals, not proof — review before acting. Already-seen findings are suppressed, so each only alerts once.');

   return {
      subject: `🚨 Moodeng fraud scan: ${critical.length} critical, ${warnings.length} to review`,
      text: lines.join('\n'),
      criticalCount: critical.length,
      warningCount: warnings.length
   };
};
