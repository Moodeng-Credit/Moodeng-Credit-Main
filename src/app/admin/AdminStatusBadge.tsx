'use client';

import { ADMIN_STATUS_META, type AdminStatus } from '@/app/admin/adminStatus';

// The one badge every admin tab uses for a borrower / loan state (see adminStatus.ts).
export default function AdminStatusBadge({ status, className = '' }: { status: AdminStatus; className?: string }) {
   const meta = ADMIN_STATUS_META[status];
   return (
      <span
         className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-3 py-1 text-xs font-black uppercase ${meta.className} ${className}`}
      >
         <span aria-hidden>{meta.emoji}</span>
         {meta.label}
      </span>
   );
}
