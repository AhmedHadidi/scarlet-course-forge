import React from "react";
import {
  Document,
  Page,
  View,
  Text,
  Image,
  Font,
  StyleSheet,
} from "@react-pdf/renderer";

/* ─── تسجيل خط Sakkal Majalla ───────────────────────────────── */
Font.register({
  family: "Sakkal Majalla",
  src: `${window.location.origin}/fonts/majalla.ttf`,
});

/* ─── أنواع البيانات ────────────────────────────────────────── */
interface Article {
  id: string;
  title: string;
  short_description: string;
  full_content: string;
  image_url: string | null;
  image_caption: string | null;
  article_type: string;
  pdf_position: string | null;
  categories: { id: string; name: string }[];
}
interface Bulletin {
  id: string;
  bulletin_number: string;
  title: string;
  description: string | null;
  week_start_date: string;
}

const C_BLUE = "#1A67B5";
const C_TEAL = "#59A6A8";
const C_NAVY = "#22589D";

const s = StyleSheet.create({
  page: {
    fontFamily: "Sakkal Majalla",
    backgroundColor: "#ffffff",
    paddingTop: 14,
    paddingBottom: 18,
    paddingHorizontal: 22,
    flexDirection: "column",
  },

  /* ══ Header ══ */
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  /* يسار: رقم الإصدار */
  issueBox: { alignItems: "flex-start", minWidth: 80 },
  issueNum: { fontSize: 17, fontWeight: "bold", color: "#111", textAlign: "left" },
  issueSub: { fontSize: 11, color: "#555", textAlign: "left", marginTop: 1 },
  /* وسط: شعار ذكاء */
  centerBox: { flex: 1, alignItems: "center" },
  zakaaLogo: { width: 100, height: 100, objectFit: "contain" },
  /* يمين: وزارة الإعلام */
  ministryBox: { alignItems: "flex-end", minWidth: 80 },
  ministryLogo: { width: 75, height: 75, objectFit: "contain" },

  subtitle: {
    fontSize: 12,
    color: "#333",
    textAlign: "center",
    marginBottom: 4,
    lineHeight: 1.4,
  },
  pageTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#222",
    textAlign: "center",
    marginBottom: 4,
  },
  titleUnderline: { borderBottomWidth: 2, borderBottomColor: "#bbb", marginBottom: 8, marginHorizontal: 60 },

  /* ══ News Card ══ */
  card: {
    flex: 1,
    flexDirection: "column",
    borderWidth: 1,
    borderColor: "#ddd",
    overflow: "hidden",
  },
  cardHeader: {
    paddingVertical: 5,
    paddingHorizontal: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  cardHeaderTxt: { color: "#fff", fontWeight: "bold", textAlign: "center" },
  cardImg: { width: "100%", objectFit: "cover" },
  cardBody: { padding: 6, fontSize: 10, color: "#444", lineHeight: 1.5, textAlign: "right", flex: 1 },

  /* ══ Image Card (p3) ══ */
  imgCard: { flexDirection: "column" },
  imgCardImg: { width: "100%", objectFit: "cover", borderRadius: 4 },
  imgCardName: { fontSize: 13, fontWeight: "bold", color: "#222", textAlign: "right", marginTop: 3 },

  /* ══ Footer ══ */
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "#ccc",
    paddingTop: 4,
    marginTop: 6,
    fontSize: 8,
    color: "#666",
  },
  footer3Box: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 6,
    padding: 7,
    marginTop: 8,
    marginBottom: 3,
  },
  footer3Item: { flex: 1, minWidth: 70, alignItems: "center", paddingHorizontal: 3 },
  footer3Label: { fontSize: 8, fontWeight: "bold", color: "#333", textAlign: "center", marginBottom: 2 },
  footer3Val: { fontSize: 8, color: "#555", textAlign: "center" },
});

/* ─── مشترك: Header ─────────────────────────────────────────── */
const PdfHeader = ({ bulletin, titleText }: { bulletin: Bulletin; titleText: string }) => (
  <View>
    <View style={s.headerRow}>
      {/* يسار: رقم الإصدار */}
      <View style={s.issueBox}>
        <Text style={s.issueNum}>{bulletin.bulletin_number || "—"}</Text>
        <Text style={s.issueSub}>{bulletin.title || ""}</Text>
      </View>
      {/* وسط: شعار ذكاء */}
      <View style={s.centerBox}>
        <Image src={`${window.location.origin}/logo-zakaa.png`} style={s.zakaaLogo} />
      </View>
      {/* يمين: شعار وزارة الإعلام */}
      <View style={s.ministryBox}>
        <Image src={`${window.location.origin}/logo-ministry.png`} style={s.ministryLogo} />
      </View>
    </View>

    <Text style={s.subtitle}>
      نشرة شهرية من فريق الذكاء الاصطناعي لمتابعة أحدث التطورات في مجال الذكاء الاصطناعي وأخبار الوزارة في هذا المجال
    </Text>
    <Text style={s.pageTitle}>{titleText}</Text>
    <View style={s.titleUnderline} />
  </View>
);

/* ─── بطاقة خبر ─────────────────────────────────────────────── */
const NewsCard = ({
  article,
  color,
  hdrH = 30,
  imgH = 110,
  fs = 11,
}: {
  article?: Article;
  color: string;
  hdrH?: number;
  imgH?: number;
  fs?: number;
}) => {
  if (!article) return (
    <View style={[s.card, { borderColor: color }]}>
      <View style={[s.cardHeader, { backgroundColor: color, height: hdrH }]} />
    </View>
  );
  const desc = article.short_description || article.full_content?.slice(0, 280) || "";
  return (
    <View style={[s.card, { borderColor: color }]}>
      <View style={[s.cardHeader, { backgroundColor: color, minHeight: hdrH }]}>
        <Text style={[s.cardHeaderTxt, { fontSize: fs }]}>{article.title}</Text>
      </View>
      {article.image_url
        ? <Image src={article.image_url} style={[s.cardImg, { height: imgH }]} />
        : <View style={{ height: imgH, backgroundColor: "#f5f5f5" }} />}
      <Text style={s.cardBody}>{desc}</Text>
    </View>
  );
};

/* ─── بطاقة صورة موظف ───────────────────────────────────────── */
const ImgCard = ({ article, name }: { article?: Article; name: string }) => (
  <View style={s.imgCard}>
    {article?.image_url
      ? <Image src={article.image_url} style={[s.imgCardImg, { height: 240 }]} />
      : <View style={{ height: 240, backgroundColor: "#eee", borderRadius: 4 }} />}
    <Text style={s.imgCardName}>{name}</Text>
  </View>
);

/* ─── Footer سفلي ───────────────────────────────────────────── */
const PageFooter = ({ pageNum }: { pageNum: number }) => (
  <View style={s.footer}>
    <Text>
      {pageNum === 3
        ? "ندعو كل من يرغب في عرض أعماله في العدد القادم إلى التواصل معنا عبر ayn.apps@omaninfo.om"
        : "تم تحرير الأخبار باستخدام تطبيقات الذكاء الاصطناعي"}
    </Text>
    <Text>الصفحة {pageNum} من 3</Text>
  </View>
);

/* ─── Footer الأسماء ────────────────────────────────────────── */
const namesData = [
  { label: "الإشراف العام",             value: "المديرية العامة للإعلام الإلكتروني" },
  { label: "رئيس التحرير",              value: "أ. أحلام بنت عبدالرب البلوشي" },
  { label: "مصمم القالب العام",          value: "سارة بنت هلال المخيني" },
  { label: "تصميم الشعار",              value: "أسامة بن سيف الركواني" },
  { label: "محرر المحتوى الإلكتروني",   value: "معاذ بن يوسف البلوشي" },
  { label: "المتابعة العامة",            value: "أمل بنت علي المسعودي" },
];
const Footer3Names = () => (
  <View style={s.footer3Box}>
    {namesData.map((n) => (
      <View key={n.label} style={s.footer3Item}>
        <Text style={s.footer3Label}>{n.label}</Text>
        <Text style={s.footer3Val}>{n.value}</Text>
      </View>
    ))}
  </View>
);

/* ═══════════════════════════════════════════════════════════════
   المستند الكامل
   ═══════════════════════════════════════════════════════════════ */
const WeeklyBulletinPdfDoc = ({
  bulletin,
  articles,
}: {
  bulletin: Bulletin;
  articles: Article[];
}) => {
  const global   = articles.filter((a) => a.pdf_position === "global_news");
  const ministry = articles.filter((a) => a.pdf_position === "ministry_news");
  const employee = articles.filter((a) => a.pdf_position === "employee_work");

  return (
    <Document>

      {/* ════════ صفحة 1: الأخبار العالمية ════════ */}
      <Page size="A4" style={s.page}>
        <PdfHeader bulletin={bulletin} titleText="أخبار عالمية" />

        {/* الخبر الرئيسي */}
        <View style={{ height: 265, marginBottom: 7 }}>
          <NewsCard article={global[0]} color={C_BLUE} hdrH={40} imgH={150} fs={16} />
        </View>

        {/* 3 أخبار صغيرة */}
        <View style={{ flexDirection: "row", gap: 8, flex: 1 }}>
          <NewsCard article={global[1]} color={C_TEAL} hdrH={28} imgH={100} fs={10} />
          <NewsCard article={global[2]} color={C_NAVY} hdrH={28} imgH={100} fs={10} />
          <NewsCard article={global[3]} color={C_TEAL} hdrH={28} imgH={100} fs={10} />
        </View>

        <PageFooter pageNum={1} />
      </Page>

      {/* ════════ صفحة 2: أخبار الوزارة ════════ */}
      <Page size="A4" style={s.page}>
        <PdfHeader bulletin={bulletin} titleText="نماذج من الجهود التي قامت بها المديريات في توظيف تقنيات الذكاء الاصطناعي" />

        {/* صف علوي: 2 كبار */}
        <View style={{ flexDirection: "row", gap: 12, height: 255, marginBottom: 7 }}>
          <NewsCard article={ministry[0]} color={C_BLUE} hdrH={36} imgH={130} fs={12} />
          <NewsCard article={ministry[1]} color={C_BLUE} hdrH={36} imgH={130} fs={12} />
        </View>

        {/* صف سفلي: 3 صغار */}
        <View style={{ flexDirection: "row", gap: 8, flex: 1 }}>
          <NewsCard article={ministry[2]} color={C_TEAL} hdrH={28} imgH={105} fs={10} />
          <NewsCard article={ministry[3]} color={C_NAVY} hdrH={28} imgH={105} fs={10} />
          <NewsCard article={ministry[4]} color={C_TEAL} hdrH={28} imgH={105} fs={10} />
        </View>

        <PageFooter pageNum={2} />
      </Page>

      {/* ════════ صفحة 3: أعمال الموظفين ════════ */}
      <Page size="A4" style={s.page}>
        <PdfHeader bulletin={bulletin} titleText="نماذج من أعمال توليد الصور لموظفي الوزارة" />

        {/* شبكة 2×2 */}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12, flex: 1 }}>
          {[0, 1, 2, 3].map((i) => (
            <View key={i} style={{ width: "48%", marginBottom: 4 }}>
              <ImgCard
                article={employee[i]}
                name={employee[i]?.image_caption || employee[i]?.title || ""}
              />
            </View>
          ))}
        </View>

        <Footer3Names />
        <PageFooter pageNum={3} />
      </Page>

    </Document>
  );
};

export default WeeklyBulletinPdfDoc;
