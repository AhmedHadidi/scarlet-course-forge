<<<<<<< HEAD
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-6">
        <h1 className="text-8xl font-bold text-primary">{t("notFound.title")}</h1>
        <h2 className="text-3xl font-bold">{t("notFound.heading")}</h2>
        <p className="text-muted-foreground text-lg">{t("notFound.message")}</p>
        <Button onClick={() => navigate("/")}>{t("notFound.backHome")}</Button>
=======
import { useLocation } from "react-router-dom";
import { useEffect } from "react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100">
      <div className="text-center">
        <h1 className="mb-4 text-4xl font-bold">404</h1>
        <p className="mb-4 text-xl text-gray-600">Oops! Page not found</p>
        <a href="/" className="text-blue-500 underline hover:text-blue-700">
          Return to Home
        </a>
>>>>>>> 5b56e227004fb842bfd26ac33621142a3f1e8a88
      </div>
    </div>
  );
};

export default NotFound;
