const POINTS_SCALE = 6;
const POINTS_MULTIPLIER = 2n;
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

   return minorUnits * POINTS_MULTIPLIER;
};

export const buildPointsIdempotencyKey = (payload: {
   userId: string;
   sourceType: string;
   sourceId: string;
   eventType: string;
}): string => {
   return `${payload.userId}:${payload.sourceType}:${payload.sourceId}:${payload.eventType}`;
};

export const pointsScale = POINTS_SCALE;
