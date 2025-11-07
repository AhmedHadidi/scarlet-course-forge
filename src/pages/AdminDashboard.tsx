import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, BookOpen, Award, TrendingUp, LogOut, GraduationCap, Home, BarChart } from "lucide-react";
import { CourseManagement } from "@/components/admin/CourseManagement";
import { UserManagement } from "@/components/admin/UserManagement";

const AdminDashboard = () => {
  const { signOut } = useAuth();
  const [activeView, setActiveView] = useState("overview");
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalCourses: 0,
    totalEnrollments: 0,
    totalCertificates: 0,
  });

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const [usersCount, coursesCount, enrollmentsCount, certificatesCount] = await Promise.all([
        supabase.from("profiles").select("*", { count: "exact", head: true }),
        supabase.from("courses").select("*", { count: "exact", head: true }),
        supabase.from("enrollments").select("*", { count: "exact", head: true }),
        supabase.from("certificates").select("*", { count: "exact", head: true }),
      ]);

      setStats({
        totalUsers: usersCount.count || 0,
        totalCourses: coursesCount.count || 0,
        totalEnrollments: enrollmentsCount.count || 0,
        totalCertificates: certificatesCount.count || 0,
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  };

  const statCards = [
    {
      title: "Total Users",
      value: stats.totalUsers,
      icon: Users,
      description: "Registered learners",
    },
    {
      title: "Total Courses",
      value: stats.totalCourses,
      icon: BookOpen,
      description: "Available courses",
    },
    {
      title: "Enrollments",
      value: stats.totalEnrollments,
      icon: TrendingUp,
      description: "Course enrollments",
    },
    {
      title: "Certificates",
      value: stats.totalCertificates,
      icon: Award,
      description: "Issued certificates",
    },
  ];

  const menuItems = [
    { id: "overview", label: "Overview", icon: Home },
    { id: "users", label: "Users", icon: Users },
    { id: "courses", label: "Courses", icon: BookOpen },
    { id: "certificates", label: "Certificates", icon: Award },
    { id: "analytics", label: "Analytics", icon: BarChart },
  ];

  const handleQuickAction = (action: string) => {
    if (action === "create-user") {
      setActiveView("users");
      setTimeout(() => {
        const button = document.querySelector('[data-action="create-user-dialog"]') as HTMLButtonElement;
        button?.click();
      }, 100);
    } else if (action === "create-course") {
      setActiveView("courses");
      setTimeout(() => {
        const button = document.querySelector('[data-action="create-course-dialog"]') as HTMLButtonElement;
        button?.click();
      }, 100);
    } else if (action === "issue-certificate") {
      setActiveView("certificates");
    }
  };

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
              <h1 className="text-lg font-bold">LearnHub</h1>
              <p className="text-xs text-muted-foreground">Admin Panel</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4">
          <div className="space-y-1">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeView === item.id;
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
              {menuItems.find(item => item.id === activeView)?.label || "Admin Dashboard"}
            </h2>
            <p className="text-muted-foreground mt-1">
              {activeView === "overview" && "Manage your platform and monitor performance"}
              {activeView === "users" && "Manage user accounts and permissions"}
              {activeView === "courses" && "Create and manage courses"}
              {activeView === "certificates" && "Issue and manage certificates"}
              {activeView === "analytics" && "View platform analytics and reports"}
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
                      onClick={() => handleQuickAction("create-user")}
                    >
                      <Users className="mr-2 h-4 w-4" />
                      Add New User
                    </Button>
                    <Button 
                      variant="outline" 
                      className="w-full justify-start"
                      onClick={() => handleQuickAction("create-course")}
                    >
                      <BookOpen className="mr-2 h-4 w-4" />
                      Create Course
                    </Button>
                    <Button 
                      variant="outline" 
                      className="w-full justify-start"
                      onClick={() => handleQuickAction("issue-certificate")}
                    >
                      <Award className="mr-2 h-4 w-4" />
                      Issue Certificate
                    </Button>
                  </CardContent>
                </Card>
                <Card className="border-border/50">
                  <CardHeader>
                    <CardTitle className="text-base">Recent Activity</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      No recent activity to display
                    </p>
                  </CardContent>
                </Card>
              </div>
            </>
          )}

          {/* Users View */}
          {activeView === "users" && <UserManagement />}

          {/* Courses View */}
          {activeView === "courses" && <CourseManagement />}

          {/* Certificates View */}
          {activeView === "certificates" && (
            <div className="rounded-lg border border-border/50 p-12 text-center">
              <Award className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Certificate Management</h3>
              <p className="text-muted-foreground">
                Certificate management interface coming soon
              </p>
            </div>
          )}

          {/* Analytics View */}
          {activeView === "analytics" && (
            <div className="rounded-lg border border-border/50 p-12 text-center">
              <TrendingUp className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Analytics & Reports</h3>
              <p className="text-muted-foreground">
                Analytics dashboard coming soon
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
