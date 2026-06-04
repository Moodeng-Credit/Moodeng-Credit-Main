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
   /** How many of their loans have been funded (Lent status) */
   fundedLoanCount?: number;
   /** How many of their funded loans were fully repaid */
   repaidLoanCount?: number;
   /** Whether this borrower has Good Standing (cs > 0) */
   goodStanding?: boolean;
   /** Whether this borrower has verified their World ID */
   isVerified?: boolean;
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
}

export type BorrowerContextProfileData = Pick<
   BorrowerContextInput,
   'incomeType' | 'paydayType' | 'paydayStart' | 'paydayEnd' | 'gapReasons'
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

const reasonMatchesPattern = (reason: string, gapReasons: string[]): boolean => {
   if (!gapReasons.length) return false;
   const reasonLower = reason.toLowerCase();
   const reasonCat = categorizeReason(reason);

   return gapReasons.some((gr) => {
      const grLower = gr.toLowerCase();
      // Direct substring match
      if (reasonLower.includes(grLower) || grLower.includes(reasonLower)) return true;
      // Category match — same category as gap reason
      const grCat = categorizeReason(gr);
      return reasonCat !== 'other' && grCat !== 'other' && reasonCat === grCat;
   });
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
   const due = toUtcDay(input.dueDate);
   const win = buildPaydayWindow(due, input.paydayStart, input.paydayEnd);
   const daysAfterWindow = daysBetween(win.end, due);
   if (due >= win.start && due <= win.end) return 'ok';
   if (due < win.start) return 'weak';
   if (daysAfterWindow >= 1 && daysAfterWindow <= 7) return 'strong';
   return 'weak';
};

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

// ─── Track record phrase ───────────────────────────────────────────────────
// Uses repaidLoanCount when available (more precise), falls back to fundedLoanCount.

const trackRecordPhrase = (repaidLoanCount: number | undefined, fundedLoanCount: number | undefined): string => {
   const repaid = repaidLoanCount ?? fundedLoanCount;

   if (repaid === undefined) return 'No repayment history loaded yet';
   if (repaid === 0)         return 'First loan on Moodeng';
   if (repaid === 1)         return 'Paid back 1 loan before';
   if (repaid === 2)         return 'Paid back 2 loans before';
   if (repaid <= 4)          return `Paid back ${repaid} loans — good track record`;
   return `Paid back ${repaid} loans — very reliable`;
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

const buildVerdict = (input: BorrowerContextInput, fitLevel: BorrowerContextFitLevel, gapDays: number, dueDate: Date): string => {
   const name        = escapeHtml(normalizeText(input.borrowerName) ?? 'this borrower');
   const income      = escapeHtml(incomeLabels[input.incomeType].withArticle);
   const payday      = escapeHtml(paydayLabels[input.paydayType]);
   const dueLabel    = escapeHtml(formatDateLabel(dueDate));
   const absGapDays  = Math.abs(gapDays);
   const track       = trackRecordPhrase(input.repaidLoanCount, input.fundedLoanCount);
   const creds       = credentialsSuffix(input.goodStanding, input.isVerified);
   const patternNote = reasonMatchesPattern(input.reason, input.gapReasons)
      ? ' Matches their usual reason for borrowing.'
      : '';

   const repaid = input.repaidLoanCount ?? input.fundedLoanCount ?? 0;
   const hasHistory = repaid >= 3;

   // STRONG — due 1-7 days after payday window (they'll have just been paid)
   if (fitLevel === 'strong') {
      if (hasHistory) {
         return `Timing and history both look good. They get paid ${payday} and repayment isn't due for another <strong>${absGapDays} days</strong> after that — they'll have money in hand.${patternNote} ${track}.${creds}`;
      }
      return `Good timing — they get paid ${payday} and repayment is <strong>${absGapDays} days</strong> later. They'll have their pay before they need to repay.${patternNote} ${track}.${creds}`;
   }

   // OK — due inside their payday window (coincides with expected pay)
   if (fitLevel === 'ok') {
      if (hasHistory) {
         return `Repayment is due on ${dueLabel}, right when they normally get paid ${payday}. This is how they usually borrow.${patternNote} ${track}.${creds}`;
      }
      return `Repayment is due on ${dueLabel} — that falls in their ${payday} pay window. They're bridging the last few days until their pay comes in.${patternNote} ${track}.${creds}`;
   }

   // WEAK — timing is off
   if (gapDays < 0) {
      // Due BEFORE payday window
      if (hasHistory) {
         return `Repayment is due <strong>${absGapDays} days</strong> before they usually get paid, but they've shown they handle this — they've repaid before regardless of timing.${patternNote} ${track}.${creds}`;
      }
      const reasonCat = categorizeReason(input.reason);
      const urgencyNote = (reasonCat === 'emergency' || reasonCat === 'healthcare')
         ? ` Likely a ${reasonCategoryLabel[reasonCat]} that couldn't wait.`
         : '';
      return `Repayment is due <strong>${absGapDays} days</strong> before they usually get paid — they'll need to cover this before their next payday.${urgencyNote}${patternNote} ${track}.${creds}`;
   }

   // Due AFTER payday window closes (> 7 days)
   if (hasHistory) {
      return `Repayment is due <strong>${absGapDays} days</strong> after their usual payday — but they've repaid reliably before, so this hasn't been an issue for them.${patternNote} ${track}.${creds}`;
   }
   return `Repayment is due <strong>${absGapDays} days</strong> after their usual payday — they'll be paying from the following month's income.${patternNote} ${track}.${creds}`;
};

// ─── Neutral result builder ────────────────────────────────────────────────
// Used when timing can't be evaluated (irregular, no income, missing dates)

const buildNeutralResult = (
   input: BorrowerContextInput,
   dueDate: Date | null,
   gapDays: number | null,
   verdictHTML: string
): BorrowerContextResult => ({
   fitLevel: 'unknown',
   contextLine: buildContextLine(),
   verdictHTML,
   chips: buildChips(input, dueDate, gapDays),
   gapDays
});

// ─── Main export ───────────────────────────────────────────────────────────

export const buildBorrowerContextFit = (input: BorrowerContextInput): BorrowerContextResult => {
   const requestDate = isValidDate(input.requestDate) ? toUtcDay(input.requestDate) : null;
   const dueDate     = isValidDate(input.dueDate)     ? toUtcDay(input.dueDate)     : null;
   const track       = trackRecordPhrase(input.repaidLoanCount, input.fundedLoanCount);
   const creds       = credentialsSuffix(input.goodStanding, input.isVerified);
   const needLabel   = escapeHtml(formatNaturalList(input.gapReasons, 'stated needs'));
   const patternMatch = reasonMatchesPattern(input.reason, input.gapReasons);
   const patternNote  = patternMatch ? ' This request aligns with their usual borrowing pattern.' : '';
   const repaid = input.repaidLoanCount ?? input.fundedLoanCount ?? 0;

   // Missing dates — no timing signal at all
   if (!requestDate || !dueDate) {
      return buildNeutralResult(input, dueDate, null,
         `No timing info available — go by their stated need (${needLabel}) and repayment history.${patternNote} ${track}.${creds}`
      );
   }

   const gapDays = input.paydayType === 'irregular' ? null : calculateGapDays(dueDate, input.paydayStart, input.paydayEnd);

   // No income on file
   if (input.incomeType === 'none') {
      if (repaid >= 3) {
         return buildNeutralResult(input, dueDate, gapDays,
            `No income listed, but they've repaid ${repaid} loans before. Their stated need is ${needLabel}.${patternNote}${creds}`
         );
      }
      return buildNeutralResult(input, dueDate, gapDays,
         `No income listed. This comes down to their stated need (${needLabel}) and their history.${patternNote} ${track}.${creds}`
      );
   }

   // Irregular pay — timing can't be evaluated
   if (input.paydayType === 'irregular' || gapDays === null) {

      // Full-time + irregular — unusual, likely commission or bonus-based
      if (input.incomeType === 'full-time') {
         return buildNeutralResult(input, dueDate, gapDays,
            `Full-time job but no regular pay schedule — probably commission or bonus-based. Look at their ${needLabel} need and repayment history.${patternNote} ${track}.${creds}`
         );
      }

      // Freelance + irregular — track record is the main signal
      if (input.incomeType === 'freelance') {
         if (repaid >= 2) {
            return buildNeutralResult(input, dueDate, gapDays,
               `Freelance pay depends on clients, but they've shown they repay reliably — ${repaid >= 3 ? 'well-established pattern' : 'building a track record'}.${patternNote} ${track}.${creds}`
            );
         }
         return buildNeutralResult(input, dueDate, gapDays,
            `Freelance income — pay timing depends on clients. Focus on their stated ${needLabel} need and history.${patternNote} ${track}.${creds}`
         );
      }

      // Part-time + irregular
      return buildNeutralResult(input, dueDate, gapDays,
         `Hours and pay aren't fixed — focus on their stated ${needLabel} need and repayment history.${patternNote} ${track}.${creds}`
      );
   }

   const fitLevel = getFitLevel(input, gapDays);

   if (fitLevel === 'unknown') {
      return buildNeutralResult(input, dueDate, gapDays,
         `Timing info is incomplete — go by their stated ${needLabel} need and repayment history.${patternNote} ${track}.${creds}`
      );
   }

   return {
      fitLevel,
      contextLine: buildContextLine(),
      verdictHTML: buildVerdict(input, fitLevel, gapDays, dueDate),
      chips: buildChips(input, dueDate, gapDays),
      gapDays
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
      paydayStart: normalizeDay(getValue(record, ['paydayStart', 'payday_start', 'borrowerPaydayStart', 'borrower_payday_start'])),
      paydayEnd:   normalizeDay(getValue(record, ['paydayEnd',   'payday_end',   'borrowerPaydayEnd',   'borrower_payday_end'])),
      gapReasons:  normalizeGapReasons(getValue(record, ['gapReasons', 'gap_reasons', 'borrowerGapReasons', 'borrower_gap_reasons']))
   };
};
