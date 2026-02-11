import ActionButton from '@/components/ui/ActionButton';

import { menuAuthButtons } from '@/config/buttonConfig';

export default function AuthButtons() {
   return (
      <div className="flex items-center gap-4">
         {menuAuthButtons.length > 0 ? menuAuthButtons.map((button) => <ActionButton key={button.text} button={button} />) : null}
      </div>
   );
}
