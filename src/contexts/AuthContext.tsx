import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

type ApprovalStatus = "pending" | "approved" | "rejected" | null;

interface AuthContextType {
  user: User | null;
  session: Session | null;
  userRole: string | null;
  approvalStatus: ApprovalStatus;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshApprovalStatus: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [approvalStatus, setApprovalStatus] = useState<ApprovalStatus>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchApprovalStatus = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("approval_status")
        .eq("id", userId)
        .maybeSingle();

      if (error) {
        console.error("Error fetching approval status:", error);
        return null;
      }
      return data?.approval_status as ApprovalStatus;
    } catch (error) {
      console.error("Error fetching approval status:", error);
      return null;
    }
  };

  const refreshApprovalStatus = async () => {
    if (user) {
      const status = await fetchApprovalStatus(user.id);
      setApprovalStatus(status);
    }
  };

  useEffect(() => {
    // Set up auth state listener FIRST (Supabase v2 best practice)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          // Defer DB calls with setTimeout to avoid Supabase internal deadlock
          setTimeout(async () => {
            const [roleData, status] = await Promise.all([
              supabase
                .from("user_roles")
                .select("role")
                .eq("user_id", session.user.id)
                .order("role", { ascending: true }),
              fetchApprovalStatus(session.user.id),
            ]);
            const role =
              roleData.data?.find((r) => r.role === "admin")?.role ||
              roleData.data?.[0]?.role ||
              null;
            setUserRole(role);
            setApprovalStatus(status);
          }, 0);
        } else {
          setUserRole(null);
          setApprovalStatus(null);
        }
      }
    );

    // Check existing session — controls the initial loading state
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        setTimeout(async () => {
          const [roleData, status] = await Promise.all([
            supabase
              .from("user_roles")
              .select("role")
              .eq("user_id", session.user.id)
              .order("role", { ascending: true }),
            fetchApprovalStatus(session.user.id),
          ]);
          const role =
            roleData.data?.find((r) => r.role === "admin")?.role ||
            roleData.data?.[0]?.role ||
            null;
          setUserRole(role);
          setApprovalStatus(status);
          setLoading(false);
        }, 0);
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
      setUser(null);
      setSession(null);
      setUserRole(null);
      setApprovalStatus(null);
      navigate("/auth");
      toast.success("Signed out successfully");
    } catch (error: any) {
      toast.error(error.message || "Error signing out");
    }
  };

  return (
    <AuthContext.Provider
      value={{ user, session, userRole, approvalStatus, loading, signOut, refreshApprovalStatus }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
