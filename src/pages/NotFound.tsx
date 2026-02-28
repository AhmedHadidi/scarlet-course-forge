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
      </div>
    </div>
  );
};

export default NotFound;
