import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, ArrowLeft, Calendar, Newspaper, Download } from "lucide-react";
import { format } from "date-fns";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

interface Category {
  id: string;
  name: string;
}

interface Article {
  id: string;
  title: string;
  short_description: string;
  full_content: string;
  image_url: string | null;
  categories: Category[];
}

interface Bulletin {
  id: string;
  bulletin_number: string;
  title: string;
  description: string | null;
  week_start_date: string;
}

const WeeklyBulletin = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [bulletin, setBulletin] = useState<Bulletin | null>(null);
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedArticle, setExpandedArticle] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const pageContentRef = useRef<HTMLDivElement>(null);

  const loadArabicFont = (): Promise<void> => {
    return new Promise((resolve) => {
      // Check if already loaded
      if (document.querySelector('#noto-sans-arabic-font')) {
        resolve();
        return;
      }
      const link = document.createElement('link');
      link.id = 'noto-sans-arabic-font';
      link.rel = 'stylesheet';
      link.href = 'https://fonts.googleapis.com/css2?family=Noto+Sans+Arabic:wght@400;700&display=swap';
      link.onload = () => {
        // Wait a bit for font to be ready
        document.fonts.ready.then(() => resolve());
      };
      link.onerror = () => resolve(); // Continue even if font fails
      document.head.appendChild(link);
    });
  };

  const exportAsPdf = async () => {
    if (!bulletin || articles.length === 0 || !pageContentRef.current) return;
    setExporting(true);

    try {
      // Load Arabic font first (both weights)
      await loadArabicFont();

      const element = pageContentRef.current;
      const clone = element.cloneNode(true) as HTMLElement;

      // Fixed-width off-screen clone for consistent layout
      clone.style.width = "1000px";
      clone.style.position = "absolute";
      clone.style.left = "-9999px";
      clone.style.top = "0";
      clone.style.background = "#ffffff";
      clone.style.color = "#000000";
      clone.style.direction = "rtl";

      // Apply the SAME Arabic font to ALL elements (titles, body, badges, everything)
      const arabicFont = "'Noto Sans Arabic', 'Segoe UI', Tahoma, Arial, sans-serif";
      clone.style.fontFamily = arabicFont;
      clone.style.unicodeBidi = "plaintext";
      clone.querySelectorAll('*').forEach(el => {
        const htmlEl = el as HTMLElement;
        htmlEl.style.fontFamily = arabicFont;
        htmlEl.style.unicodeBidi = "plaintext";
        htmlEl.style.direction = "rtl";
        htmlEl.style.textAlign = "right";
      });

      // Fix category badges - properly sized with same font
      clone.querySelectorAll('[class*="badge"], [class*="Badge"]').forEach(el => {
        const badge = el as HTMLElement;
        badge.style.fontSize = "14px";
        badge.style.padding = "8px 18px";
        badge.style.display = "inline-flex";
        badge.style.alignItems = "center";
        badge.style.justifyContent = "center";
        badge.style.lineHeight = "1.4";
        badge.style.borderRadius = "9999px";
        badge.style.whiteSpace = "nowrap";
        badge.style.minHeight = "34px";
        badge.style.boxSizing = "border-box";
      });

      // Expand all articles in clone
      clone.querySelectorAll('[data-article-content]').forEach(el => {
        (el as HTMLElement).style.display = 'block';
      });
      // Hide UI-only elements in clone
      clone.querySelectorAll('[data-read-more-btn], [data-show-less-btn], [data-export-btn], [data-back-btn]').forEach(el => {
        (el as HTMLElement).style.display = 'none';
      });

      document.body.appendChild(clone);

      // Wait for font to fully render in clone
      await document.fonts.ready;
      await new Promise(resolve => setTimeout(resolve, 800));

      const canvas = await html2canvas(clone, {
        scale: 3,
        useCORS: true,
        logging: false,
        allowTaint: true,
        backgroundColor: "#ffffff",
        width: 1000,
        windowWidth: 1000,
      });

      document.body.removeChild(clone);

      const imgData = canvas.toDataURL("image/png");
      const pdfWidth = 210;
      const pdfHeight = 297;
      const margin = 8;
      const contentWidth = pdfWidth - margin * 2;
      const contentHeight = (canvas.height * contentWidth) / canvas.width;

      const pdf = new jsPDF("p", "mm", "a4");

      let heightLeft = contentHeight;
      let position = margin;

      pdf.addImage(imgData, "PNG", margin, position, contentWidth, contentHeight);
      heightLeft -= (pdfHeight - margin * 2);

      while (heightLeft > 0) {
        position = margin - (contentHeight - heightLeft);
        pdf.addPage();
        pdf.addImage(imgData, "PNG", margin, position, contentWidth, contentHeight);
        heightLeft -= (pdfHeight - margin * 2);
      }

      pdf.save(`${bulletin.bulletin_number}.pdf`);
    } catch (error) {
      console.error("Error exporting PDF:", error);
    } finally {
      setExporting(false);
    }
  };

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (id && user) {
      fetchBulletinData();
    }
  }, [id, user]);

  const fetchBulletinData = async () => {
    const normalizeId = (v: unknown) => String(v ?? "").trim();

    try {
      // Fetch bulletin
      const { data: bulletinData, error: bulletinError } = await supabase
        .from("news_bulletins")
        .select("*")
        .eq("id", id)
        .eq("is_published", true)
        .maybeSingle();

      if (bulletinError) throw bulletinError;
      if (!bulletinData) {
        navigate("/dashboard");
        return;
      }

      setBulletin(bulletinData);

      // Fetch user preferences (used to filter articles)
      const { data: prefsData, error: prefsError } = await supabase
        .from("user_category_preferences")
        .select("category_id")
        .eq("user_id", user!.id);

      if (prefsError) throw prefsError;

      const preferredCategoryIdSet = new Set(
        (prefsData || [])
          .map((p) => normalizeId(p.category_id))
          .filter(Boolean)
      );

      // Fetch articles for this bulletin
      const { data: articlesData, error: articlesError } = await supabase
        .from("news_articles")
        .select("*")
        .eq("bulletin_id", id)
        .eq("is_published", true)
        .order("created_at", { ascending: false });

      if (articlesError) throw articlesError;

      // Fetch categories for each article
      const { data: allCategories } = await supabase
        .from("news_categories")
        .select("id, name");

      const articlesWithCategories = await Promise.all(
        (articlesData || []).map(async (article) => {
          const { data: categoryLinks } = await supabase
            .from("news_article_categories")
            .select("category_id")
            .eq("article_id", article.id);

          const articleCategories = (categoryLinks || [])
            .map((link) => allCategories?.find((c) => c.id === link.category_id))
            .filter(Boolean) as Category[];

          return { ...article, categories: articleCategories };
        })
      );

      const filteredArticles = preferredCategoryIdSet.size
        ? articlesWithCategories.filter((article) =>
            article.categories.some((cat) =>
              preferredCategoryIdSet.has(normalizeId(cat.id))
            )
          )
        : articlesWithCategories;

      setArticles(filteredArticles);
    } catch (error) {
      console.error("Error fetching bulletin:", error);
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!bulletin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Bulletin not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background" ref={pageContentRef}>
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="max-w-5xl mx-auto px-6 py-8">
          <Button
            variant="ghost"
            className="mb-4"
            onClick={() => navigate("/dashboard")}
            data-back-btn
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>

          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="h-16 w-16 rounded-lg gradient-crimson flex items-center justify-center flex-shrink-0">
                <Newspaper className="h-8 w-8 text-white" />
              </div>
              <div>
                <Badge variant="outline" className="mb-2">
                  {bulletin.bulletin_number}
                </Badge>
                <h1 className="text-3xl font-bold mb-2">{bulletin.title}</h1>
                {bulletin.description && (
                  <p className="text-muted-foreground mb-2">{bulletin.description}</p>
                )}
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <span>Week of {format(new Date(bulletin.week_start_date), "MMMM d, yyyy")}</span>
                </div>
              </div>
            </div>
            {articles.length > 0 && (
              <Button variant="outline" onClick={exportAsPdf} disabled={exporting} data-export-btn>
                {exporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                {exporting ? "Exporting..." : "Export PDF"}
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Articles */}
      <main className="max-w-5xl mx-auto px-6 py-8">
        {articles.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            No articles in this bulletin yet.
          </div>
        ) : (
          <div className="grid gap-6">
            {articles.map((article) => (
              <Card key={article.id} className="border-border/50 overflow-hidden">
                <div className="flex flex-col md:flex-row">
                  {article.image_url && (
                    <div className="md:w-64 h-48 md:h-auto flex-shrink-0">
                      <img
                        src={article.image_url}
                        alt={article.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  <div className="flex-1">
                    <CardHeader>
                      <div className="flex flex-wrap gap-2 mb-2">
                        {article.categories.map((cat) => (
                          <Badge key={cat.id} variant="secondary">
                            {cat.name}
                          </Badge>
                        ))}
                      </div>
                      <CardTitle className="text-xl" dir="rtl" style={{ unicodeBidi: "plaintext" }}>{article.title}</CardTitle>
                      <CardDescription>{article.short_description}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {/* Always render full content but toggle visibility */}
                      <div
                        data-article-content
                        style={{ display: (expandedArticle === article.id || expandedArticle === "__ALL__") ? "block" : "none" }}
                      >
                        <div className="space-y-4">
                          <p className="text-foreground whitespace-pre-wrap">
                            {article.full_content}
                          </p>
                          <Button
                            variant="link"
                            className="p-0 h-auto"
                            onClick={() => setExpandedArticle(null)}
                            data-show-less-btn
                          >
                            Show less
                          </Button>
                        </div>
                      </div>
                      {expandedArticle !== article.id && expandedArticle !== "__ALL__" && (
                        <Button
                          variant="link"
                          className="p-0 h-auto"
                          onClick={() => setExpandedArticle(article.id)}
                          data-read-more-btn
                        >
                          Read more
                        </Button>
                      )}
                    </CardContent>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default WeeklyBulletin;
