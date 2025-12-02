import { ArrowLeft, ArrowRight } from 'lucide-react';

interface ScrollerProps {
  prevDisabled: boolean;
  nextDisabled: boolean;
  onNext: () => void;
  onPrevious: () => void;
  className?: string;
}

const Scroller = ({  prevDisabled, nextDisabled, onNext, onPrevious, className }: ScrollerProps) => {
   return (
      <div className={`flex items-center gap-4 ${className || ''}`}>
         <button
            onClick={onPrevious}
            disabled={prevDisabled}
            className="p-2 rounded-full bg-white hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed ease-out duration-100 transition-colors"
            aria-label="Previous page"
       >
            <ArrowLeft size={80} strokeWidth={3} className="size-7 text-[#2D3748]" />
         </button>

         <button
            onClick={onNext}
            disabled={nextDisabled}
            className="p-2 rounded-full bg-white hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed ease-out duration-100 transition-colors"
            aria-label="Next page"
       >

            <ArrowRight size={80} strokeWidth={3} className="size-7 text-[#2D3748]" />
         </button>
      </div>
   );
};

export default Scroller;