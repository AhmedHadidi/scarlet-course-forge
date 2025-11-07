import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Trash2, Users as UsersIcon, ShieldCheck, ShieldOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import { toast as sonnerToast } from "sonner";

const userSchema = z.object({
  email: z.string().trim().email("Invalid email address").max(255),
  password: z.string().min(6, "Password must be at least 6 characters").max(100),
  full_name: z.string().trim().min(1, "Name is required").max(100),
  role: z.enum(["admin", "user"]),
});

type UserFormData = z.infer<typeof userSchema>;

interface User {
  id: string;
  email: string;
  full_name: string;
  created_at: string;
  roles: { role: string }[];
}

interface UserManagementProps {
  onOpenDialog?: () => void;
}

export const UserManagement = ({ onOpenDialog }: UserManagementProps = {}) => {
  const { toast } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [isResetPasswordDialogOpen, setIsResetPasswordDialogOpen] = useState(false);
  const [resetPasswordUserId, setResetPasswordUserId] = useState<string>("");
  const [newPassword, setNewPassword] = useState("");
  const [formData, setFormData] = useState<Partial<UserFormData>>({
    email: "",
    password: "",
    full_name: "",
    role: "user",
  });
  const [errors, setErrors] = useState<Partial<Record<keyof UserFormData, string>>>({});

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    if (onOpenDialog) {
      onOpenDialog();
    }
  }, [onOpenDialog]);

  const fetchUsers = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      // Use edge function to get all users with their details
      const { data, error } = await supabase.functions.invoke('admin-operations', {
        body: {
          operation: 'listUsers'
        },
        headers: {
          Authorization: `Bearer ${session?.access_token}`
        }
      });

      if (error) throw error;

      setUsers(data.users || []);
    } catch (error) {
      console.error("Error fetching users:", error);
      toast({
        title: "Error",
        description: "Failed to load users",
        variant: "destructive",
      });
    }
  };

  const validateForm = (): boolean => {
    try {
      if (editingUser) {
        // For editing, password is optional
        const editSchema = userSchema.extend({
          password: z.string().min(6).max(100).optional().or(z.literal("")),
        });
        editSchema.parse(formData);
      } else {
        userSchema.parse(formData);
      }
      setErrors({});
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const newErrors: Partial<Record<keyof UserFormData, string>> = {};
        error.errors.forEach((err) => {
          if (err.path[0]) {
            newErrors[err.path[0] as keyof UserFormData] = err.message;
          }
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
      
      if (editingUser) {
        // Update existing user via edge function
        const { error } = await supabase.functions.invoke('admin-operations', {
          body: {
            operation: 'updateUser',
            data: {
              userId: editingUser.id,
              email: formData.email,
              full_name: formData.full_name
            }
          },
          headers: {
            Authorization: `Bearer ${session?.access_token}`
          }
        });

        if (error) throw error;

        // Update role
        if (formData.role) {
          await supabase.functions.invoke('admin-operations', {
            body: {
              operation: 'updateUserRole',
              data: {
                userId: editingUser.id,
                role: formData.role
              }
            },
            headers: {
              Authorization: `Bearer ${session?.access_token}`
            }
          });
        }

        // Reset password if provided
        if (formData.password && formData.password.length > 0) {
          await supabase.functions.invoke('admin-operations', {
            body: {
              operation: 'resetPassword',
              data: {
                userId: editingUser.id,
                newPassword: formData.password
              }
            },
            headers: {
              Authorization: `Bearer ${session?.access_token}`
            }
          });
        }

        toast({ title: "Success", description: "User updated successfully" });
      } else {
        // Create new user via edge function
        const { error } = await supabase.functions.invoke('admin-operations', {
          body: {
            operation: 'createUser',
            data: {
              email: formData.email!,
              password: formData.password!,
              full_name: formData.full_name,
              role: formData.role
            }
          },
          headers: {
            Authorization: `Bearer ${session?.access_token}`
          }
        });

        if (error) throw error;

        sonnerToast.success("User created successfully");
        resetForm(); // Clear fields after successful creation
      }

      setIsDialogOpen(false);
      fetchUsers();
    } catch (error: any) {
      console.error("Error saving user:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to save user",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (userId: string) => {
    if (!confirm("Are you sure you want to delete this user? This action cannot be undone.")) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const { error } = await supabase.functions.invoke('admin-operations', {
        body: {
          operation: 'deleteUser',
          data: { userId }
        },
        headers: {
          Authorization: `Bearer ${session?.access_token}`
        }
      });

      if (error) throw error;

      toast({ title: "Success", description: "User deleted successfully" });
      fetchUsers();
    } catch (error) {
      console.error("Error deleting user:", error);
      toast({
        title: "Error",
        description: "Failed to delete user",
        variant: "destructive",
      });
    }
  };

  const handleResetPassword = async (userId: string) => {
    setResetPasswordUserId(userId);
    setNewPassword("");
    setIsResetPasswordDialogOpen(true);
  };

  const confirmResetPassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      sonnerToast.error("Password must be at least 6 characters");
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const { error } = await supabase.functions.invoke('admin-operations', {
        body: {
          operation: 'resetPassword',
          data: { userId: resetPasswordUserId, newPassword }
        },
        headers: {
          Authorization: `Bearer ${session?.access_token}`
        }
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
    setFormData({
      email: user.email,
      password: "",
      full_name: user.full_name,
      role: user.roles[0]?.role as "admin" | "user" || "user",
    });
    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({
      email: "",
      password: "",
      full_name: "",
      role: "user",
    });
    setEditingUser(null);
    setErrors({});
  };

  const getUserRole = (user: User): string => {
    return user.roles[0]?.role || "user";
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">User Management</h3>
          <p className="text-sm text-muted-foreground">Manage users and their roles</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button 
              className="gradient-crimson" 
              data-action="create-user-dialog"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                resetForm();
                setTimeout(() => setIsDialogOpen(true), 10);
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add User
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editingUser ? "Edit User" : "Create New User"}</DialogTitle>
              <DialogDescription>
                {editingUser ? "Update user details and role" : "Add a new user to the platform"}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="user@example.com"
                  disabled={!!editingUser}
                />
                {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="full_name">Full Name *</Label>
                <Input
                  id="full_name"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  placeholder="Enter full name"
                />
                {errors.full_name && <p className="text-sm text-destructive">{errors.full_name}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">
                  Password {editingUser ? "(leave blank to keep current)" : "*"}
                </Label>
                <Input
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="Enter password"
                />
                {errors.password && <p className="text-sm text-destructive">{errors.password}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="role">Role *</Label>
                <Select
                  value={formData.role}
                  onValueChange={(value) => setFormData({ ...formData, role: value as "admin" | "user" })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">User (Learner)</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button className="gradient-crimson" onClick={handleSubmit}>
                {editingUser ? "Update" : "Create"} User
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="border-border">
        <CardHeader>
          <CardTitle>All Users</CardTitle>
          <CardDescription>{users.length} users registered</CardDescription>
        </CardHeader>
        <CardContent>
          {users.length === 0 ? (
            <div className="text-center py-8">
              <UsersIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No users found</p>
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
                {users.map((user) => {
                  const role = getUserRole(user);
                  return (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.full_name}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>
                        <Badge variant={role === "admin" ? "default" : "secondary"} className="capitalize">
                          {role === "admin" ? (
                            <>
                              <ShieldCheck className="mr-1 h-3 w-3" />
                              Admin
                            </>
                          ) : (
                            <>
                              <ShieldOff className="mr-1 h-3 w-3" />
                              User
                            </>
                          )}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {new Date(user.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="sm" onClick={() => handleEdit(user)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleResetPassword(user.id)}
                            title="Reset Password"
                          >
                            Reset Password
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDelete(user.id)}
                          >
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
            <DialogDescription>
              Enter a new password for this user (minimum 6 characters)
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password</Label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsResetPasswordDialogOpen(false)}>
              Cancel
            </Button>
            <Button className="gradient-crimson" onClick={confirmResetPassword}>
              Reset Password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
