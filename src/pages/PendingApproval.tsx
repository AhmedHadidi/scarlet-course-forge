<<<<<<< HEAD
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Clock, Mail } from "lucide-react";

const PendingApproval = () => {
  const { signOut } = useAuth();
  const { t } = useTranslation();

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
          <Button variant="outline" className="w-full" onClick={signOut}>
            {t("pendingApproval.signOut")}
=======
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock, GraduationCap, LogOut } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const PendingApproval = () => {
  const { signOut } = useAuth();

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-md w-full border-border/50">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-amber-500/10 flex items-center justify-center">
            <Clock className="h-8 w-8 text-amber-500" />
          </div>
          <div className="flex items-center justify-center gap-2 mb-2">
            <div className="h-8 w-8 rounded-full gradient-crimson flex items-center justify-center">
              <GraduationCap className="h-4 w-4 text-white" />
            </div>
            <span className="font-bold text-lg">MOI AI Learning Hub</span>
          </div>
          <CardTitle className="text-2xl">Registration Pending</CardTitle>
          <CardDescription className="text-base">
            Your account is awaiting administrator approval
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-muted/50 rounded-lg p-4 text-center">
            <p className="text-sm text-muted-foreground">
              Thank you for registering! An administrator will review your registration 
              and approve your account shortly. You will be able to access the platform 
              once your registration has been approved.
            </p>
          </div>
          
          <div className="space-y-2">
            <h4 className="font-medium text-sm">What happens next?</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• An admin will review your registration</li>
              <li>• You'll receive access once approved</li>
              <li>• Check back later or contact your administrator</li>
            </ul>
          </div>

          <Button variant="outline" className="w-full" onClick={signOut}>
            <LogOut className="mr-2 h-4 w-4" />
            Sign Out
>>>>>>> 5b56e227004fb842bfd26ac33621142a3f1e8a88
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default PendingApproval;
