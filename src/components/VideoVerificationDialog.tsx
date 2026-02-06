import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, XCircle, Loader2, AlertTriangle, Brain } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface VideoVerificationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  videoId: string;
  videoTitle: string;
  videoDescription?: string | null;
  courseTitle: string;
  watchTimeSeconds: number;
  totalDurationSeconds: number;
  tabSwitches: number;
  onVerified: () => void;
  onFailed: () => void;
}

interface QuestionData {
  question: string;
  options: string[];
  correctAnswer: string;
  engagementScore: number;
}

type DialogState = "loading" | "question" | "result" | "error" | "insufficient_watch";

export function VideoVerificationDialog({
  open,
  onOpenChange,
  videoId,
  videoTitle,
  videoDescription,
  courseTitle,
  watchTimeSeconds,
  totalDurationSeconds,
  tabSwitches,
  onVerified,
  onFailed,
}: VideoVerificationDialogProps) {
  const [state, setState] = useState<DialogState>("loading");
  const [questionData, setQuestionData] = useState<QuestionData | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<string>("");
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  const generateQuestion = async () => {
    setState("loading");
    setSelectedAnswer("");
    setIsCorrect(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error("Not authenticated");
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verify-video-watch`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            videoId,
            videoTitle,
            videoDescription,
            courseTitle,
            watchTimeSeconds,
            totalDurationSeconds,
            tabSwitches,
            action: "generate_question",
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        if (data.message?.includes("only watched")) {
          setErrorMessage(data.message);
          setState("insufficient_watch");
          return;
        }
        throw new Error(data.error || "Failed to generate question");
      }

      setQuestionData({
        question: data.question,
        options: data.options,
        correctAnswer: data.correctAnswer,
        engagementScore: data.engagementScore,
      });
      setState("question");
    } catch (error) {
      console.error("Error generating question:", error);
      setErrorMessage(error instanceof Error ? error.message : "Failed to generate question");
      setState("error");
    }
  };

  const handleSubmitAnswer = async () => {
    if (!selectedAnswer || !questionData) return;

    setSubmitting(true);

    // Check if answer is correct (extract letter from option)
    const answerLetter = selectedAnswer.charAt(0);
    const correct = answerLetter === questionData.correctAnswer;
    setIsCorrect(correct);

    if (correct) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) {
          throw new Error("Not authenticated");
        }

        await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verify-video-watch`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session.access_token}`,
              apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            },
            body: JSON.stringify({
              videoId,
              videoTitle,
              videoDescription,
              courseTitle,
              watchTimeSeconds,
              totalDurationSeconds,
              tabSwitches,
              action: "verify_answer",
              userAnswer: selectedAnswer,
              question: questionData.question,
            }),
          }
        );

        setState("result");
        toast.success("Video completion verified!");
      } catch (error) {
        console.error("Error verifying answer:", error);
      }
    } else {
      setState("result");
      toast.error("Incorrect answer. Please re-watch the video.");
    }

    setSubmitting(false);
  };

  const handleClose = () => {
    if (isCorrect) {
      onVerified();
    } else {
      onFailed();
    }
    onOpenChange(false);
    // Reset state for next time
    setState("loading");
    setQuestionData(null);
    setSelectedAnswer("");
    setIsCorrect(null);
  };

  // Generate question when dialog opens
  if (open && state === "loading" && !questionData) {
    generateQuestion();
  }

  const watchRatio = totalDurationSeconds > 0 
    ? Math.round((watchTimeSeconds / totalDurationSeconds) * 100) 
    : 0;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-2">
            <Brain className="h-6 w-6 text-primary" />
            <DialogTitle>Video Verification</DialogTitle>
          </div>
          <DialogDescription>
            Answer this question to verify you watched the video
          </DialogDescription>
        </DialogHeader>

        {state === "loading" && (
          <div className="flex flex-col items-center py-8 space-y-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground">Generating verification question...</p>
          </div>
        )}

        {state === "insufficient_watch" && (
          <div className="flex flex-col items-center py-6 space-y-4">
            <AlertTriangle className="h-12 w-12 text-amber-500" />
            <div className="text-center space-y-2">
              <p className="font-medium">Insufficient Watch Time</p>
              <p className="text-sm text-muted-foreground">{errorMessage}</p>
              <div className="mt-4">
                <p className="text-sm text-muted-foreground mb-2">Your progress: {watchRatio}%</p>
                <Progress value={watchRatio} className="h-2" />
              </div>
            </div>
            <Button onClick={handleClose} variant="outline" className="mt-4">
              Continue Watching
            </Button>
          </div>
        )}

        {state === "error" && (
          <div className="flex flex-col items-center py-6 space-y-4">
            <XCircle className="h-12 w-12 text-destructive" />
            <div className="text-center space-y-2">
              <p className="font-medium">Error</p>
              <p className="text-sm text-muted-foreground">{errorMessage}</p>
            </div>
            <div className="flex gap-2">
              <Button onClick={generateQuestion} variant="outline">
                Try Again
              </Button>
              <Button onClick={handleClose}>Cancel</Button>
            </div>
          </div>
        )}

        {state === "question" && questionData && (
          <div className="space-y-6">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Engagement Score: {Math.round(questionData.engagementScore)}%
                {tabSwitches > 0 && (
                  <span className="text-amber-500 ml-2">
                    ({tabSwitches} tab switch{tabSwitches > 1 ? "es" : ""} detected)
                  </span>
                )}
              </p>
              <Progress value={questionData.engagementScore} className="h-2" />
            </div>

            <div className="bg-muted/50 rounded-lg p-4">
              <p className="font-medium">{questionData.question}</p>
            </div>

            <RadioGroup value={selectedAnswer} onValueChange={setSelectedAnswer}>
              <div className="space-y-3">
                {questionData.options.map((option, index) => (
                  <div
                    key={index}
                    className="flex items-center space-x-3 border rounded-lg p-3 hover:bg-accent/50 transition-colors"
                  >
                    <RadioGroupItem value={option} id={`option-${index}`} />
                    <Label htmlFor={`option-${index}`} className="flex-1 cursor-pointer">
                      {option}
                    </Label>
                  </div>
                ))}
              </div>
            </RadioGroup>

            <Button
              onClick={handleSubmitAnswer}
              disabled={!selectedAnswer || submitting}
              className="w-full"
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Verifying...
                </>
              ) : (
                "Submit Answer"
              )}
            </Button>
          </div>
        )}

        {state === "result" && (
          <div className="flex flex-col items-center py-6 space-y-4">
            {isCorrect ? (
              <>
                <CheckCircle2 className="h-16 w-16 text-primary" />
                <div className="text-center space-y-2">
                  <p className="text-xl font-bold text-primary">Correct!</p>
                  <p className="text-muted-foreground">
                    Your video completion has been verified.
                  </p>
                </div>
              </>
            ) : (
              <>
                <XCircle className="h-16 w-16 text-destructive" />
                <div className="text-center space-y-2">
                  <p className="text-xl font-bold text-destructive">Incorrect</p>
                  <p className="text-muted-foreground">
                    Please re-watch the video and try again.
                  </p>
                  {questionData && (
                    <p className="text-sm text-muted-foreground">
                      The correct answer was: {questionData.correctAnswer}
                    </p>
                  )}
                </div>
              </>
            )}
            <Button onClick={handleClose} className="mt-4">
              {isCorrect ? "Continue" : "Go Back"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
