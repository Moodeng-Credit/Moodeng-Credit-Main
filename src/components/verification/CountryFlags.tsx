import type { ComponentType } from 'react';

type FlagProps = { className?: string };

const starPoints = (cx: number, cy: number, outerR: number, innerR: number, count = 5) => {
   const points: string[] = [];
   for (let i = 0; i < count * 2; i++) {
      const r = i % 2 === 0 ? outerR : innerR;
      const angle = (Math.PI / count) * i - Math.PI / 2;
      points.push(`${(cx + r * Math.cos(angle)).toFixed(2)},${(cy + r * Math.sin(angle)).toFixed(2)}`);
   }
   return points.join(' ');
};

export const FlagVN = ({ className }: FlagProps) => (
   <svg viewBox="0 0 30 20" className={className} xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect width="30" height="20" fill="#da251d" />
      <polygon points={starPoints(15, 10, 6, 2.3)} fill="#ffcd00" />
   </svg>
);

export const FlagTW = ({ className }: FlagProps) => (
   <svg viewBox="0 0 30 20" className={className} xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect width="30" height="20" fill="#fe0000" />
      <rect width="15" height="10" fill="#000095" />
      <g stroke="#fff" strokeWidth="0.6">
         {Array.from({ length: 12 }, (_, i) => (
            <line key={i} x1="7.5" y1="5" x2="7.5" y2="2" transform={`rotate(${i * 30} 7.5 5)`} />
         ))}
      </g>
      <circle cx="7.5" cy="5" r="2" fill="#fff" />
   </svg>
);

export const FlagKR = ({ className }: FlagProps) => (
   <svg viewBox="0 0 30 20" className={className} xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect width="30" height="20" fill="#fff" />
      <path d="M15 4a3 3 0 010 6 3 3 0 000 6 6 6 0 000-12z" fill="#cd2e3a" />
      <path d="M15 4a6 6 0 000 12 3 3 0 010-6 3 3 0 000-6z" fill="#0047a0" />
   </svg>
);

export const FlagPH = ({ className }: FlagProps) => (
   <svg viewBox="0 0 30 20" className={className} xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect width="30" height="10" fill="#0038a8" />
      <rect y="10" width="30" height="10" fill="#ce1126" />
      <polygon points="0,0 0,20 13,10" fill="#fff" />
      <g stroke="#fcd116" strokeWidth="0.5">
         {Array.from({ length: 8 }, (_, i) => (
            <line key={i} x1="5" y1="10" x2="5" y2="6.5" transform={`rotate(${i * 45} 5 10)`} />
         ))}
      </g>
      <circle cx="5" cy="10" r="2" fill="#fcd116" />
      <polygon points={starPoints(2, 2, 1, 0.4)} fill="#fcd116" />
      <polygon points={starPoints(2, 18, 1, 0.4)} fill="#fcd116" />
      <polygon points={starPoints(11.5, 10, 1, 0.4)} fill="#fcd116" />
   </svg>
);

export const FlagMY = ({ className }: FlagProps) => {
   const stripeHeight = 20 / 14;
   return (
      <svg viewBox="0 0 30 20" className={className} xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
         {Array.from({ length: 14 }, (_, i) => (
            <rect key={i} y={i * stripeHeight} width="30" height={stripeHeight} fill={i % 2 === 0 ? '#cc0001' : '#fff'} />
         ))}
         <rect width="15" height={stripeHeight * 8} fill="#010066" />
         <circle cx="6" cy={stripeHeight * 4} r="3.4" fill="#fc0" />
         <circle cx="7.5" cy={stripeHeight * 3.6} r="3.4" fill="#010066" />
         <polygon points={starPoints(11, stripeHeight * 4, 1.8, 0.7, 8)} fill="#fc0" />
      </svg>
   );
};

export const FlagJP = ({ className }: FlagProps) => (
   <svg viewBox="0 0 30 20" className={className} xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect width="30" height="20" fill="#fff" />
      <circle cx="15" cy="10" r="6" fill="#bc002d" />
   </svg>
);

export const FlagID = ({ className }: FlagProps) => (
   <svg viewBox="0 0 30 20" className={className} xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect width="30" height="10" fill="#ce1126" />
      <rect y="10" width="30" height="10" fill="#fff" />
   </svg>
);

export const SUPPORTED_DIDIT_COUNTRIES: { code: string; name: string; Flag: ComponentType<FlagProps> }[] = [
   { code: 'VN', name: 'Vietnam', Flag: FlagVN },
   { code: 'TW', name: 'Taiwan', Flag: FlagTW },
   { code: 'KR', name: 'South Korea', Flag: FlagKR },
   { code: 'PH', name: 'Philippines', Flag: FlagPH },
   { code: 'MY', name: 'Malaysia', Flag: FlagMY },
   { code: 'JP', name: 'Japan', Flag: FlagJP },
   { code: 'ID', name: 'Indonesia', Flag: FlagID }
];
