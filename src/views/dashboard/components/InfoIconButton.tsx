import { HelpCircle } from 'lucide-react';

interface InfoIconButtonProps {
   label: string;
   onClick: () => void;
}

export default function InfoIconButton({ label, onClick }: InfoIconButtonProps) {
   return (
      <button
         aria-label={label}
         className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#eadfff] text-md-primary-900 active:scale-95"
         type="button"
         onClick={onClick}
      >
         <HelpCircle className="h-4 w-4" strokeWidth={2.2} />
      </button>
   );
}
