import { useEffect, useState } from "react";
import { z } from "zod";
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
import { CATEGORY_LABELS, STATUS_LABELS, Innovation, InnovationCategory, InnovationStatus } from "./innovationUtils";

const schema = z.object({
  title: z.string().trim().min(3, "العنوان قصير جداً").max(200, "العنوان طويل جداً"),
  description: z.string().trim().min(20, "الوصف يجب أن يكون 20 حرف على الأقل").max(5000),
  category: z.enum(["time_saving", "performance", "automation", "quality"]),
  status: z.enum(["idea", "in_progress", "implemented", "evaluated"]),
  progress_percentage: z.number().int().min(0).max(100),
  impact_description: z.string().trim().max(2000).optional().or(z.literal("")),
  time_saved_hours: z.string().optional(),
  cost_saved: z.string().optional(),
  tools_used: z.string().optional(),
  start_date: z.string().optional(),
  completion_date: z.string().optional(),
});

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: Innovation | null;
  onSaved: () => void;
}

export const InnovationDialog = ({ open, onOpenChange, initial, onSaved }: Props) => {
  const { user } = useAuth();
  const { toast } = useToast();
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
    start_date: "",
    completion_date: "",
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
        start_date: initial.start_date || "",
        completion_date: initial.completion_date || "",
      });
    } else {
      setForm({
        title: "", description: "", category: "time_saving", status: "idea",
        progress_percentage: 0, impact_description: "", time_saved_hours: "",
        cost_saved: "", tools_used: "", start_date: "", completion_date: "",
      });
    }
  }, [initial, open]);

  const handleSave = async () => {
    if (!user) return;
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      toast({ title: "بيانات غير صحيحة", description: parsed.error.errors[0].message, variant: "destructive" });
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
      start_date: form.start_date || null,
      completion_date: form.completion_date || null,
    };

    const { error } = initial
      ? await supabase.from("innovations").update(payload).eq("id", initial.id)
      : await supabase.from("innovations").insert(payload);

    setSaving(false);
    if (error) {
      toast({ title: "فشل الحفظ", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: initial ? "تم تحديث المبادرة" : "تمت إضافة المبادرة" });
    onOpenChange(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle>{initial ? "تعديل المبادرة" : "إضافة مبادرة جديدة"}</DialogTitle>
          <DialogDescription>وثّق مبادرة قمت بتنفيذها داخل المؤسسة</DialogDescription>
        </DialogHeader>

        <div className="space-y-4" style={{ unicodeBidi: "plaintext" }}>
          <div className="space-y-2">
            <Label>عنوان المبادرة *</Label>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} dir="rtl" />
          </div>

          <div className="space-y-2">
            <Label>الوصف التفصيلي (المشكلة والحل) *</Label>
            <Textarea rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} dir="rtl" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>الفئة *</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v as InnovationCategory })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>الحالة *</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as InnovationStatus })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUS_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>نسبة الإنجاز: {form.progress_percentage}%</Label>
            <Slider value={[form.progress_percentage]} min={0} max={100} step={5}
              onValueChange={(v) => setForm({ ...form, progress_percentage: v[0] })} />
          </div>

          <div className="space-y-2">
            <Label>الأثر المحقق</Label>
            <Textarea rows={2} value={form.impact_description} onChange={(e) => setForm({ ...form, impact_description: e.target.value })} dir="rtl"
              placeholder="مثال: تقليل وقت معالجة الطلبات من 3 أيام إلى ساعة واحدة" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>الوقت الموفر (ساعات / أسبوع)</Label>
              <Input type="number" min="0" step="0.5" value={form.time_saved_hours}
                onChange={(e) => setForm({ ...form, time_saved_hours: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>التكلفة الموفرة</Label>
              <Input type="number" min="0" value={form.cost_saved}
                onChange={(e) => setForm({ ...form, cost_saved: e.target.value })} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>الأدوات / التقنيات المستخدمة (مفصولة بفاصلة)</Label>
            <Input value={form.tools_used} onChange={(e) => setForm({ ...form, tools_used: e.target.value })}
              placeholder="Excel, Power Automate, ChatGPT" dir="rtl" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>تاريخ البدء</Label>
              <Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>تاريخ الإنجاز</Label>
              <Input type="date" value={form.completion_date} onChange={(e) => setForm({ ...form, completion_date: e.target.value })} />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
          <Button onClick={handleSave} disabled={saving} className="gradient-crimson">
            {saving ? "جارٍ الحفظ..." : "حفظ"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
