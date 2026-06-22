import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Lightbulb, TrendingUp, CheckCircle2, Clock, Search } from "lucide-react";
import { CATEGORY_KEYS, STATUS_KEYS, CATEGORY_COLORS, STATUS_COLORS, Innovation } from "./innovationUtils";

interface Props {
  scope: "department" | "all";
  departmentId?: string;
}

interface Row extends Innovation {
  userName?: string;
  departmentName?: string;
}

export const InnovationsTracker = ({ scope, departmentId }: Props) => {
  const { toast } = useToast();
  const { t, i18n } = useTranslation();
  const dir = i18n.language === "ar" ? "rtl" : "ltr";
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterDepartment, setFilterDepartment] = useState<string>("all");
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);
  const [selected, setSelected] = useState<Row | null>(null);
  const [notesDraft, setNotesDraft] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    let q = supabase.from("innovations").select("*").order("created_at", { ascending: false });
    if (scope === "department" && departmentId) q = q.eq("department_id", departmentId);
    const { data: innovations, error } = await q;
    if (error) {
      toast({ title: t("innovations.loadError"), description: error.message, variant: "destructive" });
      setLoading(false);
      return;
    }
    const userIds = Array.from(new Set((innovations || []).map(i => i.user_id)));
    const deptIds = Array.from(new Set((innovations || []).map(i => i.department_id).filter(Boolean) as string[]));

    const [{ data: profiles }, { data: depts }] = await Promise.all([
      userIds.length ? supabase.from("profiles").select("id, full_name").in("id", userIds) : Promise.resolve({ data: [] as any }),
      deptIds.length ? supabase.from("departments").select("id, name").in("id", deptIds) : Promise.resolve({ data: [] as any }),
    ]);

    const userMap = new Map((profiles || []).map((p: any) => [p.id, p.full_name]));
    const deptMap = new Map((depts || []).map((d: any) => [d.id, d.name]));

    setRows((innovations || []).map((i: any) => ({
      ...i,
      userName: userMap.get(i.user_id) || "—",
      departmentName: i.department_id ? deptMap.get(i.department_id) || "—" : "—",
    })));
    setLoading(false);
  };

  const fetchDepartments = async () => {
    if (scope !== "all") return;
    const { data } = await supabase.from("departments").select("id, name").order("name");
    setDepartments(data || []);
  };

  useEffect(() => { fetchData(); fetchDepartments(); }, [scope, departmentId]);

  const filtered = useMemo(() => rows.filter(r => {
    if (filterCategory !== "all" && r.category !== filterCategory) return false;
    if (filterStatus !== "all" && r.status !== filterStatus) return false;
    if (filterDepartment !== "all" && r.department_id !== filterDepartment) return false;
    if (search && !r.title.toLowerCase().includes(search.toLowerCase()) &&
        !(r.userName || "").toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [rows, filterCategory, filterStatus, filterDepartment, search]);

  const stats = useMemo(() => {
    const total = filtered.length;
    const implemented = filtered.filter(r => r.status === "implemented" || r.status === "evaluated").length;
    const totalHours = filtered.reduce((s, r) => s + (Number(r.time_saved_hours) || 0), 0);
    const avgProgress = total ? Math.round(filtered.reduce((s, r) => s + r.progress_percentage, 0) / total) : 0;
    return { total, implemented, totalHours, avgProgress };
  }, [filtered]);

  const handleSaveNotes = async () => {
    if (!selected) return;
    setSavingNotes(true);
    const { error } = await supabase.from("innovations").update({ admin_notes: notesDraft }).eq("id", selected.id);
    setSavingNotes(false);
    if (error) {
      toast({ title: t("innovations.saveFailed"), description: error.message, variant: "destructive" });
    } else {
      toast({ title: t("innovations.tracker.notesSaved") });
      setSelected(null);
      fetchData();
    }
  };

  const kpis = [
    { label: t("innovations.tracker.kpiTotal"), value: stats.total, icon: Lightbulb },
    { label: t("innovations.tracker.kpiImplemented"), value: stats.implemented, icon: CheckCircle2 },
    { label: t("innovations.tracker.kpiHours"), value: stats.totalHours, icon: Clock },
    { label: t("innovations.tracker.kpiAvgProgress"), value: `${stats.avgProgress}%`, icon: TrendingUp },
  ];

  const searchIconSide = dir === "rtl" ? "right-3" : "left-3";
  const searchPad = dir === "rtl" ? "pr-9" : "pl-9";

  return (
    <div className="space-y-6" dir={dir}>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((k, i) => {
          const Icon = k.icon;
          return (
            <Card key={i} className="border-border/50">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-3">
                  <div className="h-10 w-10 rounded-lg gradient-crimson flex items-center justify-center">
                    <Icon className="h-5 w-5 text-white" />
                  </div>
                </div>
                <p className="text-2xl font-bold">{k.value}</p>
                <p className="text-xs text-muted-foreground">{k.label}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="border-border">
        <CardHeader>
          <CardTitle>
            {scope === "all" ? t("innovations.tracker.allTitle") : t("innovations.tracker.departmentTitle")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="relative">
              <Search className={`absolute ${searchIconSide} top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground`} />
              <Input className={searchPad} placeholder={t("innovations.tracker.searchPlaceholder")} value={search} onChange={(e) => setSearch(e.target.value)} dir={dir} />
            </div>
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger><SelectValue placeholder={t("innovations.tracker.filterCategory")} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("innovations.tracker.allCategories")}</SelectItem>
                {CATEGORY_KEYS.map((k) => <SelectItem key={k} value={k}>{t(`innovations.categories.${k}`)}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger><SelectValue placeholder={t("innovations.tracker.filterStatus")} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("innovations.tracker.allStatuses")}</SelectItem>
                {STATUS_KEYS.map((k) => <SelectItem key={k} value={k}>{t(`innovations.statuses.${k}`)}</SelectItem>)}
              </SelectContent>
            </Select>
            {scope === "all" && (
              <Select value={filterDepartment} onValueChange={setFilterDepartment}>
                <SelectTrigger><SelectValue placeholder={t("innovations.tracker.filterDepartment")} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("innovations.tracker.allDepartments")}</SelectItem>
                  {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          </div>

          {loading ? (
            <p className="text-center text-sm text-muted-foreground py-8">{t("innovations.tracker.loading")}</p>
          ) : filtered.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">{t("innovations.tracker.noResults")}</p>
          ) : (
            <div className="space-y-2">
              {filtered.map(r => (
                <button key={r.id} onClick={() => { setSelected(r); setNotesDraft(r.admin_notes || ""); }}
                  className={`w-full ${dir === "rtl" ? "text-right" : "text-left"} p-4 rounded-lg border border-border hover:bg-accent/40 transition-colors`}
                  style={{ unicodeBidi: "plaintext" }}>
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold mb-1">{r.title}</h4>
                      <p className="text-xs text-muted-foreground">
                        {r.userName} • {r.departmentName}
                      </p>
                    </div>
                    <div className="flex gap-1 flex-wrap justify-end">
                      <Badge variant="outline" className={CATEGORY_COLORS[r.category]}>{t(`innovations.categories.${r.category}`)}</Badge>
                      <Badge className={STATUS_COLORS[r.status]}>{t(`innovations.statuses.${r.status}`)}</Badge>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{t("innovations.tracker.progress")}</span>
                      <span>{r.progress_percentage}%</span>
                    </div>
                    <Progress value={r.progress_percentage} className="h-1.5" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir={dir}>
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle>{selected.title}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 text-sm" style={{ unicodeBidi: "plaintext" }}>
                <div className="flex gap-2 flex-wrap">
                  <Badge variant="outline" className={CATEGORY_COLORS[selected.category]}>{t(`innovations.categories.${selected.category}`)}</Badge>
                  <Badge className={STATUS_COLORS[selected.status]}>{t(`innovations.statuses.${selected.status}`)}</Badge>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs mb-1">{t("innovations.tracker.owner")}</p>
                  <p>{selected.userName} — {selected.departmentName}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs mb-1">{t("innovations.tracker.description")}</p>
                  <p className="whitespace-pre-wrap">{selected.description}</p>
                </div>
                {selected.impact_description && (
                  <div>
                    <p className="text-muted-foreground text-xs mb-1">{t("innovations.tracker.impact")}</p>
                    <p className="whitespace-pre-wrap">{selected.impact_description}</p>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div><p className="text-muted-foreground text-xs">{t("innovations.tracker.timeSaved")}</p><p>{selected.time_saved_hours || 0} {t("innovations.perWeek")}</p></div>
                  <div><p className="text-muted-foreground text-xs">{t("innovations.tracker.costSaved")}</p><p>{selected.cost_saved || 0}</p></div>
                  <div><p className="text-muted-foreground text-xs">{t("innovations.tracker.startDate")}</p><p>{selected.start_date || "—"}</p></div>
                  <div><p className="text-muted-foreground text-xs">{t("innovations.tracker.completionDate")}</p><p>{selected.completion_date || "—"}</p></div>
                </div>
                {selected.tools_used && selected.tools_used.length > 0 && (
                  <div>
                    <p className="text-muted-foreground text-xs mb-1">{t("innovations.tracker.toolsUsed")}</p>
                    <div className="flex gap-1 flex-wrap">
                      {selected.tools_used.map((tool, i) => <Badge key={i} variant="secondary">{tool}</Badge>)}
                    </div>
                  </div>
                )}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs"><span>{t("innovations.tracker.progress")}</span><span>{selected.progress_percentage}%</span></div>
                  <Progress value={selected.progress_percentage} />
                </div>
                <div className="space-y-2 pt-2 border-t border-border">
                  <p className="font-medium">{t("innovations.tracker.adminNotes")}</p>
                  <Textarea rows={3} value={notesDraft} onChange={(e) => setNotesDraft(e.target.value)} dir={dir}
                    placeholder={t("innovations.tracker.adminNotesPlaceholder")} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setSelected(null)}>{t("innovations.tracker.close")}</Button>
                <Button onClick={handleSaveNotes} disabled={savingNotes} className="gradient-crimson">
                  {savingNotes ? t("innovations.tracker.savingNotes") : t("innovations.tracker.saveNotes")}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
