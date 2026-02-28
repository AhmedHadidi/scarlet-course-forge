import { Link, useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Home, BookOpen, TrendingUp, Award, User, Bell, LogOut, GraduationCap, BarChart, Newspaper } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import ThemeToggle from "@/components/ThemeToggle";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useTranslation } from "react-i18next";

const UserNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, userRole } = useAuth();
  const { t } = useTranslation();
  const [featureSettings, setFeatureSettings] = useState<Record<string, boolean>>({});

  const adminNavItems = [
    { path: "/dashboard", icon: Home, label: t("nav.courses") },
    { path: "/bulletins", icon: Newspaper, label: t("nav.aiNews") },
    { path: "/progress", icon: TrendingUp, label: t("nav.myProgress") },
    { path: "/admin", icon: BarChart, label: t("nav.adminDashboard") },
    { path: "/profile", icon: User, label: t("nav.myProfile") },
  ];

  const subAdminNavItems = [
    { path: "/dashboard", icon: Home, label: t("nav.courses") },
    { path: "/bulletins", icon: Newspaper, label: t("nav.aiNews") },
    { path: "/progress", icon: TrendingUp, label: t("nav.myProgress") },
    { path: "/subadmin", icon: BarChart, label: t("nav.myDashboard") },
    { path: "/profile", icon: User, label: t("nav.myProfile") },
  ];

  const userNavItems: Array<{ path: string; icon: any; label: string; feature?: string }> = [
    { path: "/dashboard", icon: BookOpen, label: t("nav.courses") },
    { path: "/bulletins", icon: Newspaper, label: t("nav.aiNews") },
    { path: "/progress", icon: TrendingUp, label: t("nav.myProgress") },
    { path: "/certificates", icon: Award, label: t("nav.certificates"), feature: "certificates" },
    { path: "/profile", icon: User, label: t("nav.profile") },
    { path: "/notifications", icon: Bell, label: t("nav.notifications"), feature: "notifications" },
  ];

  useEffect(() => {
    fetchFeatureSettings();
  }, []);

  const fetchFeatureSettings = async () => {
    try {
      const { data } = await supabase
        .from("feature_settings")
        .select("feature_name, is_enabled");

      if (data) {
        const settings: Record<string, boolean> = {};
        data.forEach(item => {
          settings[item.feature_name] = item.is_enabled;
        });
        setFeatureSettings(settings);
      }
    } catch (error) {
      console.error("Error fetching feature settings:", error);
    }
  };

  const navItems = userRole === 'admin'
    ? adminNavItems
    : userRole === 'sub_admin'
      ? subAdminNavItems
      : userNavItems;

  const filteredNavItems = userRole === 'admin' || userRole === 'sub_admin'
    ? navItems
    : navItems.filter(item => {
      if ('feature' in item && item.feature) {
        return featureSettings[item.feature] !== false;
      }
      return true;
    });

  return (
    <header className="border-b border-border bg-card/30 backdrop-blur-sm sticky top-0 z-10">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full gradient-crimson flex items-center justify-center">
              <GraduationCap className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold">{t("nav.brand")}</h1>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {filteredNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Button
                  key={item.path}
                  variant={isActive ? "default" : "ghost"}
                  size="sm"
                  className={cn("gap-2", isActive && "gradient-crimson")}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    navigate(item.path);
                  }}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Button>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <ThemeToggle />
            <Button variant="outline" size="sm" onClick={signOut}>
              <LogOut className="mr-2 h-4 w-4" />
              {t("nav.signOut")}
            </Button>
          </div>
        </div>

        {/* Mobile Navigation */}
        <nav className="md:hidden flex items-center gap-1 mt-4 overflow-x-auto pb-2">
          {filteredNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Button
                key={item.path}
                variant={isActive ? "default" : "ghost"}
                size="sm"
                className={cn("gap-2 whitespace-nowrap", isActive && "gradient-crimson")}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  navigate(item.path);
                }}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Button>
            );
          })}
        </nav>
      </div>
    </header>
  );
};

export default UserNav;
