import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Loader2, Newspaper, ImagePlus, Globe, Building2, Users } from "lucide-react";

interface Category {
  id: string;
  name: string;
}

interface Bulletin {
  id: string;
  bulletin_number: string;
  title: string;
}

interface Article {
  id: string;
  title: string;
  short_description: string;
  full_content: string;
  image_url: string | null;
  image_caption: string | null;
  article_type: string;
  pdf_position: string | null;
  bulletin_id: string | null;
  is_published: boolean;
  created_at: string;
  categories: Category[];
}

// ─── خيارات صفحات PDF ─────────────────────────────────────────
const PDF_PAGES = [
  {
    value: "global_news",
    label: "🌍 صفحة الأخبار العالمية",
    icon: Globe,
    description: "أخبار AI العالمية والتقنية",
    fields: ["title", "short_description", "full_content", "image", "categories"],
  },
  {
    value: "ministry_news",
    label: "🏛️ صفحة أخبار الوزارة",
    icon: Building2,
    description: "أخبار ومستجدات الوزارة في مجال الذكاء الاصطناعي",
    fields: ["title", "short_description", "full_content", "image", "categories"],
  },
  {
    value: "employee_work",
    label: "👥 صفحة نماذج من أعمال الموظفين",
    icon: Users,
    description: "صور وأعمال موظفي الوزارة بالذكاء الاصطناعي",
    fields: ["title", "employee_name", "image"],
  },
];

export const NewsArticleManagement = () => {
  const [articles, setArticles] = useState<Article[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [bulletins, setBulletins] = useState<Bulletin[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingArticle, setEditingArticle] = useState<Article | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [formData, setFormData] = useState({
    title: "",
    short_description: "",
    full_content: "",
    image_url: "",
    image_caption: "",   // اسم الموظف أو تعليق الصورة
    article_type: "standard",
    pdf_position: "",    // global_news | ministry_news | employee_work
    bulletin_id: "",
    is_published: false,
    category_ids: [] as string[],
  });

  // ─── الصفحة المختارة حالياً ──
  const selectedPage = PDF_PAGES.find((p) => p.value === formData.pdf_position) || null;
  const isEmployeePage = formData.pdf_position === "employee_work";

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [articlesRes, categoriesRes, bulletinsRes] = await Promise.all([
        supabase.from("news_articles").select("*").order("created_at", { ascending: false }),
        supabase.from("news_categories").select("*").order("name"),
        supabase.from("news_bulletins").select("id, bulletin_number, title").order("week_start_date", { ascending: false }),
      ]);

      if (articlesRes.error) throw articlesRes.error;
      if (categoriesRes.error) throw categoriesRes.error;
      if (bulletinsRes.error) throw bulletinsRes.error;

      const articlesWithCategories = await Promise.all(
        (articlesRes.data || []).map(async (article) => {
          const { data: categoryLinks } = await supabase
            .from("news_article_categories")
            .select("category_id")
            .eq("article_id", article.id);

          const articleCategories = (categoryLinks || []).map((link) => {
            const cat = categoriesRes.data?.find((c) => c.id === link.category_id);
            return cat ? { id: cat.id, name: cat.name } : null;
          }).filter(Boolean) as Category[];

          return {
            ...article,
            article_type: (article as any).article_type || "standard",
            pdf_position: (article as any).pdf_position || null,
            image_caption: (article as any).image_caption || null,
            categories: articleCategories,
          };
        })
      );

      setArticles(articlesWithCategories);
      setCategories(categoriesRes.data || []);
      setBulletins(bulletinsRes.data || []);
    } catch (error: any) {
      toast.error("Error fetching data: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `articles/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("news-images")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("news-images")
        .getPublicUrl(filePath);

      setFormData((prev) => ({ ...prev, image_url: publicUrl }));
      toast.success("تم رفع الصورة بنجاح");
    } catch (error: any) {
      toast.error("Error uploading image: " + error.message);
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const articleData: any = {
        title: formData.title,
        short_description: isEmployeePage ? (formData.image_caption || formData.title) : formData.short_description,
        full_content: isEmployeePage ? "" : formData.full_content,
        image_url: formData.image_url || null,
        image_caption: formData.image_caption || null,
        article_type: isEmployeePage ? "image_caption" : "standard",
        pdf_position: formData.pdf_position || null,
        bulletin_id: formData.bulletin_id || null,
        is_published: formData.is_published,
      };

      let articleId = editingArticle?.id;

      if (editingArticle) {
        const { error } = await supabase
          .from("news_articles")
          .update(articleData)
          .eq("id", editingArticle.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("news_articles")
          .insert(articleData)
          .select()
          .single();
        if (error) throw error;
        articleId = data.id;
      }

      if (articleId && !isEmployeePage) {
        await supabase.from("news_article_categories").delete().eq("article_id", articleId);
        if (formData.category_ids.length > 0) {
          const categoryLinks = formData.category_ids.map((categoryId) => ({
            article_id: articleId,
            category_id: categoryId,
          }));
          const { error: linkError } = await supabase
            .from("news_article_categories")
            .insert(categoryLinks);
          if (linkError) throw linkError;
        }
      }

      toast.success(editingArticle ? "تم تحديث الخبر بنجاح" : "تم إضافة الخبر بنجاح");
      setDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error: any) {
      toast.error("Error saving article: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (article: Article) => {
    setEditingArticle(article);
    setFormData({
      title: article.title,
      short_description: article.short_description,
      full_content: article.full_content || "",
      image_url: article.image_url || "",
      image_caption: article.image_caption || "",
      article_type: article.article_type || "standard",
      pdf_position: article.pdf_position || "",
      bulletin_id: article.bulletin_id || "",
      is_published: article.is_published,
      category_ids: article.categories.map((c) => c.id),
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("هل أنت متأكد من حذف هذا الخبر؟")) return;
    try {
      const { error } = await supabase.from("news_articles").delete().eq("id", id);
      if (error) throw error;
      toast.success("تم حذف الخبر");
      fetchData();
    } catch (error: any) {
      toast.error("Error deleting article: " + error.message);
    }
  };

  const resetForm = () => {
    setEditingArticle(null);
    setFormData({
      title: "",
      short_description: "",
      full_content: "",
      image_url: "",
      image_caption: "",
      article_type: "standard",
      pdf_position: "",
      bulletin_id: "",
      is_published: false,
      category_ids: [],
    });
  };

  const toggleCategory = (categoryId: string) => {
    setFormData((prev) => ({
      ...prev,
      category_ids: prev.category_ids.includes(categoryId)
        ? prev.category_ids.filter((id) => id !== categoryId)
        : [...prev.category_ids, categoryId],
    }));
  };

  const getPageLabel = (value: string | null) => {
    if (!value) return "-";
    return PDF_PAGES.find((p) => p.value === value)?.label || value;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Newspaper className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">News Articles</h3>
        </div>

        <Dialog open={dialogOpen} onOpenChange={(open) => {
          if (!open) resetForm();
          setDialogOpen(open);
        }}>
          <DialogTrigger asChild>
            <Button type="button" onClick={resetForm}>
              <Plus className="mr-2 h-4 w-4" />
              Add Article
            </Button>
          </DialogTrigger>

          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingArticle ? "تعديل الخبر" : "إضافة خبر جديد"}</DialogTitle>
              <DialogDescription>
                {editingArticle ? "تعديل بيانات الخبر" : "أضف خبراً جديداً إلى النشرة"}
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-5">

              {/* ─── 1. اختيار الصفحة (الأعلى) ─── */}
              <div className="space-y-2">
                <Label className="text-base font-semibold">📄 صفحة الخبر في ملف PDF *</Label>
                <div className="grid grid-cols-1 gap-2">
                  {PDF_PAGES.map((page) => {
                    const Icon = page.icon;
                    const isSelected = formData.pdf_position === page.value;
                    return (
                      <button
                        key={page.value}
                        type="button"
                        onClick={() => setFormData({ ...formData, pdf_position: page.value })}
                        className={`flex items-center gap-3 px-4 py-3 rounded-lg border-2 text-right transition-all duration-150 ${
                          isSelected
                            ? "border-primary bg-primary/10 text-primary shadow-sm"
                            : "border-border hover:border-primary/40 hover:bg-muted/40"
                        }`}
                      >
                        <Icon className={`h-5 w-5 shrink-0 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
                        <div className="flex-1 min-w-0 text-left" dir="rtl">
                          <div className="font-semibold text-sm">{page.label}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">{page.description}</div>
                        </div>
                        {isSelected && (
                          <div className="shrink-0 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 00-1.414 0L8 12.586 4.707 9.293a1 1 0 00-1.414 1.414l4 4a1 1 0 001.414 0l8-8a1 1 0 000-1.414z" clipRule="evenodd" />
                            </svg>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
                {!formData.pdf_position && (
                  <p className="text-xs text-amber-600">⚠️ يرجى تحديد صفحة الخبر أولاً</p>
                )}
              </div>

              {/* ─── يظهر باقي النموذج فقط بعد اختيار الصفحة ─── */}
              {formData.pdf_position && (
                <>
                  {/* ─── 2. العنوان ─── */}
                  <div className="space-y-2">
                    <Label htmlFor="title">
                      {isEmployeePage ? "عنوان العمل / اسم التصميم *" : "عنوان الخبر *"}
                    </Label>
                    <Input
                      id="title"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      placeholder={isEmployeePage ? "مثال: تصميم بالذكاء الاصطناعي" : "عنوان الخبر"}
                      dir="rtl"
                      required
                    />
                  </div>

                  {/* ─── اسم الموظف (فقط لصفحة الموظفين) ─── */}
                  {isEmployeePage && (
                    <div className="space-y-2">
                      <Label htmlFor="employee_name">اسم الموظف *</Label>
                      <Input
                        id="employee_name"
                        value={formData.image_caption}
                        onChange={(e) => setFormData({ ...formData, image_caption: e.target.value })}
                        placeholder="مثال: أماني الربيعية"
                        dir="rtl"
                        required={isEmployeePage}
                      />
                    </div>
                  )}

                  {/* ─── الوصف المختصر (للأخبار العادية) ─── */}
                  {!isEmployeePage && (
                    <div className="space-y-2">
                      <Label htmlFor="short_description">وصف مختصر *</Label>
                      <Textarea
                        id="short_description"
                        value={formData.short_description}
                        onChange={(e) => setFormData({ ...formData, short_description: e.target.value })}
                        placeholder="ملخص سريع للخبر (يظهر في بطاقة الخبر)"
                        dir="rtl"
                        required={!isEmployeePage}
                      />
                    </div>
                  )}

                  {/* ─── المحتوى الكامل (للأخبار العادية) ─── */}
                  {!isEmployeePage && (
                    <div className="space-y-2">
                      <Label htmlFor="full_content">المحتوى الكامل *</Label>
                      <Textarea
                        id="full_content"
                        value={formData.full_content}
                        onChange={(e) => setFormData({ ...formData, full_content: e.target.value })}
                        placeholder="النص الكامل للخبر"
                        className="min-h-[120px]"
                        dir="rtl"
                        required={!isEmployeePage}
                      />
                    </div>
                  )}

                  {/* ─── الصورة ─── */}
                  <div className="space-y-2">
                    <Label>
                      الصورة {isEmployeePage ? "* (مطلوب)" : "(اختياري)"}
                    </Label>
                    <div className="flex items-center gap-4">
                      {formData.image_url && (
                        <img
                          src={formData.image_url}
                          alt="Preview"
                          className="h-20 w-20 object-cover rounded-lg border"
                        />
                      )}
                      <Label htmlFor="image-upload" className="cursor-pointer">
                        <div className="flex items-center gap-2 px-4 py-2 border rounded-md hover:bg-muted transition-colors">
                          {uploading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <ImagePlus className="h-4 w-4" />
                          )}
                          <span>{formData.image_url ? "تغيير الصورة" : "رفع صورة"}</span>
                        </div>
                        <Input
                          id="image-upload"
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleImageUpload}
                          disabled={uploading}
                        />
                      </Label>
                    </div>
                  </div>

                  {/* ─── التصنيفات (للأخبار العادية فقط) ─── */}
                  {!isEmployeePage && categories.length > 0 && (
                    <div className="space-y-2">
                      <Label>التصنيفات</Label>
                      <div className="grid grid-cols-2 gap-2 p-4 border rounded-md">
                        {categories.map((category) => (
                          <div key={category.id} className="flex items-center gap-2">
                            <Checkbox
                              id={`cat-${category.id}`}
                              checked={formData.category_ids.includes(category.id)}
                              onCheckedChange={() => toggleCategory(category.id)}
                            />
                            <Label htmlFor={`cat-${category.id}`} className="cursor-pointer font-normal">
                              {category.name}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ─── النشرة ─── */}
                  <div className="space-y-2">
                    <Label>النشرة (نشرة الذكاء الاصطناعي)</Label>
                    <Select
                      value={formData.bulletin_id || "none"}
                      onValueChange={(value) =>
                        setFormData({ ...formData, bulletin_id: value === "none" ? "" : value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="اختر النشرة (اختياري)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">— بدون نشرة —</SelectItem>
                        {bulletins.map((bulletin) => (
                          <SelectItem key={bulletin.id} value={bulletin.id}>
                            {bulletin.bulletin_number} - {bulletin.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* ─── النشر ─── */}
                  <div className="flex items-center gap-2 pt-1">
                    <Switch
                      id="is_published"
                      checked={formData.is_published}
                      onCheckedChange={(checked) => setFormData({ ...formData, is_published: checked })}
                    />
                    <Label htmlFor="is_published">نشر الخبر فوراً</Label>
                  </div>
                </>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  إلغاء
                </Button>
                <Button type="submit" disabled={saving || !formData.pdf_position}>
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editingArticle ? "تحديث" : "إضافة"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* ─── جدول الأخبار ─── */}
      {articles.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          No articles yet. Create one to get started.
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>العنوان</TableHead>
              <TableHead>الصفحة</TableHead>
              <TableHead>التصنيفات</TableHead>
              <TableHead>النشرة</TableHead>
              <TableHead>الحالة</TableHead>
              <TableHead className="w-[100px]">إجراءات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {articles.map((article) => (
              <TableRow key={article.id}>
                <TableCell className="font-medium">{article.title}</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {getPageLabel(article.pdf_position)}
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {article.categories.map((cat) => (
                      <Badge key={cat.id} variant="secondary" className="text-xs">
                        {cat.name}
                      </Badge>
                    ))}
                    {article.categories.length === 0 && (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground text-xs">
                  {bulletins.find((b) => b.id === article.bulletin_id)?.bulletin_number || "-"}
                </TableCell>
                <TableCell>
                  <Badge variant={article.is_published ? "default" : "outline"}>
                    {article.is_published ? "Published" : "Draft"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(article)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(article.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
};
