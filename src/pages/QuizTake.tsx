import { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { toast as sonnerToast } from "sonner";
import { Loader2, CheckCircle, XCircle, Award, Download, Eye, EyeOff, ChevronDown, ChevronUp } from "lucide-react";
import UserNav from "@/components/UserNav";
import { downloadCertificatePDF } from "@/lib/generateCertificate";
import { useTranslation } from "react-i18next";

interface Quiz {
  id: string;
  title: string;
  description: string | null;
  passing_score: number;
  allow_retakes: boolean;
  course_id: string;
  courses: {
    title: string;
    difficulty_level: string;
  };
}

interface Question {
  id: string;
  question_text: string;
  question_type: string;
  order_index: number;
}

// Answer interface without is_correct - server validates answers
interface Answer {
  id: string;
  answer_text: string;
}

interface QuestionResult {
  questionId: string;
  questionText: string;
  isCorrect: boolean;
  userAnswerId: string;
  userAnswerText: string;
  correctAnswerId: string;
  correctAnswerText: string;
  allAnswers: { id: string; text: string }[];
}

export default function QuizTake() {
  const { quizId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const attemptType = (searchParams.get("type") as "pre" | "post") || "post";
  const { user } = useAuth();
  const { t } = useTranslation();
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<{ [key: string]: Answer[] }>({});
  const [userAnswers, setUserAnswers] = useState<{ [key: string]: string[] }>({});
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [result, setResult] = useState<{
    score: number;
    passed: boolean;
    totalQuestions: number;
    correctAnswers: number;
    certificateId?: string;
    questionResults?: QuestionResult[];
  } | null>(null);
  const [previousAttempt, setPreviousAttempt] = useState<any>(null);
  const [canTakeQuiz, setCanTakeQuiz] = useState(true);
  const [userName, setUserName] = useState<string>("");

  useEffect(() => {
    if (!user || !quizId) return;
    fetchQuizData();
    fetchUserProfile();
  }, [user, quizId, attemptType]);

  const fetchUserProfile = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .single();
    if (data) setUserName(data.full_name);
  };

  const fetchQuizData = async () => {
    try {
      // Fetch quiz details
      const { data: quizData, error: quizError } = await supabase
        .from("quizzes")
        .select("*, courses(title, difficulty_level)")
        .eq("id", quizId)
        .single();

      if (quizError) throw quizError;
      setQuiz(quizData);

      // Check for previous attempts of this type
      const { data: attemptData, error: attemptError } = await supabase
        .from("quiz_attempts")
        .select("*")
        .eq("user_id", user!.id)
        .eq("quiz_id", quizId)
        .eq("attempt_type", attemptType)
        .order("attempted_at", { ascending: false })
        .limit(1);

      if (!attemptError && attemptData && attemptData.length > 0) {
        setPreviousAttempt(attemptData[0]);
        // Pre-quiz can only be taken once; post-quiz respects allow_retakes
        if (attemptType === "pre" || !quizData.allow_retakes) {
          setCanTakeQuiz(false);
          setLoading(false);
          return;
        }
      }

      // Fetch questions
      const { data: questionsData, error: questionsError } = await supabase
        .from("quiz_questions")
        .select("*")
        .eq("quiz_id", quizId)
        .order("order_index");

      if (questionsError) throw questionsError;
      setQuestions(questionsData || []);

      // Fetch answers for all questions using the secure view (excludes is_correct)
      if (questionsData && questionsData.length > 0) {
        const questionIds = questionsData.map((q) => q.id);
        const { data: answersData, error: answersError } = await supabase
          .from("quiz_answers_display")
          .select("id, question_id, answer_text")
          .in("question_id", questionIds);

        if (answersError) throw answersError;

        const answersMap: { [key: string]: Answer[] } = {};
        answersData?.forEach((answer) => {
          if (!answersMap[answer.question_id]) {
            answersMap[answer.question_id] = [];
          }
          answersMap[answer.question_id].push(answer);
        });
        setAnswers(answersMap);
      }
    } catch (error: any) {
      sonnerToast.error("Failed to load quiz");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleAnswerSelect = (questionId: string, answerId: string) => {
    setUserAnswers({
      ...userAnswers,
      [questionId]: [answerId],
    });
  };

  const handleNext = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    }
  };

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  };

  const handleSubmit = async () => {
    if (!user || !quiz) return;

    // Check if all questions are answered
    const unansweredQuestions = questions.filter((q) => !userAnswers[q.id] || userAnswers[q.id].length === 0);
    if (unansweredQuestions.length > 0) {
      sonnerToast.error("Please answer all questions before submitting");
      return;
    }

    setSubmitting(true);

    try {
      // Get the current session for authentication
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error("Not authenticated");
      }

      // Submit quiz to server-side edge function for secure validation
      // This prevents cheating by calculating score server-side
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/submit-quiz`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            quizId: quiz.id,
            userAnswers,
            attemptType,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to submit quiz");
      }

      // Build review data only for final (post) quiz, not pre-quiz
      let questionResults: QuestionResult[] = [];
      if (attemptType !== "pre") {
        try {
          const questionIds = questions.map((q) => q.id);
          const { data: correctAnswersData } = await supabase
            .from("quiz_answers")
            .select("id, question_id, answer_text, is_correct")
            .in("question_id", questionIds);

          if (correctAnswersData) {
            questionResults = questions.map((q) => {
              const qAnswers = correctAnswersData.filter((a) => a.question_id === q.id);
              const correctAns = qAnswers.find((a) => a.is_correct);
              const userSelectedId = userAnswers[q.id]?.[0] || "";
              const userAns = qAnswers.find((a) => a.id === userSelectedId);
              const isCorrect = correctAns ? userSelectedId === correctAns.id : false;

              return {
                questionId: q.id,
                questionText: q.question_text,
                isCorrect,
                userAnswerId: userSelectedId,
                userAnswerText: userAns?.answer_text || "",
                correctAnswerId: correctAns?.id || "",
                correctAnswerText: correctAns?.answer_text || "",
                allAnswers: qAnswers.map((a) => ({ id: a.id, text: a.answer_text })),
              };
            });
          }
        } catch {
          // Review data is optional – quiz result still shows
        }
      }

      setResult({
        score: data.score,
        passed: data.passed,
        totalQuestions: data.totalQuestions,
        correctAnswers: data.correctAnswers,
        certificateId: data.certificateId,
        questionResults,
      });

      if (attemptType === "pre") {
        sonnerToast.success("Pre-quiz completed! You can now start the course.");
      } else {
        sonnerToast.success(data.passed ? "Congratulations! You passed!" : "Quiz submitted");
      }
    } catch (error: any) {
      sonnerToast.error(error.message || "Failed to submit quiz");
      console.error(error);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Show previous result if quiz was already taken (must come BEFORE the
  // "no questions" guard because fetchQuizData returns early when canTakeQuiz is false)
  if (!canTakeQuiz && previousAttempt) {
    return (
      <div className="min-h-screen bg-background">
        <UserNav />
        <div className="container mx-auto px-4 py-8 max-w-2xl">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3 mb-2">
                {previousAttempt.passed ? (
                  <CheckCircle className="h-8 w-8 text-green-500" />
                ) : (
                  <XCircle className="h-8 w-8 text-red-500" />
                )}
                <div>
                  <CardTitle>{t("quizTake.alreadyCompleted")}</CardTitle>
                  <CardDescription>{quiz?.courses?.title || ""}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">{t("quizTake.previousResult")}</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-lg border p-4">
                    <p className="text-sm text-muted-foreground mb-1">{t("quizTake.score")}</p>
                    <p className="text-2xl font-bold">{previousAttempt.score}%</p>
                  </div>
                  <div className="rounded-lg border p-4">
                    <p className="text-sm text-muted-foreground mb-1">{t("quizTake.status")}</p>
                    <Badge variant={previousAttempt.passed ? "default" : "destructive"} className="text-sm">
                      {previousAttempt.passed ? t("quizTake.passed") : t("quizTake.failed")}
                    </Badge>
                  </div>
                </div>
              </div>
              <div className="rounded-lg bg-muted p-4">
                <p className="text-sm text-muted-foreground">
                  {t("quizTake.alreadyTakenMessage")}
                  {previousAttempt.passed && " " + t("quizTake.passedMessage")}
                </p>
              </div>
              <div className="flex gap-2">
                <Button onClick={() => navigate("/dashboard")} variant="outline" className="flex-1">
                  {t("quizTake.backToDashboard")}
                </Button>
                {previousAttempt.passed && (
                  <Button onClick={() => navigate("/progress")} className="flex-1">
                    {t("quizTake.viewProgress")}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!quiz || questions.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>{t("quizTake.notAvailable")}</CardTitle>
            <CardDescription>{t("quizTake.notAvailableDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate("/dashboard")}>{t("quizTake.backToDashboard")}</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (result) {
    const isPreQuiz = attemptType === "pre";
    return (
      <div className="min-h-screen bg-background">
        <UserNav />
        <div className="container mx-auto py-8 px-4 max-w-2xl">
          <Card className="text-center">
            <CardHeader>
              <div className="flex justify-center mb-4">
                {isPreQuiz ? (
                  <CheckCircle className="h-16 w-16 text-primary" />
                ) : result.passed ? (
                  <Award className="h-16 w-16 text-primary" />
                ) : (
                  <XCircle className="h-16 w-16 text-destructive" />
                )}
              </div>
              <CardTitle className="text-3xl">
                {isPreQuiz
                  ? "Pre-Quiz Completed!"
                  : result.passed
                    ? "Congratulations!"
                    : "Quiz Completed"}
              </CardTitle>
              <CardDescription>
                {isPreQuiz
                  ? "Your baseline score has been recorded. You can now start the course."
                  : result.passed
                    ? "You have successfully passed the quiz!"
                    : "Keep practicing to improve your score"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="text-5xl font-bold text-primary">{result.score}%</div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Correct Answers:</span>
                    <span className="font-semibold">
                      {result.correctAnswers} / {result.totalQuestions}
                    </span>
                  </div>
                  {!isPreQuiz && (
                    <div className="flex justify-between text-sm">
                      <span>Passing Score:</span>
                      <span className="font-semibold">{quiz.passing_score}%</span>
                    </div>
                  )}
                </div>
                <Progress value={result.score} className="h-3" />
                {isPreQuiz ? (
                  <Badge variant="secondary" className="text-lg py-2 px-4">
                    BASELINE RECORDED
                  </Badge>
                ) : (
                  <Badge variant={result.passed ? "default" : "destructive"} className="text-lg py-2 px-4">
                    {result.passed ? "PASSED" : "NOT PASSED"}
                  </Badge>
                )}
              </div>
              <div className="flex flex-wrap gap-3 justify-center">
                {isPreQuiz ? (
                  <Button onClick={() => navigate(`/courses/${quiz.course_id}`)}>
                    Start Course
                  </Button>
                ) : (
                  <>
                    {result.passed && result.certificateId && (
                      <Button
                        onClick={() => {
                          downloadCertificatePDF({
                            userName: userName || "Student",
                            courseName: quiz.courses.title,
                            courseLevel: quiz.courses.difficulty_level,
                            quizScore: result.score,
                            passingScore: quiz.passing_score,
                            completionDate: new Date(),
                            certificateId: result.certificateId!,
                          });
                        }}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Download Certificate
                      </Button>
                    )}
                    {result.passed && (
                      <Button variant="outline" onClick={() => navigate(`/certificates`)}>
                        <Award className="h-4 w-4 mr-2" />
                        View All Certificates
                      </Button>
                    )}
                    <Button variant="outline" onClick={() => navigate("/progress")}>
                      View Progress
                    </Button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* ── Question Review (final quiz only) ── */}
          {!isPreQuiz && result.questionResults && result.questionResults.length > 0 && (
            <div className="mt-8">
              <Button
                variant="outline"
                size="lg"
                className="w-full py-6 text-base font-semibold gap-3 border-2 border-dashed hover:border-primary hover:bg-primary/5 transition-all duration-300"
                onClick={() => setShowReview(!showReview)}
              >
                {showReview ? (
                  <>
                    <EyeOff className="h-5 w-5" />
                    إخفاء الإجابات
                    <ChevronUp className="h-5 w-5 ms-auto" />
                  </>
                ) : (
                  <>
                    <Eye className="h-5 w-5" />
                    إظهار الإجابات
                    <ChevronDown className="h-5 w-5 ms-auto" />
                  </>
                )}
              </Button>

              <div
                className="overflow-hidden transition-all duration-500 ease-in-out"
                style={{
                  maxHeight: showReview ? `${result.questionResults.length * 500}px` : "0px",
                  opacity: showReview ? 1 : 0,
                }}
              >
                <div className="space-y-4 pt-6">
                  {result.questionResults.map((qr, idx) => (
                    <Card
                      key={qr.questionId}
                      className={`border-2 transition-all duration-300 ${qr.isCorrect
                        ? "border-green-300 bg-green-50/50 dark:bg-green-950/20 dark:border-green-700"
                        : "border-red-300 bg-red-50/50 dark:bg-red-950/20 dark:border-red-700"
                        }`}
                    >
                      <CardHeader className="pb-3">
                        <div className="flex items-center gap-3">
                          <div className={`flex items-center justify-center w-8 h-8 rounded-full flex-shrink-0 ${qr.isCorrect
                            ? "bg-green-100 dark:bg-green-900/50"
                            : "bg-red-100 dark:bg-red-900/50"
                            }`}>
                            {qr.isCorrect ? (
                              <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                            ) : (
                              <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                            )}
                          </div>
                          <CardTitle className="text-base leading-relaxed">
                            <span className="text-muted-foreground font-normal">Q{idx + 1}.</span>{" "}
                            {qr.questionText}
                          </CardTitle>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-2 pt-0">
                        {qr.allAnswers.map((ans, ansIdx) => {
                          const isUserAnswer = ans.id === qr.userAnswerId;
                          const isCorrectAnswer = ans.id === qr.correctAnswerId;

                          let bgClass = "border rounded-xl p-3.5 flex items-center gap-3 transition-all duration-200 ";
                          if (isCorrectAnswer) {
                            bgClass += "bg-green-50 border-green-300 dark:bg-green-900/30 dark:border-green-600 shadow-sm shadow-green-200/50 dark:shadow-green-900/30";
                          } else if (isUserAnswer && !qr.isCorrect) {
                            bgClass += "bg-red-50 border-red-300 dark:bg-red-900/30 dark:border-red-600 shadow-sm shadow-red-200/50 dark:shadow-red-900/30";
                          } else {
                            bgClass += "bg-muted/30 border-border/50 opacity-50";
                          }

                          return (
                            <div key={ans.id} className={bgClass}>
                              <span className="text-xs font-bold text-muted-foreground w-6">
                                {String.fromCharCode(65 + ansIdx)}.
                              </span>
                              <div className="flex-1 text-sm font-medium">
                                {ans.text}
                              </div>
                              <div className="flex items-center gap-1.5 flex-shrink-0">
                                {isCorrectAnswer && (
                                  <Badge className="bg-green-600 hover:bg-green-700 text-xs px-2 py-0.5 gap-1">
                                    <CheckCircle className="h-3 w-3" />
                                    الإجابة الصحيحة
                                  </Badge>
                                )}
                                {isUserAnswer && !qr.isCorrect && (
                                  <Badge variant="destructive" className="text-xs px-2 py-0.5 gap-1">
                                    <XCircle className="h-3 w-3" />
                                    إجابتك
                                  </Badge>
                                )}
                                {isUserAnswer && qr.isCorrect && (
                                  <Badge className="bg-green-600 hover:bg-green-700 text-xs px-2 py-0.5 gap-1">
                                    <CheckCircle className="h-3 w-3" />
                                    إجابتك
                                  </Badge>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  const currentQuestion = questions[currentQuestionIndex];
  const currentAnswers = answers[currentQuestion.id] || [];
  const progressPercentage = ((currentQuestionIndex + 1) / questions.length) * 100;

  return (
    <div className="min-h-screen bg-background">
      <UserNav />
      <div className="container mx-auto py-8 px-4 max-w-3xl">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">{quiz.title}</h1>
          <p className="text-muted-foreground mb-4">{quiz.courses.title}</p>
          <div className="flex items-center gap-4 mb-4">
            <Badge variant={attemptType === "pre" ? "secondary" : "default"}>
              {attemptType === "pre" ? "Pre-Quiz" : "Final Quiz"}
            </Badge>
            <Badge variant="outline">
              Question {currentQuestionIndex + 1} of {questions.length}
            </Badge>
            {attemptType === "post" && (
              <Badge variant="secondary">Passing Score: {quiz.passing_score}%</Badge>
            )}
          </div>
          <Progress value={progressPercentage} className="h-2" />
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-xl">{currentQuestion.question_text}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <RadioGroup
              value={userAnswers[currentQuestion.id]?.[0] || ""}
              onValueChange={(value) => handleAnswerSelect(currentQuestion.id, value)}
            >
              <div className="space-y-3">
                {currentAnswers.map((answer, index) => (
                  <div key={answer.id} className="flex items-center space-x-3 border rounded-lg p-4 hover:bg-accent/50 transition-colors">
                    <RadioGroupItem value={answer.id} id={`answer-${answer.id}`} />
                    <Label htmlFor={`answer-${answer.id}`} className="flex-1 cursor-pointer text-base">
                      <span className="font-semibold mr-2">{String.fromCharCode(65 + index)}.</span>
                      {answer.answer_text}
                    </Label>
                  </div>
                ))}
              </div>
            </RadioGroup>

            <div className="flex justify-between pt-4">
              <Button
                variant="outline"
                onClick={handlePrevious}
                disabled={currentQuestionIndex === 0}
              >
                Previous
              </Button>
              {currentQuestionIndex === questions.length - 1 ? (
                <Button onClick={handleSubmit} disabled={submitting}>
                  {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Submit Quiz
                </Button>
              ) : (
                <Button onClick={handleNext}>Next</Button>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-sm">Question Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {questions.map((q, index) => (
                <Button
                  key={q.id}
                  variant={currentQuestionIndex === index ? "default" : "outline"}
                  size="sm"
                  onClick={() => setCurrentQuestionIndex(index)}
                  className="w-10 h-10"
                >
                  {userAnswers[q.id] && userAnswers[q.id].length > 0 ? (
                    <CheckCircle className="h-4 w-4" />
                  ) : (
                    index + 1
                  )}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
