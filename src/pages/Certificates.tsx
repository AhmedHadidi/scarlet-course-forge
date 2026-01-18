import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Award, Download, Calendar, Trophy } from "lucide-react";
import UserNav from "@/components/UserNav";
import { downloadCertificatePDF } from "@/lib/generateCertificate";

interface Certificate {
  id: string;
  issued_at: string;
  certificate_url: string | null;
  course_id: string;
  courses: {
    title: string;
    difficulty_level: string;
  };
}

interface QuizAttempt {
  score: number;
  quiz_id: string;
  quizzes: {
    passing_score: number;
  };
}

const Certificates = () => {
  const { user } = useAuth();
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [quizScores, setQuizScores] = useState<{ [courseId: string]: { score: number; passingScore: number } }>({});
  const [userName, setUserName] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    if (!user) return;

    try {
      // Fetch certificates, user profile, and quiz attempts in parallel
      const [certificatesResult, profileResult] = await Promise.all([
        supabase
          .from("certificates")
          .select(`
            id,
            issued_at,
            certificate_url,
            course_id,
            courses (
              title,
              difficulty_level
            )
          `)
          .eq("user_id", user.id)
          .order("issued_at", { ascending: false }),
        supabase
          .from("profiles")
          .select("full_name")
          .eq("id", user.id)
          .single(),
      ]);

      if (certificatesResult.data) {
        setCertificates(certificatesResult.data as Certificate[]);

        // Fetch quiz scores for each certificate's course
        const courseIds = certificatesResult.data.map((c) => c.course_id);
        if (courseIds.length > 0) {
          const { data: quizzesData } = await supabase
            .from("quizzes")
            .select("id, course_id, passing_score")
            .in("course_id", courseIds);

          if (quizzesData && quizzesData.length > 0) {
            const quizIds = quizzesData.map((q) => q.id);
            const { data: attemptsData } = await supabase
              .from("quiz_attempts")
              .select("score, quiz_id")
              .eq("user_id", user.id)
              .eq("attempt_type", "post")
              .eq("passed", true)
              .in("quiz_id", quizIds);

            const scoresMap: { [courseId: string]: { score: number; passingScore: number } } = {};
            quizzesData.forEach((quiz) => {
              const attempt = attemptsData?.find((a) => a.quiz_id === quiz.id);
              if (attempt) {
                scoresMap[quiz.course_id] = {
                  score: attempt.score,
                  passingScore: quiz.passing_score,
                };
              }
            });
            setQuizScores(scoresMap);
          }
        }
      }

      if (profileResult.data) {
        setUserName(profileResult.data.full_name);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = (certificate: Certificate) => {
    const scoreData = quizScores[certificate.course_id];
    downloadCertificatePDF({
      userName: userName || "Student",
      courseName: certificate.courses.title,
      courseLevel: certificate.courses.difficulty_level,
      quizScore: scoreData?.score || 0,
      passingScore: scoreData?.passingScore || 70,
      completionDate: new Date(certificate.issued_at),
      certificateId: certificate.id,
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <UserNav />

      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold mb-2">My Certificates</h2>
          <p className="text-muted-foreground">View and download your earned certificates</p>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Loading certificates...</p>
          </div>
        ) : certificates.length === 0 ? (
          <div className="text-center py-12">
            <Award className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground mb-2">No certificates earned yet</p>
            <p className="text-sm text-muted-foreground">
              Complete courses and pass their quizzes to earn your certificates
            </p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {certificates.map((certificate) => {
              const scoreData = quizScores[certificate.course_id];
              return (
                <Card key={certificate.id} className="border-border transition-smooth hover:shadow-lg">
                  <CardHeader>
                    <div className="h-32 bg-gradient-to-br from-primary to-primary/60 rounded-lg flex items-center justify-center mb-4 relative overflow-hidden">
                      <div className="absolute inset-0 bg-black/20" />
                      <Award className="h-16 w-16 text-white relative z-10" />
                    </div>
                    <CardTitle className="text-lg">{certificate.courses.title}</CardTitle>
                    <CardDescription className="capitalize">
                      {certificate.courses.difficulty_level} Level
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      <span>
                        Issued {new Date(certificate.issued_at).toLocaleDateString()}
                      </span>
                    </div>
                    {scoreData && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Trophy className="h-4 w-4" />
                        <span>Quiz Score: {scoreData.score}%</span>
                      </div>
                    )}
                    <Button
                      className="w-full"
                      onClick={() => handleDownload(certificate)}
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Download PDF
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default Certificates;
