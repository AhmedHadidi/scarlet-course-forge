import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Calendar, Newspaper, ArrowRight, Settings } from "lucide-react";
import { format } from "date-fns";
import UserNav from "@/components/UserNav";

interface Category {
  id: string;
  name: string;
}

interface Article {
  id: string;
  title: string;
  short_description: string;
  image_url: string | null;
  categories: Category[];
}

interface Bulletin {
  id: string;
  bulletin_number: string;
  title: string;
  description: string | null;
  week_start_date: string;
  published_at: string | null;
  articles: Article[];
}

const Bulletins = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [bulletins, setBulletins] = useState<Bulletin[]>([]);
  const [userPreferences, setUserPreferences] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.id) {
      fetchUserPreferencesAndBulletins();
    }
  }, [user?.id]);

  const fetchUserPreferencesAndBulletins = async () => {
    if (!user?.id) return;
    
    try {
      // Fetch user's category preferences
      const { data: prefsData, error: prefsError } = await supabase
        .from("user_category_preferences")
        .select("category_id")
        .eq("user_id", user.id);

      if (prefsError) {
        console.error("Error fetching preferences:", prefsError);
      }
      
      console.log("User preferences:", prefsData);

      const preferredCategoryIds = (prefsData || []).map((p) => p.category_id);
      setUserPreferences(preferredCategoryIds);

      // Fetch all published bulletins
      const { data: bulletinsData, error } = await supabase
        .from("news_bulletins")
        .select("*")
        .eq("is_published", true)
        .order("week_start_date", { ascending: false });

      if (error) throw error;

      // Fetch articles with categories for each bulletin
      const bulletinsWithArticles = await Promise.all(
        (bulletinsData || []).map(async (bulletin) => {
          const { data: articlesData } = await supabase
            .from("news_articles")
            .select("id, title, short_description, image_url")
            .eq("bulletin_id", bulletin.id)
            .eq("is_published", true);

          // Get categories for each article
          const articlesWithCategories = await Promise.all(
            (articlesData || []).map(async (article) => {
              const { data: catData } = await supabase
                .from("news_article_categories")
                .select("category_id, news_categories(id, name)")
                .eq("article_id", article.id);

              console.log("Raw category data for article", article.id, ":", catData);
              
              const categories = (catData || []).map((c: any) => ({
                id: c.category_id,
                name: c.news_categories?.name || "Unknown",
              }));

              return { ...article, categories };
            })
          );

          // Filter articles based on user preferences (if user has preferences)
          console.log("Preferred category IDs:", preferredCategoryIds);
          console.log("Articles with categories:", articlesWithCategories);
          
          const filteredArticles = preferredCategoryIds.length > 0
            ? articlesWithCategories.filter((article) =>
                article.categories.some((cat) => preferredCategoryIds.includes(cat.id))
              )
            : articlesWithCategories;

          console.log("Filtered articles:", filteredArticles);
          return { ...bulletin, articles: filteredArticles };
        })
      );

      // Only show bulletins that have matching articles
      const filteredBulletins = bulletinsWithArticles.filter(
        (b) => b.articles.length > 0
      );

      console.log("Final bulletins with articles:", filteredBulletins);
      console.log("Setting bulletins state with", filteredBulletins.length, "bulletins");
      setBulletins(filteredBulletins);
    } catch (error) {
      console.error("Error fetching bulletins:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <UserNav />

      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-10 w-10 rounded-lg gradient-crimson flex items-center justify-center">
              <Newspaper className="h-5 w-5 text-white" />
            </div>
            <h2 className="text-3xl font-bold">Weekly AI Bulletins</h2>
          </div>
          <div className="flex items-center gap-2">
            <p className="text-muted-foreground">
              {userPreferences.length > 0
                ? "Showing news based on your preferences"
                : "Set your preferences in your profile to see personalized news"}
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/profile")}
              className="text-primary"
            >
              <Settings className="h-4 w-4 mr-1" />
              Preferences
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : userPreferences.length === 0 ? (
          <div className="text-center py-12">
            <Settings className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Set Your Preferences</h3>
            <p className="text-muted-foreground mb-4">
              To see personalized AI news, please set your category preferences.
            </p>
            <Button onClick={() => navigate("/profile")}>
              Go to Profile Settings
            </Button>
          </div>
        ) : bulletins.length === 0 ? (
          <div className="text-center py-12">
            <Newspaper className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              No news matching your preferences yet.
            </p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {bulletins.map((bulletin) => (
              <Card
                key={bulletin.id}
                className="border-border/50 transition-smooth hover:shadow-crimson cursor-pointer group"
                onClick={() => navigate(`/bulletin/${bulletin.id}`)}
              >
                <CardHeader>
                  <div className="flex items-center justify-between mb-2">
                    <Badge variant="outline">{bulletin.bulletin_number}</Badge>
                    <span className="text-sm text-muted-foreground">
                      {bulletin.articles.length} articles
                    </span>
                  </div>
                  <CardTitle className="text-lg group-hover:text-primary transition-colors">
                    {bulletin.title}
                  </CardTitle>
                  {bulletin.description && (
                    <CardDescription className="line-clamp-2">
                      {bulletin.description}
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      <span>
                        {format(new Date(bulletin.week_start_date), "MMM d, yyyy")}
                      </span>
                    </div>
                    <Button variant="ghost" size="sm" className="group-hover:text-primary">
                      Read
                      <ArrowRight className="ml-1 h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Bulletins;
