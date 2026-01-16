const IOU_POINTS_SCALE = 6;

const normalizeDecimal = (value: number | string): { scaled: bigint } => {
   const raw = typeof value === 'number' ? value.toString() : value;
   const trimmed = raw.trim();

   if (trimmed.length === 0) {
      return { scaled: 0n };
   }

   const isNegative = trimmed.startsWith('-');
   const unsigned = trimmed.replace(/^[+-]/, '');
   const [whole, fraction = ''] = unsigned.split('.');
   const paddedFraction = fraction.padEnd(IOU_POINTS_SCALE, '0').slice(0, IOU_POINTS_SCALE);
   const digits = `${whole || '0'}${paddedFraction}`.replace(/^0+(?=\d)/, '');
   const scaled = BigInt(digits.length > 0 ? digits : '0');

   return { scaled: isNegative ? -scaled : scaled };
};

const formatScaledDecimal = (value: bigint): string => {
   const isNegative = value < 0n;
   const absValue = isNegative ? -value : value;
   const raw = absValue.toString().padStart(IOU_POINTS_SCALE + 1, '0');
   const whole = raw.slice(0, -IOU_POINTS_SCALE);
   const fraction = raw.slice(-IOU_POINTS_SCALE);

   return `${isNegative ? '-' : ''}${whole}.${fraction}`;
};

export const calculateIouPoints = (loanAmount: number | string): string => {
   const { scaled } = normalizeDecimal(loanAmount);
   const pointsScaled = scaled * 2n;

   return formatScaledDecimal(pointsScaled);
};
