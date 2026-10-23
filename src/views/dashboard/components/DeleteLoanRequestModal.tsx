import type { RefObject } from 'react';

import { X } from 'lucide-react';

import { formatCurrency } from '@/utils/decimalHelpers';

import type { Loan } from '@/types/loanTypes';

// Confirm sheet for a borrower deleting their own pending request. Used on the Request Board card and
// on the request's History detail page, which is where most borrowers go looking for "cancel".
export default function DeleteLoanRequestModal({
   loan,
   clickOutsideRef,
   isDeleting,
   onClose,
   onConfirm
}: {
   loan: Loan | null;
   clickOutsideRef: RefObject<HTMLDivElement>;
   isDeleting: boolean;
   onClose: () => void;
   onConfirm: () => void;
}) {
   if (!loan) return null;

   const dueDate = new Date(loan.dueDate);
   const dueDateLabel = Number.isNaN(dueDate.getTime())
      ? 'the selected date'
      : new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(dueDate);

   return (
      <div className="fixed inset-0 z-[100] flex items-end justify-center bg-[#12071f]/45 px-md-3 py-md-4 sm:items-center">
         <div
            ref={clickOutsideRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-loan-request-title"
            className="w-full max-w-[408px] overflow-hidden rounded-t-[32px] bg-white shadow-md-overlay sm:rounded-[32px]"
         >
            <div className="flex items-center justify-between border-b border-md-neutral-400 px-md-4 py-md-3">
               <div>
                  <h2 id="delete-loan-request-title" className="text-md-h4 font-semibold text-md-heading">
                     Delete this request?
                  </h2>
                  <p className="mt-1 text-md-b3 font-medium text-md-neutral-800">This cannot be undone.</p>
               </div>
               <button
                  type="button"
                  onClick={onClose}
                  disabled={isDeleting}
                  aria-label="Close delete request confirmation"
                  className="size-11 shrink-0 rounded-full text-md-heading inline-flex items-center justify-center active:bg-md-neutral-300 disabled:cursor-not-allowed disabled:opacity-50"
               >
                  <X className="size-7" strokeWidth={2.25} />
               </button>
            </div>

            <div className="flex flex-col gap-md-4 px-md-4 py-md-5">
               <div className="rounded-md-lg border border-red-100 bg-red-50 px-md-4 py-md-4">
                  <p className="text-md-b1 font-semibold text-red-700">{loan.reason || 'Loan request'}</p>
                  <p className="mt-2 text-md-b2 font-medium leading-[1.45] text-md-neutral-900">
                     Borrowing ${formatCurrency(loan.loanAmount)} and repaying ${formatCurrency(loan.totalRepaymentAmount)} by{' '}
                     {dueDateLabel}.
                  </p>
               </div>
               <p className="text-md-b2 font-medium leading-[1.45] text-md-neutral-900">
                  Moo-lenders will no longer see it. You can make a new request from the board, but repeated deletes pause new requests for
                  a short time.
               </p>

               <button
                  type="button"
                  onClick={onConfirm}
                  disabled={isDeleting}
                  className="w-full rounded-md-lg bg-red-600 px-md-4 py-md-3 text-md-b1 font-semibold text-white active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
               >
                  {isDeleting ? 'Deleting...' : 'Delete request'}
               </button>
               <button
                  type="button"
                  onClick={onClose}
                  disabled={isDeleting}
                  className="w-full rounded-md-lg border border-md-neutral-500 px-md-4 py-md-3 text-md-b1 font-semibold text-md-neutral-1200 active:bg-md-neutral-200 disabled:cursor-not-allowed disabled:opacity-60"
               >
                  Keep request
               </button>
            </div>
         </div>
      </div>
   );
}
