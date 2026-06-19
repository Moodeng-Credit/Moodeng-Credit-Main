import type { ComponentType } from 'react';

type FlagProps = { className?: string };

export const FlagVN = ({ className }: FlagProps) => (
   <svg viewBox="0 0 30 20" className={className} xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect width="30" height="20" fill="#DA251D" />
      <polygon points="15,3.5 16.76,8.9 22.4,8.9 17.82,12.1 19.58,17.5 15,14.3 10.42,17.5 12.18,12.1 7.6,8.9 13.24,8.9" fill="#FFFF00" />
   </svg>
);

export const FlagTW = ({ className }: FlagProps) => (
   <svg viewBox="0 0 30 20" className={className} xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect width="30" height="20" fill="#FE0000" />
      <rect width="15" height="10" fill="#000095" />
      <circle cx="7.5" cy="5" r="3.2" fill="white" />
      <circle cx="7.5" cy="5" r="2.2" fill="#000095" />
      {[0,30,60,90,120,150,180,210,240,270,300,330].map((a, i) => (
         <line key={i} x1="7.5" y1="5"
            x2={7.5 + 3.2 * Math.cos((a - 90) * Math.PI / 180)}
            y2={5 + 3.2 * Math.sin((a - 90) * Math.PI / 180)}
            stroke="white" strokeWidth="0.6" />
      ))}
   </svg>
);

export const FlagKR = ({ className }: FlagProps) => (
   <svg viewBox="0 0 30 20" className={className} xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect width="30" height="20" fill="white" />
      <circle cx="15" cy="10" r="4" fill="#003478" />
      <path d="M15,6 A4,4 0 0,1 15,14 A2,2 0 0,1 15,10 A2,2 0 0,0 15,6Z" fill="#CD2E3A" />
      <line x1="4" y1="4.5" x2="9" y2="2" stroke="#000" strokeWidth="0.8" />
      <line x1="4" y1="6" x2="9" y2="3.5" stroke="#000" strokeWidth="0.8" />
      <line x1="4" y1="7.5" x2="9" y2="5" stroke="#000" strokeWidth="0.8" />
      <line x1="21" y1="2" x2="26" y2="4.5" stroke="#000" strokeWidth="0.8" />
      <line x1="21" y1="3.5" x2="26" y2="6" stroke="#000" strokeWidth="0.8" />
      <line x1="21" y1="5" x2="26" y2="7.5" stroke="#000" strokeWidth="0.8" />
      <line x1="4" y1="12.5" x2="9" y2="15" stroke="#000" strokeWidth="0.8" />
      <line x1="4" y1="14" x2="6.7" y2="15.35" stroke="#000" strokeWidth="0.8" />
      <line x1="6.3" y1="14.65" x2="9" y2="16" stroke="#000" strokeWidth="0.8" />
      <line x1="4" y1="15.5" x2="9" y2="18" stroke="#000" strokeWidth="0.8" />
      <line x1="21" y1="15" x2="26" y2="12.5" stroke="#000" strokeWidth="0.8" />
      <line x1="21" y1="16.5" x2="26" y2="14" stroke="#000" strokeWidth="0.8" />
      <line x1="21" y1="18" x2="26" y2="15.5" stroke="#000" strokeWidth="0.8" />
   </svg>
);

export const FlagPH = ({ className }: FlagProps) => (
   <svg viewBox="0 0 30 20" className={className} xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect width="30" height="10" fill="#0038A8" />
      <rect y="10" width="30" height="10" fill="#CE1126" />
      <polygon points="0,0 15,10 0,20" fill="white" />
      <circle cx="5.5" cy="10" r="1.6" fill="#FCD116" />
      {[0, 120, 240].map((a, i) => (
         <polygon key={i}
            points={`${5.5 + 3.5 * Math.cos((a - 90) * Math.PI / 180)},${10 + 3.5 * Math.sin((a - 90) * Math.PI / 180)} ${5.5 + 1.1 * Math.cos((a - 60) * Math.PI / 180)},${10 + 1.1 * Math.sin((a - 60) * Math.PI / 180)} ${5.5 + 1.1 * Math.cos((a - 120) * Math.PI / 180)},${10 + 1.1 * Math.sin((a - 120) * Math.PI / 180)}`}
            fill="#FCD116" />
      ))}
   </svg>
);

export const FlagMY = ({ className }: FlagProps) => (
   <svg viewBox="0 0 30 20" className={className} xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      {[0,1,2,3,4,5,6].map(i => (
         <rect key={i} x="0" y={i * (20/7)} width="30" height={20/7} fill={i % 2 === 0 ? '#CC0001' : 'white'} />
      ))}
      <rect width="15" height={20 * 4/7} fill="#010066" />
      <circle cx="6.5" cy="5.7" r="2.8" fill="#FC0" />
      <circle cx="7.5" cy="5.7" r="2.1" fill="#010066" />
      <polygon points="9.5,5.7 10.5,3.9 10.5,7.5" fill="#FC0" />
      {[0,45,90,135,180,225,270,315].map((a, i) => (
         <circle key={i}
            cx={9.5 + 1.3 * Math.cos(a * Math.PI / 180)}
            cy={5.7 + 1.3 * Math.sin(a * Math.PI / 180)}
            r="0.25" fill="#FC0" />
      ))}
   </svg>
);

export const FlagJP = ({ className }: FlagProps) => (
   <svg viewBox="0 0 30 20" className={className} xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect width="30" height="20" fill="white" />
      <circle cx="15" cy="10" r="5.5" fill="#BC002D" />
   </svg>
);

export const FlagID = ({ className }: FlagProps) => (
   <svg viewBox="0 0 30 20" className={className} xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect width="30" height="10" fill="#CE1126" />
      <rect y="10" width="30" height="10" fill="white" />
   </svg>
);

export const FlagTH = ({ className }: FlagProps) => (
   <svg viewBox="0 0 30 20" className={className} xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect width="30" height="20" fill="#A51931" />
      <rect y="3.3" width="30" height="13.4" fill="white" />
      <rect y="6.7" width="30" height="6.6" fill="#2D2A4A" />
   </svg>
);

export const SUPPORTED_DIDIT_COUNTRIES: { code: string; name: string; Flag: ComponentType<FlagProps> }[] = [
   { code: 'VN', name: 'Vietnam', Flag: FlagVN },
   { code: 'TW', name: 'Taiwan', Flag: FlagTW },
   { code: 'KR', name: 'South Korea', Flag: FlagKR },
   { code: 'PH', name: 'Philippines', Flag: FlagPH },
   { code: 'MY', name: 'Malaysia', Flag: FlagMY },
   { code: 'JP', name: 'Japan', Flag: FlagJP },
   { code: 'ID', name: 'Indonesia', Flag: FlagID },
   { code: 'TH', name: 'Thailand', Flag: FlagTH }
];
