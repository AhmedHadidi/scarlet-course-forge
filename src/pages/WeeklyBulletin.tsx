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
  image_caption: string | null;   // اسم الموظف / تعليق الصورة
  article_type: string;
  pdf_position: string | null;    // global_news | ministry_news | employee_work
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

const PDF_W = 794;
const PDF_H = 1123;

const CommonHeader = ({ titleText, bulletin }: { titleText?: string, bulletin: Bulletin }) => (
  <div style={{ display: 'flex', flexDirection: 'column', marginBottom: '15px', position: 'relative' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
	{/* يمين: شعار وزارة الإعلام */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <OmanEmblemRed />
      </div>

      {/* وسط: شعار ذكاء */}
      <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', top: '-5px' }}>
        <ZakaaLogo />
      </div>
     
      {/* يسار: رقم الإصدار */}
      <div style={{ textAlign: 'center', color: '#333', minWidth: '90px', marginTop: '40px' }}>
         <div style={{ fontSize: '20px', fontWeight: '900', lineHeight: 1, color: '#222' }}>{bulletin.bulletin_number || "—"}</div>
         <div style={{ fontSize: '10px', marginTop: '3px', fontWeight: '600', color: '#666' }}>
           {bulletin.title || "نشرة الذكاء الاصطناعي"}
         </div>
      </div>
    </div>
    
    <div style={{ textAlign: 'center', marginTop: '15px', borderBottom: titleText ? 'none' : '1px solid transparent' }}>
       <div style={{ fontSize: '15px', fontWeight: '800', color: '#444', maxWidth: '600px', margin: '0 auto', lineHeight: 1.4 }}>
         نشرة شهرية من فريق الذكاء الاصطناعي لمتابعة أحدث التطورات في مجال الذكاء الاصطناعي وأخبار الوزارة في هذا المجال
       </div>
    </div>
    
    {titleText && (
      <div style={{ textAlign: 'center', marginTop: '10px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: '900', color: '#555', margin: 0 }}>{titleText}</h2>
      </div>
    )}
  </div>
);


/* شعار ذكاء - يستخدم صورة من مجلد public */
const ZakaaLogo = () => (
  <div style={{ width: '140px', height: '140px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
    <img
      src="/logo-zakaa.png"
      alt="ذكاء"
      style={{ width: '140px', height: '140px', objectFit: 'contain' }}
      crossOrigin="anonymous"
    />
  </div>
);

/* شعار وزارة الإعلام - يستخدم صورة من مجلد public */
const OmanEmblemRed = () => (
  <img
    src="/logo-ministry.png"
    alt="وزارة الإعلام"
    style={{ width: '140px', height: '140px', objectFit: 'contain' }}
    crossOrigin="anonymous"
  />
);

const PdfFooter = ({ pageNum }: { pageNum: number }) => (
  <div style={{ position: 'absolute', bottom: '30px', left: '40px', right: '40px', display: 'flex', justifyContent: 'space-between', color: '#666', fontSize: '11px', borderTop: '1px solid #ddd', paddingTop: '2px' }}>
    <div>{pageNum === 3 ? "ندعو كل من يرغب في عرض أعماله في العدد القادم إلى التواصل معنا عبر ayn.apps@omaninfo.om" : "تم تحرير الأخبار باستخدام تطبيقات الذكاء الاصطناعي"}</div>
    {pageNum === 3 ? (
      <div style={{ textAlign: 'left', direction: 'rtl' }}>الصفحة {pageNum} من 3</div>
    ) : (
      <>
        <div style={{ textAlign: 'left', direction: 'rtl' }}>الصفحة {pageNum} من 3</div>
      </>
    )}
  </div>
);

const PdfFooter3Names = () => (
  <div style={{ marginTop: 'auto', marginBottom: '15px', paddingTop: '10px', display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '15px', borderTop: '1px solid #ccc', color: '#555', fontSize: '10px', textAlign: 'center' }}>
     <div style={{ flex: '1 1 auto', minWidth: '100px' }}>
       <div style={{ fontWeight: 'bold', marginBottom: '2px' }}>المتابعة العامة</div>
       <div>أمل بنت علي المسعودي</div>
     </div>
     <div style={{ flex: '1 1 auto', minWidth: '100px' }}>
       <div style={{ fontWeight: 'bold', marginBottom: '2px' }}>محرر المحتوى الإلكتروني</div>
       <div>معاذ بن يوسف البلوشي</div>
     </div>
     <div style={{ flex: '1 1 auto', minWidth: '100px' }}>
       <div style={{ fontWeight: 'bold', marginBottom: '2px' }}>تصميم الشعار</div>
       <div>أسامة بن سيف الركواني</div>
     </div>
     <div style={{ flex: '1 1 auto', minWidth: '100px' }}>
       <div style={{ fontWeight: 'bold', marginBottom: '2px' }}>مصمم القالب العام</div>
       <div>سارة بنت هلال المخيني</div>
     </div>
     <div style={{ flex: '1 1 auto', minWidth: '100px' }}>
       <div style={{ fontWeight: 'bold', marginBottom: '2px' }}>رئيس التحرير</div>
       <div>أ. أحلام بنت عبدالرب البلوشي</div>
     </div>
     <div style={{ flex: '1 1 auto', minWidth: '100px' }}>
       <div style={{ fontWeight: 'bold', marginBottom: '1px' }}>الإشراف العام</div>
       <div>المديرية العامة للإعلام الإلكتروني</div>
     </div>
  </div>
);

const NewsCard = ({ article, headerColor, headerHeight = 50, imageHeight = 150, titleFontSize = 14, isFeatured = false }: any) => {
  if (!article) {
    return (
      <div style={{ flex: 1, border: `1px solid ${headerColor}`, background: '#fdfdfd', display: 'flex', flexDirection: 'column', height: '100%', minHeight: isFeatured ? 360 : 320 }}>
        <div style={{ background: headerColor, height: headerHeight }} />
      </div>
    );
  }

  const shortDesc = article.short_description || article.full_content?.slice(0, 200) || "";

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', border: '1px solid #e0e0e0', background: 'white', overflow: 'hidden', height: '100%' }}>
      {/* Header */}
      <div style={{
        background: headerColor,
        color: 'white',
        textAlign: 'center',
        padding: "8px 12px",
        fontSize: titleFontSize,
        fontWeight: "bold",
        minHeight: headerHeight,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        {article.title}
      </div>
      {/* Image */}
      {article.image_url && (
        <div style={{ position: 'relative' }}>
          <img src={article.image_url} style={{ width: '100%', height: imageHeight, objectFit: 'cover', display: 'block' }} crossOrigin="anonymous" />
        </div>
      )}
      {/* Content */}
      <div style={{ padding: "10px 12px", fontSize: isFeatured ? '13px' : '11px', color: '#444', textAlign: 'justify', lineHeight: 1.65, flex: 1, overflow: 'hidden' }}>
        <p style={{ margin: 0 }}>
           {shortDesc}
        </p>
      </div>
    </div>
  );
};

const ImageCard = ({ article, authorName }: any) => {
  if (!article) return <div style={{ flex: 1, minHeight: 300, background: '#f9f9f9', border: '1px solid #ddd', borderRadius: 8 }} />;
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px' }}>
       {article.image_url && (
         <img src={article.image_url} style={{ width: '100%', height: '300px', borderRadius: '8px', objectFit: 'cover', display: 'block' }} crossOrigin="anonymous"/>
       )}
       <div style={{ textAlign: 'right', fontWeight: 'bold', fontSize: '15px', color: '#222' }}>{authorName || article.title}</div>
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
  const exportAsPdf = useCallback(async () => {
    if (!bulletin || !pdfContainerRef.current) return;
    setExporting(true);

    try {
      const container = pdfContainerRef.current;
      container.style.display = "block";

      await document.fonts.ready;
      await new Promise(r => setTimeout(r, 1500)); // wait for images and fonts to load

      const pageElements = container.querySelectorAll<HTMLDivElement>('[data-pdf-page]');

      const pdfW = 210; // A4 mm
      const pdfH = 297;
      const pdf = new jsPDF("p", "mm", "a4");

      for (let i = 0; i < pageElements.length; i++) {
        const pageEl = pageElements[i];

        const canvas = await html2canvas(pageEl, {
          scale: 2,
          useCORS: true,
          allowTaint: true,
          logging: false,
          backgroundColor: "#ffffff",
          width: PDF_W,
          height: PDF_H,
          windowWidth: PDF_W,
        });

        const imgData = canvas.toDataURL("image/jpeg", 0.95);

        if (i > 0) pdf.addPage();
        pdf.addImage(imgData, "JPEG", 0, 0, pdfW, pdfH);
      }

      container.style.display = "none";
      pdf.save(`${bulletin?.bulletin_number || "bulletin"}.pdf`);
    } catch (err) {
      console.error("PDF export error:", err);
      if (pdfContainerRef.current) {
        pdfContainerRef.current.style.display = "none";
      }
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
          return {
            ...article,
            article_type: (article as any).article_type || 'standard',
            pdf_position: (article as any).pdf_position || null,
            image_caption: (article as any).image_caption || null,
            categories: articleCategories,
          };
        })
      );

      // في النشرة الـ PDF تظهر جميع الأخبار التابعة للإصدار بغض النظر عن تفضيلات المستخدم
      setArticles(articlesWithCategories);
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

  // ─── تصفية الأخبار حسب صفحة PDF ───
  const globalNewsArticles  = articles.filter(a => a.pdf_position === 'global_news');
  const ministryNewsArticles = articles.filter(a => a.pdf_position === 'ministry_news');
  const employeeWorkArticles = articles.filter(a => a.pdf_position === 'employee_work');

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
          fontFamily: "'Segoe UI', Tahoma, 'Noto Sans Arabic', Arial, sans-serif",
        }}
      >
        {/* Page 1: صفحة الأخبار العالمية */}
        <div data-pdf-page style={{ width: PDF_W, height: PDF_H, background: 'white', position: 'relative', overflow: 'hidden', padding: '40px 45px', boxSizing: 'border-box' }} dir="rtl">
          <CommonHeader bulletin={bulletin} titleText="أخبار عالمية" />
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
            {/* الخبر الرئيسي */}
            <div style={{ height: '380px' }}>
              <NewsCard article={globalNewsArticles[0]} headerColor="#1A67B5" headerHeight={55} imageHeight={180} titleFontSize={20} isFeatured={true} />
            </div>
            {/* أخبار صغيرة */}
            <div style={{ display: 'flex', gap: '15px', height: '340px' }}>
              <NewsCard article={globalNewsArticles[1]} headerColor="#59A6A8" headerHeight={45} imageHeight={130} titleFontSize={13} />
              <NewsCard article={globalNewsArticles[2]} headerColor="#22589D" headerHeight={45} imageHeight={130} titleFontSize={13} />
              <NewsCard article={globalNewsArticles[3]} headerColor="#59A6A8" headerHeight={45} imageHeight={130} titleFontSize={13} />
            </div>
          </div>
          <PdfFooter pageNum={1} />
        </div>

        {/* Page 2: صفحة أخبار الوزارة */}
        <div data-pdf-page style={{ width: PDF_W, height: PDF_H, background: 'white', position: 'relative', overflow: 'hidden', padding: '40px 45px', boxSizing: 'border-box' }} dir="rtl">
          <CommonHeader bulletin={bulletin} titleText="أخبار الوزارة" />
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
            {/* صف علوي */}
            <div style={{ display: 'flex', gap: '20px', height: '360px' }}>
              <NewsCard article={ministryNewsArticles[0]} headerColor="#1A67B5" headerHeight={50} imageHeight={160} titleFontSize={14} />
              <NewsCard article={ministryNewsArticles[1]} headerColor="#1A67B5" headerHeight={50} imageHeight={160} titleFontSize={14} />
            </div>
            {/* صف سفلي */}
            <div style={{ display: 'flex', gap: '15px', height: '360px' }}>
              <NewsCard article={ministryNewsArticles[2]} headerColor="#59A6A8" headerHeight={50} imageHeight={140} titleFontSize={14} />
              <NewsCard article={ministryNewsArticles[3]} headerColor="#22589D" headerHeight={50} imageHeight={140} titleFontSize={14} />
              <NewsCard article={ministryNewsArticles[4]} headerColor="#59A6A8" headerHeight={50} imageHeight={140} titleFontSize={14} />
            </div>
          </div>
          <PdfFooter pageNum={2} />
        </div>

        {/* Page 3: صفحة نماذج من أعمال الموظفين */}
        <div data-pdf-page style={{ width: PDF_W, height: PDF_H, background: 'white', position: 'relative', overflow: 'hidden', padding: '40px 45px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column' }} dir="rtl">
          <CommonHeader bulletin={bulletin} titleText="نماذج من أعمال توليد الصور لموظفي الوزارة" />
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '10px' }}>
            {/* يستخدم image_caption كاسم الموظف */}
            <ImageCard article={employeeWorkArticles[0]} authorName={employeeWorkArticles[0]?.image_caption || employeeWorkArticles[0]?.title} />
            <ImageCard article={employeeWorkArticles[1]} authorName={employeeWorkArticles[1]?.image_caption || employeeWorkArticles[1]?.title} />
            <ImageCard article={employeeWorkArticles[2]} authorName={employeeWorkArticles[2]?.image_caption || employeeWorkArticles[2]?.title} />
            <ImageCard article={employeeWorkArticles[3]} authorName={employeeWorkArticles[3]?.image_caption || employeeWorkArticles[3]?.title} />
          </div>

          <PdfFooter3Names />
          <PdfFooter pageNum={3} />
        </div>
      </div>
    </>
  );
};

export default WeeklyBulletin;
