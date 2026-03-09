import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Clock, Mail, LogIn } from "lucide-react";

const PendingApproval = () => {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const handleBackToLogin = async () => {
    await signOut();
    navigate("/auth");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md border-border/50 shadow-crimson text-center">
        <CardHeader>
          <div className="flex justify-center mb-4">
            <div className="h-16 w-16 rounded-full gradient-crimson flex items-center justify-center shadow-crimson">
              <Clock className="h-8 w-8 text-white" />
            </div>
          </div>
          <CardTitle className="text-2xl">{t("pendingApproval.title")}</CardTitle>
          <CardDescription className="text-base">{t("pendingApproval.message")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2 text-muted-foreground text-sm justify-center">
            <Mail className="h-4 w-4" />
            <span>{t("pendingApproval.submessage")}</span>
          </div>
          <p className="text-sm text-muted-foreground">{t("pendingApproval.checkBack")}</p>
          <div className="flex flex-col gap-2">
            <Button variant="outline" className="w-full gap-2" onClick={handleBackToLogin}>
              <LogIn className="h-4 w-4" />
              {t("pendingApproval.backToLogin")}
            </Button>
            <Button variant="ghost" className="w-full text-muted-foreground" onClick={signOut}>
              {t("pendingApproval.signOut")}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PendingApproval;
