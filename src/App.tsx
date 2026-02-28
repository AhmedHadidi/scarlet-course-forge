import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
<<<<<<< HEAD
import { useLanguage } from "@/contexts/LanguageContext";
=======
>>>>>>> 5b56e227004fb842bfd26ac33621142a3f1e8a88
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Landing from "./pages/Landing";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import CoursePlayer from "./pages/CoursePlayer";
import Progress from "./pages/Progress";
import Certificates from "./pages/Certificates";
import Profile from "./pages/Profile";
import Notifications from "./pages/Notifications";
import AdminDashboard from "./pages/AdminDashboard";
import SubAdminDashboard from "./pages/SubAdminDashboard";
import QuizTake from "./pages/QuizTake";
import WeeklyBulletin from "./pages/WeeklyBulletin";
import Bulletins from "./pages/Bulletins";
import PendingApproval from "./pages/PendingApproval";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

<<<<<<< HEAD
const AppInner = () => {
  const { isRTL } = useLanguage();
  return (
    <div dir={isRTL ? "rtl" : "ltr"}>
      <ThemeProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AuthProvider>
              <Routes>
                <Route path="/" element={<Landing />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/pending-approval" element={<PendingApproval />} />
                <Route
                  path="/dashboard"
                  element={
                    <ProtectedRoute>
                      <Dashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/courses/:courseId"
                  element={
                    <ProtectedRoute>
                      <CoursePlayer />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/progress"
                  element={
                    <ProtectedRoute>
                      <Progress />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/certificates"
                  element={
                    <ProtectedRoute>
                      <Certificates />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/profile"
                  element={
                    <ProtectedRoute>
                      <Profile />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/notifications"
                  element={
                    <ProtectedRoute>
                      <Notifications />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/bulletins"
                  element={
                    <ProtectedRoute>
                      <Bulletins />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin"
                  element={
                    <ProtectedRoute requiredRole="admin">
                      <AdminDashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/subadmin"
                  element={
                    <ProtectedRoute requiredRole="sub_admin">
                      <SubAdminDashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/quiz/:quizId"
                  element={
                    <ProtectedRoute>
                      <QuizTake />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/bulletin/:id"
                  element={
                    <ProtectedRoute>
                      <WeeklyBulletin />
                    </ProtectedRoute>
                  }
                />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </AuthProvider>
          </BrowserRouter>
        </TooltipProvider>
      </ThemeProvider>
    </div>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AppInner />
=======
const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/pending-approval" element={<PendingApproval />} />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/courses/:courseId"
              element={
                <ProtectedRoute>
                  <CoursePlayer />
                </ProtectedRoute>
              }
            />
            <Route
              path="/progress"
              element={
                <ProtectedRoute>
                  <Progress />
                </ProtectedRoute>
              }
            />
            <Route
              path="/certificates"
              element={
                <ProtectedRoute>
                  <Certificates />
                </ProtectedRoute>
              }
            />
            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <Profile />
                </ProtectedRoute>
              }
            />
            <Route
              path="/notifications"
              element={
                <ProtectedRoute>
                  <Notifications />
                </ProtectedRoute>
              }
            />
            <Route
              path="/bulletins"
              element={
                <ProtectedRoute>
                  <Bulletins />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin"
              element={
                <ProtectedRoute requiredRole="admin">
                  <AdminDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/subadmin"
              element={
                <ProtectedRoute requiredRole="sub_admin">
                  <SubAdminDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/quiz/:quizId"
              element={
                <ProtectedRoute>
                  <QuizTake />
                </ProtectedRoute>
              }
            />
            <Route
              path="/bulletin/:id"
              element={
                <ProtectedRoute>
                  <WeeklyBulletin />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
    </ThemeProvider>
>>>>>>> 5b56e227004fb842bfd26ac33621142a3f1e8a88
  </QueryClientProvider>
);

export default App;
