-- إضافة عمود source_url لرابط الخبر الأصلي (يُحوَّل إلى QR Code في PDF)
ALTER TABLE news_articles
  ADD COLUMN IF NOT EXISTS source_url TEXT;
