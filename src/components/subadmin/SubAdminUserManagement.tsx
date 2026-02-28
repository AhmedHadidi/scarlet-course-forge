import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Trash2, Users as UsersIcon, Search, ShieldCheck, ShieldOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import { toast as sonnerToast } from "sonner";

const userSchema = z.object({
  email: z.string().trim().email("Invalid email address").max(255),
  password: z.string()
    .min(8, "Password must be at least 8 characters")
    .max(100)
    .regex(/[A-Z]/, "Must contain uppercase letter")
    .regex(/[a-z]/, "Must contain lowercase letter")
    .regex(/[0-9]/, "Must contain a number")
    .regex(/[!@#$%^&*(),.?":{}|<>]/, "Must contain a special character"),
  full_name: z.string().trim().min(1, "Name is required").max(100),
});

type UserFormData = z.infer<typeof userSchema>;

interface SubAdminUserManagementProps {
  departmentId: string;
}

interface User {
  id: string;
  email: string;
  full_name: string;
  created_at: string;
  roles: { role: string }[];
}

export const SubAdminUserManagement = ({ departmentId }: SubAdminUserManagementProps) => {
  const { toast } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [isResetPasswordDialogOpen, setIsResetPasswordDialogOpen] = useState(false);
  const [resetPasswordUserId, setResetPasswordUserId] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [formData, setFormData] = useState<Partial<UserFormData>>({
    email: "",
    password: "",
    full_name: "",
  });
  const [errors, setErrors] = useState<Partial<Record<keyof UserFormData, string>>>({});

  useEffect(() => {
    fetchUsers();
  }, [departmentId]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();

      const { data, error } = await supabase.functions.invoke('subadmin-operations', {
        body: { operation: 'listUsers' },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });

      if (error) throw error;
      setUsers(data.users || []);
    } catch (error) {
      console.error("Error fetching users:", error);
      toast({ title: "Error", description: "Failed to load users", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const validateForm = (): boolean => {
    try {
      if (editingUser) {
        const editSchema = z.object({ full_name: z.string().trim().min(1).max(100) });
        editSchema.parse({ full_name: formData.full_name });
      } else {
        userSchema.parse(formData);
      }
      setErrors({});
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const newErrors: Partial<Record<keyof UserFormData, string>> = {};
        error.errors.forEach((err) => {
          if (err.path[0]) newErrors[err.path[0] as keyof UserFormData] = err.message;
        });
        setErrors(newErrors);
      }
      return false;
    }
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers = { Authorization: `Bearer ${session?.access_token}` };

      if (editingUser) {
        const { error } = await supabase.functions.invoke('subadmin-operations', {
          body: {
            operation: 'updateUser',
            data: { userId: editingUser.id, full_name: formData.full_name },
          },
          headers,
        });
        if (error) throw error;
        toast({ title: "Success", description: "User updated successfully" });
      } else {
        const { error } = await supabase.functions.invoke('subadmin-operations', {
          body: {
            operation: 'createUser',
            data: {
              email: formData.email!,
              password: formData.password!,
              full_name: formData.full_name,
            },
          },
          headers,
        });
        if (error) throw error;
        sonnerToast.success("User created successfully");
      }

      resetForm();
      setIsDialogOpen(false);
      fetchUsers();
    } catch (error: any) {
      console.error("Error saving user:", error);
      toast({ title: "Error", description: error.message || "Failed to save user", variant: "destructive" });
    }
  };

  const handleDelete = async (userId: string) => {
    if (!confirm("Are you sure you want to delete this user? This action cannot be undone.")) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { error } = await supabase.functions.invoke('subadmin-operations', {
        body: { operation: 'deleteUser', data: { userId } },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (error) throw error;
      toast({ title: "Success", description: "User deleted successfully" });
      fetchUsers();
    } catch (error: any) {
      console.error("Error deleting user:", error);
      toast({ title: "Error", description: error.message || "Failed to delete user", variant: "destructive" });
    }
  };

  const handleResetPassword = (userId: string) => {
    setResetPasswordUserId(userId);
    setNewPassword("");
    setIsResetPasswordDialogOpen(true);
  };

  const confirmResetPassword = async () => {
    if (!newPassword || newPassword.length < 8) {
      sonnerToast.error("Password must be at least 8 characters");
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { error } = await supabase.functions.invoke('subadmin-operations', {
        body: { operation: 'resetPassword', data: { userId: resetPasswordUserId, newPassword } },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (error) throw error;
      sonnerToast.success("Password reset successfully");
      setIsResetPasswordDialogOpen(false);
      setNewPassword("");
    } catch (error: any) {
      console.error("Error resetting password:", error);
      sonnerToast.error(error.message || "Failed to reset password");
    }
  };

  const handleEdit = (user: User) => {
    setEditingUser(user);
    setFormData({ email: user.email, password: "", full_name: user.full_name });
    setErrors({});
    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({ email: "", password: "", full_name: "" });
    setEditingUser(null);
    setErrors({});
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "admin":
        return <Badge variant="default" className="capitalize"><ShieldCheck className="mr-1 h-3 w-3" />Admin</Badge>;
      case "sub_admin":
        return <Badge variant="outline" className="capitalize border-primary text-primary"><ShieldCheck className="mr-1 h-3 w-3" />Sub-Admin</Badge>;
      default:
        return <Badge variant="secondary" className="capitalize"><ShieldOff className="mr-1 h-3 w-3" />User</Badge>;
    }
  };

  const filteredUsers = users.filter(user =>
    user.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <Card>
        <CardContent className="py-10">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Department Users</h3>
          <p className="text-sm text-muted-foreground">{users.length} user{users.length !== 1 ? "s" : ""} in your department</p>
        </div>
        <Button
          className="gradient-crimson"
          onClick={() => { resetForm(); setIsDialogOpen(true); }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add User
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name or email..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={(open) => {
        setIsDialogOpen(open);
        if (!open) resetForm();
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingUser ? "Edit User" : "Create New User"}</DialogTitle>
            <DialogDescription>
              {editingUser ? "Update user details" : "Add a new user to your department"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {!editingUser && (
              <div className="space-y-2">
                <Label htmlFor="sa-email">Email *</Label>
                <Input
                  id="sa-email"
                  type="email"
                  value={formData.email || ""}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="email@example.com"
                />
                {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="sa-full_name">Full Name *</Label>
              <Input
                id="sa-full_name"
                value={formData.full_name || ""}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                placeholder="John Doe"
              />
              {errors.full_name && <p className="text-sm text-destructive">{errors.full_name}</p>}
            </div>
            {!editingUser && (
              <div className="space-y-2">
                <Label htmlFor="sa-password">Password *</Label>
                <Input
                  id="sa-password"
                  type="password"
                  value={formData.password || ""}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="••••••••"
                />
                {errors.password && <p className="text-sm text-destructive">{errors.password}</p>}
                <p className="text-xs text-muted-foreground">
                  Min 8 chars, uppercase, lowercase, number, and special character
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
            <Button className="gradient-crimson" onClick={handleSubmit}>
              {editingUser ? "Update" : "Create"} User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Users Table */}
      <Card className="border-border">
        <CardHeader>
          <CardTitle>Department Users</CardTitle>
          <CardDescription>{filteredUsers.length} user{filteredUsers.length !== 1 ? "s" : ""} found</CardDescription>
        </CardHeader>
        <CardContent>
          {filteredUsers.length === 0 ? (
            <div className="text-center py-8">
              <UsersIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                {searchQuery ? "No users found matching your search" : "No users in this department yet"}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user) => {
                  const role = user.roles[0]?.role || "user";
                  return (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.full_name}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>{getRoleBadge(role)}</TableCell>
                      <TableCell>{new Date(user.created_at).toLocaleDateString()}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="sm" onClick={() => handleEdit(user)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => handleResetPassword(user.id)}>
                            Reset Password
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => handleDelete(user.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Reset Password Dialog */}
      <Dialog open={isResetPasswordDialogOpen} onOpenChange={setIsResetPasswordDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>Enter a new password for this user</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="sa-newPassword">New Password</Label>
              <Input
                id="sa-newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
              />
              <p className="text-xs text-muted-foreground">
                Min 8 chars, uppercase, lowercase, number, and special character
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsResetPasswordDialogOpen(false)}>Cancel</Button>
            <Button className="gradient-crimson" onClick={confirmResetPassword}>Reset Password</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
