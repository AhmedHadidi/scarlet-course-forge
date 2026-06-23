import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, Trash2, Plus, FileText, Loader2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

interface Prompt {
  id: string;
  title: string | null;
  content: string;
  category: string | null;
  language: string | null;
  source_file: string | null;
  created_at: string;
}

type PromptLang = "ar" | "en";

export const PromptManagement = () => {
  const { t } = useTranslation();
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [replaceExisting, setReplaceExisting] = useState(false);
  const [uploadLanguage, setUploadLanguage] = useState<PromptLang>("ar");
  const [viewLanguage, setViewLanguage] = useState<PromptLang>("ar");
  const [editing, setEditing] = useState<Prompt | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [form, setForm] = useState<{ title: string; content: string; category: string; language: PromptLang }>({
    title: "",
    content: "",
    category: "",
    language: "ar",
  });

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("prompts")
      .select("*")
      .order("order_index", { ascending: true });
    if (error) toast.error(error.message);
    setPrompts((data as Prompt[]) || []);
    setLoading(false);
  };

  const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(",")[1] || "");
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.type !== "application/pdf") {
      toast.error(t("prompts.admin.pdfOnly"));
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      toast.error(t("prompts.admin.tooLarge"));
      return;
    }

    setUploading(true);
    try {
      const base64 = await fileToBase64(file);

      // Optionally archive PDF in storage (best effort, ignore errors)
      const path = `${Date.now()}_${file.name}`;
      await supabase.storage.from("prompt-pdfs").upload(path, file, { contentType: "application/pdf" });

      const { data: { session } } = await supabase.auth.getSession();
      const { data, error } = await supabase.functions.invoke("extract-prompts", {
        body: { fileBase64: base64, fileName: file.name, replaceExisting, language: uploadLanguage },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (error) throw error;
      toast.success(t("prompts.admin.extractedToast", { count: (data as any)?.inserted ?? 0 }));
      await load();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || t("prompts.admin.extractFailed"));
    } finally {
      setUploading(false);
    }
  };

  const openCreate = () => {
    setEditing(null);
    setForm({ title: "", content: "", category: "", language: viewLanguage });
    setIsDialogOpen(true);
  };
  const openEdit = (p: Prompt) => {
    setEditing(p);
    setForm({
      title: p.title || "",
      content: p.content,
      category: p.category || "",
      language: (p.language as PromptLang) || "ar",
    });
    setIsDialogOpen(true);
  };

  const save = async () => {
    if (!form.content.trim()) {
      toast.error(t("prompts.admin.contentRequired"));
      return;
    }
    const payload = {
      title: form.title.trim() || null,
      content: form.content.trim(),
      category: form.category.trim() || null,
      language: form.language,
    };
    if (editing) {
      const { error } = await supabase.from("prompts").update(payload).eq("id", editing.id);
      if (error) return toast.error(error.message);
    } else {
      const nextIdx = prompts.length;
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("prompts").insert({
        ...payload,
        order_index: nextIdx,
        created_by: user?.id,
      });
      if (error) return toast.error(error.message);
    }
    setIsDialogOpen(false);
    await load();
    toast.success(t("common.success"));
  };

  const remove = async (id: string) => {
    if (!confirm(t("prompts.admin.confirmDelete"))) return;
    const { error } = await supabase.from("prompts").delete().eq("id", id);
    if (error) return toast.error(error.message);
    await load();
  };

  const deleteAll = async () => {
    if (!confirm(t("prompts.admin.confirmDeleteAll"))) return;
    const { error } = await supabase
      .from("prompts")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000");
    if (error) return toast.error(error.message);
    await load();
  };

  return (
    <div className="space-y-6">
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            {t("prompts.admin.uploadTitle")}
          </CardTitle>
          <CardDescription>{t("prompts.admin.uploadDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <Switch id="replace" checked={replaceExisting} onCheckedChange={setReplaceExisting} />
            <Label htmlFor="replace" className="cursor-pointer">{t("prompts.admin.replaceExisting")}</Label>
          </div>
          <div className="flex flex-wrap gap-3">
            <label>
              <input type="file" accept="application/pdf" onChange={handleUpload} className="hidden" disabled={uploading} />
              <Button asChild disabled={uploading}>
                <span className="cursor-pointer">
                  {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                  {uploading ? t("prompts.admin.processing") : t("prompts.admin.uploadPdf")}
                </span>
              </Button>
            </label>
            <Button variant="outline" onClick={openCreate}>
              <Plus className="h-4 w-4 mr-2" />
              {t("prompts.admin.addManual")}
            </Button>
            {prompts.length > 0 && (
              <Button variant="destructive" onClick={deleteAll}>
                <Trash2 className="h-4 w-4 mr-2" />
                {t("prompts.admin.deleteAll")}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {t("prompts.admin.listTitle")} ({prompts.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <p className="text-muted-foreground">{t("common.loading")}</p>
          ) : prompts.length === 0 ? (
            <p className="text-muted-foreground">{t("prompts.admin.empty")}</p>
          ) : (
            prompts.map((p) => (
              <div key={p.id} className="border border-border/50 rounded-lg p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex-1 min-w-0">
                    {p.title && <h4 className="font-semibold" dir="rtl" style={{ unicodeBidi: "plaintext" }}>{p.title}</h4>}
                    {p.category && <Badge variant="secondary" className="mt-1">{p.category}</Badge>}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button size="icon" variant="ghost" onClick={() => openEdit(p)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => remove(p.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
                <p className="text-sm whitespace-pre-wrap text-muted-foreground line-clamp-4" dir="rtl" style={{ unicodeBidi: "plaintext" }}>
                  {p.content}
                </p>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? t("prompts.admin.editPrompt") : t("prompts.admin.addPrompt")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{t("prompts.admin.fieldTitle")}</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} dir="auto" />
            </div>
            <div>
              <Label>{t("prompts.admin.fieldCategory")}</Label>
              <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} dir="auto" />
            </div>
            <div>
              <Label>{t("prompts.admin.fieldContent")} *</Label>
              <Textarea
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
                rows={8}
                dir="rtl"
                style={{ unicodeBidi: "plaintext" }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>{t("common.cancel")}</Button>
            <Button onClick={save}>{t("common.save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PromptManagement;
