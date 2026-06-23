import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import UserNav from "@/components/UserNav";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Copy, Check, Sparkles } from "lucide-react";
import { toast } from "sonner";

interface Prompt {
  id: string;
  title: string | null;
  content: string;
  category: string | null;
}

const PromptLibrary = () => {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => { fetchPrompts(); }, []);

  const fetchPrompts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("prompts")
      .select("id, title, content, category")
      .order("order_index", { ascending: true });
    if (error) {
      console.error(error);
      toast.error(t("prompts.loadError"));
    }
    setPrompts((data as Prompt[]) || []);
    setLoading(false);
  };

  const categories = useMemo(() => {
    const set = new Set<string>();
    prompts.forEach((p) => { if (p.category) set.add(p.category); });
    return Array.from(set).sort();
  }, [prompts]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return prompts.filter((p) => {
      if (category !== "all" && p.category !== category) return false;
      if (!q) return true;
      return (
        (p.title || "").toLowerCase().includes(q) ||
        (p.content || "").toLowerCase().includes(q) ||
        (p.category || "").toLowerCase().includes(q)
      );
    });
  }, [prompts, search, category]);

  const handleCopy = async (p: Prompt) => {
    try {
      await navigator.clipboard.writeText(p.content);
      setCopiedId(p.id);
      toast.success(t("prompts.copied"));
      setTimeout(() => setCopiedId((c) => (c === p.id ? null : c)), 1500);
    } catch {
      toast.error(t("prompts.copyError"));
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <UserNav />
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <div className="mb-8 flex items-center gap-3">
          <div className="h-12 w-12 rounded-full gradient-crimson flex items-center justify-center">
            <Sparkles className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">{t("prompts.title")}</h1>
            <p className="text-muted-foreground">{t("prompts.subtitle")}</p>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className={`absolute top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground ${isRTL ? "right-3" : "left-3"}`} />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("prompts.searchPlaceholder")}
              className={isRTL ? "pr-9" : "pl-9"}
              dir="auto"
            />
          </div>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="md:w-64">
              <SelectValue placeholder={t("prompts.allCategories")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("prompts.allCategories")}</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-32 w-full" />)}
          </div>
        ) : filtered.length === 0 ? (
          <Card className="border-border/50">
            <CardContent className="py-12 text-center text-muted-foreground">
              {prompts.length === 0 ? t("prompts.emptyAll") : t("prompts.emptyFiltered")}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {filtered.map((p) => (
              <Card key={p.id} className="border-border/50 hover:border-primary/40 transition-colors">
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex-1 min-w-0">
                      {p.title && (
                        <h3 className="font-semibold text-lg mb-1" dir="rtl" style={{ unicodeBidi: "plaintext" }}>
                          {p.title}
                        </h3>
                      )}
                      {p.category && (
                        <Badge variant="secondary" className="mb-2">{p.category}</Badge>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant={copiedId === p.id ? "default" : "outline"}
                      onClick={() => handleCopy(p)}
                      className="shrink-0"
                    >
                      {copiedId === p.id ? (
                        <><Check className="h-4 w-4 mr-1" />{t("prompts.copied")}</>
                      ) : (
                        <><Copy className="h-4 w-4 mr-1" />{t("prompts.copy")}</>
                      )}
                    </Button>
                  </div>
                  <p
                    className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90"
                    dir="rtl"
                    style={{ unicodeBidi: "plaintext" }}
                  >
                    {p.content}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default PromptLibrary;
