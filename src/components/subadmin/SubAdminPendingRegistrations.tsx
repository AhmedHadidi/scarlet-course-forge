import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Check, X, Loader2, UserCheck, Clock, RefreshCw } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface PendingUser {
  id: string;
  full_name: string;
  created_at: string;
}

interface SubAdminPendingRegistrationsProps {
  departmentId: string;
}

export const SubAdminPendingRegistrations = ({ departmentId }: SubAdminPendingRegistrationsProps) => {
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    userId: string;
    action: "approve" | "reject";
    userName: string;
  }>({ open: false, userId: "", action: "approve", userName: "" });

  useEffect(() => {
    fetchPendingUsers();
  }, [departmentId]);

  const fetchPendingUsers = async () => {
    try {
      setLoading(true);
      
      // Fetch pending profiles for this department
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name, created_at")
        .eq("approval_status", "pending")
        .eq("department_id", departmentId)
        .order("created_at", { ascending: false });

      if (profilesError) throw profilesError;

      setPendingUsers(profiles || []);
    } catch (error) {
      console.error("Error fetching pending users:", error);
      toast.error("Failed to load pending registrations");
    } finally {
      setLoading(false);
    }
  };

  const handleApproval = async (userId: string, approve: boolean) => {
    setProcessingId(userId);
    setConfirmDialog({ ...confirmDialog, open: false });

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const { error } = await supabase
        .from("profiles")
        .update({
          approval_status: approve ? "approved" : "rejected",
          approved_at: approve ? new Date().toISOString() : null,
          approved_by: approve ? session?.user?.id : null
        })
        .eq("id", userId)
        .eq("department_id", departmentId); // Extra safety check

      if (error) throw error;

      toast.success(approve ? "User approved successfully" : "User registration rejected");
      setPendingUsers(prev => prev.filter(u => u.id !== userId));
    } catch (error: any) {
      console.error("Error updating approval status:", error);
      toast.error(error.message || "Failed to update user status");
    } finally {
      setProcessingId(null);
    }
  };

  const openConfirmDialog = (userId: string, userName: string, action: "approve" | "reject") => {
    setConfirmDialog({ open: true, userId, action, userName });
  };

  if (loading) {
    return (
      <Card className="border-border/50">
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="border-border/50">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Pending Registrations
              {pendingUsers.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {pendingUsers.length}
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              Review and approve new user registrations for your department
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={fetchPendingUsers}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </CardHeader>
        <CardContent>
          {pendingUsers.length === 0 ? (
            <div className="text-center py-8">
              <UserCheck className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No pending registrations in your department</p>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingUsers.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between p-4 rounded-lg border border-border bg-card"
                >
                  <div className="space-y-1">
                    <p className="font-medium">{user.full_name}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>
                        Registered {new Date(user.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-destructive hover:text-destructive"
                      onClick={() => openConfirmDialog(user.id, user.full_name, "reject")}
                      disabled={processingId === user.id}
                    >
                      {processingId === user.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <X className="h-4 w-4 mr-1" />
                          Reject
                        </>
                      )}
                    </Button>
                    <Button
                      size="sm"
                      className="gradient-crimson"
                      onClick={() => openConfirmDialog(user.id, user.full_name, "approve")}
                      disabled={processingId === user.id}
                    >
                      {processingId === user.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Check className="h-4 w-4 mr-1" />
                          Approve
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={confirmDialog.open} onOpenChange={(open) => setConfirmDialog({ ...confirmDialog, open })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmDialog.action === "approve" ? "Approve Registration" : "Reject Registration"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDialog.action === "approve"
                ? `Are you sure you want to approve ${confirmDialog.userName}'s registration? They will be able to access the platform.`
                : `Are you sure you want to reject ${confirmDialog.userName}'s registration? They will not be able to access the platform.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => handleApproval(confirmDialog.userId, confirmDialog.action === "approve")}
              className={confirmDialog.action === "approve" ? "gradient-crimson" : "bg-destructive text-destructive-foreground hover:bg-destructive/90"}
            >
              {confirmDialog.action === "approve" ? "Approve" : "Reject"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
