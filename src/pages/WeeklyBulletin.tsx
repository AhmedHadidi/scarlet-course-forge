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
import React from "react";

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
const TEAL = "#0D9488";
const TEAL_DARK = "#0F766E";
const TEAL_DARKER = "#115E59";

/* ── How many bottom-row cards fit per page ── */
const CARDS_PER_PAGE = 3;

/* ═══════════════════════════════════════════════════════════════════════
   Single PDF page component (renders into the off-screen container)
   ═══════════════════════════════════════════════════════════════════════ */
interface PdfPageProps {
  bulletin: Bulletin;
  pageArticles: Article[];   // articles to show in the bottom grid
  featuredArticle: Article | null; // shown only on page 1
  editionLabel: string;
  isFirstPage: boolean;
}

const PdfPage: React.FC<PdfPageProps> = ({
  bulletin,
  pageArticles,
  featuredArticle,
  editionLabel,
  isFirstPage,
}) => {
  const PAGE_W = 900;

  return (
    <div
      dir="rtl"
      style={{
        width: `${PAGE_W}px`,
        background: "#ffffff",
        fontFamily: "'Segoe UI', Tahoma, 'Noto Sans Arabic', Arial, sans-serif",
        color: "#1a1a1a",
        lineHeight: 1.6,
        fontSize: "14px",
        boxSizing: "border-box",
      }}
    >
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div
        style={{
          background: `linear-gradient(135deg, ${TEAL} 0%, ${TEAL_DARK} 60%, ${TEAL_DARKER} 100%)`,
          padding: "28px 36px 24px",
          color: "#fff",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Decorative dots / circles */}
        <div style={{ position: "absolute", top: -30, left: -30, width: 160, height: 160, borderRadius: "50%", background: "rgba(255,255,255,0.06)" }} />
        <div style={{ position: "absolute", bottom: -20, right: 60, width: 100, height: 100, borderRadius: "50%", background: "rgba(255,255,255,0.04)" }} />

        {/* Top row: ministry label right, edition badge left */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", position: "relative", zIndex: 1, marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: 0.3 }}>وزارة الإعلام</div>
          <div style={{ background: "rgba(255,255,255,0.18)", borderRadius: 20, padding: "6px 22px", fontSize: 13, fontWeight: 700 }}>
            {editionLabel}
          </div>
        </div>

        {/* Title */}
        <div style={{ textAlign: "center", position: "relative", zIndex: 1 }}>
          <div style={{ fontSize: 48, fontWeight: 900, lineHeight: 1.1, marginBottom: 8, letterSpacing: 1 }}>
            ذكاء<span style={{ fontSize: 28, verticalAlign: "super", marginRight: 2 }}>+</span>
          </div>
          <div style={{ fontSize: 13, opacity: 0.88, maxWidth: 560, margin: "0 auto" }}>
            نشرة أسبوعية من فريق الذكاء الاصطناعي لمتابعة أحدث التطورات في مجال الذكاء الاصطناعي وإنجازات الوزارة في هذا المجال
          </div>
        </div>
      </div>

      {/* ── Featured article (page 1 only) ─────────────────────────── */}
      {isFirstPage && featuredArticle && (
        <div style={{ padding: "0 32px" }}>
          {/* Accent banner */}
          <div
            style={{
              background: TEAL,
              color: "#fff",
              textAlign: "center",
              padding: "12px 24px",
              fontSize: 18,
              fontWeight: 800,
              borderRadius: "0 0 14px 14px",
              marginBottom: 16,
            }}
          >
            {featuredArticle.title}
          </div>

          {/* Featured image */}
          {featuredArticle.image_url && (
            <div style={{ borderRadius: 12, overflow: "hidden", marginBottom: 14 }}>
              <img
                src={featuredArticle.image_url}
                alt=""
                crossOrigin="anonymous"
                style={{ width: "100%", height: 280, objectFit: "cover", display: "block" }}
              />
            </div>
          )}

          {/* Description */}
          <p
            style={{
              fontSize: 13,
              color: "#444",
              lineHeight: 1.8,
              margin: "0 0 20px 0",
              textAlign: "center",
            }}
          >
            {featuredArticle.short_description || featuredArticle.full_content?.slice(0, 200)}
          </p>
        </div>
      )}

      {/* ── Article cards grid (3-col) ─────────────────────────────── */}
      {pageArticles.length > 0 && (
        <div
          style={{
            display: "flex",
            gap: 16,
            padding: "0 32px 28px",
            flexWrap: "wrap",
            justifyContent: "center",
          }}
        >
          {pageArticles.map((article) => (
            <div
              key={article.id}
              style={{
                width: pageArticles.length === 1 ? "100%" : pageArticles.length === 2 ? "48%" : "30.5%",
                background: "#F9FAFB",
                borderRadius: 14,
                overflow: "hidden",
                border: "1px solid #E5E7EB",
                boxSizing: "border-box",
              }}
            >
              {article.image_url && (
                <img
                  src={article.image_url}
                  alt=""
                  crossOrigin="anonymous"
                  style={{ width: "100%", height: 150, objectFit: "cover", display: "block" }}
                />
              )}
              <div style={{ padding: "12px 14px 16px" }}>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 800,
                    color: TEAL_DARKER,
                    marginBottom: 6,
                    lineHeight: 1.5,
                  }}
                >
                  {article.title}
                </div>
                <p
                  style={{
                    fontSize: 11.5,
                    color: "#555",
                    lineHeight: 1.7,
                    margin: 0,
                    display: "-webkit-box",
                    WebkitLineClamp: 4,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}
                >
                  {article.short_description || article.full_content?.slice(0, 120)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Footer ─────────────────────────────────────────────────── */}
      <div
        style={{
          borderTop: "2px solid #E5E7EB",
          padding: "14px 32px",
          textAlign: "center",
          fontSize: 11,
          color: "#999",
        }}
      >
        <span style={{ fontWeight: 600, color: "#666" }}>MOI AI Learning Hub</span>
        {" · "}
        تم إنشاء هذا التقرير بتاريخ {format(new Date(), "yyyy/MM/dd")} — جميع الحقوق محفوظة
      </div>
    </div>
  );
};

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
     EXPORT: Render each page in the off-screen container → html2canvas → jsPDF
     ══════════════════════════════════════════════════════════════════ */
  const [pdfPages, setPdfPages] = useState<{ featuredArticle: Article | null; pageArticles: Article[]; isFirstPage: boolean }[]>([]);

  const exportAsPdf = useCallback(async () => {
    if (!bulletin || articles.length === 0 || !pdfContainerRef.current) return;
    setExporting(true);

    try {
      // ── Build page data ────────────────────────────────────────────
      const featured = articles[0];
      const rest = articles.slice(1);
      const pages: typeof pdfPages = [];

      // Page 1: featured + first N cards
      const firstPageCards = rest.slice(0, CARDS_PER_PAGE);
      pages.push({ featuredArticle: featured, pageArticles: firstPageCards, isFirstPage: true });

      // Remaining pages: N cards each, same template (no featured)
      let offset = CARDS_PER_PAGE;
      while (offset < rest.length) {
        pages.push({
          featuredArticle: null,
          pageArticles: rest.slice(offset, offset + CARDS_PER_PAGE),
          isFirstPage: false,
        });
        offset += CARDS_PER_PAGE;
      }

      // Trigger render of pages into the DOM
      setPdfPages(pages);

      // Wait for React to render + images to load
      await document.fonts.ready;
      await new Promise(r => setTimeout(r, 800));

      const container = pdfContainerRef.current;
      container.style.display = "block";

      // Wait again after display:block for images
      await new Promise(r => setTimeout(r, 400));

      const pageElements = container.querySelectorAll<HTMLDivElement>('[data-pdf-page]');

      const pdfW = 210; // A4 mm
      const pdfH = 297;
      const margin = 4;
      const contentW = pdfW - margin * 2;

      const pdf = new jsPDF("p", "mm", "a4");

      for (let i = 0; i < pageElements.length; i++) {
        const pageEl = pageElements[i];

        const canvas = await html2canvas(pageEl, {
          scale: 2,
          useCORS: true,
          allowTaint: true,
          logging: false,
          backgroundColor: "#ffffff",
          width: pageEl.scrollWidth,
          windowWidth: pageEl.scrollWidth,
        });

        const imgData = canvas.toDataURL("image/jpeg", 0.92);
        const contentH = (canvas.height * contentW) / canvas.width;

        if (i > 0) pdf.addPage();

        // Center vertically if content is shorter than the page
        const yOffset = contentH < pdfH - margin * 2
          ? margin + (pdfH - margin * 2 - contentH) / 2
          : margin;

        pdf.addImage(imgData, "JPEG", margin, Math.max(margin, yOffset), contentW, contentH);
      }

      container.style.display = "none";
      setPdfPages([]);

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

      {/* ░░░ OFF-SCREEN PDF PAGES (captured by html2canvas) ░░░░░░░ */}
      <div
        ref={pdfContainerRef}
        style={{
          display: "none",
          position: "absolute",
          left: "-9999px",
          top: 0,
        }}
      >
        {pdfPages.map((page, idx) => (
          <div key={idx} data-pdf-page style={{ marginBottom: 20 }}>
            <PdfPage
              bulletin={bulletin}
              featuredArticle={page.featuredArticle}
              pageArticles={page.pageArticles}
              editionLabel={bulletin.bulletin_number}
              isFirstPage={page.isFirstPage}
            />
          </div>
        ))}
      </div>
    </>
  );
};

export default WeeklyBulletin;
