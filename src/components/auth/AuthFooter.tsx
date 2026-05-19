import { Link } from 'react-router-dom';

const DOCS_URL = 'https://moodeng-credit.gitbook.io/moodeng-credit';

export function AuthFooter() {
   return (
      <footer className="mt-auto w-full px-5 py-4 sm:py-6 border-t border-[#9285A0]">
         <div className="flex flex-col items-center gap-4">
            <p className="text-sm text-[#4D4359]">
               <Link to="/privacy" className="hover:underline">
                  Privacy
               </Link>
               {' · '}
               <Link to="/terms" className="hover:underline">
                  Terms
               </Link>
               {' · '}
               <a href={DOCS_URL} target="_blank" rel="noopener noreferrer" className="hover:underline">
                  Docs
               </a>
            </p>
            <p className="text-xs text-[#4D4359] text-center tracking-[-0.02em]">
               © 2026 Moodeng Credit All Rights Reserved
            </p>
         </div>
      </footer>
   );
}
