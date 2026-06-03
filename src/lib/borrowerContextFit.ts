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
   fundedLoanCount?: number; // how many of their loans have been funded (0 = new borrower)
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

type PaydayWindow = {
   start: Date;
   end: Date;
};

const DAY_MS = 24 * 60 * 60 * 1000;

const incomeLabels: Record<BorrowerIncomeType, { chip: string; withArticle: string }> = {
   'full-time': { chip: 'full-time', withArticle: 'a full-time employee' },
   'part-time': { chip: 'part-time', withArticle: 'a part-time worker' },
   freelance: { chip: 'freelance', withArticle: 'a freelancer' },
   none: { chip: 'no income shared', withArticle: 'no income source' }
};

const paydayLabels: Record<BorrowerPaydayType, string> = {
   'mid-month': 'mid-month',
   'end-of-month': 'end-of-month',
   weekly: 'weekly',
   irregular: 'irregular'
};

const normalizeText = (value: unknown): string | null => {
   if (typeof value !== 'string') return null;
   const trimmed = value.trim();
   return trimmed.length > 0 ? trimmed : null;
};

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
   const startDay = clampDayToMonth(paydayStart, year, month);
   const endDay = clampDayToMonth(Math.max(paydayStart, paydayEnd), year, month);

   return {
      start: new Date(Date.UTC(year, month, startDay)),
      end: new Date(Date.UTC(year, month, endDay))
   };
};

const calculateGapDays = (dueDate: Date, paydayStart: number | null, paydayEnd: number | null): number | null => {
   if (!isValidPaydayDay(paydayStart) || !isValidPaydayDay(paydayEnd)) return null;

   const due = toUtcDay(dueDate);
   const window = buildPaydayWindow(due, paydayStart, paydayEnd);

   if (due < window.start) return daysBetween(window.start, due);
   if (due <= window.end) return daysBetween(window.start, due);
   return daysBetween(window.end, due);
};

const getFitLevel = (input: BorrowerContextInput, gapDays: number | null): Exclude<BorrowerContextFitLevel, 'unknown'> | 'unknown' => {
   if (input.incomeType === 'none') return 'unknown';
   if (input.paydayType === 'irregular' || gapDays === null || !isValidPaydayDay(input.paydayStart) || !isValidPaydayDay(input.paydayEnd)) {
      return 'unknown';
   }

   const due = toUtcDay(input.dueDate);
   const window = buildPaydayWindow(due, input.paydayStart, input.paydayEnd);
   const daysAfterWindow = daysBetween(window.end, due);

   if (due >= window.start && due <= window.end) return 'ok';
   if (due < window.start) return 'weak';
   if (daysAfterWindow >= 1 && daysAfterWindow <= 7) return 'strong';

   return 'weak';
};

const formatDateLabel = (date: Date): string =>
   new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC'
   }).format(date);

const formatAmount = (amount: number): string => {
   if (!Number.isFinite(amount)) return '$0';

   return `$${new Intl.NumberFormat('en-US', {
      maximumFractionDigits: 2,
      minimumFractionDigits: 0
   }).format(amount)}`;
};

const lowercaseFirst = (value: string): string => (value.length ? `${value[0].toLowerCase()}${value.slice(1)}` : value);

const formatMoneyNeed = (amount: number, reason: string): string => {
   const amountLabel = formatAmount(amount);
   const normalizedReason = normalizeText(reason);
   if (!normalizedReason) return amountLabel;

   return `${amountLabel} for ${lowercaseFirst(normalizedReason)}`;
};

const cleanList = (items: string[]): string[] => {
   const seen = new Set<string>();

   return items
      .map((item) => item.trim())
      .filter(Boolean)
      .filter((item) => {
         const key = item.toLowerCase();
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

const buildChips = (input: BorrowerContextInput, dueDate: Date | null, gapDays: number | null): BorrowerContextChip[] => {
   const needLabel = formatNaturalList(input.gapReasons, 'stated needs');
   const chips: BorrowerContextChip[] = [
      { id: 'name', label: normalizeText(input.borrowerName) ?? 'this borrower', type: 'name' },
      {
         id: 'pay',
         label:
            input.incomeType === 'none'
               ? incomeLabels.none.chip
               : `${incomeLabels[input.incomeType].chip}, ${paydayLabels[input.paydayType]} pay`,
         type: 'pay'
      },
      { id: 'money', label: formatMoneyNeed(input.amount, input.reason), type: 'money' },
      { id: 'date', label: dueDate ? formatDateLabel(dueDate) : 'unclear date', type: 'date' },
      { id: 'need', label: needLabel, type: 'need' }
   ];

   if (gapDays !== null) {
      chips.push({ id: 'delta', label: `${Math.abs(gapDays)}-day gap`, type: 'delta' });
   }

   return chips;
};

const buildContextLine = (): string => '{name} — {pay} — is requesting {money}, due {date}, with recurring {need}.';

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

const historyPhrase = (fundedLoanCount: number | undefined): string => {
   if (fundedLoanCount === undefined) return 'check their repayment history before funding';
   if (fundedLoanCount === 0) return 'this is their first funded request — judge fit on their profile and stated needs';
   if (fundedLoanCount === 1) return 'they have one repaid loan — review that track record before funding';
   return `they have ${fundedLoanCount} funded loans — lean on that repayment track record`;
};

const buildVerdict = (input: BorrowerContextInput, fitLevel: BorrowerContextFitLevel, gapDays: number, dueDate: Date): string => {
   const borrowerName = escapeHtml(normalizeText(input.borrowerName) ?? 'this borrower');
   const income = escapeHtml(incomeLabels[input.incomeType].withArticle);
   const payday = escapeHtml(paydayLabels[input.paydayType]);
   const dueLabel = escapeHtml(formatDateLabel(dueDate));
   const absGapDays = Math.abs(gapDays);
   const history = historyPhrase(input.fundedLoanCount);

   if (fitLevel === 'strong') {
      return `As ${income} paid ${payday}, ${borrowerName} will have received income before repayment is due. This request bridges a <strong>${absGapDays}-day gap</strong> before their next payday — a short-term need that fits squarely within their stated cash-flow pattern.`;
   }

   if (fitLevel === 'ok') {
      return `Repayment falls on ${dueLabel}, inside their usual ${payday} window, a <strong>${absGapDays}-day gap</strong> from the window opening. As ${income}, income is expected around the same time — this request is likely bridging the final days before pay arrives.`;
   }

   if (gapDays < 0) {
      return `Repayment is due <strong>${absGapDays} days</strong> before their usual payday window opens. Their profile doesn't clearly explain this timing — ${history}.`;
   }

   return `Repayment is due <strong>${absGapDays} days</strong> after their usual payday window closes. Their profile doesn't clearly explain this longer timing — ${history}.`;
};

export const buildBorrowerContextFit = (input: BorrowerContextInput): BorrowerContextResult => {
   const requestDate = isValidDate(input.requestDate) ? toUtcDay(input.requestDate) : null;
   const dueDate = isValidDate(input.dueDate) ? toUtcDay(input.dueDate) : null;

   if (!requestDate || !dueDate) {
      return buildNeutralResult(input, dueDate, null, 'Borrower timing is missing or unclear. Review repayment history before funding.');
   }

   const gapDays = input.paydayType === 'irregular' ? null : calculateGapDays(dueDate, input.paydayStart, input.paydayEnd);

   if (input.incomeType === 'none') {
      const history = historyPhrase(input.fundedLoanCount);
      return buildNeutralResult(
         input,
         dueDate,
         gapDays,
         `No income source shared. This request is based on stated needs alone — ${history}.`
      );
   }

   if (input.paydayType === 'irregular' || gapDays === null) {
      const firstGapReason = escapeHtml(cleanList(input.gapReasons)[0] ?? 'stated needs');
      const history = historyPhrase(input.fundedLoanCount);
      return buildNeutralResult(
         input,
         dueDate,
         gapDays,
         `With irregular income, timing alone isn't a strong signal here. This request is consistent with their stated ${firstGapReason} pattern — ${history}.`
      );
   }

   const fitLevel = getFitLevel(input, gapDays);
   if (fitLevel === 'unknown') {
      return buildNeutralResult(input, dueDate, gapDays, 'Borrower timing is missing or unclear. Review repayment history before funding.');
   }

   return {
      fitLevel,
      contextLine: buildContextLine(),
      verdictHTML: buildVerdict(input, fitLevel, gapDays, dueDate),
      chips: buildChips(input, dueDate, gapDays),
      gapDays
   };
};

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
      paydayEnd: normalizeDay(getValue(record, ['paydayEnd', 'payday_end', 'borrowerPaydayEnd', 'borrower_payday_end'])),
      gapReasons: normalizeGapReasons(getValue(record, ['gapReasons', 'gap_reasons', 'borrowerGapReasons', 'borrower_gap_reasons']))
   };
};
