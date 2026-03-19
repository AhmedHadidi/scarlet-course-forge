-- إضافة الأعمدة الجديدة لجدول news_articles
-- تشغيل هذا في Supabase SQL Editor

ALTER TABLE news_articles
  ADD COLUMN IF NOT EXISTS article_type TEXT NOT NULL DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS pdf_position TEXT,
  ADD COLUMN IF NOT EXISTS image_caption TEXT;

-- تحديث قيم القديمة
UPDATE news_articles SET article_type = 'standard' WHERE article_type IS NULL;
