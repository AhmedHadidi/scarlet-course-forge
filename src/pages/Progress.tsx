import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress as ProgressBar } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TrendingUp, Trophy, Clock } from "lucide-react";
import UserNav from "@/components/UserNav";
import { useTranslation } from "react-i18next";

interface Enrollment {
  id: string;
  progress_percentage: number;
  enrolled_at: string;
  completed_at: string | null;
  courses: {
    id: string;
    title: string;
    description: string;
    difficulty_level: string;
    video_count: number;
  };
}

const Progress = () => {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProgress();
  }, [user]);

  const fetchProgress = async () => {
    if (!user) return;

    try {
      const { data } = await supabase
        .from("enrollments")
        .select(`
          *,
          courses (
            id,
            title,
            description,
            difficulty_level,
            video_count
          )
        `)
        .eq("user_id", user.id)
        .order("enrolled_at", { ascending: false });

      if (data) {
        // Sync progress for each enrollment
        await syncEnrollmentProgress(data);
      }
    } catch (error) {
      console.error("Error fetching progress:", error);
    } finally {
      setLoading(false);
    }
  };

  const syncEnrollmentProgress = async (enrollmentData: Enrollment[]) => {
    try {
      for (const enrollment of enrollmentData) {
        // Get all videos for this course
        const { data: videos } = await supabase
          .from("course_videos")
          .select("id")
          .eq("course_id", enrollment.courses.id);

        if (!videos || videos.length === 0) continue;

        // Get completed videos for this user and course
        const { data: completedVideos } = await supabase
          .from("video_progress")
          .select("video_id")
          .eq("user_id", user!.id)
          .eq("completed", true)
          .in("video_id", videos.map(v => v.id));

        const completedCount = completedVideos?.length || 0;
        const totalVideos = videos.length;
        const progressPercentage = Math.round((completedCount / totalVideos) * 100);

        // Update enrollment if progress has changed
        if (progressPercentage !== enrollment.progress_percentage) {
          const { data: updatedEnrollment } = await supabase
            .from("enrollments")
            .update({
              progress_percentage: progressPercentage,
              completed_at: progressPercentage === 100 ? new Date().toISOString() : null,
            })
            .eq("id", enrollment.id)
            .select(`
              *,
              courses (
                id,
                title,
                description,
                difficulty_level,
                video_count
              )
            `)
            .single();

          if (updatedEnrollment) {
            // Update local state with new progress
            enrollment.progress_percentage = progressPercentage;
            enrollment.completed_at = progressPercentage === 100 ? new Date().toISOString() : null;
          }
        }
      }

      setEnrollments([...enrollmentData]);
    } catch (error) {
      console.error("Error syncing enrollment progress:", error);
      setEnrollments(enrollmentData);
    }
  };

  const inProgressCourses = enrollments.filter(
    (e) => e.progress_percentage > 0 && e.progress_percentage < 100
  );
  const completedCourses = enrollments.filter((e) => e.progress_percentage === 100);
  const notStartedCourses = enrollments.filter((e) => e.progress_percentage === 0);

  const stats = [
    { title: t("progress.inProgress"), value: inProgressCourses.length, icon: TrendingUp, color: "text-primary" },
    { title: t("progress.completed"), value: completedCourses.length, icon: Trophy, color: "text-secondary" },
    { title: t("progress.notStarted"), value: notStartedCourses.length, icon: Clock, color: "text-muted-foreground" },
  ];

  const renderCourseCard = (enrollment: Enrollment) => {
    const isCompleted = enrollment.progress_percentage === 100;
    const isInProgress = enrollment.progress_percentage > 0 && enrollment.progress_percentage < 100;

    // Determine progress bar color — all stay within the red/crimson family
    let progressBarColor = "bg-rose-200 dark:bg-rose-900/40"; // not started
    if (isCompleted) progressBarColor = "bg-emerald-500 dark:bg-emerald-600";
    else if (isInProgress) progressBarColor = "bg-primary"; // existing crimson

    return (
      <Card key={enrollment.id} className="border-border transition-smooth hover:shadow-crimson">
        <CardHeader>
          <div className="flex items-start justify-between mb-2">
            <Badge variant="secondary" className="capitalize">
              {enrollment.courses.difficulty_level}
            </Badge>
            <span className={`text-sm font-semibold ${isCompleted ? "text-emerald-600 dark:text-emerald-400" : isInProgress ? "text-primary" : "text-muted-foreground"
              }`}>
              {enrollment.progress_percentage}%
            </span>
          </div>
          <CardTitle className="text-lg">{enrollment.courses.title}</CardTitle>
          <CardDescription className="line-clamp-2">
            {enrollment.courses.description}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Custom progress bar with clear contrast */}
          <div className="relative h-4 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700 mb-1">
            <div
              className={`h-full rounded-full transition-all duration-500 ${isCompleted
                  ? "bg-emerald-500"
                  : isInProgress
                    ? "bg-emerald-500"
                    : ""
                }`}
              style={{ width: `${enrollment.progress_percentage}%` }}
            />
          </div>
          {/* Status label */}
          <div className="flex items-center justify-between text-xs mb-4">
            <span className={`font-medium ${isCompleted ? "text-emerald-600 dark:text-emerald-400" : isInProgress ? "text-primary" : "text-muted-foreground"
              }`}>
              {isCompleted ? (
                <span className="flex items-center gap-1">
                  <Trophy className="h-3 w-3" /> {t("progress.completed")}
                </span>
              ) : isInProgress ? (
                <span className="flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" /> {t("progress.inProgress")}
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" /> {t("progress.notStarted")}
                </span>
              )}
            </span>
            <span className="text-muted-foreground">
              {enrollment.courses.video_count} {t("progress.videos")}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-4">
            <span>{t("progress.enrolled")} {new Date(enrollment.enrolled_at).toLocaleDateString()}</span>
          </div>
          <Button
            className="w-full"
            variant={isCompleted ? "outline" : "default"}
            onClick={() => window.location.href = `/courses/${enrollment.courses.id}`}
          >
            {isCompleted ? t("progress.completed") : t("progress.continueLearning")}
          </Button>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <UserNav />

      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold mb-2">{t("progress.title")}</h2>
          <p className="text-muted-foreground">{t("progress.subtitle")}</p>
        </div>

        {/* Stats */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          {stats.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <Card key={index} className="border-border">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">{stat.title}</p>
                      <p className="text-3xl font-bold">{stat.value}</p>
                    </div>
                    <div className={`h-12 w-12 rounded-lg gradient-crimson flex items-center justify-center`}>
                      <Icon className="h-6 w-6 text-white" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {loading ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">{t("progress.loading")}</p>
          </div>
        ) : (
          <>
            {/* In Progress */}
            {inProgressCourses.length > 0 && (
              <div className="mb-12">
                <h3 className="text-2xl font-bold mb-6">{t("progress.inProgress")}</h3>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {inProgressCourses.map(renderCourseCard)}
                </div>
              </div>
            )}

            {/* Completed */}
            {completedCourses.length > 0 && (
              <div className="mb-12">
                <h3 className="text-2xl font-bold mb-6">{t("progress.completed")}</h3>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {completedCourses.map(renderCourseCard)}
                </div>
              </div>
            )}

            {/* Not Started */}
            {notStartedCourses.length > 0 && (
              <div>
                <h3 className="text-2xl font-bold mb-6">{t("progress.notStarted")}</h3>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {notStartedCourses.map(renderCourseCard)}
                </div>
              </div>
            )}

            {enrollments.length === 0 && (
              <div className="text-center py-12">
                <p className="text-muted-foreground mb-4">{t("progress.noEnrolled")}</p>
                <Button
                  className="gradient-crimson"
                  onClick={() => window.location.href = '/dashboard'}
                >
                  {t("progress.browseCourses")}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default Progress;
