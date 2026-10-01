import { DEFAULT_LOAN_TIMEZONE, formatDeadlineForViewer, getLoanTimezone } from '@/lib/loanDeadline';

// A loan's deadline for the admin panel: the end of its due day on the borrower's clock, and the same
// moment on the viewer's own clock (read from this device each time, so it follows whoever is looking
// and wherever they are). "Sep 30, 11:59 PM Manila" / "10:59 PM your time".
export default function AdminDeadline({ dueDate, dueTimezone }: { dueDate: string | null; dueTimezone?: string | null }) {
   if (!dueDate || Number.isNaN(new Date(dueDate).getTime())) return <span>—</span>;
   const { borrower, viewer } = formatDeadlineForViewer(dueDate, getLoanTimezone({ dueTimezone }, DEFAULT_LOAN_TIMEZONE));
   return (
      <span className="inline-flex flex-col leading-tight">
         <span>{borrower}</span>
         {viewer ? <span className="text-xs font-semibold text-[#8f84a3]">{viewer}</span> : null}
      </span>
   );
}

/** Plain-text version for sentences, e.g. "Oct 7, 11:59 PM Manila (10:59 PM your time)". */
export const formatAdminDeadline = (dueDate: string, dueTimezone?: string | null): string => {
   const { borrower, viewer } = formatDeadlineForViewer(dueDate, getLoanTimezone({ dueTimezone }, DEFAULT_LOAN_TIMEZONE));
   return viewer ? `${borrower} (${viewer})` : borrower;
};
