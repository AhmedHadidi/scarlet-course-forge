import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SubmitQuizRequest {
  quizId: string;
  userAnswers: { [questionId: string]: string[] };
  attemptType: "pre" | "post";
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate authorization
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create authenticated client for user context
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // User client - for user-specific operations
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Admin client - for accessing is_correct field (bypasses RLS)
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Validate the user
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid or expired token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse request body
    const body: SubmitQuizRequest = await req.json();
    const { quizId, userAnswers, attemptType } = body;

    // Validate input
    if (!quizId || !userAnswers || !attemptType) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!["pre", "post"].includes(attemptType)) {
      return new Response(JSON.stringify({ error: "Invalid attempt type" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch quiz details
    const { data: quiz, error: quizError } = await userClient
      .from("quizzes")
      .select("*, courses(title, difficulty_level)")
      .eq("id", quizId)
      .single();

    if (quizError || !quiz) {
      return new Response(JSON.stringify({ error: "Quiz not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check for previous attempts
    const { data: previousAttempts } = await userClient
      .from("quiz_attempts")
      .select("*")
      .eq("user_id", user.id)
      .eq("quiz_id", quizId)
      .eq("attempt_type", attemptType);

    if (previousAttempts && previousAttempts.length > 0) {
      if (attemptType === "pre" || !quiz.allow_retakes) {
        return new Response(JSON.stringify({ error: "Quiz already taken and retakes not allowed" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Fetch questions
    const { data: questions, error: questionsError } = await userClient
      .from("quiz_questions")
      .select("id")
      .eq("quiz_id", quizId);

    if (questionsError || !questions || questions.length === 0) {
      return new Response(JSON.stringify({ error: "No questions found for this quiz" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify all questions are answered
    const questionIds = questions.map((q) => q.id);
    const unansweredQuestions = questionIds.filter(
      (qId) => !userAnswers[qId] || userAnswers[qId].length === 0
    );

    if (unansweredQuestions.length > 0) {
      return new Response(JSON.stringify({ error: "Please answer all questions" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch correct answers using admin client (bypasses RLS to access is_correct)
    const { data: allAnswers, error: answersError } = await adminClient
      .from("quiz_answers")
      .select("id, question_id, is_correct")
      .in("question_id", questionIds);

    if (answersError || !allAnswers) {
      console.error("Failed to fetch answers:", answersError);
      return new Response(JSON.stringify({ error: "Failed to validate answers" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Calculate score server-side
    let correctCount = 0;
    for (const questionId of questionIds) {
      const userSelectedIds = userAnswers[questionId] || [];
      const correctAnswerIds = allAnswers
        .filter((a) => a.question_id === questionId && a.is_correct)
        .map((a) => a.id);

      // Check if user selected all correct answers and no incorrect ones
      const isCorrect =
        userSelectedIds.length === correctAnswerIds.length &&
        userSelectedIds.every((id) => correctAnswerIds.includes(id));

      if (isCorrect) {
        correctCount++;
      }
    }

    const score = Math.round((correctCount / questions.length) * 100);
    const passed = score >= quiz.passing_score;

    // Save quiz attempt
    const { error: attemptError } = await userClient.from("quiz_attempts").insert({
      user_id: user.id,
      quiz_id: quizId,
      score,
      passed,
      attempt_type: attemptType,
    });

    if (attemptError) {
      console.error("Failed to save attempt:", attemptError);
      return new Response(JSON.stringify({ error: "Failed to save quiz attempt" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // If passed post-quiz, update enrollment and create certificate
    let certificateId: string | undefined;
    if (passed && attemptType === "post") {
      // Update enrollment completion
      const { error: enrollmentError } = await userClient
        .from("enrollments")
        .update({ completed_at: new Date().toISOString() })
        .eq("user_id", user.id)
        .eq("course_id", quiz.course_id)
        .is("completed_at", null);

      if (enrollmentError) {
        console.error("Failed to update enrollment:", enrollmentError);
      }

      // Check if certificate already exists
      const { data: existingCert } = await userClient
        .from("certificates")
        .select("id")
        .eq("user_id", user.id)
        .eq("course_id", quiz.course_id)
        .maybeSingle();

      if (!existingCert) {
        // Create certificate
        const certUrl = `certificate-${user.id}-${quiz.course_id}-${Date.now()}`;
        const { data: newCert, error: certError } = await userClient
          .from("certificates")
          .insert({
            user_id: user.id,
            course_id: quiz.course_id,
            certificate_url: certUrl,
          })
          .select("id")
          .single();

        if (certError) {
          console.error("Failed to create certificate:", certError);
        } else if (newCert) {
          certificateId = newCert.id;
        }
      } else {
        certificateId = existingCert.id;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        score,
        passed,
        totalQuestions: questions.length,
        correctAnswers: correctCount,
        certificateId,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in submit-quiz:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
