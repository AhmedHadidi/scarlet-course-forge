import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Calendar, Newspaper, ArrowRight } from "lucide-react";
import { format } from "date-fns";
import UserNav from "@/components/UserNav";

interface Bulletin {
  id: string;
  bulletin_number: string;
  title: string;
  description: string | null;
  week_start_date: string;
  published_at: string | null;
  article_count?: number;
}

const Bulletins = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [bulletins, setBulletins] = useState<Bulletin[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchBulletins();
    }
  }, [user]);

  const fetchBulletins = async () => {
    try {
      const { data: bulletinsData, error } = await supabase
        .from("news_bulletins")
        .select("*")
        .eq("is_published", true)
        .order("week_start_date", { ascending: false });

      if (error) throw error;

      // Get article counts for each bulletin
      const bulletinsWithCounts = await Promise.all(
        (bulletinsData || []).map(async (bulletin) => {
          const { count } = await supabase
            .from("news_articles")
            .select("*", { count: "exact", head: true })
            .eq("bulletin_id", bulletin.id)
            .eq("is_published", true);

          return { ...bulletin, article_count: count || 0 };
        })
      );

      setBulletins(bulletinsWithCounts);
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
          <p className="text-muted-foreground">
            Stay updated with the latest AI news and insights
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : bulletins.length === 0 ? (
          <div className="text-center py-12">
            <Newspaper className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No bulletins published yet.</p>
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
                      {bulletin.article_count} articles
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
