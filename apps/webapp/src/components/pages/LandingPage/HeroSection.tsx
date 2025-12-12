import { Link } from "@tanstack/react-router";
import { publicImages } from "@/types/publicImages";

export function HeroSection() {
  return (
    <div className="w-full mt-8 mb-4 px-4 md:px-8 lg:px-16">
      <div className="max-w-9xl mx-auto bg-[#f6f6f6] rounded-[60px] overflow-hidden p-8 md:p-12 lg:p-16">
        <div className="flex flex-col lg:flex-row gap-8 lg:gap-12 items-center">
          {/* Content Section - on the left */}
          <div className="flex flex-col gap-4 lg:gap-8 2xl:gap-12">
            <h1 className="font-telex text-ink-main text-5xl lg:text-6xl xl:text-7xl">
              Microloans with USDC to BUILD YOUR CREDIT
            </h1>
            <p className="font-normal text-ink-main text-xl lg:text-2xl">
              We created a new kind of Lender to Borrower experience. There is
              no escrow and no middle-man. You borrow directly from other users
              and build your credit score in the process.
            </p>
            <div className="flex items-center gap-2 sm:gap-4">
              <Link to="/guide">
                <img
                  className="size-12"
                  alt="Background"
                  src="https://c.animaapp.com/VPWnEuWR/img/background.svg"
                />
              </Link>
              <Link
                to="/guide"
                className="bg-ink-main text-white text-nowrap text-xl sm:text-2xl px-4 h-12 rounded-full flex items-center leading-0"
              >
                See How it Works
              </Link>
            </div>
          </div>

          {/* Image Section - alone on the right */}
          <div className="flex justify-center">
            <img
              className="w-64 min-w-64 2xl:min-w-[288px] 2xl:w-[288px] rounded-4xl"
              alt="Hero Illustration"
              src={publicImages["/img/landing-page/illustration1.jpg"]}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
