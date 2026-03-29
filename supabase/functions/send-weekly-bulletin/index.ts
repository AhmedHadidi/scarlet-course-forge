import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

// Restrict CORS to known origins only — never use '*' in production
const ALLOWED_ORIGINS = [
  "https://wcmfpcejlldihchyaavn.lovable.app",
  "https://scarlet-course-forge.lovable.app",
  "http://localhost:8080",
  "http://localhost:5173",
];

function getCorsHeaders(origin: string | null): Record<string, string> {
  const allowedOrigin = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

// UUID v4 validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// HTML escape function to prevent XSS in email templates
function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

interface BulletinEmailRequest {
  bulletinId: string;
}

serve(async (req: Request): Promise<Response> => {
  const origin = req.headers.get("Origin");
  const corsHeaders = getCorsHeaders(origin);

  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Only allow POST
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    
    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY is not configured");
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const resend = new Resend(resendApiKey);

    const body = await req.json();
    const bulletinId: string = body?.bulletinId;

    if (!bulletinId) {
      throw new Error("Bulletin ID is required");
    }

    // Validate UUID format to prevent SQL injection / unexpected query behavior
    if (!UUID_REGEX.test(bulletinId)) {
      return new Response(JSON.stringify({ error: "Invalid bulletin ID format" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Processing bulletin: ${bulletinId}`);

    // Get bulletin details
    const { data: bulletin, error: bulletinError } = await supabase
      .from("news_bulletins")
      .select("*")
      .eq("id", bulletinId)
      .eq("is_published", true)
      .single();

    if (bulletinError || !bulletin) {
      throw new Error("Bulletin not found or not published");
    }

    // Get articles for this bulletin with their categories
    const { data: articles, error: articlesError } = await supabase
      .from("news_articles")
      .select("*")
      .eq("bulletin_id", bulletinId)
      .eq("is_published", true);

    if (articlesError) {
      throw articlesError;
    }

    if (!articles || articles.length === 0) {
      return new Response(
        JSON.stringify({ sent: 0, message: "No articles in this bulletin" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get category IDs for all articles
    const articleIds = articles.map((a) => a.id);
    const { data: articleCategories } = await supabase
      .from("news_article_categories")
      .select("article_id, category_id")
      .in("article_id", articleIds);

    const categoryIds = [...new Set((articleCategories || []).map((ac) => ac.category_id))];

    if (categoryIds.length === 0) {
      return new Response(
        JSON.stringify({ sent: 0, message: "No categories assigned to articles" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get users who have preferences for these categories
    const { data: userPreferences, error: prefError } = await supabase
      .from("user_category_preferences")
      .select("user_id, category_id")
      .in("category_id", categoryIds);

    if (prefError) {
      throw prefError;
    }

    // Group users by their preferences
    const userCategoryMap = new Map<string, string[]>();
    (userPreferences || []).forEach((pref) => {
      const existing = userCategoryMap.get(pref.user_id) || [];
      userCategoryMap.set(pref.user_id, [...existing, pref.category_id]);
    });

    const userIds = [...userCategoryMap.keys()];

    if (userIds.length === 0) {
      return new Response(
        JSON.stringify({ sent: 0, message: "No users subscribed to these categories" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get user emails from auth
    const { data: { users }, error: usersError } = await supabase.auth.admin.listUsers();
    
    if (usersError) {
      throw usersError;
    }

    // Get all categories for display
    const { data: categories } = await supabase
      .from("news_categories")
      .select("id, name");

    const categoryMap = new Map((categories || []).map((c) => [c.id, c.name]));

    // Build article to categories map
    const articleCategoryMap = new Map<string, string[]>();
    (articleCategories || []).forEach((ac) => {
      const existing = articleCategoryMap.get(ac.article_id) || [];
      articleCategoryMap.set(ac.article_id, [...existing, ac.category_id]);
    });

    let sentCount = 0;
    const errors: string[] = [];

    // Send personalized email to each user
    for (const userId of userIds) {
      const user = users?.find((u) => u.id === userId);
      if (!user?.email) continue;

      const userCategories = userCategoryMap.get(userId) || [];
      
      // Filter articles that match user's category preferences
      const relevantArticles = articles.filter((article) => {
        const articleCats = articleCategoryMap.get(article.id) || [];
        return articleCats.some((catId) => userCategories.includes(catId));
      });

      if (relevantArticles.length === 0) continue;

      // Build email content
      const articlesList = relevantArticles
        .map((article) => {
          const artCats = articleCategoryMap.get(article.id) || [];
          const catNames = artCats.map((id) => categoryMap.get(id)).filter(Boolean).join(", ");
          // Escape all user-generated content to prevent XSS
          const safeTitle = escapeHtml(article.title || "");
          const safeDescription = escapeHtml(article.short_description || "");
          const safeCatNames = escapeHtml(catNames);
          // Validate image URL - only allow http(s) URLs
          const safeImageUrl = article.image_url && /^https?:\/\//i.test(article.image_url) 
            ? article.image_url : null;
          return `
            <div style="margin-bottom: 20px; padding: 15px; background: #f9f9f9; border-radius: 8px;">
              ${safeImageUrl ? `<img src="${safeImageUrl}" alt="${safeTitle}" style="width: 100%; max-height: 200px; object-fit: cover; border-radius: 4px; margin-bottom: 10px;">` : ""}
              <h3 style="margin: 0 0 8px 0; color: #333;">${safeTitle}</h3>
              <p style="margin: 0 0 8px 0; color: #666; font-size: 14px;">${safeDescription}</p>
              <span style="display: inline-block; background: #e0e0e0; padding: 2px 8px; border-radius: 4px; font-size: 12px; color: #555;">${safeCatNames}</span>
            </div>
          `;
        })
        .join("");

      const bulletinUrl = `https://wcmfpcejlldihchyaavn.lovable.app/bulletin/${bulletinId}`;

      const safeBulletinTitle = escapeHtml(bulletin.title || "");
      const safeBulletinNumber = escapeHtml(bulletin.bulletin_number || "");
      const emailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>${safeBulletinTitle}</title>
        </head>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #c71b1b, #8b0000); padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <h1 style="color: white; margin: 0; font-size: 24px;">📰 ${safeBulletinTitle}</h1>
            <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">${safeBulletinNumber}</p>
          </div>
          
          <p style="color: #666; margin-bottom: 20px;">
            Here are this week's AI news articles matching your interests:
          </p>
          
          ${articlesList}
          
          <div style="text-align: center; margin-top: 30px;">
            <a href="${bulletinUrl}" style="display: inline-block; background: #c71b1b; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
              View Full Bulletin
            </a>
          </div>
          
          <p style="color: #999; font-size: 12px; text-align: center; margin-top: 30px;">
            You're receiving this because you subscribed to AI news categories.<br>
            Manage your preferences in your profile settings.
          </p>
        </body>
        </html>
      `;

      try {
        // Send email using Resend
        const emailResult = await resend.emails.send({
          from: "MOI AI Learning Hub <onboarding@resend.dev>",
          to: [user.email],
          subject: `${bulletin.title} - Your Weekly AI News`,
          html: emailHtml,
        });

        if (emailResult.error) {
          console.error(`Failed to send email to ${user.email}:`, emailResult.error);
          errors.push(`${user.email}: ${emailResult.error.message}`);
        } else {
          console.log(`Email sent successfully to ${user.email}, id: ${emailResult.data?.id}`);
          sentCount++;
        }
      } catch (emailError: any) {
        console.error(`Error sending email to ${user.email}:`, emailError);
        errors.push(`${user.email}: ${emailError.message}`);
      }
    }

    console.log(`Sent ${sentCount} emails for bulletin ${bulletinId}`);

    return new Response(
      JSON.stringify({ 
        sent: sentCount, 
        errors: errors.length > 0 ? errors : undefined,
        message: `Successfully sent ${sentCount} emails` 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    // Log full error server-side but only expose safe message to client
    console.error("Error sending bulletin emails:", error);
    const safeMessage = error.message?.includes("not configured") || error.message?.includes("required") || error.message?.includes("Invalid")
      ? error.message
      : "Failed to send bulletin";
    return new Response(
      JSON.stringify({ error: safeMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
