-- Create news_categories table
CREATE TABLE public.news_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create news_bulletins table (weekly bulletin IDs)
CREATE TABLE public.news_bulletins (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bulletin_number TEXT NOT NULL UNIQUE, -- نشرة الذكاء الاصطناعي ID
  title TEXT NOT NULL,
  description TEXT,
  week_start_date DATE NOT NULL,
  is_published BOOLEAN NOT NULL DEFAULT false,
  published_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create news_articles table
CREATE TABLE public.news_articles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bulletin_id UUID REFERENCES public.news_bulletins(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  short_description TEXT NOT NULL,
  full_content TEXT NOT NULL,
  image_url TEXT,
  is_published BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Junction table for news articles and categories (many-to-many)
CREATE TABLE public.news_article_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  article_id UUID NOT NULL REFERENCES public.news_articles(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.news_categories(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(article_id, category_id)
);

-- User category preferences table
CREATE TABLE public.user_category_preferences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.news_categories(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, category_id)
);

-- Enable RLS on all tables
ALTER TABLE public.news_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.news_bulletins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.news_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.news_article_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_category_preferences ENABLE ROW LEVEL SECURITY;

-- RLS Policies for news_categories
CREATE POLICY "Anyone can view categories" ON public.news_categories
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage categories" ON public.news_categories
  FOR ALL USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for news_bulletins
CREATE POLICY "Authenticated users can view published bulletins" ON public.news_bulletins
  FOR SELECT USING (auth.uid() IS NOT NULL AND (is_published = true OR has_role(auth.uid(), 'admin')));

CREATE POLICY "Admins can manage bulletins" ON public.news_bulletins
  FOR ALL USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for news_articles
CREATE POLICY "Authenticated users can view published articles" ON public.news_articles
  FOR SELECT USING (auth.uid() IS NOT NULL AND (is_published = true OR has_role(auth.uid(), 'admin')));

CREATE POLICY "Admins can manage articles" ON public.news_articles
  FOR ALL USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for news_article_categories
CREATE POLICY "Anyone can view article categories" ON public.news_article_categories
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage article categories" ON public.news_article_categories
  FOR ALL USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for user_category_preferences
CREATE POLICY "Users can view their own preferences" ON public.user_category_preferences
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own preferences" ON public.user_category_preferences
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all preferences" ON public.user_category_preferences
  FOR SELECT USING (has_role(auth.uid(), 'admin'));

-- Add triggers for updated_at
CREATE TRIGGER update_news_categories_updated_at
  BEFORE UPDATE ON public.news_categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_news_bulletins_updated_at
  BEFORE UPDATE ON public.news_bulletins
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_news_articles_updated_at
  BEFORE UPDATE ON public.news_articles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for news images
INSERT INTO storage.buckets (id, name, public) VALUES ('news-images', 'news-images', true);

-- Storage policies for news images
CREATE POLICY "Anyone can view news images" ON storage.objects
  FOR SELECT USING (bucket_id = 'news-images');

CREATE POLICY "Admins can upload news images" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'news-images' AND has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update news images" ON storage.objects
  FOR UPDATE USING (bucket_id = 'news-images' AND has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete news images" ON storage.objects
  FOR DELETE USING (bucket_id = 'news-images' AND has_role(auth.uid(), 'admin'));