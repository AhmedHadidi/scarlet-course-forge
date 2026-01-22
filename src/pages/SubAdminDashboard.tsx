import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, BookOpen, Award, TrendingUp, LogOut, GraduationCap, Home, BarChart, Building2 } from "lucide-react";
import { SubAdminUserManagement } from "@/components/subadmin/SubAdminUserManagement";
import { SubAdminAnalytics } from "@/components/subadmin/SubAdminAnalytics";
import { toast } from "sonner";

interface Department {
  id: string;
  name: string;
  description: string | null;
}

const SubAdminDashboard = () => {
  const { signOut, user } = useAuth();
  const [activeView, setActiveView] = useState("overview");
  const [department, setDepartment] = useState<Department | null>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalEnrollments: 0,
    totalCertificates: 0,
    completedCourses: 0,
  });

  useEffect(() => {
    if (user) {
      fetchDepartmentInfo();
    }
  }, [user]);

  useEffect(() => {
    if (department) {
      fetchStats();
    }
  }, [department]);

  const fetchDepartmentInfo = async () => {
    try {
      // Get the department this sub-admin is assigned to
      const { data: departmentAdmin, error: daError } = await supabase
        .from("department_admins")
        .select("department_id")
        .eq("user_id", user?.id)
        .single();

      if (daError) {
        console.error("Error fetching department admin:", daError);
        toast.error("Could not fetch your department assignment");
        setLoading(false);
        return;
      }

      if (departmentAdmin) {
        // Get department details
        const { data: deptData, error: deptError } = await supabase
          .from("departments")
          .select("*")
          .eq("id", departmentAdmin.department_id)
          .single();

        if (deptError) {
          console.error("Error fetching department:", deptError);
        } else {
          setDepartment(deptData);
        }
      }
      setLoading(false);
    } catch (error) {
      console.error("Error:", error);
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    if (!department) return;

    try {
      // Fetch users in this department
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id")
        .eq("department_id", department.id);

      if (profilesError) throw profilesError;

      const userIds = profiles?.map(p => p.id) || [];
      const totalUsers = userIds.length;

      if (userIds.length === 0) {
        setStats({
          totalUsers: 0,
          totalEnrollments: 0,
          totalCertificates: 0,
          completedCourses: 0,
        });
        return;
      }

      // Fetch enrollments for department users
      const { count: enrollmentsCount } = await supabase
        .from("enrollments")
        .select("*", { count: "exact", head: true })
        .in("user_id", userIds);

      // Fetch certificates for department users
      const { count: certificatesCount } = await supabase
        .from("certificates")
        .select("*", { count: "exact", head: true })
        .in("user_id", userIds);

      // Fetch completed enrollments
      const { count: completedCount } = await supabase
        .from("enrollments")
        .select("*", { count: "exact", head: true })
        .in("user_id", userIds)
        .not("completed_at", "is", null);

      setStats({
        totalUsers,
        totalEnrollments: enrollmentsCount || 0,
        totalCertificates: certificatesCount || 0,
        completedCourses: completedCount || 0,
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  };

  const statCards = [
    {
      title: "Department Users",
      value: stats.totalUsers,
      icon: Users,
      description: "Users in your department",
    },
    {
      title: "Enrollments",
      value: stats.totalEnrollments,
      icon: BookOpen,
      description: "Course enrollments",
    },
    {
      title: "Completed",
      value: stats.completedCourses,
      icon: TrendingUp,
      description: "Completed courses",
    },
    {
      title: "Certificates",
      value: stats.totalCertificates,
      icon: Award,
      description: "Issued certificates",
    },
  ];

  const menuItems = [
    { id: "home", label: "Home", icon: Home, isExternal: true, path: "/" },
    { id: "overview", label: "Dashboard", icon: BarChart },
    { id: "users", label: "Department Users", icon: Users },
    { id: "analytics", label: "Analytics", icon: TrendingUp },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!department) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">No Department Assigned</h2>
            <p className="text-muted-foreground mb-4">
              You haven't been assigned to any department yet. Please contact an administrator.
            </p>
            <Button onClick={signOut} variant="outline">
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside className="w-64 bg-card border-r border-border flex flex-col">
        {/* Logo */}
        <div className="p-6 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full gradient-crimson flex items-center justify-center">
              <GraduationCap className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold">MOI AI Learning Hub</h1>
              <p className="text-xs text-muted-foreground">Sub-Admin Panel</p>
            </div>
          </div>
        </div>

        {/* Department Info */}
        <div className="p-4 border-b border-border bg-muted/30">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">{department.name}</span>
          </div>
          {department.description && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
              {department.description}
            </p>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4">
          <div className="space-y-1">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeView === item.id;
              
              if (item.isExternal) {
                return (
                  <a
                    key={item.id}
                    href={item.path}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <Icon className="h-5 w-5" />
                    <span className="font-medium">{item.label}</span>
                  </a>
                );
              }
              
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveView(item.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  <span className="font-medium">{item.label}</span>
                </button>
              );
            })}
          </div>
        </nav>

        {/* Sign Out Button */}
        <div className="p-4 border-t border-border">
          <Button variant="outline" className="w-full" onClick={signOut}>
            <LogOut className="mr-2 h-4 w-4" />
            Sign Out
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        {/* Header */}
        <header className="border-b border-border bg-card/30 backdrop-blur-sm sticky top-0 z-10">
          <div className="px-8 py-6">
            <h2 className="text-3xl font-bold">
              {menuItems.find(item => item.id === activeView)?.label || "Sub-Admin Dashboard"}
            </h2>
            <p className="text-muted-foreground mt-1">
              {activeView === "overview" && `Manage ${department.name} department`}
              {activeView === "users" && "View and manage users in your department"}
              {activeView === "analytics" && "View analytics for your department"}
            </p>
          </div>
        </header>

        <div className="p-8">
          {/* Overview */}
          {activeView === "overview" && (
            <>
              {/* Stats Grid */}
              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                {statCards.map((stat, index) => {
                  const Icon = stat.icon;
                  return (
                    <Card key={index} className="border-border/50">
                      <CardContent className="pt-6">
                        <div className="flex items-center justify-between mb-4">
                          <div className="h-12 w-12 rounded-lg gradient-crimson flex items-center justify-center">
                            <Icon className="h-6 w-6 text-white" />
                          </div>
                        </div>
                        <p className="text-3xl font-bold mb-1">{stat.value}</p>
                        <p className="text-sm font-medium text-foreground">{stat.title}</p>
                        <p className="text-xs text-muted-foreground">{stat.description}</p>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              {/* Quick Actions */}
              <div className="grid md:grid-cols-2 gap-6">
                <Card className="border-border/50">
                  <CardHeader>
                    <CardTitle className="text-base">Quick Actions</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <Button 
                      variant="outline" 
                      className="w-full justify-start"
                      onClick={() => setActiveView("users")}
                    >
                      <Users className="mr-2 h-4 w-4" />
                      View Department Users
                    </Button>
                    <Button 
                      variant="outline" 
                      className="w-full justify-start"
                      onClick={() => setActiveView("analytics")}
                    >
                      <TrendingUp className="mr-2 h-4 w-4" />
                      View Analytics
                    </Button>
                  </CardContent>
                </Card>
                <Card className="border-border/50">
                  <CardHeader>
                    <CardTitle className="text-base">Department Summary</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Total Users</span>
                        <span className="font-medium">{stats.totalUsers}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Completion Rate</span>
                        <span className="font-medium">
                          {stats.totalEnrollments > 0 
                            ? Math.round((stats.completedCourses / stats.totalEnrollments) * 100)
                            : 0}%
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Certificates Earned</span>
                        <span className="font-medium">{stats.totalCertificates}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </>
          )}

          {/* Users View */}
          {activeView === "users" && <SubAdminUserManagement departmentId={department.id} />}

          {/* Analytics View */}
          {activeView === "analytics" && <SubAdminAnalytics departmentId={department.id} />}
        </div>
      </div>
    </div>
  );
};

export default SubAdminDashboard;
