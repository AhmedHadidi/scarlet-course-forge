import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Copy, TrendingUp, Users, Sparkles, Search, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useLanguage } from "@/contexts/LanguageContext";

interface PromptCopyRow {
  id: string;
  prompt_id: string;
  user_id: string;
  department_id: string | null;
  copied_at: string;
}

interface PromptInfo {
  id: string;
  title: string | null;
  content: string;
  category: string | null;
  language: string | null;
}

interface ProfileInfo {
  id: string;
  full_name: string | null;
  department_id: string | null;
}

interface Props {
  /** When provided, restricts analytics to this department (sub-admin view) */
  departmentId?: string;
}

export const PromptCopyAnalytics = ({ departmentId }: Props) => {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [copies, setCopies] = useState<PromptCopyRow[]>([]);
  const [prompts, setPrompts] = useState<Record<string, PromptInfo>>({});
  const [profiles, setProfiles] = useState<Record<string, ProfileInfo>>({});
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"prompts" | "users" | "recent">("prompts");

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [departmentId]);

  const load = async () => {
    setLoading(true);
    try {
      let q = supabase
        .from("prompt_copies")
        .select("id, prompt_id, user_id, department_id, copied_at")
        .order("copied_at", { ascending: false })
        .limit(5000);
      if (departmentId) q = q.eq("department_id", departmentId);
      const { data: copiesData, error: copiesErr } = await q;
      if (copiesErr) throw copiesErr;
      const rows = (copiesData || []) as PromptCopyRow[];
      setCopies(rows);

      const promptIds = Array.from(new Set(rows.map((r) => r.prompt_id)));
      const userIds = Array.from(new Set(rows.map((r) => r.user_id)));

      const [promptsRes, profilesRes] = await Promise.all([
        promptIds.length
          ? supabase.from("prompts").select("id, title, content, category, language").in("id", promptIds)
          : Promise.resolve({ data: [], error: null } as any),
        userIds.length
          ? supabase.from("profiles").select("id, full_name, department_id").in("id", userIds)
          : Promise.resolve({ data: [], error: null } as any),
      ]);

      const pMap: Record<string, PromptInfo> = {};
      (promptsRes.data as PromptInfo[] | null)?.forEach((p) => (pMap[p.id] = p));
      setPrompts(pMap);

      const uMap: Record<string, ProfileInfo> = {};
      (profilesRes.data as ProfileInfo[] | null)?.forEach((u) => (uMap[u.id] = u));
      setProfiles(uMap);
    } catch (e) {
      console.error("Failed to load prompt copy analytics", e);
    } finally {
      setLoading(false);
    }
  };

  const totals = useMemo(() => {
    const uniqueUsers = new Set(copies.map((c) => c.user_id)).size;
    const uniquePrompts = new Set(copies.map((c) => c.prompt_id)).size;
    return { total: copies.length, uniqueUsers, uniquePrompts };
  }, [copies]);

  const perPrompt = useMemo(() => {
    const map = new Map<string, { count: number; users: Set<string> }>();
    copies.forEach((c) => {
      const e = map.get(c.prompt_id) || { count: 0, users: new Set() };
      e.count += 1;
      e.users.add(c.user_id);
      map.set(c.prompt_id, e);
    });
    return Array.from(map.entries())
      .map(([promptId, v]) => ({
        promptId,
        count: v.count,
        uniqueUsers: v.users.size,
        prompt: prompts[promptId],
      }))
      .sort((a, b) => b.count - a.count);
  }, [copies, prompts]);

  const perUser = useMemo(() => {
    const map = new Map<string, { count: number; prompts: Set<string> }>();
    copies.forEach((c) => {
      const e = map.get(c.user_id) || { count: 0, prompts: new Set() };
      e.count += 1;
      e.prompts.add(c.prompt_id);
      map.set(c.user_id, e);
    });
    return Array.from(map.entries())
      .map(([userId, v]) => ({
        userId,
        count: v.count,
        uniquePrompts: v.prompts.size,
        profile: profiles[userId],
      }))
      .sort((a, b) => b.count - a.count);
  }, [copies, profiles]);

  const filteredPerPrompt = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return perPrompt;
    return perPrompt.filter((r) => {
      const p = r.prompt;
      return (
        (p?.title || "").toLowerCase().includes(q) ||
        (p?.content || "").toLowerCase().includes(q) ||
        (p?.category || "").toLowerCase().includes(q)
      );
    });
  }, [perPrompt, search]);

  const filteredPerUser = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return perUser;
    return perUser.filter((r) => (r.profile?.full_name || "").toLowerCase().includes(q));
  }, [perUser, search]);

  const filteredRecent = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return copies.slice(0, 200);
    return copies
      .filter((c) => {
        const p = prompts[c.prompt_id];
        const u = profiles[c.user_id];
        return (
          (p?.title || "").toLowerCase().includes(q) ||
          (p?.category || "").toLowerCase().includes(q) ||
          (u?.full_name || "").toLowerCase().includes(q)
        );
      })
      .slice(0, 200);
  }, [copies, prompts, profiles, search]);

  const fmtDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleString(isRTL ? "ar-EG" : "en-US");
    } catch {
      return iso;
    }
  };

  const stats = [
    { label: t("prompts.analytics.totalCopies"), value: totals.total, icon: Copy },
    { label: t("prompts.analytics.uniqueUsers"), value: totals.uniqueUsers, icon: Users },
    { label: t("prompts.analytics.uniquePrompts"), value: totals.uniquePrompts, icon: Sparkles },
  ];

  return (
    <div className="space-y-6">
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            {t("prompts.analytics.title")}
          </CardTitle>
          <CardDescription>{t("prompts.analytics.subtitle")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {stats.map((s, i) => {
              const Icon = s.icon;
              return (
                <div key={i} className="rounded-lg border border-border/50 p-4 flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg gradient-crimson flex items-center justify-center">
                    <Icon className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{s.value}</p>
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/50">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="text-base">{t("prompts.analytics.breakdown")}</CardTitle>
            <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
              <TabsList>
                <TabsTrigger value="prompts">{t("prompts.analytics.byPrompt")}</TabsTrigger>
                <TabsTrigger value="users">{t("prompts.analytics.byUser")}</TabsTrigger>
                <TabsTrigger value="recent">{t("prompts.analytics.recent")}</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          <div className="relative mt-3">
            <Search className={`absolute top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground ${isRTL ? "right-3" : "left-3"}`} />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("prompts.analytics.searchPlaceholder")}
              className={isRTL ? "pr-9" : "pl-9"}
              dir="auto"
            />
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              {t("common.loading")}
            </div>
          ) : copies.length === 0 ? (
            <p className="text-center text-muted-foreground py-12">
              {t("prompts.analytics.empty")}
            </p>
          ) : tab === "prompts" ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("prompts.analytics.promptCol")}</TableHead>
                  <TableHead className="w-32 text-center">{t("prompts.analytics.copies")}</TableHead>
                  <TableHead className="w-32 text-center">{t("prompts.analytics.users")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPerPrompt.map((r) => {
                  const lang = r.prompt?.language || "ar";
                  const dir = lang === "ar" ? "rtl" : "ltr";
                  return (
                    <TableRow key={r.promptId}>
                      <TableCell>
                        <div className="max-w-xl">
                          {r.prompt?.title && (
                            <p className="font-medium truncate" dir={dir} style={{ unicodeBidi: "plaintext" }}>
                              {r.prompt.title}
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground truncate" dir={dir} style={{ unicodeBidi: "plaintext" }}>
                            {r.prompt?.content || "—"}
                          </p>
                          <div className="flex flex-wrap gap-1 mt-1">
                            <Badge variant="outline">{lang.toUpperCase()}</Badge>
                            {r.prompt?.category && <Badge variant="secondary">{r.prompt.category}</Badge>}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-center font-semibold">{r.count}</TableCell>
                      <TableCell className="text-center">{r.uniqueUsers}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : tab === "users" ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("prompts.analytics.userCol")}</TableHead>
                  <TableHead className="w-32 text-center">{t("prompts.analytics.copies")}</TableHead>
                  <TableHead className="w-32 text-center">{t("prompts.analytics.prompts")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPerUser.map((r) => (
                  <TableRow key={r.userId}>
                    <TableCell>
                      <p className="font-medium" dir="auto" style={{ unicodeBidi: "plaintext" }}>
                        {r.profile?.full_name || t("prompts.analytics.unknownUser")}
                      </p>
                    </TableCell>
                    <TableCell className="text-center font-semibold">{r.count}</TableCell>
                    <TableCell className="text-center">{r.uniquePrompts}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("prompts.analytics.userCol")}</TableHead>
                  <TableHead>{t("prompts.analytics.promptCol")}</TableHead>
                  <TableHead className="w-48">{t("prompts.analytics.date")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRecent.map((c) => {
                  const p = prompts[c.prompt_id];
                  const u = profiles[c.user_id];
                  const lang = p?.language || "ar";
                  const dir = lang === "ar" ? "rtl" : "ltr";
                  return (
                    <TableRow key={c.id}>
                      <TableCell>
                        <span dir="auto" style={{ unicodeBidi: "plaintext" }}>
                          {u?.full_name || t("prompts.analytics.unknownUser")}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="max-w-md">
                          <p className="text-sm truncate" dir={dir} style={{ unicodeBidi: "plaintext" }}>
                            {p?.title || p?.content || "—"}
                          </p>
                          {p?.category && <Badge variant="secondary" className="mt-1">{p.category}</Badge>}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{fmtDate(c.copied_at)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default PromptCopyAnalytics;
