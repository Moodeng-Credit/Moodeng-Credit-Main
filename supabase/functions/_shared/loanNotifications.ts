export type LoanNotificationType = 'funded' | 'urgent_reminder' | 'final_reminder' | 'weekly_digest' | 'overdue' | 'repayment_received';

export type LoanNotificationLoan = {
   tracking_id: string;
   loan_amount: number;
   total_repayment_amount: number;
   repaid_amount?: number | null;
   due_date: string | null;
   funded_at: string | null;
   borrower_user_id: string | null;
   lender_user_id: string | null;
   repayment_status?: string | null;
   updated_at?: string | null;
   borrower_username?: string | null;
   lender_username?: string | null;
};

export type LoanNotificationRecipient = {
   username: string | null;
   telegram_username?: string | null;
   email?: string | null;
   chat_id?: number | string | null;
   trust_points_total?: number | string | null;
   trust_points_reward?: number | string | null;
   trust_points_reward_kind?: 'potential' | 'earned';
};

export type LoanNotificationAggregate = {
   count: number;
   totalAmount: number;
   dueLabel?: string;
   nextDueDate?: string | null;
};

type DetailTone = 'default' | 'good' | 'warn';

type DetailRow = {
   label: string;
   value: string;
   icon?: string;
   tone?: DetailTone;
};

type EmailContent = {
   subject: string;
   title: string;
   intro: string;
   amountLabel: string;
   amountValue: string;
   details: DetailRow[];
   highlightTitle: string;
   highlightCopy: string;
   highlightValue: string;
   ctaLabel: string;
   ctaHref: string;
   supportText: string;
   telegramText: string;
   text: string;
};

const toNumber = (value: number | string | null | undefined) => {
   const numberValue = Number(value ?? 0);
   return Number.isFinite(numberValue) ? numberValue : 0;
};

export const getLoanOutstandingAmount = (loan: Pick<LoanNotificationLoan, 'total_repayment_amount' | 'repaid_amount'>) =>
   Math.max(0, toNumber(loan.total_repayment_amount) - toNumber(loan.repaid_amount));

const formatCurrency = (amount: number) =>
   new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 2
   }).format(toNumber(amount));

const formatUsdcAmount = (amount: number) => `${formatCurrency(amount)} USDC`;

const formatTrustPoints = (pointsTotal: number | string | null | undefined) => {
   const points = Number(pointsTotal ?? 0) / 1_000_000;
   const formattedPoints = new Intl.NumberFormat('en-US', {
      maximumFractionDigits: points % 1 === 0 ? 0 : 1
   }).format(Number.isFinite(points) ? points : 0);

   return `${formattedPoints} pts`;
};

const formatDate = (dateValue: string | null) => {
   if (!dateValue) {
      return 'N/A';
   }

   const parsedDate = new Date(dateValue);
   if (Number.isNaN(parsedDate.getTime())) {
      return 'N/A';
   }

   return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
      timeZone: 'UTC',
      timeZoneName: 'short'
   }).format(parsedDate);
};

const getEnvValue = (key: string) => {
   if (typeof Deno !== 'undefined' && 'env' in Deno) {
      return Deno.env.get(key);
   }

   if (typeof process !== 'undefined' && process.env) {
      return process.env[key];
   }

   return undefined;
};

const getConfiguredUrl = (key: string) => {
   const value = getEnvValue(key);
   return value && /^https?:\/\//.test(value) ? value : undefined;
};

const getSiteUrl = () => {
   const configuredUrl = getConfiguredUrl('VITE_SITE_URL') ?? getConfiguredUrl('MOODENG_APP_URL') ?? 'https://dashboard.moodeng.app';
   return configuredUrl.replace(/\/$/, '');
};

const buildAppLink = (path: string) => `${getSiteUrl()}${path.startsWith('/') ? path : `/${path}`}`;

const buildDashboardLink = () => buildAppLink('/dashboard');

const buildRepayLink = () => buildAppLink('/repay');

const buildHeroImageUrl = () => getConfiguredUrl('MOODENG_EMAIL_HIPPO_URL') ?? `${getSiteUrl()}/hippos/hippo-purple-envelope-email.png`;

const telegramUrl = 'https://t.me/jimmymoodengcredit';
const facebookUrl = 'https://www.facebook.com/profile.php?id=61589106561061';

const escapeHtml = (value: string | number) =>
   String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const normalizeNotificationText = (text: string) =>
   text
      .replace(/\r\n/g, '\n')
      .replace(/\n[ \t]*\n+/g, '\n')
      .replace(/[ \t]+\n/g, '\n')
      .trimEnd();

const formatLoanCount = (count: number) => `${count} ${count === 1 ? 'loan' : 'loans'}`;

const getRecipientName = (recipient: LoanNotificationRecipient) => recipient.username?.trim() || 'there';

const getTelegramRecipientName = (recipient: LoanNotificationRecipient) => {
   const username = (recipient.telegram_username ?? recipient.username)?.trim().replace(/^@/, '');
   return username ? `@${username}` : getRecipientName(recipient);
};

const getRecipientTrustPointReward = (recipient: LoanNotificationRecipient) => {
   const reward = toNumber(recipient.trust_points_reward);
   if (reward <= 0) {
      return null;
   }

   return `+${formatTrustPoints(recipient.trust_points_reward)}`;
};

const buildTrustPointHighlight = (
   recipient: LoanNotificationRecipient,
   copy: {
      potential: string;
      earned?: string;
      fallback: string;
      fallbackValue?: string;
   }
) => {
   const reward = getRecipientTrustPointReward(recipient);
   const isEarnedReward = recipient.trust_points_reward_kind === 'earned';

   if (reward) {
      return {
         title: isEarnedReward ? 'Trust points earned' : 'Trust point opportunity',
         copy: isEarnedReward ? (copy.earned ?? 'This action unlocked eligible milestones.') : copy.potential,
         value: reward,
         textLine: `${isEarnedReward ? 'Trust points earned' : 'Trust point opportunity'}: ${reward}. ${
            isEarnedReward ? (copy.earned ?? 'This action unlocked eligible milestones.') : copy.potential
         }`
      };
   }

   return {
      title: 'Trust points',
      copy: copy.fallback,
      value: copy.fallbackValue ?? 'Review',
      textLine: `Trust point note: ${copy.fallback}`
   };
};

const toneStyles = {
   default: {
      bg: '#f5ecff',
      color: '#6010d2'
   },
   good: {
      bg: '#d9f7e5',
      color: '#148240'
   },
   warn: {
      bg: '#fff2c8',
      color: '#9a6700'
   }
};

const emailFontFamily = "-apple-system,BlinkMacSystemFont,'SF Pro','SF Pro Display','SF Pro Text','Segoe UI',Roboto,Arial,sans-serif";
const emailRegularWeight = 400;
const emailMediumWeight = 500;
const emailSemiboldWeight = 590;
const emailTightTracking = 0;
const emailBodyTracking = 0;
const emailFooterSize = 12;
const emailHelperSize = 13;
const emailLabelSize = 14;
const emailActionSize = 16;
const emailAmountSize = 14;
const emailTitleSize = 24;

const getUsdcAmountParts = (amountValue: string) => {
   const usdcSuffix = ' USDC';

   if (!amountValue.endsWith(usdcSuffix)) {
      return {
         isUsdc: false,
         numericValue: amountValue
      };
   }

   return {
      isUsdc: true,
      numericValue: amountValue.slice(0, -usdcSuffix.length)
   };
};

const renderUsdcToken = () =>
   `<span class="moodeng-usdc-icon" style="display:inline-block;width:14px;height:14px;margin-right:4px;border:1.25px solid #fdfcfd;border-radius:999px;color:#fdfcfd;font-size:8px;line-height:13px;text-align:center;vertical-align:-2px;">$</span>USDC`;

const renderDetailRows = (rows: DetailRow[]) =>
   rows
      .map((row, index) => {
         const tone = toneStyles[row.tone ?? 'default'];
         const borderTop = index === 0 ? '' : 'border-top:1px solid #e4d8f0;';

         return `<tr>
                  <td style="${borderTop}padding:8px 0;width:32px;vertical-align:middle;">
                    <span style="display:inline-block;width:24px;height:24px;border-radius:999px;background:${tone.bg};color:${tone.color};font-size:${emailFooterSize}px;line-height:24px;font-weight:${emailSemiboldWeight};text-align:center;">${row.icon ?? '&bull;'}</span>
                  </td>
                  <td style="${borderTop}padding:8px 8px 8px 0;color:#100733;font-size:${emailLabelSize}px;line-height:19px;font-weight:${emailMediumWeight};letter-spacing:${emailBodyTracking};">${escapeHtml(row.label)}</td>
                  <td style="${borderTop}padding:8px 0;color:${tone.color};font-size:${emailLabelSize}px;line-height:19px;font-weight:${emailMediumWeight};letter-spacing:${emailBodyTracking};text-align:right;white-space:nowrap;">${escapeHtml(row.value)}</td>
                </tr>`;
      })
      .join('');

const buildTelegramLink = (text: string) => `${telegramUrl}?text=${encodeURIComponent(text)}`;

const buildLoanEmailHtml = (content: EmailContent, recipient: LoanNotificationRecipient) => {
   const heroImageUrl = buildHeroImageUrl();
   const name = getRecipientName(recipient);
   const amountParts = getUsdcAmountParts(content.amountValue);
   const amountLineColspan = amountParts.isUsdc ? '' : ' colspan="2"';
   const amountTokenCell = amountParts.isUsdc
      ? `<td align="center" class="moodeng-usdc-cell" style="width:68px;padding:0 8px;border-left:1px solid rgba(28,5,61,0.16);border-radius:0 11px 11px 0;background:#2775ca;color:#fdfcfd;font-size:${emailHelperSize}px;line-height:20px;font-weight:${emailMediumWeight};letter-spacing:0;white-space:nowrap;">${renderUsdcToken()}</td>`
      : '';
   return `<div style="margin:0;padding:0;background:#f9f8fa;font-family:${emailFontFamily};color:#100733;-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility;">
  <style>
    @media only screen and (max-width:480px) {
      .moodeng-shell { padding:8px !important; }
      .moodeng-email { max-width:430px !important; }
      .moodeng-body { padding:16px !important; }
      .moodeng-title { font-size:${emailTitleSize}px !important; line-height:27px !important; }
      .moodeng-hero-img { width:126px !important; max-width:126px !important; }
      .moodeng-amount-value { font-size:${emailAmountSize}px !important; line-height:24px !important; }
      .moodeng-usdc-cell { width:66px !important; padding:0 8px !important; font-size:${emailHelperSize}px !important; line-height:20px !important; }
    }
  </style>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;border-collapse:collapse;background:#f9f8fa;">
    <tr>
      <td align="center" class="moodeng-shell" style="padding:16px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" class="moodeng-email" style="width:100%;max-width:430px;border-collapse:separate;border-spacing:0;background:#fdfcfd;border:1px solid #e4d8f0;border-radius:14px;overflow:hidden;">
          <tr>
            <td align="center" style="padding:16px;background:#1c053d;background:linear-gradient(135deg,#1c053d 0%,#170443 52%,#100229 100%);color:#fdfcfd;">
              <div style="font-size:20px;line-height:24px;font-weight:${emailSemiboldWeight};letter-spacing:${emailTightTracking};text-align:center;">Moodeng Credit</div>
            </td>
          </tr>
          <tr>
            <td class="moodeng-body" style="padding:16px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;border-collapse:collapse;">
                <tr>
                  <td style="padding:0 10px 12px 0;vertical-align:top;">
                    <p style="margin:0 0 4px;color:#5d24e8;font-size:${emailActionSize}px;line-height:20px;font-weight:${emailMediumWeight};letter-spacing:${emailBodyTracking};">Hi ${escapeHtml(name)},</p>
                    <h1 class="moodeng-title" style="margin:0 0 6px;max-width:200px;color:#1c053d;font-size:${emailTitleSize}px;line-height:27px;font-weight:${emailSemiboldWeight};letter-spacing:${emailTightTracking};">${escapeHtml(content.title)}</h1>
                    <p style="margin:0;max-width:170px;color:#33294c;font-size:${emailLabelSize}px;line-height:20px;font-weight:${emailRegularWeight};letter-spacing:${emailBodyTracking};">${escapeHtml(content.intro)}</p>
                  </td>
                  <td align="right" style="padding:0 0 12px;vertical-align:top;width:126px;">
                    <img class="moodeng-hero-img" src="${escapeHtml(heroImageUrl)}" alt="Moodeng mascot" width="126" style="display:block;width:126px;max-width:126px;height:auto;border:0;" />
                  </td>
                </tr>
              </table>

              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;margin:0 0 10px;border-collapse:separate;border-spacing:0;border:1px solid #e4d8f0;border-radius:12px;overflow:hidden;background:#fdfcfd;">
                <tr>
                  <td${amountLineColspan} style="padding:10px 12px;color:#33294c;font-size:${emailLabelSize}px;line-height:24px;font-weight:${emailMediumWeight};letter-spacing:${emailBodyTracking};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(content.amountLabel)}: <span class="moodeng-amount-value" style="color:#1c053d;font-size:${emailAmountSize}px;line-height:24px;font-weight:${emailMediumWeight};letter-spacing:${emailBodyTracking};white-space:nowrap;">${escapeHtml(amountParts.numericValue)}</span></td>
                  ${amountTokenCell}
                </tr>
              </table>

              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;margin:0 0 10px;border-collapse:separate;border-spacing:0;border:1px solid #e4d8f0;border-radius:12px;background:#fdfcfd;padding:0 10px;">
                ${renderDetailRows(content.details)}
              </table>

              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;margin:0 0 10px;border-collapse:separate;border-spacing:0;border:1px solid #e4d8f0;border-radius:12px;background:#fbf8ff;">
                <tr>
                  <td style="padding:10px;width:36px;vertical-align:middle;">
                    <span style="display:inline-block;width:28px;height:28px;border-radius:999px;background:#6010d2;background:linear-gradient(135deg,#8f54ff 0%,#6010d2 100%);color:#fdfcfd;font-size:${emailLabelSize}px;line-height:28px;font-weight:${emailSemiboldWeight};text-align:center;">&#9734;</span>
                  </td>
                  <td style="padding:10px 8px 10px 0;vertical-align:middle;">
                    <p style="margin:0 0 2px;color:#100733;font-size:${emailLabelSize}px;line-height:17px;font-weight:${emailSemiboldWeight};letter-spacing:${emailBodyTracking};">${escapeHtml(content.highlightTitle)}</p>
                    <p style="margin:0;color:#33294c;font-size:${emailHelperSize}px;line-height:18px;font-weight:${emailRegularWeight};letter-spacing:${emailBodyTracking};">${escapeHtml(content.highlightCopy)}</p>
                  </td>
                  <td align="right" style="padding:10px;color:#6010d2;font-size:${emailActionSize}px;line-height:20px;font-weight:${emailSemiboldWeight};letter-spacing:${emailTightTracking};white-space:nowrap;">${escapeHtml(content.highlightValue)}</td>
                </tr>
              </table>

              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;margin:0 0 10px;border-collapse:collapse;">
                <tr>
                  <td align="center">
                    <a href="${escapeHtml(content.ctaHref)}" style="display:block;border-radius:16px;background:#6010d2;color:#fdfcfd;text-align:center;text-decoration:none;font-size:${emailActionSize}px;line-height:20px;font-weight:${emailSemiboldWeight};letter-spacing:${emailBodyTracking};padding:14px 20px;">${escapeHtml(content.ctaLabel)} &rarr;</a>
                  </td>
                </tr>
              </table>

            </td>
          </tr>
          <tr>
            <td style="padding:14px 16px 0;background:#f3e8ff;border-top:1px solid #e4d8f0;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;margin:0 0 10px;border-collapse:separate;border-spacing:0;border:1px solid #e4d8f0;border-radius:12px;background:#fbf8ff;">
                <tr>
                  <td style="padding:12px 0 8px 12px;width:40px;vertical-align:middle;">
                    <span style="display:inline-block;width:28px;height:28px;border-radius:999px;background:#eadcff;color:#6010d2;font-size:${emailActionSize}px;line-height:28px;font-weight:${emailSemiboldWeight};text-align:center;">?</span>
                  </td>
                  <td style="padding:12px 12px 8px 0;vertical-align:middle;">
                    <p style="margin:0 0 2px;color:#100733;font-size:${emailLabelSize}px;line-height:17px;font-weight:${emailSemiboldWeight};letter-spacing:${emailBodyTracking};">Questions?</p>
                    <p style="margin:0;color:#33294c;font-size:${emailHelperSize}px;line-height:18px;font-weight:${emailRegularWeight};letter-spacing:${emailBodyTracking};">${escapeHtml(content.supportText)}</p>
                  </td>
                </tr>
                <tr>
                  <td colspan="2" style="padding:2px 12px 12px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;border-collapse:collapse;">
                      <tr>
                        <td style="padding-right:5px;">
                          <a href="${escapeHtml(buildTelegramLink(content.telegramText))}" style="display:block;border:1px solid #6010d2;border-radius:10px;color:#6010d2;text-align:center;text-decoration:none;font-size:${emailLabelSize}px;line-height:18px;font-weight:${emailSemiboldWeight};letter-spacing:${emailBodyTracking};padding:10px 8px;">Telegram</a>
                        </td>
                        <td style="padding-left:5px;">
                          <a href="${facebookUrl}" style="display:block;border:1px solid #6010d2;border-radius:10px;color:#6010d2;text-align:center;text-decoration:none;font-size:${emailLabelSize}px;line-height:18px;font-weight:${emailSemiboldWeight};letter-spacing:${emailBodyTracking};padding:10px 8px;">Facebook</a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

            </td>
          </tr>
          <tr>
            <td align="center" style="padding:2px 16px 14px;background:#f3e8ff;color:#786790;font-size:${emailFooterSize}px;line-height:16px;font-weight:${emailRegularWeight};letter-spacing:${emailBodyTracking};text-align:center;">
              <span>Thanks for choosing Moodeng Credit.</span>
              <span style="display:inline-block;padding:0 6px;color:#8336f0;font-size:13px;line-height:13px;">&hearts;</span>
              <span>We're here to help you grow.</span>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</div>`;
};

const buildFundedContent = (loan: LoanNotificationLoan, recipient: LoanNotificationRecipient): EmailContent => {
   const formattedLoanAmount = formatUsdcAmount(loan.loan_amount);
   const formattedTotalRepayment = formatUsdcAmount(loan.total_repayment_amount);
   const formattedDueDate = formatDate(loan.due_date);
   const formattedFundedDate = formatDate(loan.funded_at);
   const trustPointHighlight = buildTrustPointHighlight(recipient, {
      potential: 'Repay this loan on time to unlock eligible milestones.',
      fallback: 'Repay on time to build your borrower record.',
      fallbackValue: 'On time'
   });
   const lenderName = loan.lender_username ?? 'a lender';
   const dashboardLink = buildDashboardLink();
   const text = normalizeNotificationText(`Hi ${getRecipientName(recipient)},
Your loan ${loan.tracking_id} has been funded.
Amount funded: ${formattedLoanAmount}
Funded on: ${formattedFundedDate}
Total to repay: ${formattedTotalRepayment}
Repayment due: ${formattedDueDate}
${trustPointHighlight.textLine}
Lender: ${lenderName}
View your loan: ${dashboardLink}
For help, contact support@moodeng.app`);

   return {
      subject: 'Your loan has been funded',
      title: 'Your loan has been funded',
      intro: 'Your accepted loan is funded and ready in Moodeng.',
      amountLabel: 'Amount funded',
      amountValue: formattedLoanAmount,
      details: [
         { label: 'Loan count', value: '1' },
         { label: 'Loan status', value: 'Funded', icon: '&check;', tone: 'good' },
         { label: 'Total to repay', value: formattedTotalRepayment },
         { label: 'Repayment due', value: formattedDueDate },
         { label: 'Funded on', value: formattedFundedDate }
      ],
      highlightTitle: trustPointHighlight.title,
      highlightCopy: trustPointHighlight.copy,
      highlightValue: trustPointHighlight.value,
      ctaLabel: 'View funded loan',
      ctaHref: dashboardLink,
      supportText: 'Message us if you have questions about this funded loan.',
      telegramText: `Hi Moodeng Credit, I have a question about my funded loan ${loan.tracking_id}.`,
      text
   };
};

const buildUrgentReminderContent = (recipient: LoanNotificationRecipient, aggregate?: LoanNotificationAggregate): EmailContent => {
   const count = aggregate?.count ?? 0;
   const dueLabel = aggregate?.dueLabel ?? '3 days';
   const nextDueDate = formatDate(aggregate?.nextDueDate ?? null);
   const totalToRepay = formatUsdcAmount(aggregate?.totalAmount ?? 0);
   const trustPointHighlight = buildTrustPointHighlight(recipient, {
      potential: 'Repay on time to unlock eligible milestones.',
      fallback: 'Repay on time to protect your borrower record.',
      fallbackValue: 'On time'
   });
   const repayLink = buildRepayLink();
   const text = normalizeNotificationText(`Hi ${getRecipientName(recipient)},
You have ${formatLoanCount(count)} coming due in ${dueLabel}.
Due date: ${nextDueDate}
Total to repay: ${totalToRepay}
${trustPointHighlight.textLine}
Open Moodeng to repay before the due date: ${repayLink}
For help, contact support@moodeng.app`);

   return {
      subject: 'Your loan is coming due',
      title: count === 1 ? 'Your loan is coming due' : 'Your loans are coming due',
      intro: 'This is a quick reminder.',
      amountLabel: 'Total to repay',
      amountValue: totalToRepay,
      details: [
         { label: 'Loans due', value: String(count) },
         { label: 'Due date', value: nextDueDate },
         { label: 'Due in', value: dueLabel },
         { label: 'Repayment benefit', value: 'Good Standing', icon: '&check;', tone: 'good' }
      ],
      highlightTitle: trustPointHighlight.title,
      highlightCopy: trustPointHighlight.copy,
      highlightValue: trustPointHighlight.value,
      ctaLabel: 'Repay in Moodeng',
      ctaHref: repayLink,
      supportText: 'Start a chat if you need help with repayment.',
      telegramText: `Hi Moodeng Credit, I need help with ${formatLoanCount(count)} due in ${dueLabel}. My total to repay is ${totalToRepay}.`,
      text
   };
};

const buildFinalReminderContent = (recipient: LoanNotificationRecipient, aggregate?: LoanNotificationAggregate): EmailContent => {
   const count = aggregate?.count ?? 0;
   const dueLabel = aggregate?.dueLabel ?? '24 hours';
   const nextDueDate = formatDate(aggregate?.nextDueDate ?? null);
   const totalDue = formatUsdcAmount(aggregate?.totalAmount ?? 0);
   const trustPointHighlight = buildTrustPointHighlight(recipient, {
      potential: 'Repay on time to unlock eligible milestones.',
      fallback: 'Repay on time to protect your borrower record.',
      fallbackValue: 'On time'
   });
   const repayLink = buildRepayLink();
   const text = normalizeNotificationText(`Hi ${getRecipientName(recipient)},
You have ${formatLoanCount(count)} due within ${dueLabel}.
Due date: ${nextDueDate}
Total due: ${totalDue}
${trustPointHighlight.textLine}
Please repay soon to keep the loan current: ${repayLink}
For help, contact support@moodeng.app`);

   return {
      subject: 'Your repayment is due soon',
      title: count === 1 ? 'Your loan is due soon' : 'Your loans are due soon',
      intro: 'Please repay soon to keep your account in good standing.',
      amountLabel: 'Total due',
      amountValue: totalDue,
      details: [
         { label: 'Loans due', value: String(count) },
         { label: 'Due date', value: nextDueDate },
         { label: 'Due within', value: dueLabel, icon: '!', tone: 'warn' },
         { label: 'Account status', value: 'Needs action', icon: '!', tone: 'warn' }
      ],
      highlightTitle: trustPointHighlight.title,
      highlightCopy: trustPointHighlight.copy,
      highlightValue: trustPointHighlight.value,
      ctaLabel: 'Repay now',
      ctaHref: repayLink,
      supportText: 'Start a chat if you need help making this repayment.',
      telegramText: `Hi Moodeng Credit, I need help with ${formatLoanCount(count)} due within ${dueLabel}. My total due is ${totalDue}.`,
      text
   };
};

const buildOverdueContent = (recipient: LoanNotificationRecipient, aggregate?: LoanNotificationAggregate): EmailContent => {
   const count = aggregate?.count ?? 0;
   const overdueBy = aggregate?.dueLabel ?? 'overdue';
   const dueDate = formatDate(aggregate?.nextDueDate ?? null);
   const overdueAmount = formatUsdcAmount(aggregate?.totalAmount ?? 0);
   const trustPointHighlight = buildTrustPointHighlight(recipient, {
      potential: 'Repay now to unlock any eligible repayment milestones.',
      fallback: 'Bring this loan current to protect your borrower record.',
      fallbackValue: 'Review'
   });
   const repayLink = buildRepayLink();
   const text = normalizeNotificationText(`Hi ${getRecipientName(recipient)},
You have ${formatLoanCount(count)} overdue.
Due date: ${dueDate}
Overdue by: ${overdueBy}
Overdue amount: ${overdueAmount}
${trustPointHighlight.textLine}
Please repay now to bring the loan current: ${repayLink}
For help, contact support@moodeng.app`);

   return {
      subject: 'Your loan is overdue',
      title: count === 1 ? 'Your loan is overdue' : 'Your loans are overdue',
      intro: 'Please repay as soon as you can to bring this loan current.',
      amountLabel: 'Overdue amount',
      amountValue: overdueAmount,
      details: [
         { label: count === 1 ? 'Loan overdue' : 'Loans overdue', value: String(count), icon: '!', tone: 'warn' },
         { label: 'Due date', value: dueDate, icon: '!', tone: 'warn' },
         { label: 'Overdue by', value: overdueBy, icon: '!', tone: 'warn' },
         { label: 'Account status', value: 'Needs action', icon: '!', tone: 'warn' }
      ],
      highlightTitle: trustPointHighlight.title,
      highlightCopy: trustPointHighlight.copy,
      highlightValue: trustPointHighlight.value,
      ctaLabel: 'Repay now',
      ctaHref: repayLink,
      supportText: 'Message us if you need help with this overdue loan.',
      telegramText: `Hi Moodeng Credit, I need help with ${formatLoanCount(count)} overdue. My overdue amount is ${overdueAmount}.`,
      text
   };
};

const buildRepaymentReceivedContent = (loan: LoanNotificationLoan, recipient: LoanNotificationRecipient): EmailContent => {
   const amountRepaid = formatUsdcAmount(loan.repaid_amount ?? loan.total_repayment_amount);
   const formattedDueDate = formatDate(loan.due_date);
   const formattedPaidDate = formatDate(loan.updated_at ?? null);
   const trustPointHighlight = buildTrustPointHighlight(
      {
         ...recipient,
         trust_points_reward_kind: 'earned'
      },
      {
         potential: 'This repayment unlocked eligible milestones.',
         earned: 'This repayment unlocked eligible milestones.',
         fallback: 'Open Moodeng to review your borrower reputation.',
         fallbackValue: 'Review'
      }
   );
   const dashboardLink = buildDashboardLink();
   const text = normalizeNotificationText(`Hi ${getRecipientName(recipient)},
Your repayment for loan ${loan.tracking_id} was received.
Amount repaid: ${amountRepaid}
Paid on: ${formattedPaidDate}
Original due date: ${formattedDueDate}
${trustPointHighlight.textLine}
View your loan details: ${dashboardLink}
For help, contact support@moodeng.app`);

   return {
      subject: 'Your repayment was received',
      title: 'Your repayment was received',
      intro: 'Thanks for repaying your Moodeng loan.',
      amountLabel: 'Amount repaid',
      amountValue: amountRepaid,
      details: [
         { label: 'Loan count', value: '1' },
         { label: 'Loan status', value: 'Paid', icon: '&check;', tone: 'good' },
         { label: 'Paid on', value: formattedPaidDate, icon: '&check;', tone: 'good' },
         { label: 'Original due date', value: formattedDueDate }
      ],
      highlightTitle: trustPointHighlight.title,
      highlightCopy: trustPointHighlight.copy,
      highlightValue: trustPointHighlight.value,
      ctaLabel: 'View loan details',
      ctaHref: dashboardLink,
      supportText: 'Message us if this payment looks wrong.',
      telegramText: `Hi Moodeng Credit, I have a question about a loan repayment marked as received for loan ${loan.tracking_id}.`,
      text
   };
};

const buildWeeklyDigestContent = (recipient: LoanNotificationRecipient, aggregate?: LoanNotificationAggregate): EmailContent => {
   const count = aggregate?.count ?? 0;
   const nextDueDate = formatDate(aggregate?.nextDueDate ?? null);
   const totalOutstanding = formatUsdcAmount(aggregate?.totalAmount ?? 0);
   const trustPointHighlight = buildTrustPointHighlight(recipient, {
      potential: 'Repay eligible loans on time to unlock milestones.',
      fallback: 'Open Moodeng to review available milestones.',
      fallbackValue: 'Review'
   });
   const dashboardLink = buildDashboardLink();
   const text = normalizeNotificationText(`Hi ${getRecipientName(recipient)},
Here is your weekly Moodeng Credit digest.
Active loans: ${count}
Next due date: ${nextDueDate}
Total outstanding: ${totalOutstanding}
${trustPointHighlight.textLine}
Open Moodeng to review your loans: ${dashboardLink}
For help, contact support@moodeng.app`);

   return {
      subject: 'Your weekly Moodeng Credit digest',
      title: 'Your weekly loan digest',
      intro: 'Here is a quick look at your active Moodeng loans.',
      amountLabel: 'Total outstanding',
      amountValue: totalOutstanding,
      details: [
         { label: 'Active loans', value: String(count) },
         { label: 'Next due date', value: nextDueDate },
         { label: 'Repayment status', value: 'Open' },
         { label: 'Next step', value: 'Review loans' }
      ],
      highlightTitle: trustPointHighlight.title,
      highlightCopy: trustPointHighlight.copy,
      highlightValue: trustPointHighlight.value,
      ctaLabel: 'Open Moodeng',
      ctaHref: dashboardLink,
      supportText: 'Message us if any loan number looks wrong.',
      telegramText: `Hi Moodeng Credit, I have a question about my weekly digest. It shows ${count} active loans and ${totalOutstanding} outstanding.`,
      text
   };
};

export const buildLoanNotificationEmail = (
   type: LoanNotificationType,
   loan: LoanNotificationLoan | null,
   recipient: LoanNotificationRecipient,
   aggregate?: LoanNotificationAggregate
) => {
   let content: EmailContent;

   if (type === 'funded') {
      if (!loan) {
         throw new Error('Loan details are required for funded notifications.');
      }

      content = buildFundedContent(loan, recipient);
   } else if (type === 'urgent_reminder') {
      content = buildUrgentReminderContent(recipient, aggregate);
   } else if (type === 'final_reminder') {
      content = buildFinalReminderContent(recipient, aggregate);
   } else if (type === 'overdue') {
      content = buildOverdueContent(recipient, aggregate);
   } else if (type === 'repayment_received') {
      if (!loan) {
         throw new Error('Loan details are required for repayment received notifications.');
      }

      content = buildRepaymentReceivedContent(loan, recipient);
   } else {
      content = buildWeeklyDigestContent(recipient, aggregate);
   }

   return {
      subject: content.subject,
      text: content.text,
      html: buildLoanEmailHtml(content, recipient)
   };
};

export const buildLoanNotificationTelegram = (
   type: LoanNotificationType,
   loan: LoanNotificationLoan | null,
   recipient: LoanNotificationRecipient,
   aggregate?: LoanNotificationAggregate
) => {
   const name = getTelegramRecipientName(recipient);

   if (type === 'funded') {
      if (!loan) {
         throw new Error('Loan details are required for funded notifications.');
      }

      const actionUrl = buildRepayLink();
      const text = normalizeNotificationText(`Loan funded
Hi ${name}, your request for ${formatUsdcAmount(loan.loan_amount)} (${loan.tracking_id}) was funded by ${
         loan.lender_username ?? 'a lender'
      } on ${formatDate(loan.funded_at)}.
Repay ${formatUsdcAmount(loan.total_repayment_amount)} by ${formatDate(loan.due_date)} to stay in good standing.
${actionUrl}`);

      return { actionUrl, text };
   }

   if (type === 'urgent_reminder') {
      const actionUrl = buildRepayLink();
      const dueLabel = aggregate?.dueLabel ?? '3 days';
      const text = normalizeNotificationText(`Amount coming due
Hi ${name}, you have ${formatLoanCount(aggregate?.count ?? 0)} due in ${dueLabel}.
Amount due: ${formatUsdcAmount(aggregate?.totalAmount ?? 0)}
Repay on time to stay in good standing.
${actionUrl}`);

      return { actionUrl, text };
   }

   if (type === 'final_reminder') {
      const actionUrl = buildRepayLink();
      const dueLabel = aggregate?.dueLabel ?? '24 hours';
      const text = normalizeNotificationText(`Amount coming due
Hi ${name}, you have ${formatLoanCount(aggregate?.count ?? 0)} due within ${dueLabel}.
Amount due: ${formatUsdcAmount(aggregate?.totalAmount ?? 0)}
Please make sure your wallet has the stablecoins ready so your Moodeng history stays on track.
${actionUrl}`);

      return { actionUrl, text };
   }

   if (type === 'overdue') {
      const actionUrl = buildRepayLink();
      const text = normalizeNotificationText(`Amount overdue
Hi ${name}, you have ${formatLoanCount(aggregate?.count ?? 0)} overdue.
Amount overdue: ${formatUsdcAmount(aggregate?.totalAmount ?? 0)}
Please repay now so your Moodeng history can get back on track.
${actionUrl}`);

      return { actionUrl, text };
   }

   if (type === 'repayment_received') {
      if (!loan) {
         throw new Error('Loan details are required for repayment received notifications.');
      }

      const actionUrl = buildDashboardLink();
      const text = normalizeNotificationText(`Repayment received
Hi ${name}, your repayment for ${loan.tracking_id} was received.
Amount repaid: ${formatUsdcAmount(loan.repaid_amount ?? loan.total_repayment_amount)}
${actionUrl}`);

      return { actionUrl, text };
   }

   const actionUrl = buildDashboardLink();
   const text = normalizeNotificationText(`Weekly Moodeng update
Hi ${name}, here is your weekly loan update.
Active loans: ${aggregate?.count ?? 0}
Total outstanding: ${formatUsdcAmount(aggregate?.totalAmount ?? 0)}
Keep repayments on time to build your Moodeng history.
${actionUrl}`);

   return { actionUrl, text };
};

export const getReminderWindows = (referenceDate: Date, urgentHours: number, finalHours: number) => {
   const finalEnd = new Date(referenceDate);
   finalEnd.setUTCHours(finalEnd.getUTCHours() + finalHours);

   const urgentStart = new Date(referenceDate);
   urgentStart.setUTCHours(urgentStart.getUTCHours() + finalHours);

   const urgentEnd = new Date(referenceDate);
   urgentEnd.setUTCHours(urgentEnd.getUTCHours() + urgentHours);

   return {
      final: { start: referenceDate, end: finalEnd },
      urgent: { start: urgentStart, end: urgentEnd }
   };
};
