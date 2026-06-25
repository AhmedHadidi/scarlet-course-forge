import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import UserNav from "@/components/UserNav";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Copy, Check, Sparkles, ArrowRight, ArrowLeft, FolderOpen } from "lucide-react";
import { toast } from "sonner";

interface Prompt {
  id: string;
  title: string | null;
  content: string;
  category: string | null;
  language: string | null;
}

const PromptLibrary = () => {
  const { t } = useTranslation();
  const { isRTL, lang } = useLanguage();
  const contentDir = lang === "ar" ? "rtl" : "ltr";
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => { fetchPrompts(); /* eslint-disable-next-line */ }, [lang]);

  const fetchPrompts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("prompts")
      .select("id, title, content, category, language")
      .eq("language", lang)
      .order("order_index", { ascending: true });
    if (error) {
      console.error(error);
      toast.error(t("prompts.loadError"));
    }
    setPrompts((data as Prompt[]) || []);
    setSelectedCategory(null);
    setLoading(false);
  };

  const categories = useMemo(() => {
    const map = new Map<string, number>();
    prompts.forEach((p) => {
      if (p.category) {
        map.set(p.category, (map.get(p.category) || 0) + 1);
      }
    });
    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name, lang));
  }, [prompts, lang]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return prompts.filter((p) => {
      if (selectedCategory && p.category !== selectedCategory) return false;
      if (!q) return true;
      return (
        (p.title || "").toLowerCase().includes(q) ||
        (p.content || "").toLowerCase().includes(q) ||
        (p.category || "").toLowerCase().includes(q)
      );
    });
  }, [prompts, search, selectedCategory]);

  const searchedCategories = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return categories;
    return categories.filter((c) => c.name.toLowerCase().includes(q));
  }, [categories, search]);

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

  const arrowIcon = isRTL ? ArrowLeft : ArrowRight;

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

        <div className="flex flex-col md:flex-row gap-3 mb-6 items-center">
          <div className="relative flex-1 w-full">
            <Search className={`absolute top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground ${isRTL ? "right-3" : "left-3"}`} />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("prompts.searchPlaceholder")}
              className={isRTL ? "pr-9" : "pl-9"}
              dir="auto"
            />
          </div>
          {selectedCategory && (
            <Button variant="outline" onClick={() => setSelectedCategory(null)}>
              {isRTL ? <ArrowRight className="h-4 w-4 ml-2" /> : <ArrowLeft className="h-4 w-4 mr-2" />}
              {t("prompts.backToCategories")}
            </Button>
          )}
        </div>

        {loading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-32 w-full" />)}
          </div>
        ) : prompts.length === 0 ? (
          <Card className="border-border/50">
            <CardContent className="py-12 text-center text-muted-foreground">
              {t("prompts.emptyAll")}
            </CardContent>
          </Card>
        ) : selectedCategory ? (
          /* Prompts list for selected category */
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="outline" className="text-base px-3 py-1">
                <FolderOpen className="h-4 w-4 mr-1" />
                {selectedCategory}
              </Badge>
              <span className="text-sm text-muted-foreground">
                {filtered.length} {filtered.length === 1 ? t("prompts.copy") : t("prompts.copy")}
              </span>
            </div>
            {filtered.length === 0 ? (
              <Card className="border-border/50">
                <CardContent className="py-12 text-center text-muted-foreground">
                  {t("prompts.emptyFiltered")}
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
                            <h3 className="font-semibold text-lg mb-1" dir={contentDir} style={{ unicodeBidi: "plaintext" }}>
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
                        dir={contentDir}
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
        ) : (
          /* Categories grid */
          <div>
            <h2 className="text-xl font-semibold mb-4">{t("prompts.categories")}</h2>
            {searchedCategories.length === 0 ? (
              <Card className="border-border/50">
                <CardContent className="py-12 text-center text-muted-foreground">
                  {t("prompts.emptyFiltered")}
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {searchedCategories.map((cat) => (
                  <Card
                    key={cat.name}
                    className="border-border/50 hover:border-primary/40 hover:shadow-md transition-all cursor-pointer group"
                    onClick={() => setSelectedCategory(cat.name)}
                  >
                    <CardContent className="p-5 flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <h3
                          className="font-semibold text-lg truncate"
                          dir={contentDir}
                          style={{ unicodeBidi: "plaintext" }}
                        >
                          {cat.name}
                        </h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          {cat.count} {cat.count === 1 ? t("prompts.copy") : t("prompts.copy")}
                        </p>
                      </div>
                      <arrowIcon className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default PromptLibrary;
