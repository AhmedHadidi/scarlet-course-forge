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

const CARDS_FIRST_PAGE = 3;
const CARDS_PER_PAGE = 6;

/* ── Oman MOI Emblem SVG (khanjar + swords) ── */
const OmanEmblem = () => (
  <svg width="48" height="56" viewBox="0 0 100 120" fill="white" xmlns="http://www.w3.org/2000/svg">
    {/* Simplified Omani national emblem: khanjar (dagger) with crossed swords */}
    {/* Khanjar handle */}
    <ellipse cx="50" cy="18" rx="12" ry="8" fill="none" stroke="white" strokeWidth="2.5" />
    <path d="M50 26 L50 60" stroke="white" strokeWidth="3" strokeLinecap="round" />
    {/* Khanjar blade curve */}
    <path d="M50 60 Q42 75 38 90" stroke="white" strokeWidth="2.5" fill="none" strokeLinecap="round" />
    <path d="M50 60 Q52 75 50 85" stroke="white" strokeWidth="1.5" fill="none" opacity="0.5" />
    {/* Khanjar sheath */}
    <path d="M44 28 L56 28 L54 55 L46 55 Z" fill="none" stroke="white" strokeWidth="1.5" />
    {/* Left sword */}
    <line x1="20" y1="95" x2="50" y2="25" stroke="white" strokeWidth="2" />
    <line x1="15" y1="100" x2="25" y2="90" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
    {/* Right sword */}
    <line x1="80" y1="95" x2="50" y2="25" stroke="white" strokeWidth="2" />
    <line x1="85" y1="100" x2="75" y2="90" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
    {/* Belt / horizontal band */}
    <path d="M30 70 Q50 65 70 70" stroke="white" strokeWidth="2" fill="none" />
    <path d="M30 74 Q50 69 70 74" stroke="white" strokeWidth="1.5" fill="none" />
  </svg>
);

/* ═══════════════════════════════════════════════════════════════════
   PdfPage — one page of the newsletter (rendered off-screen)
   ═══════════════════════════════════════════════════════════════════ */
interface PdfPageProps {
  bulletin: Bulletin;
  featuredArticle: Article | null;
  pageArticles: Article[];
  editionLabel: string;
  isFirstPage: boolean;
}

const PdfPage: React.FC<PdfPageProps> = ({
  bulletin,
  featuredArticle,
  pageArticles,
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
      {/* ══ HEADER ═══════════════════════════════════════════════════ */}
      <div
        style={{
          background: `linear-gradient(160deg, ${TEAL} 0%, ${TEAL_DARK} 50%, ${TEAL_DARKER} 100%)`,
          padding: "24px 36px 22px",
          color: "#fff",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Decorative shapes */}
        <div style={{ position: "absolute", top: -40, left: -40, width: 180, height: 180, borderRadius: "50%", background: "rgba(255,255,255,0.05)" }} />
        <div style={{ position: "absolute", bottom: -30, right: 80, width: 120, height: 120, borderRadius: "50%", background: "rgba(255,255,255,0.04)" }} />

        {/* Top row: edition label (left) — ministry emblem + name (right) */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", position: "relative", zIndex: 1, marginBottom: 12 }}>
          {/* Right side: emblem + ministry name */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <OmanEmblem />
            <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: 0.5, lineHeight: 1.3 }}>
              وزارة الإعلام
            </div>
          </div>
          {/* Left side: edition badge */}
          <div style={{
            background: "rgba(0,0,0,0.2)",
            borderRadius: 10,
            padding: "10px 20px",
            fontSize: 16,
            fontWeight: 800,
            lineHeight: 1.3,
            textAlign: "center",
          }}>
            <div style={{ fontSize: 13, fontWeight: 600, opacity: 0.9 }}>الإصدار</div>
            <div>{editionLabel}</div>
          </div>
        </div>

        {/* Center branding: ذكاء+ */}
        <div style={{ textAlign: "center", position: "relative", zIndex: 1, margin: "8px 0 6px" }}>
          <div style={{ fontSize: 52, fontWeight: 900, lineHeight: 1.0, marginBottom: 6, letterSpacing: 2 }}>
            ذكاء<span style={{ fontSize: 32, verticalAlign: "super", marginRight: 2, color: "#A7F3D0" }}>+</span>
          </div>
          <div style={{ fontSize: 12.5, opacity: 0.9, maxWidth: 520, margin: "0 auto", lineHeight: 1.7 }}>
            نشرة أسبوعية من فريق الذكاء الاصطناعي لمتابعة أحدث التطورات في مجال الذكاء الاصطناعي
            <br />وإنجازات الوزارة في هذا المجال
          </div>
        </div>
      </div>

      {/* ══ FEATURED ARTICLE (page 1 only) ════════════════════════════ */}
      {isFirstPage && featuredArticle && (
        <div style={{ padding: "0" }}>
          {/* Title banner */}
          <div
            style={{
              background: TEAL,
              color: "#fff",
              textAlign: "center",
              padding: "14px 32px",
              fontSize: 19,
              fontWeight: 800,
              lineHeight: 1.5,
            }}
          >
            {featuredArticle.title}
          </div>

          {/* Featured image */}
          {featuredArticle.image_url && (
            <div style={{ overflow: "hidden" }}>
              <img
                src={featuredArticle.image_url}
                alt=""
                crossOrigin="anonymous"
                style={{ width: "100%", height: 300, objectFit: "cover", display: "block" }}
              />
            </div>
          )}

          {/* Description text */}
          <p
            style={{
              fontSize: 13,
              color: "#444",
              lineHeight: 1.9,
              margin: "0",
              padding: "14px 36px 6px",
              textAlign: "center",
            }}
          >
            {featuredArticle.short_description || featuredArticle.full_content?.slice(0, 250)}
          </p>
        </div>
      )}

      {/* ══ ARTICLE CARDS GRID ══════════════════════════════════════ */}
      {pageArticles.length > 0 && (
        <div
          style={{
            display: "flex",
            gap: 14,
            padding: "16px 24px 20px",
            flexWrap: "wrap",
            justifyContent: "center",
          }}
        >
          {pageArticles.map((article) => {
            const colW = pageArticles.length <= 2
              ? (pageArticles.length === 1 ? "100%" : "48%")
              : "31%";
            return (
              <div
                key={article.id}
                style={{
                  width: colW,
                  background: "#F0FDFA",
                  borderRadius: 14,
                  overflow: "hidden",
                  border: "1px solid #CCF0EB",
                  boxSizing: "border-box",
                }}
              >
                {/* Card title bar */}
                <div style={{
                  background: TEAL_DARKER,
                  color: "#fff",
                  textAlign: "center",
                  padding: "10px 12px",
                  fontSize: 13,
                  fontWeight: 800,
                  lineHeight: 1.5,
                  minHeight: 46,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}>
                  {article.title}
                </div>
                {/* Card image — uses the article's image */}
                {article.image_url && (
                  <img
                    src={article.image_url}
                    alt=""
                    crossOrigin="anonymous"
                    style={{ width: "100%", height: 140, objectFit: "cover", display: "block" }}
                  />
                )}
                {/* Card description */}
                <div style={{ padding: "10px 14px 14px" }}>
                  <p
                    style={{
                      fontSize: 11,
                      color: "#444",
                      lineHeight: 1.8,
                      margin: 0,
                      display: "-webkit-box",
                      WebkitLineClamp: 5,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    }}
                  >
                    {article.short_description || article.full_content?.slice(0, 150)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ══ FOOTER ════════════════════════════════════════════════════ */}
      <div
        style={{
          borderTop: "2px solid #E0F2F1",
          padding: "10px 32px",
          textAlign: "center",
          fontSize: 10,
          color: "#999",
          background: "#F0FDFA",
        }}
      >
        <span style={{ fontWeight: 600, color: "#666" }}>Thakaa+ Training Platform</span>
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
      // ── Build page data ────────────────────────────────────────
      const featured = articles[0];
      const rest = articles.slice(1);
      const pages: typeof pdfPages = [];

      // Page 1: featured article + first N cards
      const firstPageCards = rest.slice(0, CARDS_FIRST_PAGE);
      pages.push({ featuredArticle: featured, pageArticles: firstPageCards, isFirstPage: true });

      // Remaining pages
      let offset = CARDS_FIRST_PAGE;
      while (offset < rest.length) {
        pages.push({
          featuredArticle: null,
          pageArticles: rest.slice(offset, offset + CARDS_PER_PAGE),
          isFirstPage: false,
        });
        offset += CARDS_PER_PAGE;
      }

      // Trigger React render of PdfPage components
      setPdfPages(pages);

      // Wait for render + images
      await document.fonts.ready;
      await new Promise(r => setTimeout(r, 800));

      const container = pdfContainerRef.current;
      container.style.display = "block";

      await new Promise(r => setTimeout(r, 500));

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
