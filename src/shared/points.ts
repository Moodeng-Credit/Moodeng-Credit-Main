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

export type TrustPointMilestoneRule = {
   id: string;
   pointSourceId: string;
   title: string;
   points: number;
   criteria: string;
   example: string;
};

export const trustPointMilestoneRules: TrustPointMilestoneRule[] = [
   {
      id: 'verify-identity',
      pointSourceId: '9c826a2d-2fc8-43b5-95b6-09d7f21f1e01',
      title: 'Verify your identity',
      points: 10,
      criteria: 'Borrower has ACTIVE World ID verification.',
      example: 'World ID verified = +10 Trust Points'
   },
   {
      id: 'first-loan-request',
      pointSourceId: '6cb37536-68e5-4d38-a2eb-ef850b69c7ad',
      title: 'Post your first loan request',
      points: 10,
      criteria: 'Borrower has at least one loan request record.',
      example: 'First request posted = +10 Trust Points'
   },
   {
      id: 'profile-name-added',
      pointSourceId: '7446f4ae-cc24-4718-8f98-f8ed7fc0afb9',
      title: 'Add a bio name',
      points: 10,
      criteria: 'Borrower has saved a bio display name.',
      example: 'Display name saved = +10 Trust Points'
   },
   {
      id: 'profile-image-added',
      pointSourceId: 'eb091789-5c5d-4d54-a927-87d58bea1206',
      title: 'Add a profile image',
      points: 15,
      criteria: 'Borrower has saved a profile image.',
      example: 'Profile image saved = +15 Trust Points'
   },
   {
      id: 'borrower-background-complete',
      pointSourceId: '9d3b05b2-4f6d-4ad2-8e60-29f11920f3a4',
      title: 'Complete borrower bio',
      points: 10,
      criteria: 'Borrower has a loan request with saved work, payday, and short-term help context.',
      example: 'Borrower bio saved with a request = +10 Trust Points'
   },
   {
      id: 'first-funded-loan',
      pointSourceId: 'a030a2e0-3955-443a-b2c7-e1ac03f0319f',
      title: 'Get funded by a lender',
      points: 15,
      criteria: 'Borrower has at least one funded loan.',
      example: 'First funded loan = +15 Trust Points'
   },
   {
      id: 'first-on-time-repayment',
      pointSourceId: '30898ca5-6a8f-4275-8b33-56d5d797435b',
      title: 'Repay a loan on time',
      points: 20,
      criteria: 'Borrower fully repays at least one loan on or before its due date.',
      example: 'First on-time full repayment = +20 Trust Points'
   },
   {
      id: 'two-on-time-streak',
      pointSourceId: 'f7c1c0d2-93a9-404d-925c-7201d20d0d84',
      title: 'Build a 2-loan on-time streak',
      points: 25,
      criteria: 'Borrower fully repays at least two loans on or before their due dates.',
      example: 'Second on-time full repayment = +25 Trust Points'
   },
   {
      id: 'full-limit-credit-builder',
      pointSourceId: '1e10653e-46ce-4c8d-b2ef-738f3c55a7c9',
      title: 'Repay a full-limit credit-builder',
      points: 30,
      criteria: 'Borrower fully repays a credit-tier amount on time.',
      example: 'On-time repayment of a $15, $20, $40, $60, $80, $100, $120, or $140 loan = +30 Trust Points'
   },
   {
      id: 'two-unique-lenders',
      pointSourceId: '05d358b1-ce9b-49ec-9fd6-61611c1e4e37',
      title: 'Borrow from 2 different lenders',
      points: 30,
      criteria: 'Borrower has funded loans from at least two unique lenders.',
      example: 'Second unique lender relationship = +30 Trust Points'
   },
   {
      id: 'repay-100-total',
      pointSourceId: 'e4a7c7cb-2a88-483e-ad57-a79b35e1a32b',
      title: 'Repay $100 total',
      points: 40,
      criteria: 'Borrower has at least $100 in total repaid amount across paid loans.',
      example: '$100 total repaid = +40 Trust Points'
   },
   {
      id: 'reach-level-three',
      pointSourceId: 'fe748497-60b8-4545-b44c-3f77c7172dc6',
      title: 'Reach Credit Level 3',
      points: 50,
      criteria: 'Borrower is verified and has unlocked a $40 or higher credit limit.',
      example: 'Credit limit reaches $40 = +50 Trust Points'
   },
   {
      id: 'trusted-borrower-candidate',
      pointSourceId: '3d321dad-0854-4f4b-aa95-5441a8f77099',
      title: 'Become a trusted borrower candidate',
      points: 75,
      criteria: 'Borrower has five on-time repayments, three unique lenders, and no unresolved defaults.',
      example: 'Trusted borrower candidate criteria met = +75 Trust Points'
   }
];

export const trustPointMilestoneRuleById = trustPointMilestoneRules.reduce(
   (rulesById, rule) => {
      rulesById[rule.id] = rule;
      return rulesById;
   },
   {} as Record<string, TrustPointMilestoneRule>
);

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

const trustPointMilestoneAwardRules: PointsAwardRule[] = trustPointMilestoneRules.map((rule) => ({
   id: `trust-${rule.id}`,
   system: 'Trust points',
   action: rule.title,
   eventType: 'completed',
   sourceType: 'reputation_milestone',
   actor: 'Borrower',
   points: `+${rule.points} Trust Points`,
   criteria: rule.criteria,
   sourceOfTruth: 'milestone_definitions, record_milestone_completion(), trust_point_events, and user_trust_points',
   status: 'live',
   example: rule.example
}));

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
   ...trustPointMilestoneAwardRules,
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
   }
];

export const iouPointsAwardRules = pointsAwardRules.filter((rule) => rule.system === 'IOU points');
export const trustPointsAwardRules = pointsAwardRules.filter((rule) => rule.system === 'Trust points');
