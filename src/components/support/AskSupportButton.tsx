import { type JSX } from 'react';

import { MessageCircle } from 'lucide-react';

import { identifyCrisp, openSupportChat } from '@/lib/support/crisp';

// Inline "message the team" trigger — the Crisp-backed replacement for
// <AskMechaButton />. Drop it next to an error or a friction point; on tap it
// opens the chat with the question already sent, so a stuck borrower reaches a
// human without typing anything. `context` rides along as session data, so the
// operator sees which screen the message came from before they reply.

export interface SupportContext {
   /** Human-readable screen name, e.g. "Repay". */
   page?: string;
   /** Onboarding/flow step id, e.g. "base-account". */
   step?: string;
}

interface AskSupportButtonProps {
   label: string;
   /** Sent as the borrower's opening message, so the thread starts with the problem. */
   seedUserMessage?: string;
   context?: SupportContext;
   variant?: 'chip' | 'link';
   className?: string;
}

export default function AskSupportButton({
   label,
   seedUserMessage,
   context,
   variant = 'chip',
   className = ''
}: AskSupportButtonProps): JSX.Element {
   const onClick = () => {
      if (context?.page || context?.step) {
         identifyCrisp({ data: { from_page: context.page, from_step: context.step } });
      }
      openSupportChat(seedUserMessage);
   };

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
         <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#f3effe] dark:bg-[#281b35]">
            <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />
         </span>
         {label}
      </button>
   );
}
