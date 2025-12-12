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
import { Plus, Pencil, Trash2, Loader2, Newspaper, ImagePlus } from "lucide-react";

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
  bulletin_id: string | null;
  is_published: boolean;
  created_at: string;
  categories: Category[];
}

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
    bulletin_id: "",
    is_published: false,
    category_ids: [] as string[],
  });

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

      // Fetch article categories
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

          return { ...article, categories: articleCategories };
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

      setFormData({ ...formData, image_url: publicUrl });
      toast.success("Image uploaded successfully");
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
      const articleData = {
        title: formData.title,
        short_description: formData.short_description,
        full_content: formData.full_content,
        image_url: formData.image_url || null,
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

      // Update categories
      if (articleId) {
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

      toast.success(editingArticle ? "Article updated successfully" : "Article created successfully");
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
      full_content: article.full_content,
      image_url: article.image_url || "",
      bulletin_id: article.bulletin_id || "",
      is_published: article.is_published,
      category_ids: article.categories.map((c) => c.id),
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this article?")) return;

    try {
      const { error } = await supabase.from("news_articles").delete().eq("id", id);
      if (error) throw error;
      toast.success("Article deleted successfully");
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
      bulletin_id: "",
      is_published: false,
      category_ids: [],
    });
  };

  const openCreateDialog = () => {
    resetForm();
    setDialogOpen(true);
  };

  const toggleCategory = (categoryId: string) => {
    setFormData((prev) => ({
      ...prev,
      category_ids: prev.category_ids.includes(categoryId)
        ? prev.category_ids.filter((id) => id !== categoryId)
        : [...prev.category_ids, categoryId],
    }));
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
          if (open) resetForm();
          setDialogOpen(open);
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Article
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingArticle ? "Edit Article" : "Create Article"}</DialogTitle>
              <DialogDescription>
                {editingArticle ? "Update the article details" : "Add a new news article"}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Article title"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="short_description">Short Description</Label>
                <Textarea
                  id="short_description"
                  value={formData.short_description}
                  onChange={(e) => setFormData({ ...formData, short_description: e.target.value })}
                  placeholder="Brief summary of the article"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="full_content">Full Content</Label>
                <Textarea
                  id="full_content"
                  value={formData.full_content}
                  onChange={(e) => setFormData({ ...formData, full_content: e.target.value })}
                  placeholder="Full article content"
                  className="min-h-[150px]"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Image</Label>
                <div className="flex items-center gap-4">
                  {formData.image_url && (
                    <img
                      src={formData.image_url}
                      alt="Preview"
                      className="h-20 w-20 object-cover rounded"
                    />
                  )}
                  <Label htmlFor="image-upload" className="cursor-pointer">
                    <div className="flex items-center gap-2 px-4 py-2 border rounded-md hover:bg-muted">
                      {uploading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <ImagePlus className="h-4 w-4" />
                      )}
                      <span>{formData.image_url ? "Change Image" : "Upload Image"}</span>
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

              <div className="space-y-2">
                <Label>Categories</Label>
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
                  {categories.length === 0 && (
                    <p className="text-sm text-muted-foreground col-span-2">
                      No categories available. Create some first.
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Bulletin (نشرة الذكاء الاصطناعي)</Label>
                <Select
                  value={formData.bulletin_id}
                  onValueChange={(value) => setFormData({ ...formData, bulletin_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select bulletin (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {bulletins.map((bulletin) => (
                      <SelectItem key={bulletin.id} value={bulletin.id}>
                        {bulletin.bulletin_number} - {bulletin.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  id="is_published"
                  checked={formData.is_published}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_published: checked })}
                />
                <Label htmlFor="is_published">Publish article</Label>
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editingArticle ? "Update" : "Create"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {articles.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          No articles yet. Create one to get started.
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Categories</TableHead>
              <TableHead>Bulletin</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {articles.map((article) => (
              <TableRow key={article.id}>
                <TableCell className="font-medium">{article.title}</TableCell>
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
                <TableCell className="text-muted-foreground">
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
