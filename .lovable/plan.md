
# نظام توثيق الابتكارات والمبادرات (Innovations Tracker)

## الفكرة
يستطيع كل موظف توثيق مبادرة قام بتنفيذها داخل المؤسسة (توفير وقت / تحسين أداء / أتمتة / رفع جودة)، ويستطيع الـ Admin والـ Sub-Admin تتبع ابتكارات قسمه ومراجعة التقدم.

---

## 1. قاعدة البيانات

### جدول `innovations`
الحقول المطلوبة للتوثيق:

| الحقل | النوع | الوصف |
|---|---|---|
| `title` | text | عنوان المبادرة |
| `description` | text | وصف تفصيلي للمشكلة والحل |
| `category` | enum | نوع المبادرة: `time_saving` / `performance` / `automation` / `quality` |
| `status` | enum | `idea` / `in_progress` / `implemented` / `evaluated` |
| `progress_percentage` | int (0-100) | نسبة الإنجاز |
| `impact_description` | text | الأثر المحقق |
| `time_saved_hours` | numeric | الوقت الموفر (ساعات/أسبوع) — اختياري |
| `cost_saved` | numeric | التكلفة الموفرة — اختياري |
| `tools_used` | text[] | الأدوات/التقنيات المستخدمة |
| `start_date` / `completion_date` | date | تواريخ التنفيذ |
| `attachments_urls` | text[] | روابط مرفقات (اختياري) |
| `department_id` | uuid | يُملأ تلقائياً من قسم المستخدم |
| `user_id` | uuid | صاحب المبادرة |
| `admin_notes` | text | ملاحظات الأدمن (مرئية للأدمن فقط للكتابة) |

### الـ RLS Policies
- **المستخدم**: يقرأ/يضيف/يعدل/يحذف مبادراته فقط
- **Sub-Admin**: يقرأ كل مبادرات قسمه (عبر `is_department_admin`) ويعدل `admin_notes`
- **Admin**: يقرأ ويعدل الكل
- تفعيل GRANTs لـ `authenticated` و `service_role`

---

## 2. واجهة المستخدم (Profile Page)

إضافة تبويب/قسم جديد في `src/pages/Profile.tsx` بعنوان **"ابتكاراتي ومبادراتي"**:
- زر **"إضافة مبادرة جديدة"** يفتح Dialog بنموذج كامل
- قائمة بمبادراته مع: العنوان، الفئة، شريط التقدم، الحالة، تاريخ
- زرّا تعديل/حذف لكل مبادرة
- Badge ملوّن للفئة (توفير وقت / أتمتة / جودة / أداء)

مكوّن جديد: `src/components/innovations/InnovationsList.tsx` + `InnovationDialog.tsx`

---

## 3. لوحة Admin / Sub-Admin

### Sub-Admin (في `SubAdminDashboard.tsx`)
تبويب جديد **"ابتكارات القسم"**:
- جدول بكل مبادرات الموظفين في قسمه
- فلترة حسب: الفئة، الحالة، الموظف
- إحصائيات سريعة (KPI Cards):
  - عدد المبادرات الإجمالي
  - عدد المنفّذة
  - مجموع الساعات الموفرة
  - متوسط نسبة التقدم
- النقر على صف يفتح تفاصيل + إمكانية إضافة `admin_notes`

### Admin (في `AdminDashboard.tsx`)
نفس الواجهة لكن **لكل الأقسام**، مع فلتر إضافي حسب القسم + Chart (Bar) لمقارنة الأقسام.

مكوّن مشترك: `src/components/innovations/InnovationsTracker.tsx` يقبل prop `scope: 'department' | 'all'`.

---

## التفاصيل التقنية

- استخدام **Zod** للتحقق من المدخلات (عنوان 3-200 حرف، وصف ≥ 20 حرف)
- النصوص العربية مع `dir="rtl"` و `unicode-bidi: plaintext`
- Recharts للرسوم البيانية في لوحة الأدمن
- لا حاجة لـ Edge Functions — كل العمليات عبر Supabase client + RLS

---

## ملفات سيتم إنشاؤها/تعديلها

**جديد:**
- migration: جدول `innovations` + enums + policies
- `src/components/innovations/InnovationsList.tsx`
- `src/components/innovations/InnovationDialog.tsx`
- `src/components/innovations/InnovationsTracker.tsx`
- `src/components/innovations/InnovationCard.tsx`

**تعديل:**
- `src/pages/Profile.tsx` — إضافة قسم الابتكارات
- `src/pages/AdminDashboard.tsx` — تبويب التتبع
- `src/pages/SubAdminDashboard.tsx` — تبويب التتبع

هل أبدأ التنفيذ؟
