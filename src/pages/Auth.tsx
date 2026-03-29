import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, GraduationCap, Check, X } from "lucide-react";
import { z } from "zod";
import { CategoryPreferencesStep } from "@/components/CategoryPreferencesStep";
import { useTranslation } from "react-i18next";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import ThemeToggle from "@/components/ThemeToggle";

interface Department {
  id: string;
  name: string;
}

const Auth = () => {
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("login");
  const [showPreferences, setShowPreferences] = useState(false);
  const [newUserId, setNewUserId] = useState<string | null>(null);
  const [signupPassword, setSignupPassword] = useState("");
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDepartment, setSelectedDepartment] = useState<string>("");
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { t } = useTranslation();

  const passwordRequirements = [
    { regex: /.{8,}/, label: t("auth.passwordReq1") },
    { regex: /[A-Z]/, label: t("auth.passwordReq2") },
    { regex: /[a-z]/, label: t("auth.passwordReq3") },
    { regex: /[0-9]/, label: t("auth.passwordReq4") },
    { regex: /[!@#$%^&*(),.?":{}|<>]/, label: t("auth.passwordReq5") },
  ];

  const strongPasswordSchema = z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(100, "Password must be less than 100 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number")
    .regex(/[!@#$%^&*(),.?":{}|<>]/, "Password must contain at least one special character");

  const loginSchema = z.object({
    email: z.string().email("Invalid email address").max(255),
    password: z.string().min(1, "Password is required").max(100),
  });

  const signupSchema = z.object({
    email: z.string().email("Invalid email address").max(255),
    password: strongPasswordSchema,
    fullName: z.string().min(2, "Name must be at least 2 characters").max(100).regex(/^[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\s\-'\.]+$/, t("auth.nameArabicOnly")),
  });

  useEffect(() => {
    const fetchDepartments = async () => {
      const { data, error } = await supabase.from("departments").select("id, name").order("name");
      if (!error && data) setDepartments(data);
    };
    fetchDepartments();
  }, []);

  const getPasswordStrength = (password: string) => {
    return passwordRequirements.map((req) => ({ ...req, met: req.regex.test(password) }));
  };

  const passwordStrength = getPasswordStrength(signupPassword);
  const allRequirementsMet = passwordStrength.every((req) => req.met);

  useEffect(() => {
    const handleOAuthCallback = async () => {
      const isCallback = searchParams.get("callback");
      if (!isCallback) return;
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { data: roleData } = await supabase
          .from("user_roles").select("role").eq("user_id", session.user.id).eq("role", "admin").maybeSingle();
        if (roleData) {
          navigate("/admin", { replace: true });
        } else {
          navigate("/dashboard", { replace: true });
        }
      }
    };
    handleOAuthCallback();
  }, [searchParams, navigate]);

  const handleEmailSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    try {
      const validated = loginSchema.parse({ email, password });
      setLoading(true);
      const { data, error } = await supabase.auth.signInWithPassword({ email: validated.email, password: validated.password });
      if (error) throw error;
      const { data: profileData } = await supabase.from("profiles").select("full_name").eq("id", data.user.id).maybeSingle();
      const { data: roleData } = await supabase.from("user_roles").select("role").eq("user_id", data.user.id).eq("role", "admin").maybeSingle();
      const userName = profileData?.full_name || "User";
      toast.success(t("auth.welcomeBack", { name: userName }));
      if (roleData) {
        navigate("/admin");
      } else {
        navigate("/dashboard");
      }
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        toast.error(error.message || "Invalid email or password");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSignUp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    const fullName = formData.get("fullName") as string;
    if (!selectedDepartment) { toast.error(t("auth.selectDeptError")); return; }
    try {
      const validated = signupSchema.parse({ email, password, fullName });
      setLoading(true);
      const redirectUrl = `${window.location.origin}/`;
      const { data, error } = await supabase.auth.signUp({
        email: validated.email,
        password: validated.password,
        options: { emailRedirectTo: redirectUrl, data: { full_name: validated.fullName } },
      });
      if (error) throw error;
      if (data.user) {
        await supabase.from("profiles").update({ department_id: selectedDepartment }).eq("id", data.user.id);
        toast.success(t("auth.welcomeUser", { name: validated.fullName || "User" }));
        setNewUserId(data.user.id);
        setShowPreferences(true);
      }
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else if (error.message?.includes("already registered")) {
        toast.error(t("auth.alreadyRegistered"));
      } else {
        toast.error(error.message || "Error creating account");
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePreferencesComplete = async () => {
    if (newUserId) {
      const { data: roleData } = await supabase.from("user_roles").select("role").eq("user_id", newUserId).eq("role", "admin").maybeSingle();
      if (roleData) {
        navigate("/admin");
      } else {
        navigate("/dashboard");
      }
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-background">
      <div className="flex items-center gap-2 mb-4 self-end">
        <LanguageSwitcher />
        <ThemeToggle />
      </div>
      <Card className="w-full max-w-md border-border/50 shadow-crimson">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <div className="h-16 w-16 rounded-full gradient-crimson flex items-center justify-center shadow-crimson">
              <GraduationCap className="h-8 w-8 text-white" />
            </div>
          </div>
          <CardTitle className="text-2xl">
            {showPreferences ? t("auth.preferencesTitle") : t("auth.welcomeTitle")}
          </CardTitle>
          <CardDescription>
            {showPreferences ? t("auth.preferencesDesc") : t("auth.signInDesc")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {showPreferences && newUserId ? (
            <CategoryPreferencesStep
              userId={newUserId}
              onComplete={handlePreferencesComplete}
              onSkip={handlePreferencesComplete}
            />
          ) : (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="login">{t("auth.signIn")}</TabsTrigger>
                <TabsTrigger value="signup">{t("auth.signUp")}</TabsTrigger>
              </TabsList>

              <TabsContent value="login">
                <form onSubmit={handleEmailSignIn} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-email">{t("auth.email")}</Label>
                    <Input id="login-email" name="email" type="email" placeholder={t("auth.emailPlaceholder")} required disabled={loading} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="login-password">{t("auth.password")}</Label>
                    <Input id="login-password" name="password" type="password" placeholder="••••••••" required disabled={loading} />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{t("auth.signingIn")}</>
                    ) : t("auth.signIn")}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup">
                <form onSubmit={handleEmailSignUp} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-fullName">{t("auth.fullName")}</Label>
                    <Input id="signup-fullName" name="fullName" type="text" placeholder="" required disabled={loading} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-department">{t("auth.department")}</Label>
                    <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
                      <SelectTrigger>
                        <SelectValue placeholder={t("auth.selectDepartment")} />
                      </SelectTrigger>
                      <SelectContent>
                        {departments.map((dept) => (
                          <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">{t("auth.email")}</Label>
                    <Input id="signup-email" name="email" type="email" placeholder={t("auth.emailPlaceholder")} required disabled={loading} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">{t("auth.password")}</Label>
                    <Input
                      id="signup-password" name="password" type="password" placeholder="••••••••"
                      required disabled={loading} value={signupPassword} onChange={(e) => setSignupPassword(e.target.value)}
                    />
                    {signupPassword && (
                      <div className="mt-2 space-y-1">
                        {passwordStrength.map((req, index) => (
                          <div key={index} className={`flex items-center gap-2 text-xs ${req.met ? "text-green-600" : "text-muted-foreground"}`}>
                            {req.met ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                            {req.label}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <Button type="submit" className="w-full" disabled={loading || !allRequirementsMet}>
                    {loading ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{t("auth.creatingAccount")}</>
                    ) : t("auth.createAccount")}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
