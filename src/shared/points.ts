const POINTS_SCALE = 6;
const LOAN_FUNDING_POINTS_PER_USDC = 1;
const LOAN_FUNDING_POINTS_MULTIPLIER = BigInt(LOAN_FUNDING_POINTS_PER_USDC);
export const ACADEMY_QUIZ_POINTS_PER_CORRECT_ANSWER = 2;
const DECIMAL_PATTERN = /^\d+(\.\d+)?$/;

const parseAmountToMinorUnits = (amount: string | number): bigint => {
   const normalized = typeof amount === 'number' ? amount.toString() : amount.trim();

   if (normalized.length === 0 || normalized.includes('e') || normalized.includes('E')) {
      throw new Error('Loan amount must be a base-10 number');
   }

   if (!DECIMAL_PATTERN.test(normalized)) {
      throw new Error('Loan amount must be a positive number');
   }

   const [whole, fraction = ''] = normalized.split('.');

   if (fraction.length > POINTS_SCALE) {
      throw new Error(`Loan amount must have at most ${POINTS_SCALE} decimal places`);
   }

   const paddedFraction = fraction.padEnd(POINTS_SCALE, '0');
   const scaleFactor = 10n ** BigInt(POINTS_SCALE);

   return BigInt(whole) * scaleFactor + BigInt(paddedFraction || '0');
};

export const computePointsDelta = (loanAmount: string | number): bigint => {
   const minorUnits = parseAmountToMinorUnits(loanAmount);

   return minorUnits * LOAN_FUNDING_POINTS_MULTIPLIER;
};

const pointsMajorToMinor = (points: number): bigint => {
   return BigInt(Math.trunc(points)) * 10n ** BigInt(POINTS_SCALE);
};

export type IouBorrowerBonusTier = {
   id: string;
   borrowerLoanNumber: string;
   priorFundedLoanCount: number | 'subsequent';
   bonusPoints: number;
   criteria: string;
};

export const yearOneIouBorrowerBonusTiers: IouBorrowerBonusTier[] = [
   {
      id: 'first-time-borrower',
      borrowerLoanNumber: '1st funded borrower loan',
      priorFundedLoanCount: 0,
      bonusPoints: 25,
      criteria: 'Borrower has no prior funded loans.'
   },
   {
      id: 'second-time-borrower',
      borrowerLoanNumber: '2nd funded borrower loan',
      priorFundedLoanCount: 1,
      bonusPoints: 20,
      criteria: 'Borrower has one prior funded loan.'
   },
   {
      id: 'third-time-borrower',
      borrowerLoanNumber: '3rd funded borrower loan',
      priorFundedLoanCount: 2,
      bonusPoints: 15,
      criteria: 'Borrower has two prior funded loans.'
   },
   {
      id: 'subsequent-borrower',
      borrowerLoanNumber: '4th+ funded borrower loan',
      priorFundedLoanCount: 'subsequent',
      bonusPoints: 10,
      criteria: 'Borrower has three or more prior funded loans.'
   }
];

export const getYearOneIouBorrowerBonusPoints = (borrowerPriorFundedLoanCount: number): number => {
   const priorFundedLoans = Math.max(0, Math.trunc(borrowerPriorFundedLoanCount));

   if (priorFundedLoans === 0) return 25;
   if (priorFundedLoans === 1) return 20;
   if (priorFundedLoans === 2) return 15;
   return 10;
};

export const computeYearOneIouPointsDelta = (loanAmount: string | number, borrowerPriorFundedLoanCount: number): bigint => {
   return computePointsDelta(loanAmount) + pointsMajorToMinor(getYearOneIouBorrowerBonusPoints(borrowerPriorFundedLoanCount));
};

export const computeAcademyQuizPoints = (correctAnswers: number): number => {
   return Math.max(0, Math.trunc(correctAnswers)) * ACADEMY_QUIZ_POINTS_PER_CORRECT_ANSWER;
};

export const buildPointsIdempotencyKey = (payload: { userId: string; sourceType: string; sourceId: string; eventType: string }): string => {
   return `${payload.userId}:${payload.sourceType}:${payload.sourceId}:${payload.eventType}`;
};

const safeToBigInt = (value: number | string | bigint): bigint => {
   if (typeof value === 'bigint') return value;
   if (typeof value === 'number') {
      if (!Number.isFinite(value)) return 0n;
      return BigInt(Math.trunc(value));
   }

   const normalized = value.trim();
   if (normalized.length === 0) return 0n;
   const numeric = normalized.split('.')[0];
   if (!/^\d+$/.test(numeric)) return 0n;
   return BigInt(numeric);
};

export const formatPointsMajor = (minorUnits?: number | string | bigint | null): string => {
   if (minorUnits === null || minorUnits === undefined) return '0';

   const minor = safeToBigInt(minorUnits);
   const scaleFactor = 10n ** BigInt(POINTS_SCALE);
   const whole = minor / scaleFactor;
   const fraction = minor % scaleFactor;

   if (fraction === 0n) {
      return whole.toString();
   }

   const fractionStr = fraction.toString().padStart(POINTS_SCALE, '0').replace(/0+$/, '');
   return `${whole.toString()}.${fractionStr}`;
};

export const pointsScale = POINTS_SCALE;
export const loanFundingPointsPerUsdc = LOAN_FUNDING_POINTS_PER_USDC;

export type PointsAwardRuleStatus = 'live' | 'display-only' | 'not-awarded';

export type PointsAwardRule = {
   id: string;
   system: 'IOU points' | 'Trust points' | 'Academy reward';
   action: string;
   eventType: string;
   sourceType: string;
   actor: string;
   points: string;
   criteria: string;
   sourceOfTruth: string;
   status: PointsAwardRuleStatus;
   example: string;
   bonusTiers?: IouBorrowerBonusTier[];
};

export const pointsAwardRules: PointsAwardRule[] = [
   {
      id: 'loan-funded',
      system: 'IOU points',
      action: 'Loan funded',
      eventType: 'funded',
      sourceType: 'loan',
      actor: 'Lender',
      points: `Year 1: ${loanFundingPointsPerUsdc} IOU point per 1 USDC funded + borrower-order bonus`,
      criteria:
         'A requested loan is updated to Lent and has a lender user id. Borrower bonus is based on prior funded loans for that borrower.',
      sourceOfTruth: 'computeYearOneIouPointsDelta(), getYearOneIouBorrowerBonusPoints(), and award_points()',
      status: 'live',
      example: `$20 funded first-time borrower loan = ${formatPointsMajor(computeYearOneIouPointsDelta('20', 0))} IOU points`,
      bonusTiers: yearOneIouBorrowerBonusTiers
   },
   {
      id: 'academy-quiz',
      system: 'Academy reward',
      action: 'Academy quiz',
      eventType: 'academy_quiz',
      sourceType: 'academy',
      actor: 'Borrower or lender',
      points: `${ACADEMY_QUIZ_POINTS_PER_CORRECT_ANSWER} points per correct answer shown in the Academy UI`,
      criteria: 'The visible Academy reward flow calculates the score, but no point event is written yet.',
      sourceOfTruth: 'computeAcademyQuizPoints()',
      status: 'display-only',
      example: `5 correct answers = ${computeAcademyQuizPoints(5)} displayed points`
   },
   {
      id: 'loan-repaid',
      system: 'Trust points',
      action: 'Loan repaid',
      eventType: 'repaid',
      sourceType: 'loan',
      actor: 'Borrower',
      points: '0 trust points today',
      criteria: 'On-time fully repaid loans can raise credit limit; they do not currently add rows to a trust_points balance.',
      sourceOfTruth: 'credit progression in loanSlice, not award_points()',
      status: 'not-awarded',
      example: 'Fully repaid on time = possible credit limit growth, 0 trust-point event'
   }
];

export const iouPointsAwardRules = pointsAwardRules.filter((rule) => rule.system === 'IOU points');
export const trustPointsAwardRules = pointsAwardRules.filter((rule) => rule.system === 'Trust points');
