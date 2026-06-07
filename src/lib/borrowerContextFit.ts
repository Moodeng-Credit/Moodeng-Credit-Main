export type BorrowerIncomeType = 'full-time' | 'part-time' | 'freelance' | 'none';
export type BorrowerPaydayType = 'mid-month' | 'end-of-month' | 'weekly' | 'irregular';
export type BorrowerContextFitLevel = 'strong' | 'ok' | 'weak' | 'unknown';
export type BorrowerContextChipType = 'name' | 'pay' | 'need' | 'money' | 'date' | 'delta';

export interface BorrowerContextInput {
   borrowerName: string;
   requestDate: Date;
   dueDate: Date;
   amount: number;
   reason: string;
   incomeType: BorrowerIncomeType;
   paydayType: BorrowerPaydayType;
   paydayStart: number | null;
   paydayEnd: number | null;
   gapReasons: string[];
   monthlyIncome?: string;
   monthlyExpenses?: string;
   otherIncome?: string;
   profession?: string;
   /** How many of their loans have been funded (Lent status) */
   fundedLoanCount?: number;
   /** How many of their funded loans were fully repaid */
   repaidLoanCount?: number;
   /** Whether this borrower has Good Standing (cs > 0) */
   goodStanding?: boolean;
   /** Whether this borrower has verified their World ID */
   isVerified?: boolean;
}

export interface BorrowerContextState {
   incomeSetup: string;
   paydayWindow: string;
   cashGaps: string[];
   monthlyIncome?: string;
   monthlyExpenses?: string;
   otherIncome?: string;
   profession?: string;
   incomeDescription?: string;
}

export interface BorrowerContextChip {
   id: string;
   label: string;
   type: BorrowerContextChipType;
}

export interface BorrowerContextResult {
   fitLevel: BorrowerContextFitLevel;
   contextLine: string;
   verdictHTML: string;
   chips: BorrowerContextChip[];
   gapDays: number | null;
   paragraphText: string;
}

export type BorrowerContextProfileData = Pick<
   BorrowerContextInput,
   'incomeType' | 'paydayType' | 'paydayStart' | 'paydayEnd' | 'gapReasons' | 'monthlyIncome' | 'monthlyExpenses' | 'otherIncome' | 'profession'
>;

// ─── Reason categories for semantic matching ───────────────────────────────

type ReasonCategory = 'bridge' | 'essential' | 'healthcare' | 'family' | 'emergency' | 'investment' | 'other';

const REASON_KEYWORDS: Record<ReasonCategory, string[]> = {
   bridge:     ['payday bridge', 'bridge', 'waiting for payment', 'payroll', 'advance'],
   essential:  ['rent', 'bill', 'bills', 'food', 'groceries', 'utilities', 'electricity', 'water', 'transport', 'commute', 'fuel', 'gas'],
   healthcare: ['medical', 'medicine', 'doctor', 'hospital', 'health', 'clinic', 'prescription', 'dental'],
   family:     ['family', 'child', 'children', 'kid', 'parent', 'school', 'tuition'],
   emergency:  ['emergency', 'urgent', 'accident', 'repair', 'broke', 'broken'],
   investment: ['education', 'course', 'business', 'tools', 'equipment', 'training'],
   other:      []
};

const categorizeReason = (text: string): ReasonCategory => {
   const lower = text.toLowerCase();
   for (const [cat, keywords] of Object.entries(REASON_KEYWORDS) as [ReasonCategory, string[]][]) {
      if (cat === 'other') continue;
      if (keywords.some((kw) => lower.includes(kw))) return cat;
   }
   return 'other';
};

const reasonCategoryLabel: Record<ReasonCategory, string> = {
   bridge:     'payday bridge',
   essential:  'essential expenses',
   healthcare: 'healthcare',
   family:     'family needs',
   emergency:  'emergency',
   investment: 'investment in themselves',
   other:      'stated need'
};

// ─── Semantic reason × gapReason matching ─────────────────────────────────

const reasonMatchesPattern = (reason: string, gapReasons: string[]): boolean =>
   findMatchingGapReason(reason, gapReasons) !== null;

/** Returns the specific gap reason that matches, for use in verdict text */
const findMatchingGapReason = (reason: string, gapReasons: string[]): string | null => {
   if (!gapReasons.length) return null;
   const reasonLower = reason.toLowerCase();
   const reasonCat = categorizeReason(reason);

   for (const gr of gapReasons) {
      const grLower = gr.toLowerCase();
      if (reasonLower.includes(grLower) || grLower.includes(reasonLower)) return gr;
      const grCat = categorizeReason(gr);
      if (reasonCat !== 'other' && grCat !== 'other' && reasonCat === grCat) return gr;
   }
   return null;
};

// ─── Date helpers ──────────────────────────────────────────────────────────

type PaydayWindow = { start: Date; end: Date };
const DAY_MS = 24 * 60 * 60 * 1000;

const isValidDate = (value: unknown): value is Date => value instanceof Date && !Number.isNaN(value.getTime());
const toUtcDay = (date: Date): Date => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
const daysBetween = (from: Date, to: Date): number => Math.round((toUtcDay(to).getTime() - toUtcDay(from).getTime()) / DAY_MS);
const daysInUtcMonth = (year: number, month: number): number => new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
const clampDayToMonth = (day: number, year: number, month: number): number => Math.min(day, daysInUtcMonth(year, month));
const isValidPaydayDay = (value: number | null): value is number => Number.isInteger(value) && value >= 1 && value <= 31;

const buildPaydayWindow = (dueDate: Date, paydayStart: number, paydayEnd: number): PaydayWindow => {
   const due = toUtcDay(dueDate);
   const year = due.getUTCFullYear();
   const month = due.getUTCMonth();
   return {
      start: new Date(Date.UTC(year, month, clampDayToMonth(paydayStart, year, month))),
      end:   new Date(Date.UTC(year, month, clampDayToMonth(Math.max(paydayStart, paydayEnd), year, month)))
   };
};

const calculateGapDays = (dueDate: Date, paydayStart: number | null, paydayEnd: number | null): number | null => {
   if (!isValidPaydayDay(paydayStart) || !isValidPaydayDay(paydayEnd)) return null;
   const due = toUtcDay(dueDate);
   const win = buildPaydayWindow(due, paydayStart, paydayEnd);
   if (due < win.start) return daysBetween(win.start, due);
   if (due <= win.end)  return daysBetween(win.start, due);
   return daysBetween(win.end, due);
};

const getFitLevel = (input: BorrowerContextInput, gapDays: number | null): BorrowerContextFitLevel => {
   if (input.incomeType === 'none') return 'unknown';
   if (input.paydayType === 'irregular' || gapDays === null || !isValidPaydayDay(input.paydayStart) || !isValidPaydayDay(input.paydayEnd)) {
      return 'unknown';
   }

   // Weekly earners get paid every 7 days — any gap <= 7 days is at most one cycle away
   // so "weak" timing is never as concerning as it is for monthly earners
   if (input.paydayType === 'weekly') {
      const absGap = Math.abs(gapDays);
      if (absGap <= 3) return 'strong'; // within 3 days of pay = strong
      if (absGap <= 7) return 'ok';     // within one pay cycle = ok
      return 'weak';                    // more than a full cycle away
   }

   const due = toUtcDay(input.dueDate);
   const win = buildPaydayWindow(due, input.paydayStart, input.paydayEnd);
   const daysAfterWindow = daysBetween(win.end, due);
   if (due >= win.start && due <= win.end) return 'ok';
   if (due < win.start) return 'weak';
   if (daysAfterWindow >= 1 && daysAfterWindow <= 7) return 'strong';
   return 'weak';
};

// ─── Bio field value → display label mappings ─────────────────────────────
// Values stored in DB are slugs (e.g. '200_400'); these map them to readable text.

const MONTHLY_INCOME_LABELS: Record<string, string> = {
   under_200: 'under $200',
   '200_400': '$200–$400',
   '400_700': '$400–$700',
   '700_plus': 'over $700',
};

const MONTHLY_EXPENSES_LABELS: Record<string, string> = {
   under_50:   'under $50',
   '50_150':   '$50–$150',
   '150_300':  '$150–$300',
   '300_plus': 'over $300',
};

const GAP_REASON_LABELS: Record<string, string> = {
   gap_before_payday:  '',               // meta — skip in expense list
   bills_before_payday:'bills',
   family_needs:       'family needs',
   transport:          'transport',
   medical:            'medical',
   emergency_costs:    'emergency costs',
   work_supplies:      'work supplies',
   // pass-through for legacy free-text values
};

const resolveMonthlyIncome   = (v: string | undefined): string | undefined =>
   v ? (MONTHLY_INCOME_LABELS[v]   ?? v) || undefined : undefined;

const resolveMonthlyExpenses = (v: string | undefined): string | undefined =>
   v ? (MONTHLY_EXPENSES_LABELS[v] ?? v) || undefined : undefined;

const resolveGapReasons = (values: string[]): string[] =>
   values
      .map((v) => GAP_REASON_LABELS[v] ?? v)   // map slug → label (pass unknown through)
      .filter(Boolean);                          // drop empty strings (e.g. gap_before_payday)

/** Strip leading articles/sentences, normalise case for use after "being a ___" */
const sanitizeJobTitle = (raw: string): string => {
   let s = raw.trim();
   if (!s) return '';
   // strip common sentence prefixes people might type
   s = s.replace(/^(i am an? |i'?m an? |i work as an? |works? as an? |also |an? |the )/i, '');
   s = s.trim();
   if (!s) return '';
   // fully lowercase — job titles sit mid-sentence
   return s.toLowerCase();
};

/** Returns "a" or "an" based on the first letter of the word */
const indefiniteArticle = (word: string): string =>
   /^[aeiou]/i.test(word.trim()) ? 'an' : 'a';

// ─── Formatting helpers ────────────────────────────────────────────────────

const formatDateLabel = (date: Date): string =>
   new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(date);

const formatAmount = (amount: number): string => {
   if (!Number.isFinite(amount)) return '$0';
   return `$${new Intl.NumberFormat('en-US', { maximumFractionDigits: 2, minimumFractionDigits: 0 }).format(amount)}`;
};

const lowercaseFirst = (value: string): string => (value.length ? `${value[0].toLowerCase()}${value.slice(1)}` : value);

const formatMoneyNeed = (amount: number, reason: string): string => {
   const amountLabel = formatAmount(amount);
   const normalizedReason = normalizeText(reason);
   return normalizedReason ? `${amountLabel} for ${lowercaseFirst(normalizedReason)}` : amountLabel;
};

const normalizeText = (value: unknown): string | null => {
   if (typeof value !== 'string') return null;
   const trimmed = value.trim();
   return trimmed.length > 0 ? trimmed : null;
};

const cleanList = (items: string[]): string[] => {
   const seen = new Set<string>();
   return items.map((i) => i.trim()).filter(Boolean).filter((i) => {
      const key = i.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
   });
};

const formatNaturalList = (items: string[], fallback: string): string => {
   const cleaned = cleanList(items);
   if (cleaned.length === 0) return fallback;
   if (cleaned.length === 1) return cleaned[0];
   if (cleaned.length === 2) return `${cleaned[0]} and ${cleaned[1]}`;
   return `${cleaned.slice(0, -1).join(', ')}, and ${cleaned[cleaned.length - 1]}`;
};

const escapeHtml = (value: string): string =>
   value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

// ─── Derived signal helpers ────────────────────────────────────────────────

/** Loans currently active (funded but not repaid) = rough concurrent exposure */
const getActiveLoansCount = (fundedLoanCount: number | undefined, repaidLoanCount: number | undefined): number | null => {
   if (fundedLoanCount === undefined || repaidLoanCount === undefined) return null;
   return Math.max(0, fundedLoanCount - repaidLoanCount);
};

/** Repayment rate 0–1, only meaningful when fundedLoanCount >= 2 */
const getRepaymentRate = (fundedLoanCount: number | undefined, repaidLoanCount: number | undefined): number | null => {
   if (!fundedLoanCount || fundedLoanCount < 2 || repaidLoanCount === undefined) return null;
   return repaidLoanCount / fundedLoanCount;
};

/** Loan duration in days from request to due date */
const getLoanDurationDays = (requestDate: Date | null, dueDate: Date | null): number | null => {
   if (!requestDate || !dueDate) return null;
   const d = daysBetween(requestDate, dueDate);
   return d > 0 ? d : null;
};

// ─── Track record phrase ───────────────────────────────────────────────────
// Uses repaidLoanCount when available (more precise), falls back to fundedLoanCount.

const trackRecordPhrase = (repaidLoanCount: number | undefined, fundedLoanCount: number | undefined): string => {
   const repaid = repaidLoanCount ?? fundedLoanCount;

   if (repaid === undefined) return '';
   if (repaid === 0)         return 'First loan on Moodeng — no prior repayment history.';
   if (repaid === 1)         return 'Repaid 1 loan on Moodeng.';
   if (repaid === 2)         return 'Repaid 2 loans on Moodeng.';
   if (repaid <= 4)          return `Repaid ${repaid} loans on Moodeng — clean history.`;
   return `Repaid ${repaid} loans on Moodeng.`;
};

// ─── Verification + standing suffix ───────────────────────────────────────

const credentialsSuffix = (goodStanding: boolean | undefined, isVerified: boolean | undefined): string => {
   if (goodStanding && isVerified) return ' World ID verified · Good Standing.';
   if (goodStanding)               return ' Good Standing.';
   if (isVerified)                 return ' World ID verified.';
   return '';
};

// ─── Income reliability label ──────────────────────────────────────────────

const incomeLabels: Record<BorrowerIncomeType, { chip: string; withArticle: string; reliability: string }> = {
   'full-time': { chip: 'full-time',         withArticle: 'a full-time employee',  reliability: 'stable, predictable income' },
   'part-time': { chip: 'part-time',         withArticle: 'a part-time worker',    reliability: 'regular but variable income' },
   freelance:   { chip: 'freelance',         withArticle: 'a freelancer',           reliability: 'project-based income' },
   none:        { chip: 'no income shared',  withArticle: 'no income source',       reliability: 'no income on file' }
};

const paydayLabels: Record<BorrowerPaydayType, string> = {
   'mid-month':    'mid-month',
   'end-of-month': 'end-of-month',
   weekly:         'weekly',
   irregular:      'irregular'
};

// ─── Chips ─────────────────────────────────────────────────────────────────

const buildChips = (input: BorrowerContextInput, dueDate: Date | null, gapDays: number | null): BorrowerContextChip[] => {
   const needLabel = formatNaturalList(input.gapReasons, 'stated needs');
   const chips: BorrowerContextChip[] = [
      { id: 'name',  label: normalizeText(input.borrowerName) ?? 'this borrower', type: 'name' },
      {
         id: 'pay',
         label: input.incomeType === 'none'
            ? incomeLabels.none.chip
            : `${incomeLabels[input.incomeType].chip}, ${paydayLabels[input.paydayType]} pay`,
         type: 'pay'
      },
      { id: 'money', label: formatMoneyNeed(input.amount, input.reason),             type: 'money' },
      { id: 'date',  label: dueDate ? formatDateLabel(dueDate) : 'unclear date',      type: 'date' },
      { id: 'need',  label: needLabel,                                                type: 'need' }
   ];
   if (gapDays !== null) chips.push({ id: 'delta', label: `${Math.abs(gapDays)}-day gap`, type: 'delta' });
   return chips;
};

const buildContextLine = (): string => '{name} — {pay} — is requesting {money}, due {date}, with recurring {need}.';

// ─── Core verdict builder ──────────────────────────────────────────────────
// Covers all meaningful combinations of income type × payday type × fit level × track record

const buildVerdict = (
   input: BorrowerContextInput,
   fitLevel: BorrowerContextFitLevel,
   gapDays: number,
   dueDate: Date,
   loanDurationDays: number | null,
   activeLoansCount: number | null,
   repaymentRateNote: string
): string => {
   const payday       = escapeHtml(paydayLabels[input.paydayType]);
   const dueLabel     = escapeHtml(formatDateLabel(dueDate));
   const absGapDays   = Math.abs(gapDays);
   const track        = trackRecordPhrase(input.repaidLoanCount, input.fundedLoanCount);
   const creds        = credentialsSuffix(input.goodStanding, input.isVerified);
   const matchedPattern = findMatchingGapReason(input.reason, input.gapReasons);
   const patternNote  = matchedPattern
      ? ` Consistent with their stated ${escapeHtml(matchedPattern)} pattern.`
      : '';
   const repaid       = input.repaidLoanCount ?? input.fundedLoanCount ?? 0;
   const hasHistory   = repaid >= 3;
   const reasonCat    = categorizeReason(input.reason);
   const isBridge     = reasonCat === 'bridge';
   const isUrgent     = reasonCat === 'emergency' || reasonCat === 'healthcare';
   const isWeekly     = input.paydayType === 'weekly';
   const isShortLoan  = loanDurationDays !== null && loanDurationDays <= 14;
   const weeklyNote   = isWeekly ? ' Gets paid every week, so income is always recent.' : '';
   const shortLoanNote = isShortLoan ? ` ${loanDurationDays}-day loan.` : '';

   // Bridge loans — they know exactly when they're paying back
   if (isBridge) {
      if (hasHistory) {
         return `Borrowing to bridge the gap until they get paid. They've repaid ${repaid} loans on Moodeng.${creds}`;
      }
      return `Borrowing to bridge the gap until they get paid.${creds} ${track}`;
   }

   // STRONG — will have pay before repayment
   if (fitLevel === 'strong') {
      if (hasHistory && matchedPattern) {
         return `Gets paid ${payday} — repayment isn't until <strong>${absGapDays} days</strong> after that.${weeklyNote} This is a recurring ${escapeHtml(matchedPattern)} borrowing pattern for them. They've repaid ${repaid} loans on Moodeng.${creds}`;
      }
      if (hasHistory) {
         return `Gets paid ${payday} — repayment is <strong>${absGapDays} days</strong> later.${weeklyNote} They've repaid ${repaid} loans on Moodeng.${creds}`;
      }
      if (matchedPattern) {
         return `Gets paid ${payday} — repayment is <strong>${absGapDays} days</strong> later, so they'll have income first. They borrow for ${escapeHtml(matchedPattern)} regularly.${weeklyNote}${creds} ${track}`;
      }
      return `Gets paid ${payday} — repayment is <strong>${absGapDays} days</strong> later, so they'll have their income first.${weeklyNote}${creds} ${track}`;
   }

   // OK — repayment inside pay window
   if (fitLevel === 'ok') {
      if (hasHistory && matchedPattern) {
         return `Repayment falls on ${dueLabel}, right in their ${payday} pay window. This is how they typically borrow for ${escapeHtml(matchedPattern)} — they've repaid ${repaid} loans on Moodeng.${weeklyNote}${creds}`;
      }
      if (hasHistory) {
         return `Repayment falls on ${dueLabel}, right in their ${payday} pay window.${weeklyNote} They've repaid ${repaid} loans on Moodeng.${creds}`;
      }
      return `Repayment falls on ${dueLabel}, inside their ${payday} pay window — pay and repayment arrive at the same time.${weeklyNote}${patternNote}${creds} ${track}`;
   }

   // WEAK before — repayment is ahead of their payday
   if (gapDays < 0) {
      const urgencyNote = isUrgent
         ? ` ${reasonCategoryLabel[reasonCat].charAt(0).toUpperCase() + reasonCategoryLabel[reasonCat].slice(1)} need.`
         : '';
      if (hasHistory) {
         return `Repayment is <strong>${absGapDays} days</strong> before their usual payday.${weeklyNote}${urgencyNote}${shortLoanNote} They've repaid ${repaid} loans on Moodeng, including in similar timing situations.${patternNote}${creds}`;
      }
      return `Repayment is <strong>${absGapDays} days</strong> before their usual payday.${weeklyNote}${urgencyNote}${shortLoanNote}${patternNote}${creds} ${track}`;
   }

   // WEAK after — repayment is past their usual payday
   if (hasHistory) {
      return `Repayment is <strong>${absGapDays} days</strong> after their usual payday — they'll draw from the following month. They've repaid ${repaid} loans on Moodeng this way.${patternNote}${creds}`;
   }
   return `Repayment is <strong>${absGapDays} days</strong> after their usual payday — they'll draw from the following month's income.${patternNote}${creds} ${track}`;
};

// ─── Prose paragraph builder ───────────────────────────────────────────────

const buildParagraphText = (
   input: BorrowerContextInput,
   gapDays: number | null,
   dueDate: Date | null,
   loanDurationDays: number | null
): string => {
   const name = normalizeText(input.borrowerName) ?? 'This borrower';

   // ── Opening: responsible person, small ask ──
   const incomeRange = input.monthlyIncome ? ` ~${input.monthlyIncome}/mo` : '';
   const paydayDesc = input.paydayType === 'weekly'      ? ' (paid weekly)'
      : input.paydayType === 'mid-month'                 ? ' (paid mid-month)'
      : input.paydayType === 'end-of-month'              ? ' (paid end of the month)'
      : '';

   const resolvedGapReasons = resolveGapReasons(input.gapReasons);
   const costList = resolvedGapReasons.length > 0
      ? formatNaturalList(resolvedGapReasons, 'their expenses')
      : null;
   const resolvedIncome   = resolveMonthlyIncome(input.monthlyIncome);
   const resolvedExpenses = resolveMonthlyExpenses(input.monthlyExpenses);

   const otherIncome = sanitizeJobTitle(input.otherIncome ?? '');
   const profession  = sanitizeJobTitle(input.profession  ?? '');

   const bioParts: string[] = [];

   if (input.incomeType !== 'none') {
      const incomeAdj = input.incomeType === 'full-time' ? 'stable'
         : input.incomeType === 'part-time' ? 'regular'
         : 'project-based';
      const incomeAmountNote = resolvedIncome
         ? ` (${resolvedIncome}${paydayDesc ? ', ' + paydayDesc.replace(/[()]/g, '').trim() : ''})`
         : paydayDesc;

      let incomeSentence = `${name} demonstrates ${incomeAdj} income${incomeAmountNote}`;
      if (profession) {
         const profArticle = indefiniteArticle(profession);
         incomeSentence += ` from being ${profArticle} ${profession} as main source of income`;
         if (otherIncome) incomeSentence += `, with ${otherIncome} as other source of income`;
      } else if (otherIncome) {
         incomeSentence += `, with ${otherIncome} on the side`;
      }
      bioParts.push(incomeSentence + '.');

      if (costList) {
         if (resolvedExpenses) {
            bioParts.push(`Spends ${resolvedExpenses} a month on ${costList}.`);
         } else {
            bioParts.push(`Covers ${costList} each month.`);
         }
      }
   } else {
      const need = costList ? `cover ${costList}` : 'cover essentials';
      bioParts.push(`${name} needs ${formatAmount(input.amount)} to ${need} this cycle.`);
   }

   // ── Trust line: history + verification ──
   const factLines: string[] = [];
   const repaid = input.repaidLoanCount ?? input.fundedLoanCount;
   const verifiedNote = input.isVerified ? ' · World ID verified' : '';

   if (repaid === undefined || repaid === 0) {
      factLines.push(`First time trusting this community${verifiedNote}.`);
   } else if (repaid === 1) {
      factLines.push(`Already repaid 1 loan — they follow through${verifiedNote}.`);
   } else if (repaid <= 4) {
      factLines.push(`Repaid ${repaid} loans and always came back${verifiedNote}.`);
   } else {
      factLines.push(`${repaid} loans repaid — one of the community's reliable borrowers${verifiedNote}.`);
   }

   // ── Repayment: frame it as reassuring ──
   if (dueDate) {
      const dueLabel = formatDateLabel(dueDate);
      const durationNote = loanDurationDays ? ` · ${loanDurationDays}-day loan` : '';
      if (gapDays !== null) {
         const absGap = Math.abs(gapDays);
         if (gapDays > 0) {
            factLines.push(`Paycheck lands ${absGap} days before repayment — income in hand first (${dueLabel}${durationNote}).`);
         } else if (gapDays === 0) {
            factLines.push(`Repayment right on payday (${dueLabel}${durationNote}).`);
         } else {
            factLines.push(`Due ${dueLabel}${durationNote} — ${absGap} days before their next paycheck.`);
         }
      } else {
         factLines.push(`Due ${dueLabel}${durationNote}.`);
      }
   }

   return [bioParts.join(' '), ...factLines].join('\n');
};

// ─── Neutral result builder ────────────────────────────────────────────────
// Used when timing can't be evaluated (irregular, no income, missing dates)

const buildNeutralResult = (
   input: BorrowerContextInput,
   dueDate: Date | null,
   gapDays: number | null,
   verdictHTML: string,
   loanDurationDays?: number | null
): BorrowerContextResult => ({
   fitLevel: 'unknown',
   contextLine: buildContextLine(),
   verdictHTML,
   chips: buildChips(input, dueDate, gapDays),
   gapDays,
   paragraphText: buildParagraphText(input, gapDays, dueDate, loanDurationDays ?? null)
});

// ─── Main export ───────────────────────────────────────────────────────────

export const buildBorrowerContextFit = (input: BorrowerContextInput): BorrowerContextResult => {
   const requestDate      = isValidDate(input.requestDate) ? toUtcDay(input.requestDate) : null;
   const dueDate          = isValidDate(input.dueDate)     ? toUtcDay(input.dueDate)     : null;
   const track            = trackRecordPhrase(input.repaidLoanCount, input.fundedLoanCount);
   const creds            = credentialsSuffix(input.goodStanding, input.isVerified);
   const needLabel        = escapeHtml(formatNaturalList(input.gapReasons, 'their needs'));
   const matchedPattern   = findMatchingGapReason(input.reason, input.gapReasons);
   const patternNote      = matchedPattern ? ` Consistent with their stated ${escapeHtml(matchedPattern)} pattern.` : '';
   const repaid           = input.repaidLoanCount ?? input.fundedLoanCount ?? 0;
   const loanDurationDays = getLoanDurationDays(requestDate, dueDate);
   const isBridgeLoan     = categorizeReason(input.reason) === 'bridge';
   const isSmallAmount    = input.amount > 0 && input.amount <= 75;

   // Missing dates
   if (!requestDate || !dueDate) {
      const fallback = track || (input.isVerified ? 'World ID verified.' : 'New to Moodeng.');
      return buildNeutralResult(input, dueDate, null, `${fallback}${creds}`);
   }

   const gapDays = input.paydayType === 'irregular' ? null : calculateGapDays(dueDate, input.paydayStart, input.paydayEnd);
   const shortLoanContext = loanDurationDays !== null && loanDurationDays <= 14 ? ` ${loanDurationDays}-day loan.` : '';

   // Bridge loan — they know exactly when they're paying back
   if (isBridgeLoan) {
      return buildNeutralResult(input, dueDate, gapDays,
         `Borrowing to bridge the gap until they get paid.${patternNote} ${track}${creds}`,
         loanDurationDays
      );
   }

   // No income on file — lead with what IS there
   if (input.incomeType === 'none') {
      if (repaid >= 3) {
         return buildNeutralResult(input, dueDate, gapDays,
            `They've repaid ${repaid} loans on Moodeng — their track record speaks for itself.${patternNote}${creds}`,
            loanDurationDays
         );
      }
      if (repaid >= 1) {
         return buildNeutralResult(input, dueDate, gapDays,
            `They've repaid ${repaid === 1 ? '1 loan' : `${repaid} loans`} on Moodeng before.${patternNote}${creds}`,
            loanDurationDays
         );
      }
      const firstNotes = [
         input.isVerified ? 'World ID verified' : '',
         isSmallAmount ? `${formatAmount(input.amount)} loan` : ''
      ].filter(Boolean).join(', ');
      return buildNeutralResult(input, dueDate, gapDays,
         `New to Moodeng.${firstNotes ? ` ${firstNotes}.` : ''}${patternNote}${creds}`,
         loanDurationDays
      );
   }

   // Irregular pay
   if (input.paydayType === 'irregular' || gapDays === null) {

      if (input.incomeType === 'full-time') {
         if (repaid >= 3) {
            return buildNeutralResult(input, dueDate, gapDays,
               `Full-time employee — pay varies by performance. They've repaid ${repaid} loans on Moodeng.${shortLoanContext}${patternNote}${creds}`,
               loanDurationDays
            );
         }
         const verifiedNote = input.isVerified ? ' World ID verified.' : '';
         return buildNeutralResult(input, dueDate, gapDays,
            `Full-time employee — pay varies by performance.${verifiedNote}${shortLoanContext}${patternNote}${creds} ${track}`,
            loanDurationDays
         );
      }

      if (input.incomeType === 'freelance') {
         if (repaid >= 3) {
            return buildNeutralResult(input, dueDate, gapDays,
               `Freelance work — pay comes in by project. They've repaid ${repaid} loans on Moodeng, showing they manage repayment regardless of timing.${shortLoanContext}${patternNote}${creds}`,
               loanDurationDays
            );
         }
         if (repaid >= 1) {
            return buildNeutralResult(input, dueDate, gapDays,
               `Freelance work — pay comes in by project. They've repaid ${repaid === 1 ? '1 loan' : `${repaid} loans`} on Moodeng.${shortLoanContext}${patternNote}${creds}`,
               loanDurationDays
            );
         }
         const verifiedNote = input.isVerified ? ' World ID verified.' : '';
         return buildNeutralResult(input, dueDate, gapDays,
            `Freelance work — pay comes in by project.${verifiedNote}${shortLoanContext}${patternNote}${creds} ${track}`,
            loanDurationDays
         );
      }

      // Part-time + irregular
      if (repaid >= 1) {
         return buildNeutralResult(input, dueDate, gapDays,
            `Part-time work with flexible hours. They've repaid ${repaid === 1 ? '1 loan' : `${repaid} loans`} on Moodeng.${shortLoanContext}${patternNote}${creds}`,
            loanDurationDays
         );
      }
      const verifiedNote = input.isVerified ? ' World ID verified.' : '';
      const smallNote = isSmallAmount ? ` ${formatAmount(input.amount)} loan.` : '';
      return buildNeutralResult(input, dueDate, gapDays,
         `Part-time work with flexible hours.${verifiedNote}${smallNote}${shortLoanContext}${patternNote}${creds} ${track}`,
         loanDurationDays
      );
   }

   const fitLevel = getFitLevel(input, gapDays);

   if (fitLevel === 'unknown') {
      return buildNeutralResult(input, dueDate, gapDays, `${track}${creds}`, loanDurationDays);
   }

   return {
      fitLevel,
      contextLine: buildContextLine(),
      verdictHTML: buildVerdict(input, fitLevel, gapDays, dueDate, loanDurationDays, null, ''),
      chips: buildChips(input, dueDate, gapDays),
      gapDays,
      paragraphText: buildParagraphText(input, gapDays, dueDate, loanDurationDays)
   };
};

// ─── Profile normalizer ────────────────────────────────────────────────────

const getValue = (source: Record<string, unknown>, keys: string[]): unknown => {
   for (const key of keys) {
      if (source[key] !== undefined) return source[key];
   }
   return undefined;
};

const isIncomeType = (value: unknown): value is BorrowerIncomeType =>
   value === 'full-time' || value === 'part-time' || value === 'freelance' || value === 'none';

const isPaydayType = (value: unknown): value is BorrowerPaydayType =>
   value === 'mid-month' || value === 'end-of-month' || value === 'weekly' || value === 'irregular';

const normalizeDay = (value: unknown): number | null => {
   if (value === null) return null;
   if (typeof value === 'number' && isValidPaydayDay(value)) return value;
   if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value);
      return isValidPaydayDay(parsed) ? parsed : null;
   }
   return null;
};

const normalizeGapReasons = (value: unknown): string[] => {
   if (Array.isArray(value)) return cleanList(value.filter((item): item is string => typeof item === 'string'));
   if (typeof value === 'string') return cleanList(value.split(','));
   return [];
};

export const normalizeBorrowerContextProfile = (source: unknown): BorrowerContextProfileData | null => {
   if (!source || typeof source !== 'object') return null;
   const record = source as Record<string, unknown>;
   const incomeType = getValue(record, ['incomeType', 'income_type', 'borrowerIncomeType', 'borrower_income_type']);
   const paydayType = getValue(record, ['paydayType', 'payday_type', 'borrowerPaydayType', 'borrower_payday_type']);
   if (!isIncomeType(incomeType) || !isPaydayType(paydayType)) return null;
   return {
      incomeType,
      paydayType,
      paydayStart:     normalizeDay(getValue(record, ['paydayStart', 'payday_start', 'borrowerPaydayStart', 'borrower_payday_start'])),
      paydayEnd:       normalizeDay(getValue(record, ['paydayEnd',   'payday_end',   'borrowerPaydayEnd',   'borrower_payday_end'])),
      gapReasons:      normalizeGapReasons(getValue(record, ['gapReasons', 'gap_reasons', 'borrowerGapReasons', 'borrower_gap_reasons'])),
      monthlyIncome:   (record['monthlyIncome']   ?? record['monthly_income']   ?? '') as string || undefined,
      monthlyExpenses: (record['monthlyExpenses'] ?? record['monthly_expenses'] ?? '') as string || undefined,
      otherIncome:     (record['otherIncome']     ?? record['other_income']     ?? '') as string || undefined,
      profession:      (record['profession']      ?? '') as string || undefined
   };
};
