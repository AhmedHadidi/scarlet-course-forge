import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Trash2, Building2, UserPlus, UserMinus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";

interface Department {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
}

interface DepartmentAdmin {
  id: string;
  department_id: string;
  user_id: string;
  user_email?: string;
  user_name?: string;
}

interface User {
  id: string;
  email: string;
  full_name: string;
}

const departmentSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(100),
  description: z.string().max(500).optional(),
});

export const DepartmentManagement = () => {
  const { toast } = useToast();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [departmentAdmins, setDepartmentAdmins] = useState<DepartmentAdmin[]>([]);
  const [subAdminUsers, setSubAdminUsers] = useState<User[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null);
  const [selectedDepartment, setSelectedDepartment] = useState<Department | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [formData, setFormData] = useState({
    name: "",
    description: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchDepartments();
    fetchDepartmentAdmins();
    fetchSubAdminUsers();
  }, []);

  const fetchDepartments = async () => {
    const { data, error } = await supabase
      .from("departments")
      .select("*")
      .order("name");

    if (error) {
      toast({ title: "Error", description: "Failed to load departments", variant: "destructive" });
    } else {
      setDepartments(data || []);
    }
  };

  const fetchDepartmentAdmins = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    
    const { data, error } = await supabase
      .from("department_admins")
      .select("*");

    if (error) {
      console.error("Error fetching department admins:", error);
      return;
    }

    // Get user details for each admin
    const adminsWithDetails = await Promise.all(
      (data || []).map(async (admin) => {
        const { data: usersData } = await supabase.functions.invoke('admin-operations', {
          body: { operation: 'listUsers' },
          headers: { Authorization: `Bearer ${session?.access_token}` }
        });
        
        const user = usersData?.users?.find((u: User) => u.id === admin.user_id);
        return {
          ...admin,
          user_email: user?.email || 'Unknown',
          user_name: user?.full_name || 'Unknown'
        };
      })
    );

    setDepartmentAdmins(adminsWithDetails);
  };

  const fetchSubAdminUsers = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    
    const { data, error } = await supabase.functions.invoke('admin-operations', {
      body: { operation: 'listUsers' },
      headers: { Authorization: `Bearer ${session?.access_token}` }
    });

    if (!error && data?.users) {
      // Filter to show only sub_admin role users
      const subAdmins = data.users.filter((user: any) => 
        user.roles?.some((r: { role: string }) => r.role === 'sub_admin')
      );
      setSubAdminUsers(subAdmins);
    }
  };

  const handleSubmit = async () => {
    try {
      departmentSchema.parse(formData);
      setErrors({});
    } catch (error) {
      if (error instanceof z.ZodError) {
        const newErrors: Record<string, string> = {};
        error.errors.forEach((err) => {
          if (err.path[0]) newErrors[err.path[0] as string] = err.message;
        });
        setErrors(newErrors);
        return;
      }
    }

    if (editingDepartment) {
      const { error } = await supabase
        .from("departments")
        .update({
          name: formData.name,
          description: formData.description || null,
        })
        .eq("id", editingDepartment.id);

      if (error) {
        toast({ title: "Error", description: "Failed to update department", variant: "destructive" });
      } else {
        toast({ title: "Success", description: "Department updated successfully" });
      }
    } else {
      const { error } = await supabase
        .from("departments")
        .insert({
          name: formData.name,
          description: formData.description || null,
        });

      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Success", description: "Department created successfully" });
      }
    }

    setIsDialogOpen(false);
    setEditingDepartment(null);
    setFormData({ name: "", description: "" });
    fetchDepartments();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this department?")) return;

    const { error } = await supabase
      .from("departments")
      .delete()
      .eq("id", id);

    if (error) {
      toast({ title: "Error", description: "Failed to delete department", variant: "destructive" });
    } else {
      toast({ title: "Success", description: "Department deleted successfully" });
      fetchDepartments();
      fetchDepartmentAdmins();
    }
  };

  const handleEdit = (department: Department) => {
    setEditingDepartment(department);
    setFormData({
      name: department.name,
      description: department.description || "",
    });
    setIsDialogOpen(true);
  };

  const handleAssignSubAdmin = async () => {
    if (!selectedDepartment || !selectedUserId) return;

    const { error } = await supabase
      .from("department_admins")
      .insert({
        department_id: selectedDepartment.id,
        user_id: selectedUserId,
      });

    if (error) {
      if (error.code === '23505') {
        toast({ title: "Error", description: "This user is already assigned to this department", variant: "destructive" });
      } else {
        toast({ title: "Error", description: "Failed to assign sub-admin", variant: "destructive" });
      }
    } else {
      toast({ title: "Success", description: "Sub-admin assigned successfully" });
      fetchDepartmentAdmins();
    }

    setIsAssignDialogOpen(false);
    setSelectedDepartment(null);
    setSelectedUserId("");
  };

  const handleRemoveSubAdmin = async (adminId: string) => {
    if (!confirm("Are you sure you want to remove this sub-admin?")) return;

    const { error } = await supabase
      .from("department_admins")
      .delete()
      .eq("id", adminId);

    if (error) {
      toast({ title: "Error", description: "Failed to remove sub-admin", variant: "destructive" });
    } else {
      toast({ title: "Success", description: "Sub-admin removed successfully" });
      fetchDepartmentAdmins();
    }
  };

  const getDepartmentAdmins = (departmentId: string) => {
    return departmentAdmins.filter(a => a.department_id === departmentId);
  };

  return (
    <div className="space-y-6">
      {/* Departments Section */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Department Management</h3>
          <p className="text-sm text-muted-foreground">Manage departments and assign sub-admins</p>
        </div>
        <Button
          className="gradient-crimson"
          onClick={() => {
            setEditingDepartment(null);
            setFormData({ name: "", description: "" });
            setErrors({});
            setIsDialogOpen(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Department
        </Button>
      </div>

      <Card className="border-border">
        <CardHeader>
          <CardTitle>All Departments</CardTitle>
          <CardDescription>{departments.length} departments configured</CardDescription>
        </CardHeader>
        <CardContent>
          {departments.length === 0 ? (
            <div className="text-center py-8">
              <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No departments found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Sub-Admins</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {departments.map((department) => {
                  const admins = getDepartmentAdmins(department.id);
                  return (
                    <TableRow key={department.id}>
                      <TableCell className="font-medium">{department.name}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {department.description || "-"}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {admins.length === 0 ? (
                            <span className="text-muted-foreground text-sm">None assigned</span>
                          ) : (
                            admins.map((admin) => (
                              <Badge key={admin.id} variant="secondary" className="text-xs">
                                {admin.user_name}
                                <button
                                  className="ml-1 hover:text-destructive"
                                  onClick={() => handleRemoveSubAdmin(admin.id)}
                                >
                                  <UserMinus className="h-3 w-3" />
                                </button>
                              </Badge>
                            ))
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {new Date(department.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedDepartment(department);
                              setSelectedUserId("");
                              setIsAssignDialogOpen(true);
                            }}
                            title="Assign Sub-Admin"
                          >
                            <UserPlus className="h-4 w-4" />
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => handleEdit(department)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => handleDelete(department.id)}>
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

      {/* Department Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingDepartment ? "Edit Department" : "Create Department"}</DialogTitle>
            <DialogDescription>
              {editingDepartment ? "Update department details" : "Add a new department to the system"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Human Resources"
              />
              {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Optional description"
              />
              {errors.description && <p className="text-sm text-destructive">{errors.description}</p>}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button className="gradient-crimson" onClick={handleSubmit}>
              {editingDepartment ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Sub-Admin Dialog */}
      <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Sub-Admin</DialogTitle>
            <DialogDescription>
              Assign a sub-admin to {selectedDepartment?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Select Sub-Admin</Label>
              {subAdminUsers.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No sub-admin users found. Create a user with the "Sub-Admin" role first.
                </p>
              ) : (
                <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a sub-admin" />
                  </SelectTrigger>
                  <SelectContent>
                    {subAdminUsers.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.full_name} ({user.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAssignDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              className="gradient-crimson" 
              onClick={handleAssignSubAdmin}
              disabled={!selectedUserId || subAdminUsers.length === 0}
            >
              Assign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
