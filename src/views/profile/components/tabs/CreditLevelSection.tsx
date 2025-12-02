
import { useCarouselNav } from "@/hooks/useCarouselNav";
import CreditLevelCard from "@/views/profile/components/tabs/CreditLevelCard";
import Scroller from "@/views/profile/components/tabs/Srcoller";
import type { CreditLevel } from "@/views/profile/components/tabs/types";
import useEmblaCarousel from "embla-carousel-react";
import React from "react";

type Props = {
  creditLevels: CreditLevel[];
}
const CreditLevelSection: React.FC<Props> = ({ creditLevels }) => {

  const [emblaRef, emblaApi] = useEmblaCarousel({
    dragFree: true,
    skipSnaps: true
  })

   const {
      prevBtnDisabled,
      nextBtnDisabled,
      onPrevButtonClick,
      onNextButtonClick
   } = useCarouselNav(emblaApi)

  return (
    <div className="bg-white rounded-xl flex flex-col overflow-x-auto select-none" style={{
        "--slide-height": "19rem",
        "--slide-spacing": "1.5rem",
        "--slide-size": "100%",
      } as React.CSSProperties}
    >
      <div className="flex p-6 pb-0">
         <h2 className="font-extrabold text-3xl flex items-center gap-2">
          Credit Level
          <button
            aria-label="Info"
            className="text-[#374151] text-sm rounded-full border border-[#374151] w-6 h-6 flex items-center justify-center hover:bg-gray-50 transition"
            type="button"
          >
            <i className="fa-solid fa-circle-info" />
          </button>
        </h2>
        <Scroller
          prevDisabled={prevBtnDisabled}
          nextDisabled={nextBtnDisabled}
          onNext={onNextButtonClick}
          onPrevious={onPrevButtonClick}
          className="ml-auto"

        />
      </div>
      <div ref={emblaRef} className="overflow-hidden px-3 pt-6">
        <div className="bg-white flex touch-pan-y touch-pinch-zoom -ml-[var(--slide-spacing)]">
          {creditLevels.map((level) => (
            <CreditLevelCard key={level.id} level={level} />
          ))}
        </div>
      </div>

    </div>
  )
}

export default CreditLevelSection