import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Home, BookOpen, TrendingUp, Award, User, Bell, LogOut, GraduationCap, BarChart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";

const UserNav = () => {
  const location = useLocation();
  const { signOut, userRole } = useAuth();
  const [featureSettings, setFeatureSettings] = useState<Record<string, boolean>>({});

  // Admin menu items
  const adminNavItems = [
    { path: "/dashboard", icon: Home, label: "Home" },
    { path: "/admin", icon: BarChart, label: "My Dashboard" },
    { path: "/profile", icon: User, label: "My Profile" },
  ];

  // Regular user menu items
  const userNavItems: Array<{ path: string; icon: any; label: string; feature?: string }> = [
    { path: "/admin", icon: BookOpen, label: "Courses" },
    { path: "/progress", icon: TrendingUp, label: "My Progress" },
    { path: "/certificates", icon: Award, label: "Certificates", feature: "certificates" },
    { path: "/profile", icon: User, label: "Profile" },
    { path: "/notifications", icon: Bell, label: "Notifications", feature: "notifications" },
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

  const navItems = userRole === 'admin' ? adminNavItems : userNavItems;
  
  // Filter nav items based on feature settings for regular users
  const filteredNavItems = userRole === 'admin' 
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
          <Link to="/dashboard" className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full gradient-crimson flex items-center justify-center">
              <GraduationCap className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold">LearnHub</h1>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {filteredNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link key={item.path} to={item.path}>
                  <Button
                    variant={isActive ? "default" : "ghost"}
                    size="sm"
                    className={cn("gap-2", isActive && "gradient-crimson")}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Button>
                </Link>
              );
            })}
          </nav>

          <Button variant="outline" size="sm" onClick={signOut}>
            <LogOut className="mr-2 h-4 w-4" />
            Sign Out
          </Button>
        </div>

        {/* Mobile Navigation */}
        <nav className="md:hidden flex items-center gap-1 mt-4 overflow-x-auto pb-2">
          {filteredNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link key={item.path} to={item.path}>
                <Button
                  variant={isActive ? "default" : "ghost"}
                  size="sm"
                  className={cn("gap-2 whitespace-nowrap", isActive && "gradient-crimson")}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Button>
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
};

export default UserNav;
