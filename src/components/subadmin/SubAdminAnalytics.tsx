import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart, TrendingUp, Award, BookOpen } from "lucide-react";

interface SubAdminAnalyticsProps {
  departmentId: string;
}

interface UserProgress {
  userId: string;
  userName: string;
  courseName: string;
  videoProgress: string;
  enrolledAt: string;
  completedAt: string | null;
}

interface QuizPerformance {
  userId: string;
  userName: string;
  courseName: string;
  quizTitle: string;
  preScore: number | null;
  postScore: number | null;
  improvement: number | null;
}

interface CertificateDetail {
  userId: string;
  userName: string;
  courseName: string;
  certificateId: string;
  issuedAt: string;
}

export const SubAdminAnalytics = ({ departmentId }: SubAdminAnalyticsProps) => {
  const [loading, setLoading] = useState(true);
  const [userProgress, setUserProgress] = useState<UserProgress[]>([]);
  const [quizPerformance, setQuizPerformance] = useState<QuizPerformance[]>([]);
  const [certificateDetails, setCertificateDetails] = useState<CertificateDetail[]>([]);

  useEffect(() => {
    fetchAnalytics();
  }, [departmentId]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);

      // Fetch department users
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name")
        .eq("department_id", departmentId);

      if (profilesError) throw profilesError;

      if (!profiles || profiles.length === 0) {
        setLoading(false);
        return;
      }

      const userIds = profiles.map(p => p.id);
      const userMap = new Map(profiles.map(p => [p.id, p.full_name]));

      // Fetch all data in parallel
      const [enrollmentsResult, quizAttemptsResult, certificatesResult, coursesResult, quizzesResult, videosResult, videoProgressResult] = await Promise.all([
        supabase.from("enrollments").select("*").in("user_id", userIds),
        supabase.from("quiz_attempts").select("*").in("user_id", userIds),
        supabase.from("certificates").select("*").in("user_id", userIds),
        supabase.from("courses").select("id, title"),
        supabase.from("quizzes").select("id, title, course_id"),
        supabase.from("course_videos").select("id, course_id"),
        supabase.from("video_progress").select("*").in("user_id", userIds),
      ]);

      const enrollments = enrollmentsResult.data || [];
      const quizAttempts = quizAttemptsResult.data || [];
      const certificates = certificatesResult.data || [];
      const courses = coursesResult.data || [];
      const quizzes = quizzesResult.data || [];
      const videos = videosResult.data || [];
      const videoProgress = videoProgressResult.data || [];

      const courseMap = new Map(courses.map(c => [c.id, c.title]));
      const quizMap = new Map(quizzes.map(q => [q.id, { title: q.title, courseId: q.course_id }]));

      // Build User Progress data
      const progressData: UserProgress[] = enrollments.map(enrollment => {
        const courseVideos = videos.filter(v => v.course_id === enrollment.course_id);
        const userVideoProgress = videoProgress.filter(
          vp => vp.user_id === enrollment.user_id && courseVideos.some(cv => cv.id === vp.video_id)
        );
        const completedVideos = userVideoProgress.filter(vp => vp.completed).length;
        const totalVideos = courseVideos.length;

        return {
          userId: enrollment.user_id,
          userName: userMap.get(enrollment.user_id) || "Unknown",
          courseName: courseMap.get(enrollment.course_id) || "Unknown Course",
          videoProgress: totalVideos > 0 ? `${completedVideos}/${totalVideos}` : "0/0",
          enrolledAt: enrollment.enrolled_at,
          completedAt: enrollment.completed_at,
        };
      });

      // Build Quiz Performance data using nested Map to avoid UUID split issues
      const quizPerformanceData: QuizPerformance[] = [];
      const userQuizMap = new Map<string, Map<string, { pre: number | null; post: number | null }>>();

      quizAttempts.forEach(attempt => {
        const userId = attempt.user_id;
        const quizId = attempt.quiz_id;
        
        if (!userQuizMap.has(userId)) {
          userQuizMap.set(userId, new Map());
        }
        const userQuizzes = userQuizMap.get(userId)!;
        
        if (!userQuizzes.has(quizId)) {
          userQuizzes.set(quizId, { pre: null, post: null });
        }
        const entry = userQuizzes.get(quizId)!;
        
        if (attempt.attempt_type === "pre") {
          entry.pre = entry.pre === null ? attempt.score : Math.max(entry.pre, attempt.score);
        } else {
          entry.post = entry.post === null ? attempt.score : Math.max(entry.post, attempt.score);
        }
      });

      userQuizMap.forEach((quizzes, userId) => {
        quizzes.forEach((scores, quizId) => {
          const quizInfo = quizMap.get(quizId);
          if (quizInfo) {
            const improvement = scores.pre !== null && scores.post !== null
              ? scores.post - scores.pre
              : null;

            quizPerformanceData.push({
              userId,
              userName: userMap.get(userId) || "Unknown",
              courseName: courseMap.get(quizInfo.courseId) || "Unknown Course",
              quizTitle: quizInfo.title,
              preScore: scores.pre,
              postScore: scores.post,
              improvement,
            });
          }
        });
      });

      // Build Certificate Details data
      const certificateData: CertificateDetail[] = certificates.map(cert => ({
        userId: cert.user_id,
        userName: userMap.get(cert.user_id) || "Unknown",
        courseName: courseMap.get(cert.course_id) || "Unknown Course",
        certificateId: cert.id.slice(0, 8).toUpperCase(),
        issuedAt: cert.issued_at,
      }));

      setUserProgress(progressData);
      setQuizPerformance(quizPerformanceData);
      setCertificateDetails(certificateData);
    } catch (error) {
      console.error("Error fetching analytics:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-10">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <BookOpen className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{userProgress.length}</p>
                <p className="text-sm text-muted-foreground">Course Enrollments</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{quizPerformance.length}</p>
                <p className="text-sm text-muted-foreground">Quiz Attempts</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                <Award className="h-6 w-6 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{certificateDetails.length}</p>
                <p className="text-sm text-muted-foreground">Certificates Issued</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Tabs */}
      <Tabs defaultValue="progress" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="progress">Course Progress</TabsTrigger>
          <TabsTrigger value="quizzes">Quiz Performance</TabsTrigger>
          <TabsTrigger value="certificates">Certificates</TabsTrigger>
        </TabsList>

        <TabsContent value="progress">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart className="h-5 w-5" />
                User Course Progress
              </CardTitle>
              <CardDescription>Video completion tracking for department users</CardDescription>
            </CardHeader>
            <CardContent>
              {userProgress.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground">
                  No course enrollments yet
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Course</TableHead>
                      <TableHead className="text-center">Videos Completed</TableHead>
                      <TableHead>Enrolled</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {userProgress.map((progress, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">{progress.userName}</TableCell>
                        <TableCell>{progress.courseName}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant="secondary">{progress.videoProgress}</Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(progress.enrolledAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          {progress.completedAt ? (
                            <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                              Completed
                            </Badge>
                          ) : (
                            <Badge variant="outline">In Progress</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="quizzes">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Quiz Performance
              </CardTitle>
              <CardDescription>Pre and post quiz scores with improvement tracking</CardDescription>
            </CardHeader>
            <CardContent>
              {quizPerformance.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground">
                  No quiz attempts yet
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Course</TableHead>
                      <TableHead>Quiz</TableHead>
                      <TableHead className="text-center">Pre-Score</TableHead>
                      <TableHead className="text-center">Post-Score</TableHead>
                      <TableHead className="text-center">Improvement</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {quizPerformance.map((perf, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">{perf.userName}</TableCell>
                        <TableCell>{perf.courseName}</TableCell>
                        <TableCell>{perf.quizTitle}</TableCell>
                        <TableCell className="text-center">
                          {perf.preScore !== null ? (
                            <Badge variant="secondary">{perf.preScore}%</Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {perf.postScore !== null ? (
                            <Badge variant="secondary">{perf.postScore}%</Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {perf.improvement !== null ? (
                            <Badge 
                              className={
                                perf.improvement > 0 
                                  ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                                  : perf.improvement < 0
                                  ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                                  : ""
                              }
                              variant={perf.improvement === 0 ? "secondary" : "default"}
                            >
                              {perf.improvement > 0 ? "+" : ""}{perf.improvement}%
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="certificates">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Award className="h-5 w-5" />
                Certificate Details
              </CardTitle>
              <CardDescription>Certificates earned by department users</CardDescription>
            </CardHeader>
            <CardContent>
              {certificateDetails.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground">
                  No certificates issued yet
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Course</TableHead>
                      <TableHead>Certificate ID</TableHead>
                      <TableHead>Issued Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {certificateDetails.map((cert, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">{cert.userName}</TableCell>
                        <TableCell>{cert.courseName}</TableCell>
                        <TableCell>
                          <code className="px-2 py-1 bg-muted rounded text-sm">
                            {cert.certificateId}
                          </code>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(cert.issuedAt).toLocaleDateString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
