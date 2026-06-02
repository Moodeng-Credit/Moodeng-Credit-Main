import { addMonths, differenceInCalendarDays, format, isValid, parseISO } from 'date-fns';

import { formatCurrency } from '@/utils/decimalHelpers';

export const borrowerIncomeSetupIds = [
   'full_time',
   'part_time',
   'contract',
   'contract_temp',
   'freelance',
   'freelance_gig',
   'none',
   'no_income',
   'self_employed',
   'irregular',
   'irregular_income'
] as const;

export const borrowerPaydayWindowIds = ['1_5', '10_15', '15_20', '25_30', 'irregular', 'varies', 'it_varies'] as const;

export const borrowerCashGapIds = [
   'gap_before_payday',
   'bills_before_payday',
   'transport',
   'work_supplies',
   'family_needs',
   'food',
   'medical',
   'emergency_costs',
   'emergency_expense'
] as const;

export type BorrowerIncomeSetupId = (typeof borrowerIncomeSetupIds)[number];
export type BorrowerPaydayWindowId = (typeof borrowerPaydayWindowIds)[number];
export type BorrowerCashGapId = (typeof borrowerCashGapIds)[number];

export type BorrowerContextState = {
   incomeSetup?: BorrowerIncomeSetupId;
   paydayWindow?: BorrowerPaydayWindowId;
   cashGaps?: BorrowerCashGapId[];
   note?: string;
};

export type BorrowerContextFitLevel =
   | 'supportive'
   | 'consistent'
   | 'early_gap'
   | 'after_payday_gap'
   | 'distant'
   | 'variable'
   | 'no_income'
   | 'unclear';

export type BorrowerContextFitTone = 'supportive' | 'neutral' | 'caution';

export type BorrowerContextFitChipVariant = 'borrower' | 'request' | 'date' | 'due' | 'gap' | 'income' | 'payday' | 'delta' | 'neutral';

export type BorrowerContextFitChip = {
   id: string;
   label: string;
   text: string;
   variant: BorrowerContextFitChipVariant;
};

export type BorrowerContextFitSegment = string | { chipId: string };

export type BorrowerContextFit = {
   chips: BorrowerContextFitChip[];
   explanationSegments: BorrowerContextFitSegment[];
   fitLevel: BorrowerContextFitLevel;
   segments: BorrowerContextFitSegment[];
   secondaryChips: BorrowerContextFitChip[];
   showTimingClaim: boolean;
   tone: BorrowerContextFitTone;
};

export type BorrowerContextFitInput = {
   borrowerName: string;
   context?: BorrowerContextState | null;
   dueDate: string;
   loanAmount: number;
   loanReason: string;
   requestDate: string;
};

const knownIncomeSetupIds = new Set<string>(borrowerIncomeSetupIds);
const knownPaydayWindowIds = new Set<string>(borrowerPaydayWindowIds);
const knownCashGapIds = new Set<string>(borrowerCashGapIds);

const incomeContextLabels: Record<BorrowerIncomeSetupId, string> = {
   full_time: 'full-time employee',
   part_time: 'part-time worker',
   contract: 'contract worker',
   contract_temp: 'contract worker',
   freelance: 'freelance worker',
   freelance_gig: 'freelance worker',
   none: 'No income shared',
   no_income: 'No income shared',
   self_employed: 'self-employed',
   irregular: 'irregular income',
   irregular_income: 'irregular income'
};

const incomePatternLabels: Partial<Record<BorrowerIncomeSetupId, string>> = {
   full_time: 'full-time',
   part_time: 'part-time',
   contract: 'contract',
   contract_temp: 'contract',
   freelance: 'freelance',
   freelance_gig: 'freelance',
   self_employed: 'self-employed',
   irregular: 'irregular',
   irregular_income: 'irregular'
};

type PaydayWindowDefinition = { label: string; range: string; start?: number; end?: number; variable?: boolean };

const paydayContextLabels: Record<BorrowerPaydayWindowId, PaydayWindowDefinition> = {
   '1_5': { label: 'early month', range: '1st-5th', start: 1, end: 5 },
   '10_15': { label: 'mid-month', range: '10th-15th', start: 10, end: 15 },
   '15_20': { label: 'late month', range: '15th-20th', start: 15, end: 20 },
   '25_30': { label: 'end of month', range: '25th-30th', start: 25, end: 30 },
   irregular: { label: 'irregular payday', range: 'varies', variable: true },
   varies: { label: 'it varies', range: 'no fixed schedule', variable: true },
   it_varies: { label: 'it varies', range: 'no fixed schedule', variable: true }
};

const cashGapContextLabels: Record<BorrowerCashGapId, string> = {
   gap_before_payday: 'gap before payday',
   bills_before_payday: 'bills before payday',
   transport: 'transport costs',
   work_supplies: 'work supplies',
   family_needs: 'family needs',
   food: 'food',
   medical: 'medical expenses',
   emergency_costs: 'emergency costs',
   emergency_expense: 'emergency costs'
};

export const isBorrowerContextState = (value: unknown): value is BorrowerContextState => {
   if (!value || typeof value !== 'object') return false;
   const context = value as BorrowerContextState;
   return Boolean(
      typeof context.incomeSetup === 'string' &&
      context.incomeSetup.trim() &&
      knownIncomeSetupIds.has(context.incomeSetup) &&
      typeof context.paydayWindow === 'string' &&
      context.paydayWindow.trim() &&
      knownPaydayWindowIds.has(context.paydayWindow) &&
      Array.isArray(context.cashGaps) &&
      context.cashGaps.length > 0 &&
      context.cashGaps.every((gap) => typeof gap === 'string' && knownCashGapIds.has(gap))
   );
};

const chip = (id: string, label: string, text: string, variant: BorrowerContextFitChipVariant): BorrowerContextFitChip => ({
   id,
   label,
   text,
   variant
});

const chipSegment = (chipId: string): BorrowerContextFitSegment => ({ chipId });

const formatDelta = (days: number, direction: 'after' | 'before') => {
   const absoluteDays = Math.abs(days);
   return `${absoluteDays} ${absoluteDays === 1 ? 'day' : 'days'} ${direction} payday`;
};

const formatBridge = (days: number) => `${days}-day gap`;

const formatChipAmount = (amount: number) => formatCurrency(amount).replace(/\.00$/, '');

const startOfCalendarDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

const getMonthLastDay = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();

const buildPaydayWindowForMonth = (anchorDate: Date, payday: Required<Pick<PaydayWindowDefinition, 'start' | 'end'>>) => {
   const lastDay = getMonthLastDay(anchorDate);
   const startDay = Math.min(payday.start, lastDay);
   const endDay = Math.min(payday.end, lastDay);

   return {
      startDate: startOfCalendarDay(new Date(anchorDate.getFullYear(), anchorDate.getMonth(), startDay)),
      endDate: startOfCalendarDay(new Date(anchorDate.getFullYear(), anchorDate.getMonth(), Math.max(startDay, endDay)))
   };
};

const getNextPaydayWindow = (fromDate: Date, payday: Required<Pick<PaydayWindowDefinition, 'start' | 'end'>>) => {
   const currentWindow = buildPaydayWindowForMonth(fromDate, payday);
   if (startOfCalendarDay(fromDate).getTime() <= currentWindow.endDate.getTime()) return currentWindow;
   return buildPaydayWindowForMonth(addMonths(fromDate, 1), payday);
};

const buildBaseSegments = ({
   dueChipId,
   patternChipId,
   primaryGapChipId,
   requestChipId,
   borrowerChipId
}: {
   borrowerChipId: string;
   dueChipId: string;
   patternChipId?: string;
   primaryGapChipId?: string;
   requestChipId: string;
}): BorrowerContextFitSegment[] => {
   const segments: BorrowerContextFitSegment[] = [chipSegment(borrowerChipId)];

   if (patternChipId) {
      segments.push(' - ', chipSegment(patternChipId), ' - is requesting ');
   } else {
      segments.push(' is requesting ');
   }

   segments.push(chipSegment(requestChipId), ', due ', chipSegment(dueChipId));

   if (primaryGapChipId) {
      segments.push(', with recurring ', chipSegment(primaryGapChipId));
   }

   segments.push('.');
   return segments;
};

const buildResult = ({
   chips,
   explanationSegments = [],
   fitLevel,
   secondaryChips = [],
   segments,
   showTimingClaim,
   tone
}: BorrowerContextFit & { explanationSegments?: BorrowerContextFitSegment[] }): BorrowerContextFit => ({
   chips,
   explanationSegments,
   fitLevel,
   secondaryChips,
   segments,
   showTimingClaim,
   tone
});

export const buildBorrowerContextFit = ({
   borrowerName,
   context,
   dueDate,
   loanAmount,
   loanReason,
   requestDate
}: BorrowerContextFitInput): BorrowerContextFit => {
   const openedAt = parseISO(requestDate);
   const dueAt = parseISO(dueDate);
   const hasValidDates = isValid(openedAt) && isValid(dueAt);
   const requestReason = loanReason.trim() || 'loan request';
   const incomeLabel = context?.incomeSetup ? incomeContextLabels[context.incomeSetup] : undefined;
   const incomePatternLabel = context?.incomeSetup ? incomePatternLabels[context.incomeSetup] : undefined;
   const hasNoIncome = context?.incomeSetup === 'none' || context?.incomeSetup === 'no_income';
   const payday = context?.paydayWindow ? paydayContextLabels[context.paydayWindow] : undefined;
   const paydayChipLabel = payday?.range ? `${payday.range} monthly` : payday?.variable ? 'payday varies' : payday?.label;
   const paydayPatternLabel = paydayChipLabel && !payday?.variable ? `paid ${paydayChipLabel}` : paydayChipLabel;
   const payPattern = paydayPatternLabel ? [incomePatternLabel, paydayPatternLabel].filter(Boolean).join(', ') : incomePatternLabel;
   const gapLabels = (context?.cashGaps ?? []).map((gap) => cashGapContextLabels[gap]).filter(Boolean);
   const primaryGap = gapLabels[0];
   const secondaryGaps = gapLabels.slice(1);
   const openedText = hasValidDates ? format(openedAt, 'MMM d') : 'request date';
   const dueText = hasValidDates ? format(dueAt, 'MMM d') : 'repay date';
   const allChips = [
      chip('borrower', 'Borrower', borrowerName, 'borrower'),
      chip('opened', 'Opened', openedText, 'date'),
      chip('request', 'Request', `$${formatChipAmount(loanAmount)} for ${requestReason.toLowerCase()}`, 'request'),
      chip('due', 'Repay by', dueText, 'due'),
      incomeLabel ? chip('income', 'Income', incomeLabel, hasNoIncome ? 'neutral' : 'income') : null,
      paydayChipLabel ? chip('payday', 'Payday', paydayChipLabel, 'payday') : null,
      payPattern ? chip('pattern', 'Pattern', payPattern, 'income') : null,
      primaryGap ? chip('gap-primary', 'Need', primaryGap, 'gap') : null
   ].filter(Boolean) as BorrowerContextFitChip[];
   const secondaryChips = secondaryGaps.map((gap, index) => chip(`gap-secondary-${index}`, 'Also', gap, 'gap'));
   const baseSegments = buildBaseSegments({
      borrowerChipId: 'borrower',
      dueChipId: 'due',
      patternChipId: payPattern ? 'pattern' : undefined,
      primaryGapChipId: primaryGap ? 'gap-primary' : undefined,
      requestChipId: 'request'
   });

   if (!context || (!context.paydayWindow && !gapLabels.length)) {
      return buildResult({
         chips: allChips,
         explanationSegments: ['Bio context is incomplete. Use request reason and repayment history for context.'],
         fitLevel: 'unclear',
         secondaryChips,
         segments: baseSegments,
         showTimingClaim: false,
         tone: 'neutral'
      });
   }

   if (!hasValidDates) {
      return buildResult({
         chips: allChips,
         explanationSegments: ['The timing details are not available, so use repayment history and request reason to judge fit.'],
         fitLevel: 'unclear',
         secondaryChips,
         segments: baseSegments,
         showTimingClaim: false,
         tone: 'neutral'
      });
   }

   if (hasNoIncome) {
      return buildResult({
         chips: allChips,
         explanationSegments: ['No income source is included in the bio. Repayment history gives the clearest context.'],
         fitLevel: 'no_income',
         secondaryChips,
         segments: baseSegments,
         showTimingClaim: true,
         tone: 'caution'
      });
   }

   if (!payday || payday.variable || !payday.start || !payday.end) {
      return buildResult({
         chips: allChips,
         explanationSegments: ['Pay timing varies, so repayment history and request reason are the clearest bio signals.'],
         fitLevel: 'variable',
         secondaryChips,
         segments: baseSegments,
         showTimingClaim: true,
         tone: 'neutral'
      });
   }

   const daysFromRequestToDue = differenceInCalendarDays(dueAt, openedAt);

   if (daysFromRequestToDue > 30) {
      const deltaChip = chip('delta', 'Timing', `${daysFromRequestToDue} days after request`, 'delta');
      return buildResult({
         chips: [...allChips, deltaChip],
         explanationSegments: ['Repayment is due ', chipSegment('delta'), ', so payday timing is less useful as a short-term signal.'],
         fitLevel: 'distant',
         secondaryChips,
         segments: baseSegments,
         showTimingClaim: true,
         tone: 'neutral'
      });
   }

   const requestDay = startOfCalendarDay(openedAt);
   const dueDay = startOfCalendarDay(dueAt);
   const paydayWindowForRequestMonth = buildPaydayWindowForMonth(
      requestDay,
      payday as Required<Pick<PaydayWindowDefinition, 'start' | 'end'>>
   );
   const nextPaydayWindow = getNextPaydayWindow(requestDay, payday as Required<Pick<PaydayWindowDefinition, 'start' | 'end'>>);
   const openedAfterPaydayWindow = requestDay.getTime() > paydayWindowForRequestMonth.endDate.getTime();
   const dueDaysBeforePayday = differenceInCalendarDays(nextPaydayWindow.startDate, dueDay);
   const dueDaysAfterPayday = differenceInCalendarDays(dueDay, nextPaydayWindow.endDate);

   if (dueDay.getTime() < nextPaydayWindow.startDate.getTime()) {
      const deltaChip = chip('delta', 'Timing', formatDelta(dueDaysBeforePayday, 'before'), 'delta');

      if (openedAfterPaydayWindow) {
         const openedDeltaChip = chip(
            'opened-delta',
            'Opened',
            formatDelta(differenceInCalendarDays(requestDay, paydayWindowForRequestMonth.endDate), 'after'),
            'neutral'
         );

         return buildResult({
            chips: [...allChips, deltaChip, openedDeltaChip],
            explanationSegments: [
               'This request opened ',
               chipSegment('opened-delta'),
               ', and repayment is due ',
               chipSegment('delta'),
               '. Bio timing gives a less direct signal here, so repayment history is the clearest context.'
            ],
            fitLevel: 'after_payday_gap',
            secondaryChips,
            segments: baseSegments,
            showTimingClaim: true,
            tone: 'neutral'
         });
      }

      return buildResult({
         chips: [...allChips, deltaChip],
         explanationSegments: [
            'Repayment is due ',
            chipSegment('delta'),
            '. This may bridge an earlier gap, so repayment history gives the clearest context.'
         ],
         fitLevel: 'early_gap',
         secondaryChips,
         segments: baseSegments,
         showTimingClaim: true,
         tone: 'neutral'
      });
   }

   if (dueDay.getTime() >= nextPaydayWindow.startDate.getTime() && dueDay.getTime() <= nextPaydayWindow.endDate.getTime()) {
      const deltaChip = chip('delta', 'Timing', 'inside payday window', 'delta');
      return buildResult({
         chips: [...allChips, deltaChip],
         explanationSegments: ['Repayment falls ', chipSegment('delta'), ', matching the bio timing shared.'],
         fitLevel: 'consistent',
         secondaryChips,
         segments: baseSegments,
         showTimingClaim: true,
         tone: 'supportive'
      });
   }

   const deltaChip = chip('delta', 'Timing', formatDelta(dueDaysAfterPayday, 'after'), 'delta');
   const bridgeChip = chip('bridge', 'Bridge', formatBridge(Math.max(daysFromRequestToDue, 1)), 'delta');
   const explanationSegments: BorrowerContextFitSegment[] =
      incomeLabel && payday?.range
         ? [
              'As a ',
              chipSegment('income'),
              ' paid ',
              chipSegment('payday'),
              ', this request bridges a short-term ',
              chipSegment('bridge'),
              ', with repayment ',
              chipSegment('delta'),
              ', so the due date follows the bio timing shared.'
           ]
         : [
              'This request bridges a short-term ',
              chipSegment('bridge'),
              ', with repayment ',
              chipSegment('delta'),
              ', so the due date follows the bio timing shared.'
           ];

   return buildResult({
      chips: [...allChips, deltaChip, bridgeChip],
      explanationSegments,
      fitLevel: 'supportive',
      secondaryChips,
      segments: baseSegments,
      showTimingClaim: true,
      tone: 'supportive'
   });
};
