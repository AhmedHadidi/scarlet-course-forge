import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { toast as sonnerToast } from "sonner";
import { Loader2, CheckCircle, XCircle, Award } from "lucide-react";
import UserNav from "@/components/UserNav";

interface Quiz {
  id: string;
  title: string;
  description: string | null;
  passing_score: number;
  allow_retakes: boolean;
  course_id: string;
  courses: {
    title: string;
  };
}

interface Question {
  id: string;
  question_text: string;
  question_type: string;
  order_index: number;
}

interface Answer {
  id: string;
  answer_text: string;
  is_correct: boolean;
}

export default function QuizTake() {
  const { quizId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<{ [key: string]: Answer[] }>({});
  const [userAnswers, setUserAnswers] = useState<{ [key: string]: string[] }>({});
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{
    score: number;
    passed: boolean;
    totalQuestions: number;
    correctAnswers: number;
  } | null>(null);
  const [previousAttempt, setPreviousAttempt] = useState<any>(null);
  const [canTakeQuiz, setCanTakeQuiz] = useState(true);

  useEffect(() => {
    if (!user || !quizId) return;
    fetchQuizData();
  }, [user, quizId]);

  const fetchQuizData = async () => {
    try {
      // Fetch quiz details
      const { data: quizData, error: quizError } = await supabase
        .from("quizzes")
        .select("*, courses(title)")
        .eq("id", quizId)
        .single();

      if (quizError) throw quizError;
      setQuiz(quizData);

      // Check for previous attempts
      const { data: attemptData, error: attemptError } = await supabase
        .from("quiz_attempts")
        .select("*")
        .eq("user_id", user!.id)
        .eq("quiz_id", quizId)
        .order("attempted_at", { ascending: false })
        .limit(1);

      if (!attemptError && attemptData && attemptData.length > 0) {
        setPreviousAttempt(attemptData[0]);
        // If retakes are not allowed, prevent taking the quiz again
        if (!quizData.allow_retakes) {
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

      // Fetch answers for all questions
      if (questionsData && questionsData.length > 0) {
        const questionIds = questionsData.map((q) => q.id);
        const { data: answersData, error: answersError } = await supabase
          .from("quiz_answers")
          .select("*")
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
      // Calculate score
      let correctCount = 0;
      questions.forEach((question) => {
        const userAnswerIds = userAnswers[question.id] || [];
        const correctAnswers = answers[question.id].filter((a) => a.is_correct);
        const correctAnswerIds = correctAnswers.map((a) => a.id);

        // Check if user selected all correct answers and no incorrect ones
        const isCorrect =
          userAnswerIds.length === correctAnswerIds.length &&
          userAnswerIds.every((id) => correctAnswerIds.includes(id));

        if (isCorrect) {
          correctCount++;
        }
      });

      const score = Math.round((correctCount / questions.length) * 100);
      const passed = score >= quiz.passing_score;

      // Save quiz attempt
      const { error } = await supabase.from("quiz_attempts").insert({
        user_id: user.id,
        quiz_id: quiz.id,
        score: score,
        passed: passed,
      });

      if (error) throw error;

      // Update enrollment if passed
      if (passed) {
        const { error: enrollmentError } = await supabase
          .from("enrollments")
          .update({ completed_at: new Date().toISOString() })
          .eq("user_id", user.id)
          .eq("course_id", quiz.course_id)
          .is("completed_at", null);

        if (enrollmentError) console.error("Failed to update enrollment:", enrollmentError);
      }

      setResult({
        score,
        passed,
        totalQuestions: questions.length,
        correctAnswers: correctCount,
      });

      sonnerToast.success(passed ? "Congratulations! You passed!" : "Quiz submitted");
    } catch (error: any) {
      sonnerToast.error("Failed to submit quiz");
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

  if (!quiz || questions.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Quiz Not Available</CardTitle>
            <CardDescription>This quiz could not be found or has no questions.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate("/dashboard")}>Return to Dashboard</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

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
                  <CardTitle>Quiz Already Completed</CardTitle>
                  <CardDescription>{quiz.courses.title}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">Your Previous Result</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-lg border p-4">
                    <p className="text-sm text-muted-foreground mb-1">Score</p>
                    <p className="text-2xl font-bold">{previousAttempt.score}%</p>
                  </div>
                  <div className="rounded-lg border p-4">
                    <p className="text-sm text-muted-foreground mb-1">Status</p>
                    <Badge variant={previousAttempt.passed ? "default" : "destructive"} className="text-sm">
                      {previousAttempt.passed ? "Passed" : "Failed"}
                    </Badge>
                  </div>
                </div>
              </div>
              <div className="rounded-lg bg-muted p-4">
                <p className="text-sm text-muted-foreground">
                  You have already taken this quiz. Retakes are not allowed for this quiz.
                  {previousAttempt.passed && " You have passed and can continue with the course."}
                </p>
              </div>
              <div className="flex gap-2">
                <Button onClick={() => navigate("/dashboard")} variant="outline" className="flex-1">
                  Back to Dashboard
                </Button>
                {previousAttempt.passed && (
                  <Button onClick={() => navigate("/progress")} className="flex-1">
                    View Progress
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (result) {
    return (
      <div className="min-h-screen bg-background">
        <UserNav />
        <div className="container mx-auto py-8 px-4 max-w-2xl">
          <Card className="text-center">
            <CardHeader>
              <div className="flex justify-center mb-4">
                {result.passed ? (
                  <Award className="h-16 w-16 text-primary" />
                ) : (
                  <XCircle className="h-16 w-16 text-destructive" />
                )}
              </div>
              <CardTitle className="text-3xl">
                {result.passed ? "Congratulations!" : "Quiz Completed"}
              </CardTitle>
              <CardDescription>
                {result.passed
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
                  <div className="flex justify-between text-sm">
                    <span>Passing Score:</span>
                    <span className="font-semibold">{quiz.passing_score}%</span>
                  </div>
                </div>
                <Progress value={result.score} className="h-3" />
                <Badge variant={result.passed ? "default" : "destructive"} className="text-lg py-2 px-4">
                  {result.passed ? "PASSED" : "NOT PASSED"}
                </Badge>
              </div>
              <div className="flex gap-3 justify-center">
                {result.passed && (
                  <Button onClick={() => navigate(`/certificates`)}>
                    <Award className="h-4 w-4 mr-2" />
                    View Certificate
                  </Button>
                )}
                <Button variant="outline" onClick={() => navigate("/progress")}>
                  View Progress
                </Button>
              </div>
            </CardContent>
          </Card>
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
            <Badge variant="outline">
              Question {currentQuestionIndex + 1} of {questions.length}
            </Badge>
            <Badge variant="secondary">Passing Score: {quiz.passing_score}%</Badge>
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
