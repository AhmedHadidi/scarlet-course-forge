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
  const pdfContentRef = useRef<HTMLDivElement>(null);

  const exportAsPdf = async () => {
    if (!bulletin || articles.length === 0 || !pdfContentRef.current) return;
    setExporting(true);

    try {
      const element = pdfContentRef.current;
      // Make visible for rendering
      element.style.display = "block";

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
      });

      element.style.display = "none";

      const imgWidth = 210; // A4 width in mm
      const pageHeight = 297; // A4 height in mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      const pdf = new jsPDF("p", "mm", "a4");
      const imgData = canvas.toDataURL("image/png");

      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
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
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="max-w-5xl mx-auto px-6 py-8">
          <Button
            variant="ghost"
            className="mb-4"
            onClick={() => navigate("/dashboard")}
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
              <Button variant="outline" onClick={exportAsPdf} disabled={exporting}>
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
                      <CardTitle className="text-xl">{article.title}</CardTitle>
                      <CardDescription>{article.short_description}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {expandedArticle === article.id ? (
                        <div className="space-y-4">
                          <p className="text-foreground whitespace-pre-wrap">
                            {article.full_content}
                          </p>
                          <Button
                            variant="link"
                            className="p-0 h-auto"
                            onClick={() => setExpandedArticle(null)}
                          >
                            Show less
                          </Button>
                        </div>
                      ) : (
                        <Button
                          variant="link"
                          className="p-0 h-auto"
                          onClick={() => setExpandedArticle(article.id)}
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
      {/* Hidden PDF content for html2canvas */}
      <div
        ref={pdfContentRef}
        style={{ display: "none", width: "800px", padding: "40px", backgroundColor: "#fff", color: "#000", fontFamily: "sans-serif" }}
        dir="rtl"
      >
        <div style={{ marginBottom: "8px", color: "#666", fontSize: "14px" }}>{bulletin.bulletin_number}</div>
        <h1 style={{ fontSize: "28px", fontWeight: "bold", marginBottom: "8px" }}>{bulletin.title}</h1>
        {bulletin.description && <p style={{ color: "#555", marginBottom: "8px" }}>{bulletin.description}</p>}
        <p style={{ color: "#888", fontSize: "13px", marginBottom: "24px" }}>
          Week of {format(new Date(bulletin.week_start_date), "MMMM d, yyyy")}
        </p>
        <hr style={{ borderColor: "#ddd", marginBottom: "24px" }} />
        {articles.map((article, index) => (
          <div key={article.id} style={{ marginBottom: "28px" }}>
            {article.categories.length > 0 && (
              <div style={{ fontSize: "12px", color: "#888", marginBottom: "6px" }}>
                {article.categories.map(c => c.name).join(" • ")}
              </div>
            )}
            <h2 style={{ fontSize: "20px", fontWeight: "bold", marginBottom: "6px" }}>{article.title}</h2>
            <p style={{ color: "#555", fontSize: "14px", marginBottom: "10px" }}>{article.short_description}</p>
            <p style={{ fontSize: "14px", lineHeight: "1.8", whiteSpace: "pre-wrap" }}>{article.full_content}</p>
            {index < articles.length - 1 && <hr style={{ borderColor: "#eee", marginTop: "24px" }} />}
          </div>
        ))}
      </div>
    </div>
  );
};

export default WeeklyBulletin;
