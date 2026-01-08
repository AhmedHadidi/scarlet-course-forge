import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useVerifyAdmin } from "@/hooks/useVerifyAdmin";
import { Loader2 } from "lucide-react";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: string;
}

export const ProtectedRoute = ({ children, requiredRole }: ProtectedRouteProps) => {
  const { user, loading } = useAuth();
  const { isVerifiedAdmin, isVerifying } = useVerifyAdmin();

  // Show loading while auth or admin verification is in progress
  if (loading || (requiredRole === 'admin' && isVerifying)) {
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

  return <>{children}</>;
};
