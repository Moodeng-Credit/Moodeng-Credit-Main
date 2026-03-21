const DOCS_URL = 'https://moodeng-credit.gitbook.io/moodeng-credit';

export function AuthFooter() {
   return (
      <footer className="mt-auto w-full px-5 py-4 sm:py-6 border-t border-[#9285A0]">
         <div className="flex flex-col items-center gap-4">
            <div className="flex justify-center gap-5 text-sm text-[#4D4359]">
               <a href={DOCS_URL} target="_blank" rel="noopener noreferrer" className="hover:underline">
                  Privacy
               </a>
               <a href={DOCS_URL} target="_blank" rel="noopener noreferrer" className="hover:underline">
                  Terms
               </a>
               <a href={DOCS_URL} target="_blank" rel="noopener noreferrer" className="hover:underline">
                  Docs
               </a>
            </div>
            <p className="text-xs text-[#4D4359] text-center tracking-[-0.02em]">
               © 2026 Moodeng Credit All Rights Reserved
            </p>
         </div>
      </footer>
   );
}
