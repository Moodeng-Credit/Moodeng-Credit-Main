import { ProtectedRoute } from '@/components/ProtectedRoute';

interface AdminGuardProps {
   children: React.ReactNode;
}

export function AdminGuard({ children }: AdminGuardProps) {
   return <ProtectedRoute>{children}</ProtectedRoute>;
}
