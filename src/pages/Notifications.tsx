import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bell, Award, BookOpen, TrendingUp } from "lucide-react";
import UserNav from "@/components/UserNav";

const Notifications = () => {
  // Mock notifications data - will be replaced with real data from backend
  const notifications = [
    {
      id: "1",
      type: "certificate",
      title: "Certificate Earned",
      message: "Congratulations! You've earned a certificate for completing React Fundamentals",
      timestamp: new Date(Date.now() - 3600000).toISOString(),
      read: false,
      icon: Award,
    },
    {
      id: "2",
      type: "course",
      title: "New Course Available",
      message: "A new course 'Advanced TypeScript Patterns' has been added to the platform",
      timestamp: new Date(Date.now() - 86400000).toISOString(),
      read: true,
      icon: BookOpen,
    },
    {
      id: "3",
      type: "progress",
      title: "Progress Milestone",
      message: "You've completed 50% of your JavaScript course. Keep it up!",
      timestamp: new Date(Date.now() - 172800000).toISOString(),
      read: true,
      icon: TrendingUp,
    },
  ];

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="min-h-screen bg-background">
      <UserNav />

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-3xl font-bold mb-2">Notifications</h2>
              <p className="text-muted-foreground">Stay updated with your learning journey</p>
            </div>
            {unreadCount > 0 && (
              <Badge className="gradient-crimson">{unreadCount} New</Badge>
            )}
          </div>
        </div>

        {notifications.length === 0 ? (
          <div className="text-center py-12">
            <Bell className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No notifications yet</p>
          </div>
        ) : (
          <div className="space-y-4">
            {notifications.map((notification) => {
              const Icon = notification.icon;
              return (
                <Card
                  key={notification.id}
                  className={`border-border transition-smooth hover:shadow-crimson ${
                    !notification.read ? "border-primary/50" : ""
                  }`}
                >
                  <CardHeader>
                    <div className="flex items-start gap-4">
                      <div className="h-10 w-10 rounded-full gradient-crimson flex items-center justify-center flex-shrink-0">
                        <Icon className="h-5 w-5 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <CardTitle className="text-base">{notification.title}</CardTitle>
                          {!notification.read && (
                            <Badge variant="secondary" className="flex-shrink-0">
                              New
                            </Badge>
                          )}
                        </div>
                        <CardDescription className="text-sm">
                          {notification.message}
                        </CardDescription>
                        <p className="text-xs text-muted-foreground mt-2">
                          {new Date(notification.timestamp).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </CardHeader>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default Notifications;
