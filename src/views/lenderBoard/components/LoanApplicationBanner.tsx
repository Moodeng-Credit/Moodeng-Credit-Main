import { type MouseEvent } from 'react';

import { Button } from '@/components/shadcn/button';
import { Card, CardContent } from '@/components/shadcn/card';

import { cn } from '@/lib/utils';

interface LoanApplicationBannerProps {
   onApplyClick: (e: MouseEvent<HTMLButtonElement>) => void;
}

export default function LoanApplicationBanner({ onApplyClick }: LoanApplicationBannerProps) {
   return (
      <Card
         className={cn(
            'mb-6 overflow-hidden border-0 bg-gradient-to-br from-[#ede9fe] to-[#e0e7ff]',
            'shadow-sm'
         )}
      >
         <CardContent className="p-6">
            <div className="flex items-center justify-between gap-6">
               <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                     Need short-term support?
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4">
                     Borrow USDC to build trust and unlock higher loan levels.
                  </p>
                  <Button
                     onClick={onApplyClick}
                     className="bg-[#6d57ff] hover:bg-[#5b46e0] text-white font-semibold rounded-lg shadow-sm"
                  >
                     Apply For A Loan
                  </Button>
               </div>
               <div className="hidden md:flex shrink-0 w-36 h-36 items-center justify-center rounded-2xl bg-white/60">
                  <span className="text-6xl" aria-hidden>
                     🦛
                  </span>
                  <span className="text-2xl ml-1" aria-hidden>
                     👍
                  </span>
               </div>
            </div>
         </CardContent>
      </Card>
   );
}
