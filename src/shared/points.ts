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
