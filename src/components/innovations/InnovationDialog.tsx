import { useEffect, useState } from "react";
import { z } from "zod";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { CATEGORY_KEYS, STATUS_KEYS, Innovation, InnovationCategory, InnovationStatus } from "./innovationUtils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: Innovation | null;
  onSaved: () => void;
}

export const InnovationDialog = ({ open, onOpenChange, initial, onSaved }: Props) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === "ar";
  const dir = isRtl ? "rtl" : "ltr";
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "time_saving" as InnovationCategory,
    status: "idea" as InnovationStatus,
    progress_percentage: 0,
    impact_description: "",
    time_saved_hours: "",
    cost_saved: "",
    tools_used: "",
    collaborators: "",
    start_date: "",
    completion_date: "",
  });

  const schema = z.object({
    title: z.string().trim().min(3, t("innovations.errors.titleShort")).max(200, t("innovations.errors.titleLong")),
    description: z.string().trim().min(20, t("innovations.errors.descShort")).max(5000),
    category: z.enum(["time_saving", "performance", "automation", "quality"]),
    status: z.enum(["idea", "in_progress", "implemented", "evaluated"]),
    progress_percentage: z.number().int().min(0).max(100),
    impact_description: z.string().trim().max(2000).optional().or(z.literal("")),
  });

  useEffect(() => {
    if (initial) {
      setForm({
        title: initial.title,
        description: initial.description,
        category: initial.category,
        status: initial.status,
        progress_percentage: initial.progress_percentage,
        impact_description: initial.impact_description || "",
        time_saved_hours: initial.time_saved_hours?.toString() || "",
        cost_saved: initial.cost_saved?.toString() || "",
        tools_used: (initial.tools_used || []).join(", "),
        collaborators: (initial.collaborators || []).join(", "),
        start_date: initial.start_date || "",
        completion_date: initial.completion_date || "",
      });
    } else {
      setForm({
        title: "", description: "", category: "time_saving", status: "idea",
        progress_percentage: 0, impact_description: "", time_saved_hours: "",
        cost_saved: "", tools_used: "", collaborators: "", start_date: "", completion_date: "",
      });
    }
  }, [initial, open]);

  const handleSave = async () => {
    if (!user) return;
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      toast({ title: t("innovations.invalidData"), description: parsed.error.errors[0].message, variant: "destructive" });
      return;
    }
    setSaving(true);
    const payload = {
      user_id: user.id,
      title: parsed.data.title,
      description: parsed.data.description,
      category: parsed.data.category,
      status: parsed.data.status,
      progress_percentage: parsed.data.progress_percentage,
      impact_description: parsed.data.impact_description || null,
      time_saved_hours: form.time_saved_hours ? Number(form.time_saved_hours) : null,
      cost_saved: form.cost_saved ? Number(form.cost_saved) : null,
      tools_used: form.tools_used ? form.tools_used.split(",").map(s => s.trim()).filter(Boolean) : [],
      collaborators: form.collaborators ? form.collaborators.split(",").map(s => s.trim()).filter(Boolean) : [],
      start_date: form.start_date || null,
      completion_date: form.completion_date || null,
    };

    const { error } = initial
      ? await supabase.from("innovations").update(payload).eq("id", initial.id)
      : await supabase.from("innovations").insert(payload);

    setSaving(false);
    if (error) {
      toast({ title: t("innovations.saveFailed"), description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: initial ? t("innovations.updated") : t("innovations.added") });
    onOpenChange(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir={dir}>
        <DialogHeader>
          <DialogTitle>{initial ? t("innovations.edit") : t("innovations.new")}</DialogTitle>
          <DialogDescription>{t("innovations.dialogDesc")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4" style={{ unicodeBidi: "plaintext" }}>
          <div className="space-y-2">
            <Label>{t("innovations.fields.title")} *</Label>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} dir={dir} />
          </div>

          <div className="space-y-2">
            <Label>{t("innovations.fields.description")} *</Label>
            <Textarea rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} dir={dir} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t("innovations.fields.category")} *</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v as InnovationCategory })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORY_KEYS.map((k) => (
                    <SelectItem key={k} value={k}>{t(`innovations.categories.${k}`)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{t("innovations.fields.status")} *</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as InnovationStatus })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_KEYS.map((k) => (
                    <SelectItem key={k} value={k}>{t(`innovations.statuses.${k}`)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t("innovations.fields.progress", { value: form.progress_percentage })}</Label>
            <Slider value={[form.progress_percentage]} min={0} max={100} step={5}
              onValueChange={(v) => setForm({ ...form, progress_percentage: v[0] })} />
          </div>

          <div className="space-y-2">
            <Label>{t("innovations.fields.impact")}</Label>
            <Textarea rows={2} value={form.impact_description} onChange={(e) => setForm({ ...form, impact_description: e.target.value })} dir={dir}
              placeholder={t("innovations.fields.impactPlaceholder")} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t("innovations.fields.timeSaved")}</Label>
              <Input type="number" min="0" step="0.5" value={form.time_saved_hours}
                onChange={(e) => setForm({ ...form, time_saved_hours: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>{t("innovations.fields.costSaved")}</Label>
              <Input type="number" min="0" value={form.cost_saved}
                onChange={(e) => setForm({ ...form, cost_saved: e.target.value })} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t("innovations.fields.tools")}</Label>
            <Input value={form.tools_used} onChange={(e) => setForm({ ...form, tools_used: e.target.value })}
              placeholder="Excel, Power Automate, ChatGPT" dir={dir} />
          </div>

          <div className="space-y-2">
            <Label>{t("innovations.fields.collaborators")}</Label>
            <Input value={form.collaborators} onChange={(e) => setForm({ ...form, collaborators: e.target.value })}
              placeholder={t("innovations.fields.collaboratorsPlaceholder")} dir={dir} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t("innovations.fields.startDate")}</Label>
              <Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>{t("innovations.fields.completionDate")}</Label>
              <Input type="date" value={form.completion_date} onChange={(e) => setForm({ ...form, completion_date: e.target.value })} />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t("innovations.cancel")}</Button>
          <Button onClick={handleSave} disabled={saving} className="gradient-crimson">
            {saving ? t("innovations.saving") : t("innovations.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
