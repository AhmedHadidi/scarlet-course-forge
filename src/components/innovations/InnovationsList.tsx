import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Lightbulb, Plus, Pencil, Trash2, Clock, Coins } from "lucide-react";
import { InnovationDialog } from "./InnovationDialog";
import { CATEGORY_LABELS, CATEGORY_COLORS, STATUS_LABELS, STATUS_COLORS, Innovation } from "./innovationUtils";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

export const InnovationsList = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [items, setItems] = useState<Innovation[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Innovation | null>(null);
  const [deleting, setDeleting] = useState<Innovation | null>(null);

  const fetchItems = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("innovations")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (error) {
      toast({ title: "خطأ في التحميل", description: error.message, variant: "destructive" });
    } else {
      setItems((data || []) as Innovation[]);
    }
    setLoading(false);
  };

  useEffect(() => { fetchItems(); }, [user]);

  const handleDelete = async () => {
    if (!deleting) return;
    const { error } = await supabase.from("innovations").delete().eq("id", deleting.id);
    if (error) {
      toast({ title: "فشل الحذف", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "تم حذف المبادرة" });
      fetchItems();
    }
    setDeleting(null);
  };

  return (
    <Card className="border-border" dir="rtl">
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-primary" />
            ابتكاراتي ومبادراتي
          </CardTitle>
          <CardDescription>
            وثّق المبادرات التي قمت بتنفيذها داخل المؤسسة (توفير وقت، أتمتة، تحسين أداء، رفع جودة)
          </CardDescription>
        </div>
        <Button onClick={() => { setEditing(null); setDialogOpen(true); }} className="gradient-crimson shrink-0">
          <Plus className="h-4 w-4 ml-1" />
          إضافة مبادرة
        </Button>
      </CardHeader>

      <CardContent className="space-y-3">
        {loading ? (
          <p className="text-sm text-muted-foreground text-center py-6">جارٍ التحميل...</p>
        ) : items.length === 0 ? (
          <div className="text-center py-10 border border-dashed border-border rounded-lg">
            <Lightbulb className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground mb-3">لم تقم بإضافة أي مبادرة بعد</p>
            <Button variant="outline" onClick={() => { setEditing(null); setDialogOpen(true); }}>
              <Plus className="h-4 w-4 ml-1" /> أضف أول مبادرة
            </Button>
          </div>
        ) : (
          items.map((it) => (
            <div key={it.id} className="p-4 rounded-lg border border-border hover:bg-accent/30 transition-colors"
              style={{ unicodeBidi: "plaintext" }}>
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-base mb-1">{it.title}</h4>
                  <p className="text-sm text-muted-foreground line-clamp-2">{it.description}</p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button size="icon" variant="ghost" onClick={() => { setEditing(it); setDialogOpen(true); }}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => setDeleting(it)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 mb-3">
                <Badge variant="outline" className={CATEGORY_COLORS[it.category]}>
                  {CATEGORY_LABELS[it.category]}
                </Badge>
                <Badge className={STATUS_COLORS[it.status]}>
                  {STATUS_LABELS[it.status]}
                </Badge>
                {it.time_saved_hours ? (
                  <Badge variant="outline" className="gap-1">
                    <Clock className="h-3 w-3" /> {it.time_saved_hours} ساعة/أسبوع
                  </Badge>
                ) : null}
                {it.cost_saved ? (
                  <Badge variant="outline" className="gap-1">
                    <Coins className="h-3 w-3" /> {it.cost_saved}
                  </Badge>
                ) : null}
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>نسبة الإنجاز</span>
                  <span>{it.progress_percentage}%</span>
                </div>
                <Progress value={it.progress_percentage} className="h-2" />
              </div>

              {it.admin_notes && (
                <div className="mt-3 p-2 rounded bg-muted/50 text-sm">
                  <span className="font-medium">ملاحظة الإدارة: </span>
                  {it.admin_notes}
                </div>
              )}
            </div>
          ))
        )}
      </CardContent>

      <InnovationDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initial={editing}
        onSaved={fetchItems}
      />

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>حذف المبادرة؟</AlertDialogTitle>
            <AlertDialogDescription>سيتم حذف "{deleting?.title}" نهائياً.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive">حذف</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};
