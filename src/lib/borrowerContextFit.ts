import { differenceInCalendarDays, format, isValid, parseISO } from 'date-fns';

import { formatCurrency } from '@/utils/decimalHelpers';

export type BorrowerContextState = {
   incomeSetup?: string;
   paydayWindow?: string;
   cashGaps?: string[];
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

export type BorrowerContextFitChipVariant =
   | 'borrower'
   | 'request'
   | 'date'
   | 'due'
   | 'gap'
   | 'income'
   | 'payday'
   | 'delta'
   | 'neutral';

export type BorrowerContextFitChip = {
   id: string;
   label: string;
   text: string;
   variant: BorrowerContextFitChipVariant;
};

export type BorrowerContextFitSegment = string | { chipId: string };

export type BorrowerContextFit = {
   chips: BorrowerContextFitChip[];
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

const incomeContextLabels: Record<string, string> = {
   full_time: 'full-time income',
   part_time: 'part-time income',
   contract: 'contract income',
   contract_temp: 'contract income',
   freelance: 'freelance income',
   freelance_gig: 'freelance income',
   none: 'No income shared',
   no_income: 'No income shared',
   self_employed: 'self-employed income',
   irregular: 'irregular income',
   irregular_income: 'irregular income'
};

const paydayContextLabels: Record<string, { label: string; range: string; start?: number; end?: number; variable?: boolean }> = {
   '1_5': { label: 'early month', range: '1st-5th', start: 1, end: 5 },
   '10_15': { label: 'mid-month', range: '10th-15th', start: 10, end: 15 },
   '15_20': { label: 'late month', range: '15th-20th', start: 15, end: 20 },
   '25_30': { label: 'end of month', range: '25th-30th', start: 25, end: 30 },
   irregular: { label: 'irregular payday', range: 'varies', variable: true },
   varies: { label: 'it varies', range: 'no fixed schedule', variable: true },
   it_varies: { label: 'it varies', range: 'no fixed schedule', variable: true }
};

const cashGapContextLabels: Record<string, string> = {
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
   return Boolean(context.incomeSetup || context.paydayWindow || context.cashGaps?.length);
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

const formatChipAmount = (amount: number) => formatCurrency(amount).replace(/\.00$/, '');

const buildBaseSegments = ({
   dueChipId,
   incomeChipId,
   openedChipId,
   paydayChipId,
   primaryGapChipId,
   requestChipId,
   borrowerChipId
}: {
   borrowerChipId: string;
   dueChipId: string;
   incomeChipId?: string;
   openedChipId: string;
   paydayChipId?: string;
   primaryGapChipId?: string;
   requestChipId: string;
}): BorrowerContextFitSegment[] => {
   const segments: BorrowerContextFitSegment[] = [
      chipSegment(borrowerChipId),
      ' opened this request for ',
      chipSegment(requestChipId),
      ' on ',
      chipSegment(openedChipId),
      ', planning to repay by ',
      chipSegment(dueChipId),
      '. '
   ];

   if (primaryGapChipId) {
      segments.push('They marked ', chipSegment(primaryGapChipId), ' as the cash-flow gap. ');
   }

   if (incomeChipId && paydayChipId) {
      segments.push('Their profile shows ', chipSegment(incomeChipId), ' paid ', chipSegment(paydayChipId), '. ');
   } else if (incomeChipId) {
      segments.push('Their profile shows ', chipSegment(incomeChipId), '. ');
   } else if (paydayChipId) {
      segments.push('Their profile shows ', chipSegment(paydayChipId), ' pay timing. ');
   }

   return segments;
};

const buildResult = ({
   chips,
   fitLevel,
   secondaryChips = [],
   segments,
   showTimingClaim,
   tone
}: BorrowerContextFit): BorrowerContextFit => ({
   chips,
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
   const hasNoIncome = context?.incomeSetup === 'none' || context?.incomeSetup === 'no_income';
   const payday = context?.paydayWindow ? paydayContextLabels[context.paydayWindow] : undefined;
   const gapLabels = (context?.cashGaps ?? []).map((gap) => cashGapContextLabels[gap]).filter(Boolean);
   const primaryGap = gapLabels[0];
   const secondaryGaps = gapLabels.slice(1);
   const openedText = hasValidDates ? format(openedAt, 'MMM d') : 'request date';
   const dueText = hasValidDates ? format(dueAt, 'MMM d') : 'repay date';
   const allChips = [
      chip('borrower', 'Borrower', borrowerName, 'borrower'),
      chip('opened', 'Opened', openedText, 'date'),
      chip('request', 'Request', `$${formatChipAmount(loanAmount)} · ${requestReason.toLowerCase()}`, 'request'),
      chip('due', 'Repay by', dueText, 'due'),
      incomeLabel ? chip('income', 'Income', incomeLabel, hasNoIncome ? 'neutral' : 'income') : null,
      payday ? chip('payday', 'Payday', `${payday.label}${payday.range ? ` (${payday.range})` : ''}`, 'payday') : null,
      primaryGap ? chip('gap-primary', 'Need', primaryGap, 'gap') : null
   ].filter(Boolean) as BorrowerContextFitChip[];
   const secondaryChips = secondaryGaps.map((gap, index) => chip(`gap-secondary-${index}`, 'Also', gap, 'gap'));
   const baseSegments = buildBaseSegments({
      borrowerChipId: 'borrower',
      dueChipId: 'due',
      incomeChipId: incomeLabel ? 'income' : undefined,
      openedChipId: 'opened',
      paydayChipId: payday ? 'payday' : undefined,
      primaryGapChipId: primaryGap ? 'gap-primary' : undefined,
      requestChipId: 'request'
   });

   if (!context || (!context.paydayWindow && !gapLabels.length)) {
      return buildResult({
         chips: allChips,
         fitLevel: 'unclear',
         secondaryChips,
         segments: [...baseSegments, 'Use the request reason and repayment history to judge fit.'],
         showTimingClaim: false,
         tone: 'neutral'
      });
   }

   if (!hasValidDates) {
      return buildResult({
         chips: allChips,
         fitLevel: 'unclear',
         secondaryChips,
         segments: [...baseSegments, 'The timing details are not available, so use repayment history and request reason to judge fit.'],
         showTimingClaim: false,
         tone: 'neutral'
      });
   }

   if (hasNoIncome) {
      return buildResult({
         chips: allChips,
         fitLevel: 'no_income',
         secondaryChips,
         segments: [...baseSegments, 'This borrower has not shared an income source. Review repayment history for more context.'],
         showTimingClaim: true,
         tone: 'caution'
      });
   }

   if (!payday || payday.variable || !payday.start || !payday.end) {
      return buildResult({
         chips: allChips,
         fitLevel: 'variable',
         secondaryChips,
         segments: [...baseSegments, 'Their payday timing varies, so use repayment history and request reason to judge fit.'],
         showTimingClaim: true,
         tone: 'neutral'
      });
   }

   const daysFromRequestToDue = differenceInCalendarDays(dueAt, openedAt);

   if (daysFromRequestToDue > 30) {
      const deltaChip = chip('delta', 'Timing', `${daysFromRequestToDue} days after request`, 'delta');
      return buildResult({
         chips: [...allChips, deltaChip],
         fitLevel: 'distant',
         secondaryChips,
         segments: [...baseSegments, 'Repayment is due ', chipSegment('delta'), ', so payday timing is less of a signal here.'],
         showTimingClaim: true,
         tone: 'neutral'
      });
   }

   const requestDay = openedAt.getDate();
   const dueDay = dueAt.getDate();

   if (requestDay > payday.end) {
      const deltaChip = chip('delta', 'Timing', formatDelta(requestDay - payday.end, 'after'), 'delta');
      return buildResult({
         chips: [...allChips, deltaChip],
         fitLevel: 'after_payday_gap',
         secondaryChips,
         segments: [
            ...baseSegments,
            'This request was opened ',
            chipSegment('delta'),
            ', which may reflect a gap after income was received.'
         ],
         showTimingClaim: true,
         tone: 'neutral'
      });
   }

   if (dueDay < payday.start) {
      const deltaChip = chip('delta', 'Timing', formatDelta(payday.start - dueDay, 'before'), 'delta');
      return buildResult({
         chips: [...allChips, deltaChip],
         fitLevel: 'early_gap',
         secondaryChips,
         segments: [
            ...baseSegments,
            'Repayment is due ',
            chipSegment('delta'),
            '. This may bridge an earlier gap, so borrower history gives the clearest context.'
         ],
         showTimingClaim: true,
         tone: 'neutral'
      });
   }

   if (dueDay >= payday.start && dueDay <= payday.end) {
      const deltaChip = chip('delta', 'Timing', 'inside payday window', 'delta');
      return buildResult({
         chips: [...allChips, deltaChip],
         fitLevel: 'consistent',
         secondaryChips,
         segments: [...baseSegments, 'Repayment falls ', chipSegment('delta'), ', consistent with their profile.'],
         showTimingClaim: true,
         tone: 'supportive'
      });
   }

   const deltaChip = chip('delta', 'Timing', formatDelta(dueDay - payday.end, 'after'), 'delta');
   return buildResult({
      chips: [...allChips, deltaChip],
      fitLevel: 'supportive',
      secondaryChips,
      segments: [
         ...baseSegments,
         'Repayment falls ',
         chipSegment('delta'),
         ', so the due date follows the income timing they shared.'
      ],
      showTimingClaim: true,
      tone: 'supportive'
   });
};
