import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, ArrowLeft, Calendar, Newspaper, Download } from "lucide-react";
import { format } from "date-fns";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

/* ─────────────────────────── Types ──────────────────────────────── */
interface Category { id: string; name: string; }
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

/* ─────────────────────────── Helpers ─────────────────────────────── */
const CRIMSON = "#B91C2E";
const CRIMSON_DARK = "#8B1528";

/* ─────────────────────────── Component ──────────────────────────── */
const WeeklyBulletin = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [bulletin, setBulletin] = useState<Bulletin | null>(null);
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedArticle, setExpandedArticle] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const pdfContainerRef = useRef<HTMLDivElement>(null);

  /* ══════════════════════════════════════════════════════════════════
     EXPORT: html2canvas of a dedicated off-screen layout → jsPDF
     ══════════════════════════════════════════════════════════════════ */
  const exportAsPdf = useCallback(async () => {
    if (!bulletin || articles.length === 0 || !pdfContainerRef.current) return;
    setExporting(true);

    try {
      const el = pdfContainerRef.current;

      // Briefly make it visible for html2canvas (still off-screen)
      el.style.display = "block";

      // Wait for images + fonts to settle
      await document.fonts.ready;
      await new Promise(r => setTimeout(r, 600));

      const canvas = await html2canvas(el, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        logging: false,
        backgroundColor: "#ffffff",
        width: el.scrollWidth,
        windowWidth: el.scrollWidth,
      });

      // Hide again
      el.style.display = "none";

      // Build PDF
      const imgData = canvas.toDataURL("image/jpeg", 0.92);
      const pdfW = 210; // A4 width mm
      const pdfH = 297; // A4 height mm
      const margin = 6;
      const contentW = pdfW - margin * 2;
      const contentH = (canvas.height * contentW) / canvas.width;
      const pageContentH = pdfH - margin * 2;

      const pdf = new jsPDF("p", "mm", "a4");
      let heightLeft = contentH;
      let yOffset = margin;

      // First page
      pdf.addImage(imgData, "JPEG", margin, yOffset, contentW, contentH);
      heightLeft -= pageContentH;

      // Additional pages
      while (heightLeft > 0) {
        pdf.addPage();
        yOffset = margin - (contentH - heightLeft);
        pdf.addImage(imgData, "JPEG", margin, yOffset, contentW, contentH);
        heightLeft -= pageContentH;
      }

      pdf.save(`${bulletin.bulletin_number}.pdf`);
    } catch (err) {
      console.error("PDF export error:", err);
    } finally {
      setExporting(false);
    }
  }, [bulletin, articles]);

  /* ── Auth guard ─────────────────────────────────────────────────── */
  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [user, authLoading, navigate]);

  /* ── Fetch data ─────────────────────────────────────────────────── */
  useEffect(() => {
    if (id && user) fetchBulletinData();
  }, [id, user]);

  const fetchBulletinData = async () => {
    const normalizeId = (v: unknown) => String(v ?? "").trim();
    try {
      const { data: bulletinData, error: bulletinError } = await supabase
        .from("news_bulletins").select("*").eq("id", id).eq("is_published", true).maybeSingle();
      if (bulletinError) throw bulletinError;
      if (!bulletinData) { navigate("/dashboard"); return; }
      setBulletin(bulletinData);

      const { data: prefsData } = await supabase
        .from("user_category_preferences").select("category_id").eq("user_id", user!.id);
      const preferredCategoryIdSet = new Set(
        (prefsData || []).map(p => normalizeId(p.category_id)).filter(Boolean)
      );

      const { data: articlesData, error: articlesError } = await supabase
        .from("news_articles").select("*").eq("bulletin_id", id).eq("is_published", true)
        .order("created_at", { ascending: false });
      if (articlesError) throw articlesError;

      const { data: allCategories } = await supabase.from("news_categories").select("id, name");
      const articlesWithCategories = await Promise.all(
        (articlesData || []).map(async (article) => {
          const { data: categoryLinks } = await supabase
            .from("news_article_categories").select("category_id").eq("article_id", article.id);
          const articleCategories = (categoryLinks || [])
            .map(link => allCategories?.find(c => c.id === link.category_id))
            .filter(Boolean) as Category[];
          return { ...article, categories: articleCategories };
        })
      );

      const filteredArticles = preferredCategoryIdSet.size
        ? articlesWithCategories.filter(a =>
          a.categories.some(cat => preferredCategoryIdSet.has(normalizeId(cat.id)))
        )
        : articlesWithCategories;
      setArticles(filteredArticles);
    } catch (error) {
      console.error("Error fetching bulletin:", error);
    } finally {
      setLoading(false);
    }
  };

  /* ── Loading / empty ────────────────────────────────────────────── */
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

  const formattedDate = format(new Date(bulletin.week_start_date), "MMMM d, yyyy");
  const featuredArticle = articles[0];
  const restArticles = articles.slice(1);

  /* ═══════════════════════════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════════════════════════ */
  return (
    <>
      {/* ░░░ SCREEN LAYOUT ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ */}
      <div className="min-h-screen bg-background">
        <header className="border-b border-border bg-card">
          <div className="max-w-5xl mx-auto px-6 py-8">
            <Button variant="ghost" className="mb-4" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
            </Button>
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="h-16 w-16 rounded-lg gradient-crimson flex items-center justify-center flex-shrink-0">
                  <Newspaper className="h-8 w-8 text-white" />
                </div>
                <div>
                  <Badge variant="outline" className="mb-2">{bulletin.bulletin_number}</Badge>
                  <h1 className="text-3xl font-bold mb-2">{bulletin.title}</h1>
                  {bulletin.description && <p className="text-muted-foreground mb-2">{bulletin.description}</p>}
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" /><span>Week of {formattedDate}</span>
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

        <main className="max-w-5xl mx-auto px-6 py-8">
          {articles.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">No articles in this bulletin yet.</div>
          ) : (
            <div className="grid gap-6">
              {articles.map(article => (
                <div key={article.id} className="border border-border/50 rounded-xl overflow-hidden bg-card shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex flex-col md:flex-row">
                    {article.image_url && (
                      <div className="md:w-64 h-48 md:h-auto flex-shrink-0">
                        <img src={article.image_url} alt={article.title} className="w-full h-full object-cover" />
                      </div>
                    )}
                    <div className="flex-1 p-6">
                      <div className="flex flex-wrap gap-2 mb-3">
                        {article.categories.map(cat => <Badge key={cat.id} variant="secondary">{cat.name}</Badge>)}
                      </div>
                      <h2 className="text-xl font-bold mb-2" dir="rtl" style={{ unicodeBidi: "plaintext" }}>{article.title}</h2>
                      <p className="text-muted-foreground text-sm mb-3" dir="rtl" style={{ unicodeBidi: "plaintext" }}>{article.short_description}</p>
                      {(expandedArticle === article.id || expandedArticle === "__ALL__") && (
                        <div className="mt-4">
                          <p className="text-foreground whitespace-pre-wrap leading-relaxed" dir="rtl" style={{ unicodeBidi: "plaintext" }}>{article.full_content}</p>
                          <Button variant="link" className="p-0 h-auto mt-2" onClick={() => setExpandedArticle(null)}>Show less</Button>
                        </div>
                      )}
                      {expandedArticle !== article.id && expandedArticle !== "__ALL__" && (
                        <Button variant="link" className="p-0 h-auto text-primary" onClick={() => setExpandedArticle(article.id)}>Read more</Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>

      {/* ░░░ OFF-SCREEN PDF LAYOUT (captured by html2canvas) ░░░░░░░ */}
      <div
        ref={pdfContainerRef}
        dir="rtl"
        style={{
          display: "none",
          position: "absolute",
          left: "-9999px",
          top: 0,
          width: "900px",
          background: "#ffffff",
          fontFamily: "'Segoe UI', Tahoma, 'Noto Sans Arabic', Arial, sans-serif",
          color: "#1a1a1a",
          lineHeight: 1.7,
          fontSize: "14px",
          padding: "0",
        }}
      >
        {/* ══ HEADER ═════════════════════════════════════════════════ */}
        <div style={{
          background: `linear-gradient(135deg, ${CRIMSON} 0%, ${CRIMSON_DARK} 60%, #5C0E1C 100%)`,
          color: "#fff",
          padding: "44px 48px 40px",
          position: "relative",
          overflow: "hidden",
        }}>
          {/* Decorative circles */}
          <div style={{ position: "absolute", top: "-50px", left: "-50px", width: "200px", height: "200px", borderRadius: "50%", background: "rgba(255,255,255,0.06)" }} />
          <div style={{ position: "absolute", bottom: "-40px", right: "50px", width: "140px", height: "140px", borderRadius: "50%", background: "rgba(255,255,255,0.04)" }} />

          <div style={{ position: "relative", zIndex: 1 }}>
            {/* Top: icon + bulletin number */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
              <div style={{ background: "rgba(255,255,255,0.15)", borderRadius: "12px", padding: "14px", display: "inline-flex" }}>
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2" />
                  <path d="M18 14h-8" /><path d="M15 18h-5" /><path d="M10 6h8v4h-8V6Z" />
                </svg>
              </div>
              <div style={{ background: "rgba(255,255,255,0.18)", borderRadius: "24px", padding: "8px 24px", fontSize: "14px", fontWeight: 700, letterSpacing: "0.5px" }}>
                {bulletin.bulletin_number}
              </div>
            </div>

            {/* Title */}
            <h1 style={{ fontSize: "34px", fontWeight: 800, margin: "0 0 10px 0", lineHeight: 1.35 }}>
              {bulletin.title}
            </h1>
            {bulletin.description && (
              <p style={{ fontSize: "16px", opacity: 0.85, margin: "0 0 16px 0", maxWidth: "650px" }}>{bulletin.description}</p>
            )}

            {/* Date */}
            <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", fontSize: "14px", opacity: 0.9, background: "rgba(255,255,255,0.12)", borderRadius: "8px", padding: "8px 16px" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
                <line x1="16" x2="16" y1="2" y2="6" /><line x1="8" x2="8" y1="2" y2="6" />
                <line x1="3" x2="21" y1="10" y2="10" />
              </svg>
              <span>{formattedDate}</span>
            </div>
          </div>
        </div>

        {/* ══ ARTICLE COUNT BAR ══════════════════════════════════════ */}
        <div style={{ textAlign: "center", padding: "16px 0 24px", borderBottom: "2px solid #f0f0f0", marginBottom: "32px", fontSize: "15px", color: "#555" }}>
          <span style={{ background: CRIMSON, color: "#fff", borderRadius: "20px", padding: "5px 18px", fontSize: "14px", fontWeight: 700, marginLeft: "8px" }}>
            {articles.length}
          </span>
          أخبار في هذا العدد
        </div>

        {/* ══ FEATURED ARTICLE ═══════════════════════════════════════ */}
        {featuredArticle && (
          <div style={{ padding: "0 40px", marginBottom: "36px" }}>
            {featuredArticle.image_url && (
              <div style={{ borderRadius: "14px", overflow: "hidden", marginBottom: "20px" }}>
                <img src={featuredArticle.image_url} alt="" crossOrigin="anonymous"
                  style={{ width: "100%", height: "300px", objectFit: "cover", display: "block" }} />
              </div>
            )}
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "12px" }}>
              {featuredArticle.categories.map(cat => (
                <span key={cat.id} style={{ background: CRIMSON, color: "#fff", borderRadius: "16px", padding: "5px 16px", fontSize: "12px", fontWeight: 700 }}>
                  {cat.name}
                </span>
              ))}
            </div>
            <h2 style={{ fontSize: "26px", fontWeight: 800, margin: "0 0 12px 0", lineHeight: 1.4, color: "#1a1a1a" }}>
              {featuredArticle.title}
            </h2>
            <p style={{ fontSize: "14px", color: "#666", margin: "0 0 16px 0", lineHeight: 1.7 }}>
              {featuredArticle.short_description}
            </p>
            <div style={{ fontSize: "14px", color: "#333", lineHeight: 1.9, whiteSpace: "pre-wrap", borderRight: `4px solid ${CRIMSON}`, paddingRight: "20px" }}>
              {featuredArticle.full_content}
            </div>
            <div style={{ margin: "36px 40px", height: "2px", background: "linear-gradient(90deg, transparent, #ddd 20%, #ddd 80%, transparent)" }} />
          </div>
        )}

        {/* ══ REST ARTICLES ══════════════════════════════════════════ */}
        {restArticles.map((article, idx) => (
          <div key={article.id} style={{ padding: "0 40px", marginBottom: "28px" }}>
            <div style={{ display: "flex", gap: "20px", alignItems: "flex-start" }}>
              {article.image_url && (
                <div style={{ width: "200px", minWidth: "200px", height: "150px", borderRadius: "10px", overflow: "hidden", flexShrink: 0 }}>
                  <img src={article.image_url} alt="" crossOrigin="anonymous"
                    style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                </div>
              )}
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "8px" }}>
                  {article.categories.map(cat => (
                    <span key={cat.id} style={{ background: "#FEF2F2", color: CRIMSON, borderRadius: "12px", padding: "3px 14px", fontSize: "11px", fontWeight: 700, border: "1px solid #FECACA" }}>
                      {cat.name}
                    </span>
                  ))}
                </div>
                <h3 style={{ fontSize: "19px", fontWeight: 700, margin: "0 0 8px 0", lineHeight: 1.4, color: "#1a1a1a" }}>
                  {article.title}
                </h3>
                <p style={{ fontSize: "13px", color: "#666", margin: 0, lineHeight: 1.6 }}>
                  {article.short_description}
                </p>
              </div>
            </div>
            <div style={{ fontSize: "13.5px", color: "#333", lineHeight: 1.9, whiteSpace: "pre-wrap", marginTop: "14px", paddingRight: "16px", borderRight: "3px solid #E5E7EB" }}>
              {article.full_content}
            </div>
            {idx < restArticles.length - 1 && (
              <div style={{ margin: "28px 0 0", height: "1px", background: "linear-gradient(90deg, transparent, #e0e0e0 15%, #e0e0e0 85%, transparent)" }} />
            )}
          </div>
        ))}

        {/* ══ FOOTER ═════════════════════════════════════════════════ */}
        <div style={{ marginTop: "48px", borderTop: "2px solid #f0f0f0", padding: "24px 40px", textAlign: "center", fontSize: "12px", color: "#999" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", marginBottom: "8px" }}>
            <div style={{ width: "28px", height: "28px", borderRadius: "6px", background: `linear-gradient(135deg, ${CRIMSON}, ${CRIMSON_DARK})`, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2" />
              </svg>
            </div>
            <span style={{ fontWeight: 600, color: "#666" }}>MOI AI Learning Hub</span>
          </div>
          <div>تم إنشاء هذا التقرير بتاريخ {format(new Date(), "yyyy/MM/dd")} — جميع الحقوق محفوظة</div>
        </div>
      </div>
    </>
  );
};

export default WeeklyBulletin;
