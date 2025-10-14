import ActionButton from '@/components/ui/ActionButton';

import type { ActionButtonConfig } from '@/types/actionButtonTypes';

interface DesktopNavProps {
   buttons: ActionButtonConfig[];
}

export default function DesktopNav({ buttons }: DesktopNavProps) {
   return (
      <nav className="hidden md:flex items-center gap-8" role="navigation">
         {buttons.map((button) => (
            <ActionButton key={button.href} button={button} />
         ))}
      </nav>
   );
}
