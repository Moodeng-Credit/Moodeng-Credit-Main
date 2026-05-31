import ActionButton from '@/components/ui/ActionButton';

import type { ActionButtonConfig } from '@/types/actionButtonTypes';

interface DesktopNavProps {
   buttons: ActionButtonConfig[];
}

export default function DesktopNav({ buttons }: DesktopNavProps) {
   return (
      <nav className="hidden lg:flex items-center gap-8" role="navigation">
         {buttons.map((button) => (
            <ActionButton key={button.href} button={button} />
         ))}
      </nav>
   );
}
