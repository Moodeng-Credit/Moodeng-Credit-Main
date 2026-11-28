import { useEffect } from 'react';

import '@/app/admin/adminFigmaLook.css';
import { applyAdminLook } from '@/app/admin/adminLook';
import { ProtectedRoute } from '@/components/ProtectedRoute';

interface AdminGuardProps {
   children: React.ReactNode;
}

export function AdminGuard({ children }: AdminGuardProps) {
   // The admin's own look (light Figma style or the original dark), only while an admin page is open.
   useEffect(() => applyAdminLook(), []);
   return <ProtectedRoute>{children}</ProtectedRoute>;
}
