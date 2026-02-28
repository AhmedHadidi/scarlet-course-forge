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
import { useTranslation } from "react-i18next";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import ThemeToggle from "@/components/ThemeToggle";

const AdminDashboard = () => {
  const { signOut } = useAuth();
  const { t } = useTranslation();
  const [activeView, setActiveView] = useState("overview");
  const [stats, setStats] = useState({ totalUsers: 0, totalCourses: 0, totalEnrollments: 0, totalCertificates: 0 });

  useEffect(() => { fetchStats(); }, []);

  const fetchStats = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { data: usersData } = await supabase.functions.invoke('admin-operations', {
        body: { operation: 'listUsers' },
        headers: { Authorization: `Bearer ${session?.access_token}` }
      });
      const [coursesCount, enrollmentsCount, certificatesCount] = await Promise.all([
        supabase.from("courses").select("*", { count: "exact", head: true }),
        supabase.from("enrollments").select("*", { count: "exact", head: true }),
        supabase.from("certificates").select("*", { count: "exact", head: true }),
      ]);
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
    }
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside className="w-64 bg-card border-r border-border flex flex-col">
        <div className="p-6 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full gradient-crimson flex items-center justify-center">
              <GraduationCap className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold">{t("nav.brand")}</h1>
              <p className="text-xs text-muted-foreground">{t("admin.panelLabel")}</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4">
          <div className="space-y-1">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeView === item.id;
              if (item.isExternal) {
                return (
                  <a key={item.id} href={item.path} className="w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-muted-foreground hover:bg-muted hover:text-foreground">
                    <Icon className="h-5 w-5" />
                    <span className="font-medium">{item.label}</span>
                  </a>
                );
              }
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveView(item.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
                >
                  <Icon className="h-5 w-5" />
                  <span className="font-medium">{item.label}</span>
                </button>
              );
            })}
          </div>
        </nav>

        <div className="p-4 border-t border-border space-y-2">
          <div className="flex items-center justify-between">
            <LanguageSwitcher />
            <ThemeToggle />
          </div>
          <Button variant="outline" className="w-full" onClick={signOut}>
            <LogOut className="mr-2 h-4 w-4" />
            {t("admin.signOut")}
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        <header className="border-b border-border bg-card/30 backdrop-blur-sm sticky top-0 z-10">
          <div className="px-8 py-6">
            <h2 className="text-3xl font-bold">
              {menuItems.find(item => item.id === activeView)?.label || t("admin.dashboard")}
            </h2>
            <p className="text-muted-foreground mt-1">{getHeaderDescription()}</p>
          </div>
        </header>

        <div className="p-8">
          {activeView === "overview" && (
            <>
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
                  </Button>
                </CardContent>
              </Card>
            </>
          )}

          {activeView === "registrations" && <PendingRegistrations />}
          {activeView === "users" && <UserManagement />}
          {activeView === "departments" && <DepartmentManagement />}
          {activeView === "courses" && <CourseManagement />}
          {activeView === "quizzes" && <QuizManagement />}
          {activeView === "news" && <NewsManagement />}
          {activeView === "features" && <FeatureManagement />}
          {activeView === "analytics" && <AnalyticsDashboard />}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
