const DOCS_URL = 'https://moodeng-credit.gitbook.io/moodeng-credit';

export function AuthFooter() {
   return (
      <footer className="mt-auto w-full shrink-0 border-t border-[#9285A0] px-5 py-0">
         <div className="mx-auto flex w-full max-w-[400px] flex-col items-center gap-4 pt-4">
            <nav
               className="flex flex-row flex-wrap justify-center gap-5 text-sm font-normal leading-[21px] tracking-[-0.02em] text-[#4D4359]"
               aria-label="Legal"
            >
               <a href={`${DOCS_URL}/privacy`} target="_blank" rel="noopener noreferrer" className="hover:underline">
                  Privacy
               </a>
               <a href={`${DOCS_URL}/terms`} target="_blank" rel="noopener noreferrer" className="hover:underline">
                  Terms
               </a>
               <a href={DOCS_URL} target="_blank" rel="noopener noreferrer" className="hover:underline">
                  Docs
               </a>
            </nav>
            <p className="text-center text-xs font-normal leading-[18px] tracking-[-0.02em] text-[#4D4359]">
               ⓒ 2026 Moodeng Credit All Rights Reserved
            </p>
         </div>
      </footer>
   );
}
