-- إضافة عمود sort_order لترتيب الأخبار يدوياً
ALTER TABLE news_articles
  ADD COLUMN IF NOT EXISTS sort_order INTEGER;

-- تعيين قيم افتراضية بناءً على تاريخ الإنشاء (الأحدث يحصل على أصغر رقم)
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at DESC) AS rn
  FROM news_articles
)
UPDATE news_articles
SET sort_order = ranked.rn
FROM ranked
WHERE news_articles.id = ranked.id;
