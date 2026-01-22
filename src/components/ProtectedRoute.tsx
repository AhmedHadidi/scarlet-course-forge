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
  const { user, loading } = useAuth();
  const { isVerifiedAdmin, isVerifying: isVerifyingAdmin } = useVerifyAdmin();
  const { isVerifiedSubAdmin, isVerifying: isVerifyingSubAdmin } = useVerifySubAdmin();

  // Show loading while auth or role verification is in progress
  if (loading || (requiredRole === 'admin' && isVerifyingAdmin) || (requiredRole === 'sub_admin' && isVerifyingSubAdmin)) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
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
