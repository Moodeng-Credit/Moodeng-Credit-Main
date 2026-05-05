import { ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function VerificationCTA() {
   return (
      <section className="flex gap-md-3 rounded-md-lg border border-[#f5dd83] bg-[#fff8e1] p-md-4 shadow-md-card">
         <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white text-[#8a6d00]">
            <ShieldCheck className="h-6 w-6" strokeWidth={2.2} />
         </span>
         <div className="min-w-0 flex-1">
            <p className="text-md-b1 font-semibold text-md-heading">Verify before requesting loans</p>
            <p className="mt-1 text-md-b3 text-md-neutral-1200">
               Unverified borrowers can read the dashboard, but loan requests stay locked until verification is complete.
            </p>
            <Link
               className="mt-md-3 inline-flex rounded-md-md bg-md-primary-900 px-md-3 py-2 text-md-b3 font-semibold text-white"
               to="/verify-world-id"
            >
               Get Verified
            </Link>
         </div>
      </section>
   );
}
