import { type JSX } from 'react';

import { MessageCircle } from 'lucide-react';

import { identifySupport, isSupportChatEnabled, openSupportChat } from '@/lib/support/liveChat';

// Inline "message the team" trigger — the live-chat replacement for
// <AskMechaButton />. Drop it next to an error or a friction point; on tap it
// opens the chat with the topic and the current screen already attached, so the
// agent knows what broke before the borrower has finished typing.
//
// Note the widget cannot post an opening message on the borrower's behalf (no
// vendor API for it), so `topic` is passed as context, not as a sent message —
// keep labels phrased as "message us about X", never "we've sent your question".
// Renders nothing when live chat is unconfigured, so the surrounding error card
// never shows a dead button.

export interface SupportContext {
   /** Human-readable screen name, e.g. "Repay". */
   page?: string;
   /** Onboarding/flow step id, e.g. "base-account". */
   step?: string;
}

interface AskSupportButtonProps {
   label: string;
   /** The problem being reported. Reaches the agent as a chat event + tag. */
   topic?: string;
   context?: SupportContext;
   variant?: 'chip' | 'link';
   className?: string;
}

export default function AskSupportButton({
   label,
   topic,
   context,
   variant = 'chip',
   className = ''
}: AskSupportButtonProps): JSX.Element | null {
   if (!isSupportChatEnabled) return null;

   const onClick = () => {
      if (context?.page || context?.step) {
         identifySupport({ data: { from_page: context.page, from_step: context.step } });
      }
      openSupportChat(topic);
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
