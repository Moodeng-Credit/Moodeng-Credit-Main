import { type JSX } from 'react';

import { poseSrc } from '@/components/mecha/mechaAssets';
import { openMecha, type MechaContext } from '@/components/mecha/mechaBus';

// Inline "Ask Mecha" trigger (Direction 04). Drop it next to an error or a
// friction point; on tap it opens the shared panel pre-loaded with a question and
// the current context — zero typing for the user.

interface AskMechaButtonProps {
   label: string;
   /** Auto-sent as the user's first message, so Mecha answers immediately. */
   seedUserMessage?: string;
   /** Assistant line shown before the seeded question resolves. */
   greeting?: string;
   context?: MechaContext;
   variant?: 'chip' | 'link';
   className?: string;
}

export default function AskMechaButton({
   label,
   seedUserMessage,
   greeting,
   context,
   variant = 'chip',
   className = ''
}: AskMechaButtonProps): JSX.Element {
   const onClick = () => openMecha({ seedUserMessage, greeting, context });

   if (variant === 'link') {
      return (
         <button
            type="button"
            onClick={onClick}
            className={`inline-flex items-center gap-1 text-[13px] font-semibold text-[#6c3fe0] underline-offset-2 hover:underline dark:text-[#d8c2ff] ${className}`}
         >
            {label}
            <span aria-hidden="true">→</span>
         </button>
      );
   }

   return (
      <button
         type="button"
         onClick={onClick}
         className={`inline-flex items-center gap-2 rounded-full border border-[#e6ddf6] bg-white px-3 py-1.5 text-[13px] font-semibold text-[#6c3fe0] transition-colors hover:bg-[#f3effe] dark:border-[#40354F] dark:bg-[#1e1730] dark:text-[#d8c2ff] dark:hover:bg-[#281b35] ${className}`}
      >
         <span className="flex h-5 w-5 items-center justify-center overflow-hidden rounded-full bg-[#f3effe] dark:bg-[#281b35]">
            <img src={poseSrc('present')} alt="" className="h-full w-full object-contain" />
         </span>
         {label}
      </button>
   );
}
