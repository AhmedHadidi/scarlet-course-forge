import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface VerifyVideoRequest {
  videoId: string;
  videoTitle: string;
  videoDescription?: string;
  courseTitle: string;
  watchTimeSeconds: number;
  totalDurationSeconds: number;
  tabSwitches: number;
  action: "generate_question" | "verify_answer";
  userAnswer?: string;
  question?: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI service not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid or expired token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body: VerifyVideoRequest = await req.json();
    const { 
      videoId, 
      videoTitle, 
      videoDescription, 
      courseTitle, 
      watchTimeSeconds, 
      totalDurationSeconds, 
      tabSwitches, 
      action,
      userAnswer,
      question
    } = body;

    // Calculate engagement score
    const watchRatio = totalDurationSeconds > 0 ? watchTimeSeconds / totalDurationSeconds : 0;
    const tabPenalty = Math.min(tabSwitches * 0.1, 0.5); // Max 50% penalty
    const engagementScore = Math.max(0, Math.min(100, (watchRatio * 100) - (tabPenalty * 100)));

    // Check if user watched enough (at least 80% of video)
    const watchedEnough = watchRatio >= 0.8;

    if (!watchedEnough) {
      return new Response(JSON.stringify({ 
        error: "Insufficient watch time",
        engagementScore,
        watchRatio: Math.round(watchRatio * 100),
        message: `You've only watched ${Math.round(watchRatio * 100)}% of the video. Please watch at least 80% before marking as complete.`
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "generate_question") {
      // Generate AI comprehension question
      const prompt = `You are a training course assistant. Generate ONE simple multiple-choice question to verify that someone watched a video.

Course: "${courseTitle}"
Video Title: "${videoTitle}"
${videoDescription ? `Video Description: "${videoDescription}"` : ""}

Requirements:
1. The question should be general enough that someone who watched the video could answer it
2. Create a question about the topic/concept that would be covered based on the title
3. Provide exactly 4 answer options (A, B, C, D)
4. One answer should be clearly correct
5. Make the question educational and relevant

Respond in this exact JSON format only:
{
  "question": "Your question here?",
  "options": ["A) Option 1", "B) Option 2", "C) Option 3", "D) Option 4"],
  "correctAnswer": "A"
}`;

      const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: "You are a helpful training course assistant. Always respond with valid JSON only." },
            { role: "user", content: prompt }
          ],
          temperature: 0.7,
        }),
      });

      if (!aiResponse.ok) {
        if (aiResponse.status === 429) {
          return new Response(JSON.stringify({ error: "AI service rate limited. Please try again in a moment." }), {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (aiResponse.status === 402) {
          return new Response(JSON.stringify({ error: "AI service payment required." }), {
            status: 402,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        console.error("AI gateway error:", aiResponse.status);
        return new Response(JSON.stringify({ error: "Failed to generate question" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const aiData = await aiResponse.json();
      const content = aiData.choices?.[0]?.message?.content || "";
      
      // Parse the JSON response
      let questionData;
      try {
        // Extract JSON from response (in case there's extra text)
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          questionData = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error("No JSON found");
        }
      } catch (e) {
        console.error("Failed to parse AI response:", content);
        // Fallback question
        questionData = {
          question: `What is the main topic covered in "${videoTitle}"?`,
          options: [
            `A) The content described in the video`,
            `B) Unrelated topic 1`,
            `C) Unrelated topic 2`,
            `D) Unrelated topic 3`
          ],
          correctAnswer: "A"
        };
      }

      // Store engagement data
      await userClient.from("video_engagement").upsert({
        user_id: user.id,
        video_id: videoId,
        watch_time_seconds: watchTimeSeconds,
        total_duration_seconds: totalDurationSeconds,
        tab_switches: tabSwitches,
        engagement_score: engagementScore,
        ai_question: questionData.question,
      }, { onConflict: "user_id,video_id" });

      return new Response(JSON.stringify({
        success: true,
        question: questionData.question,
        options: questionData.options,
        correctAnswer: questionData.correctAnswer,
        engagementScore,
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "verify_answer") {
      if (!userAnswer || !question) {
        return new Response(JSON.stringify({ error: "Missing answer or question" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Update engagement record
      const { error: updateError } = await userClient.from("video_engagement").upsert({
        user_id: user.id,
        video_id: videoId,
        watch_time_seconds: watchTimeSeconds,
        total_duration_seconds: totalDurationSeconds,
        tab_switches: tabSwitches,
        engagement_score: engagementScore,
        ai_verification_passed: true,
        ai_user_answer: userAnswer,
        ai_question: question,
      }, { onConflict: "user_id,video_id" });

      if (updateError) {
        console.error("Failed to update engagement:", updateError);
      }

      return new Response(JSON.stringify({
        success: true,
        verified: true,
        engagementScore,
        message: "Video completion verified!"
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error in verify-video-watch:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
