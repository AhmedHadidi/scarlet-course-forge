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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Loader2, FileStack, Eye, Send } from "lucide-react";
import { format } from "date-fns";

interface Bulletin {
  id: string;
  bulletin_number: string;
  title: string;
  description: string | null;
  week_start_date: string;
  is_published: boolean;
  published_at: string | null;
  created_at: string;
  article_count?: number;
}

export const NewsBulletinManagement = () => {
  const [bulletins, setBulletins] = useState<Bulletin[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingBulletin, setEditingBulletin] = useState<Bulletin | null>(null);
  const [saving, setSaving] = useState(false);
  const [sendingEmails, setSendingEmails] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    bulletin_number: "",
    title: "",
    description: "",
    week_start_date: "",
    is_published: false,
  });

  useEffect(() => {
    fetchBulletins();
  }, []);

  const fetchBulletins = async () => {
    try {
      const { data: bulletinsData, error: bulletinsError } = await supabase
        .from("news_bulletins")
        .select("*")
        .order("week_start_date", { ascending: false });

      if (bulletinsError) throw bulletinsError;

      // Get article counts for each bulletin
      const bulletinsWithCounts = await Promise.all(
        (bulletinsData || []).map(async (bulletin) => {
          const { count } = await supabase
            .from("news_articles")
            .select("*", { count: "exact", head: true })
            .eq("bulletin_id", bulletin.id);

          return { ...bulletin, article_count: count || 0 };
        })
      );

      setBulletins(bulletinsWithCounts);
    } catch (error: any) {
      toast.error("Error fetching bulletins: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const bulletinData = {
        bulletin_number: formData.bulletin_number,
        title: formData.title,
        description: formData.description || null,
        week_start_date: formData.week_start_date,
        is_published: formData.is_published,
        published_at: formData.is_published ? new Date().toISOString() : null,
      };

      if (editingBulletin) {
        const { error } = await supabase
          .from("news_bulletins")
          .update(bulletinData)
          .eq("id", editingBulletin.id);

        if (error) throw error;
        toast.success("Bulletin updated successfully");
      } else {
        const { error } = await supabase
          .from("news_bulletins")
          .insert(bulletinData);

        if (error) throw error;
        toast.success("Bulletin created successfully");
      }

      setDialogOpen(false);
      resetForm();
      fetchBulletins();
    } catch (error: any) {
      toast.error("Error saving bulletin: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (bulletin: Bulletin) => {
    setEditingBulletin(bulletin);
    setFormData({
      bulletin_number: bulletin.bulletin_number,
      title: bulletin.title,
      description: bulletin.description || "",
      week_start_date: bulletin.week_start_date,
      is_published: bulletin.is_published,
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this bulletin?")) return;

    try {
      const { error } = await supabase.from("news_bulletins").delete().eq("id", id);
      if (error) throw error;
      toast.success("Bulletin deleted successfully");
      fetchBulletins();
    } catch (error: any) {
      toast.error("Error deleting bulletin: " + error.message);
    }
  };

  const handleSendEmails = async (bulletinId: string) => {
    setSendingEmails(bulletinId);
    try {
      const { data, error } = await supabase.functions.invoke("send-weekly-bulletin", {
        body: { bulletinId },
      });

      if (error) throw error;
      toast.success(`Emails sent to ${data?.sent || 0} users`);
    } catch (error: any) {
      toast.error("Error sending emails: " + error.message);
    } finally {
      setSendingEmails(null);
    }
  };

  const resetForm = () => {
    setEditingBulletin(null);
    setFormData({
      bulletin_number: "",
      title: "",
      description: "",
      week_start_date: "",
      is_published: false,
    });
  };

  const openCreateDialog = () => {
    resetForm();
    setDialogOpen(true);
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
          <FileStack className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Weekly Bulletins (نشرة الذكاء الاصطناعي)</h3>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreateDialog}>
              <Plus className="mr-2 h-4 w-4" />
              Create Bulletin
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingBulletin ? "Edit Bulletin" : "Create Bulletin"}</DialogTitle>
              <DialogDescription>
                {editingBulletin
                  ? "Update the bulletin details"
                  : "Create a new weekly AI bulletin"}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="bulletin_number">Bulletin ID</Label>
                <Input
                  id="bulletin_number"
                  value={formData.bulletin_number}
                  onChange={(e) => setFormData({ ...formData, bulletin_number: e.target.value })}
                  placeholder="e.g., AI-2024-W01"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Weekly AI Bulletin - January Week 1"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description (optional)</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Brief description of this week's bulletin"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="week_start_date">Week Start Date</Label>
                <Input
                  id="week_start_date"
                  type="date"
                  value={formData.week_start_date}
                  onChange={(e) => setFormData({ ...formData, week_start_date: e.target.value })}
                  required
                />
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  id="is_published"
                  checked={formData.is_published}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_published: checked })}
                />
                <Label htmlFor="is_published">Publish bulletin</Label>
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editingBulletin ? "Update" : "Create"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {bulletins.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          No bulletins yet. Create one to group news articles.
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Bulletin ID</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Week</TableHead>
              <TableHead>Articles</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[150px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {bulletins.map((bulletin) => (
              <TableRow key={bulletin.id}>
                <TableCell className="font-medium">{bulletin.bulletin_number}</TableCell>
                <TableCell>{bulletin.title}</TableCell>
                <TableCell>{format(new Date(bulletin.week_start_date), "MMM d, yyyy")}</TableCell>
                <TableCell>{bulletin.article_count}</TableCell>
                <TableCell>
                  <Badge variant={bulletin.is_published ? "default" : "outline"}>
                    {bulletin.is_published ? "Published" : "Draft"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    {bulletin.is_published && (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => window.open(`/bulletin/${bulletin.id}`, "_blank")}
                          title="View Bulletin"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleSendEmails(bulletin.id)}
                          disabled={sendingEmails === bulletin.id}
                          title="Send Emails"
                        >
                          {sendingEmails === bulletin.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Send className="h-4 w-4" />
                          )}
                        </Button>
                      </>
                    )}
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(bulletin)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(bulletin.id)}>
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
