import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, BookOpen, Award, TrendingUp, LogOut, GraduationCap, Home, BarChart, FileText, Newspaper, Building2, UserCheck } from "lucide-react";
import { CourseManagement } from "@/components/admin/CourseManagement";
import { UserManagement } from "@/components/admin/UserManagement";
import { AnalyticsDashboard } from "@/components/admin/AnalyticsDashboard";
import { QuizManagement } from "@/components/admin/QuizManagement";
import { FeatureManagement } from "@/components/admin/FeatureManagement";
import { NewsManagement } from "@/components/admin/NewsManagement";
import { DepartmentManagement } from "@/components/admin/DepartmentManagement";
import { PendingRegistrations } from "@/components/admin/PendingRegistrations";
<<<<<<< HEAD
import { useTranslation } from "react-i18next";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import ThemeToggle from "@/components/ThemeToggle";

const AdminDashboard = () => {
  const { signOut } = useAuth();
  const { t } = useTranslation();
  const [activeView, setActiveView] = useState("overview");
  const [stats, setStats] = useState({ totalUsers: 0, totalCourses: 0, totalEnrollments: 0, totalCertificates: 0 });

  useEffect(() => { fetchStats(); }, []);
=======

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
>>>>>>> 5b56e227004fb842bfd26ac33621142a3f1e8a88

  const fetchStats = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
<<<<<<< HEAD
=======
      
      // Fetch users via edge function for accurate count
>>>>>>> 5b56e227004fb842bfd26ac33621142a3f1e8a88
      const { data: usersData } = await supabase.functions.invoke('admin-operations', {
        body: { operation: 'listUsers' },
        headers: { Authorization: `Bearer ${session?.access_token}` }
      });
<<<<<<< HEAD
=======

>>>>>>> 5b56e227004fb842bfd26ac33621142a3f1e8a88
      const [coursesCount, enrollmentsCount, certificatesCount] = await Promise.all([
        supabase.from("courses").select("*", { count: "exact", head: true }),
        supabase.from("enrollments").select("*", { count: "exact", head: true }),
        supabase.from("certificates").select("*", { count: "exact", head: true }),
      ]);
<<<<<<< HEAD
=======

>>>>>>> 5b56e227004fb842bfd26ac33621142a3f1e8a88
      setStats({
        totalUsers: usersData?.users?.length || 0,
        totalCourses: coursesCount.count || 0,
        totalEnrollments: enrollmentsCount.count || 0,
        totalCertificates: certificatesCount.count || 0,
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  };

  const statCards = [
<<<<<<< HEAD
    { title: t("admin.totalUsers"), value: stats.totalUsers, icon: Users, description: t("admin.registeredLearners") },
    { title: t("admin.totalCourses"), value: stats.totalCourses, icon: BookOpen, description: t("admin.availableCourses") },
    { title: t("admin.enrollments"), value: stats.totalEnrollments, icon: TrendingUp, description: t("admin.courseEnrollments") },
    { title: t("admin.certificates"), value: stats.totalCertificates, icon: Award, description: t("admin.issuedCertificates") },
  ];

  const menuItems = [
    { id: "home", label: t("admin.home"), icon: Home, isExternal: true, path: "/" },
    { id: "overview", label: t("admin.dashboard"), icon: BarChart },
    { id: "registrations", label: t("admin.registrations"), icon: UserCheck },
    { id: "analytics", label: t("admin.analytics"), icon: TrendingUp },
    { id: "users", label: t("admin.users"), icon: Users },
    { id: "departments", label: t("admin.departments"), icon: Building2 },
    { id: "courses", label: t("admin.courses"), icon: BookOpen },
    { id: "quizzes", label: t("admin.quizzes"), icon: FileText },
    { id: "news", label: t("admin.news"), icon: Newspaper },
    { id: "features", label: t("admin.features"), icon: Award },
  ];

  const getHeaderDescription = () => {
    switch (activeView) {
      case "overview": return t("admin.manageOverview");
      case "registrations": return t("admin.manageRegistrations");
      case "users": return t("admin.manageUsers");
      case "departments": return t("admin.manageDepartments");
      case "courses": return t("admin.manageCourses");
      case "quizzes": return t("admin.manageQuizzes");
      case "news": return t("admin.manageNews");
      case "features": return t("admin.manageFeatures");
      case "analytics": return t("admin.manageAnalytics");
      default: return "";
    }
  };

  const handleQuickAction = (action: string) => {
    if (action === "create-user") {
      setActiveView("users");
      setTimeout(() => { (document.querySelector('[data-action="create-user-dialog"]') as HTMLButtonElement)?.click(); }, 100);
    } else if (action === "create-course") {
      setActiveView("courses");
      setTimeout(() => { (document.querySelector('[data-action="create-course-dialog"]') as HTMLButtonElement)?.click(); }, 100);
=======
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
    { id: "home", label: "Home", icon: Home, isExternal: true, path: "/" },
    { id: "overview", label: "Dashboard", icon: BarChart },
    { id: "registrations", label: "Registrations", icon: UserCheck },
    { id: "analytics", label: "Analytics", icon: TrendingUp },
    { id: "users", label: "Users", icon: Users },
    { id: "departments", label: "Departments", icon: Building2 },
    { id: "courses", label: "Courses", icon: BookOpen },
    { id: "quizzes", label: "Quizzes", icon: FileText },
    { id: "news", label: "News & Bulletins", icon: Newspaper },
    { id: "features", label: "Features", icon: Award },
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
>>>>>>> 5b56e227004fb842bfd26ac33621142a3f1e8a88
    }
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside className="w-64 bg-card border-r border-border flex flex-col">
<<<<<<< HEAD
=======
        {/* Logo */}
>>>>>>> 5b56e227004fb842bfd26ac33621142a3f1e8a88
        <div className="p-6 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full gradient-crimson flex items-center justify-center">
              <GraduationCap className="h-5 w-5 text-white" />
            </div>
            <div>
<<<<<<< HEAD
              <h1 className="text-lg font-bold">{t("nav.brand")}</h1>
              <p className="text-xs text-muted-foreground">{t("admin.panelLabel")}</p>
=======
              <h1 className="text-lg font-bold">MOI AI Learning Hub</h1>
              <p className="text-xs text-muted-foreground">Admin Panel</p>
>>>>>>> 5b56e227004fb842bfd26ac33621142a3f1e8a88
            </div>
          </div>
        </div>

<<<<<<< HEAD
=======
        {/* Navigation */}
>>>>>>> 5b56e227004fb842bfd26ac33621142a3f1e8a88
        <nav className="flex-1 p-4">
          <div className="space-y-1">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeView === item.id;
<<<<<<< HEAD
              if (item.isExternal) {
                return (
                  <a key={item.id} href={item.path} className="w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-muted-foreground hover:bg-muted hover:text-foreground">
=======
              
              if (item.isExternal) {
                return (
                  <a
                    key={item.id}
                    href={item.path}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
>>>>>>> 5b56e227004fb842bfd26ac33621142a3f1e8a88
                    <Icon className="h-5 w-5" />
                    <span className="font-medium">{item.label}</span>
                  </a>
                );
              }
<<<<<<< HEAD
=======
              
>>>>>>> 5b56e227004fb842bfd26ac33621142a3f1e8a88
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveView(item.id)}
<<<<<<< HEAD
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
=======
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
>>>>>>> 5b56e227004fb842bfd26ac33621142a3f1e8a88
                >
                  <Icon className="h-5 w-5" />
                  <span className="font-medium">{item.label}</span>
                </button>
              );
            })}
          </div>
        </nav>

<<<<<<< HEAD
        <div className="p-4 border-t border-border space-y-2">
          <div className="flex items-center justify-between">
            <LanguageSwitcher />
            <ThemeToggle />
          </div>
          <Button variant="outline" className="w-full" onClick={signOut}>
            <LogOut className="mr-2 h-4 w-4" />
            {t("admin.signOut")}
=======
        {/* Sign Out Button */}
        <div className="p-4 border-t border-border">
          <Button variant="outline" className="w-full" onClick={signOut}>
            <LogOut className="mr-2 h-4 w-4" />
            Sign Out
>>>>>>> 5b56e227004fb842bfd26ac33621142a3f1e8a88
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
<<<<<<< HEAD
        <header className="border-b border-border bg-card/30 backdrop-blur-sm sticky top-0 z-10">
          <div className="px-8 py-6">
            <h2 className="text-3xl font-bold">
              {menuItems.find(item => item.id === activeView)?.label || t("admin.dashboard")}
            </h2>
            <p className="text-muted-foreground mt-1">{getHeaderDescription()}</p>
=======
        {/* Header */}
        <header className="border-b border-border bg-card/30 backdrop-blur-sm sticky top-0 z-10">
          <div className="px-8 py-6">
            <h2 className="text-3xl font-bold">
              {menuItems.find(item => item.id === activeView)?.label || "Admin Dashboard"}
            </h2>
            <p className="text-muted-foreground mt-1">
              {activeView === "overview" && "Manage your platform and monitor performance"}
              {activeView === "registrations" && "Review and approve new user registrations"}
              {activeView === "users" && "Manage user accounts and permissions"}
              {activeView === "departments" && "Manage departments and assign sub-admins"}
              {activeView === "courses" && "Create and manage courses"}
              {activeView === "quizzes" && "Create and manage course quizzes"}
              {activeView === "news" && "Manage news articles, categories, and weekly bulletins"}
              {activeView === "features" && "Control feature visibility for users"}
              {activeView === "analytics" && "View platform analytics and reports"}
            </p>
>>>>>>> 5b56e227004fb842bfd26ac33621142a3f1e8a88
          </div>
        </header>

        <div className="p-8">
<<<<<<< HEAD
          {activeView === "overview" && (
            <>
=======
          {/* Overview */}
          {activeView === "overview" && (
            <>
              {/* Stats Grid */}
>>>>>>> 5b56e227004fb842bfd26ac33621142a3f1e8a88
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

<<<<<<< HEAD
              <Card className="border-border/50">
                <CardHeader>
                  <CardTitle className="text-base">{t("admin.quickActions")}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Button variant="outline" className="w-full justify-start" onClick={() => handleQuickAction("create-user")}>
                    <Users className="mr-2 h-4 w-4" />
                    {t("admin.addNewUser")}
                  </Button>
                  <Button variant="outline" className="w-full justify-start" onClick={() => handleQuickAction("create-course")}>
                    <BookOpen className="mr-2 h-4 w-4" />
                    {t("admin.createCourse")}
=======
              {/* Quick Actions */}
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
>>>>>>> 5b56e227004fb842bfd26ac33621142a3f1e8a88
                  </Button>
                </CardContent>
              </Card>
            </>
          )}

<<<<<<< HEAD
          {activeView === "registrations" && <PendingRegistrations />}
          {activeView === "users" && <UserManagement />}
          {activeView === "departments" && <DepartmentManagement />}
          {activeView === "courses" && <CourseManagement />}
          {activeView === "quizzes" && <QuizManagement />}
          {activeView === "news" && <NewsManagement />}
          {activeView === "features" && <FeatureManagement />}
=======
          {/* Registrations View */}
          {activeView === "registrations" && <PendingRegistrations />}

          {/* Users View */}
          {activeView === "users" && <UserManagement />}

          {/* Departments View */}
          {activeView === "departments" && <DepartmentManagement />}

          {/* Courses View */}
          {activeView === "courses" && <CourseManagement />}

          {/* Quizzes View */}
          {activeView === "quizzes" && <QuizManagement />}

          {/* News View */}
          {activeView === "news" && <NewsManagement />}

          {/* Features View */}
          {activeView === "features" && <FeatureManagement />}

          {/* Analytics View */}
>>>>>>> 5b56e227004fb842bfd26ac33621142a3f1e8a88
          {activeView === "analytics" && <AnalyticsDashboard />}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
