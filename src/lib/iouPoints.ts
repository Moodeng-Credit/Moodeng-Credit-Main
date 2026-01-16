const IOU_POINTS_SCALE = 6;
const IOU_POINTS_FACTOR = 10 ** IOU_POINTS_SCALE;

const normalizeDecimal = (value: number): { scaled: bigint } => {
   if (!Number.isFinite(value)) {
      return { scaled: 0n };
   }

   const scaled = BigInt(Math.round(value * IOU_POINTS_FACTOR));

   return { scaled };
};

const formatScaledDecimal = (value: bigint): string => {
   const raw = value.toString().padStart(IOU_POINTS_SCALE + 1, '0');
   const whole = raw.slice(0, -IOU_POINTS_SCALE);
   const fraction = raw.slice(-IOU_POINTS_SCALE);

   if (/^0+$/.test(fraction)) {
      return whole;
   }

   return `${whole}.${fraction}`;
};

export const calculateIouPoints = (loanAmount: number): string => {
   const { scaled } = normalizeDecimal(loanAmount);
   const pointsScaled = scaled * 2n;

   return formatScaledDecimal(pointsScaled);
};
