import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useVerifyAdmin } from "@/hooks/useVerifyAdmin";
import { useVerifySubAdmin } from "@/hooks/useVerifySubAdmin";
import { Loader2 } from "lucide-react";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: string;
}

export const ProtectedRoute = ({ children, requiredRole }: ProtectedRouteProps) => {
  const { user, loading, userRole, approvalStatus } = useAuth();
  const { isVerifiedAdmin, isVerifying: isVerifyingAdmin } = useVerifyAdmin();
  const { isVerifiedSubAdmin, isVerifying: isVerifyingSubAdmin } = useVerifySubAdmin();

  // Show loading only while auth is initializing OR role verification is actively in progress.
  // We do NOT wait on `approvalStatus === null` to avoid infinite spinner when
  // the profiles row is missing or the query fails — approval checks below handle null safely.
  const isAdminVerificationPending = requiredRole === 'admin' && (isVerifyingAdmin || isVerifiedAdmin === null);
  const isSubAdminVerificationPending = requiredRole === 'sub_admin' && (isVerifyingSubAdmin || isVerifiedSubAdmin === null);

  if (loading || isAdminVerificationPending || isSubAdminVerificationPending) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Check approval status - admins bypass approval check
  // Treat null approvalStatus (fetch failed / no profile row) as no restriction
  const isAdmin = userRole === 'admin';
  if (!isAdmin && approvalStatus === 'pending') {
    return <Navigate to="/pending-approval" replace />;
  }
  
  if (!isAdmin && approvalStatus === 'rejected') {
    return <Navigate to="/auth" replace />;
  }

  // For admin routes, require server-side verification
  if (requiredRole === 'admin' && isVerifiedAdmin !== true) {
    return <Navigate to="/" replace />;
  }

  // For sub_admin routes, require role verification
  if (requiredRole === 'sub_admin' && isVerifiedSubAdmin !== true) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};
