import { type MouseEvent } from 'react';

import { Button } from '@/components/shadcn/button';
import { Card, CardContent } from '@/components/shadcn/card';

import { cn } from '@/lib/utils';

import supportImage from '../../../images/request_board_support.png';

interface LoanApplicationBannerProps {
   onApplyClick: (e: MouseEvent<HTMLButtonElement>) => void;
}

export default function LoanApplicationBanner({ onApplyClick }: LoanApplicationBannerProps) {
   return (
      <Card
         className={cn('rounded-lg border-0 overflow-hidden shadow-sm mb-6')}
         style={{ backgroundColor: '#F1E9FD' }}
      >
         <CardContent className="p-4">
            <div className="flex items-center justify-between gap-4">
               <div className="flex-1 min-w-0">
                  <h3 className="text-base font-semibold text-foreground mb-1">
                     Need short-term support?
                  </h3>
                  <p className="text-xs text-muted-foreground mb-2">
                     Borrow USDC to build trust and unlock higher loan levels.
                     
                  </p>
                  <Button
                     onClick={onApplyClick}
                     className="bg-[#6d57ff] hover:bg-[#5b46e0] text-white text-sm font-semibold rounded-lg shadow-sm"
                  >
                     Apply For A Loan
                  </Button>
               </div>
               <div className="shrink-0 w-[142px] h-[120px] rounded-xl overflow-visible bg-white/60 flex items-center justify-center">
                  <img
                     src={supportImage}
                     alt=""
                     className="block"
                     style={{
                        width: 210,
                        height: 144,
                        objectFit: 'cover',
                        objectPosition: 'center',
                        margin: '-17px -24px',
                        transform: 'scaleX(-1)',                     }}
                  />
               </div>
            </div>
         </CardContent>
      </Card>
   );
}
