import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, Award, FileText } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import UserNav from "@/components/UserNav";
import { useVideoEngagement } from "@/hooks/useVideoEngagement";
import { useYouTubePlayer } from "@/hooks/useYouTubePlayer";
import { useVideoEventTracker } from "@/hooks/useVideoEventTracker";

interface Video {
  id: string;
  title: string;
  video_url: string;
  video_source: string;
  description: string | null;
  duration_seconds: number | null;
  order_index: number;
  completed: boolean;
}

interface Course {
  id: string;
  title: string;
  description: string;
}

function generateSessionId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

const CoursePlayer = () => {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [course, setCourse] = useState<Course | null>(null);
  const [videos, setVideos] = useState<Video[]>([]);
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [quizId, setQuizId] = useState<string | null>(null);
  const [hasCompletedPreQuiz, setHasCompletedPreQuiz] = useState(false);
  const [hasCompletedPostQuiz, setHasCompletedPostQuiz] = useState(false);
  const [trackingOptIn, setTrackingOptIn] = useState(true);

  const [sessionId] = useState(() => generateSessionId());

  const activeVideo = videos[currentVideoIndex];
  const isYouTube = activeVideo?.video_source === "youtube_single";

  // Silent engagement tracking (data only visible to admins/sub-admins)
  const { engagement, resetEngagement, setManualDuration } = useVideoEngagement({
    videoId: activeVideo?.id || "",
    videoDuration: activeVideo?.duration_seconds || null,
  });

  // Event tracker for granular behavioral data
  const { trackEvent, getSummary, flushEvents } = useVideoEventTracker({
    userId: user?.id,
    videoId: activeVideo?.id || "",
    sessionId,
    trackingEnabled: trackingOptIn,
  });

  // Track whether we've already captured the duration for the current video
  const durationCapturedRef = useRef<string | null>(null);

  // Wrap trackEvent to capture YouTube duration for engagement calculations
  const handlePlayerEvent = useCallback(
    (event: Parameters<typeof trackEvent>[0]) => {
      try {
        // Capture actual duration from YouTube player — only once per video
        if (
          event.totalDuration > 0 &&
          activeVideo &&
          durationCapturedRef.current !== activeVideo.id
        ) {
          durationCapturedRef.current = activeVideo.id;
          setManualDuration(event.totalDuration);

          // Update course_videos if duration_seconds is missing (best-effort, may fail for non-admins)
          if (!activeVideo.duration_seconds) {
            const videoId = activeVideo.id;
            const rounded = Math.round(event.totalDuration);
            supabase
              .from("course_videos")
              .update({ duration_seconds: rounded })
              .eq("id", videoId)
              .then(({ error: updateError }) => {
                if (!updateError) {
                  setVideos((prev) =>
                    prev.map((v) =>
                      v.id === videoId ? { ...v, duration_seconds: rounded } : v
                    )
                  );
                }
              });
          }
        }
        trackEvent(event);
      } catch (err) {
        console.error("Error in handlePlayerEvent:", err);
      }
    },
    [trackEvent, activeVideo, setManualDuration]
  );

  // YouTube IFrame Player API hook
  const containerId = "yt-player-stable";
  useYouTubePlayer({
    containerId,
    videoUrl: activeVideo?.video_url || "",
    onEvent: handlePlayerEvent,
    enabled: isYouTube && !!activeVideo,
  });

  // Fetch tracking preference
  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("tracking_opt_in")
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        if (data) setTrackingOptIn(data.tracking_opt_in ?? true);
      });
  }, [user]);

  useEffect(() => {
    if (user && courseId) {
      fetchCourseData();
    }
  }, [user, courseId]);

  const fetchCourseData = async () => {
    try {
      const { data: enrollment, error: enrollmentError } = await supabase
        .from("enrollments")
        .select("*")
        .eq("user_id", user?.id)
        .eq("course_id", courseId)
        .single();

      if (enrollmentError || !enrollment) {
        toast.error("You are not enrolled in this course");
        navigate("/dashboard");
        return;
      }

      const { data: courseData, error: courseError } = await supabase
        .from("courses")
        .select("id, title, description")
        .eq("id", courseId)
        .single();

      if (courseError) throw courseError;
      setCourse(courseData);

      const { data: videosData, error: videosError } = await supabase
        .from("course_videos")
        .select("*")
        .eq("course_id", courseId)
        .order("order_index", { ascending: true });

      if (videosError) throw videosError;

      const { data: progressData } = await supabase
        .from("video_progress")
        .select("video_id, completed")
        .eq("user_id", user?.id);

      const progressMap = new Map(
        progressData?.map((p) => [p.video_id, p.completed]) || []
      );

      const videosWithProgress = videosData.map((video) => ({
        ...video,
        completed: progressMap.get(video.id) || false,
      }));

      setVideos(videosWithProgress);
      calculateProgress(videosWithProgress);

      const { data: quizData } = await supabase
        .from("quizzes")
        .select("id")
        .eq("course_id", courseId)
        .maybeSingle();

      if (quizData) {
        setQuizId(quizData.id);

        const { data: preAttemptData } = await supabase
          .from("quiz_attempts")
          .select("id")
          .eq("user_id", user?.id)
          .eq("quiz_id", quizData.id)
          .eq("attempt_type", "pre")
          .maybeSingle();

        setHasCompletedPreQuiz(!!preAttemptData);

        const { data: postAttemptData } = await supabase
          .from("quiz_attempts")
          .select("passed")
          .eq("user_id", user?.id)
          .eq("quiz_id", quizData.id)
          .eq("attempt_type", "post")
          .eq("passed", true)
          .maybeSingle();

        setHasCompletedPostQuiz(!!postAttemptData);
      }

      setLoading(false);
    } catch (error) {
      console.error("Error fetching course data:", error);
      toast.error("Failed to load course");
      setLoading(false);
    }
  };

  const calculateProgress = (videoList: Video[]) => {
    const completed = videoList.filter((v) => v.completed).length;
    const total = videoList.length;
    setProgress(total > 0 ? Math.round((completed / total) * 100) : 0);
  };

  const markVideoCompleted = async (videoId: string) => {
    try {
      const { error } = await supabase.from("video_progress").upsert({
        user_id: user?.id,
        video_id: videoId,
        completed: true,
        last_watched_at: new Date().toISOString(),
      });

      if (error) throw error;

      // Flush any pending events before saving summary
      await flushEvents();

      const summary = getSummary();

      const effectiveDuration =
        engagement.totalDurationSeconds > 0
          ? engagement.totalDurationSeconds
          : activeVideo.duration_seconds || engagement.watchTimeSeconds || 1;
      const engagementScore =
        effectiveDuration > 0
          ? Math.min(
              100,
              Math.round(
                (engagement.watchTimeSeconds / effectiveDuration) * 100
              )
            )
          : 0;

      await supabase.from("video_engagement").upsert(
        {
          user_id: user?.id!,
          video_id: videoId,
          watch_time_seconds: engagement.watchTimeSeconds,
          total_duration_seconds: Math.round(effectiveDuration),
          tab_switches: engagement.tabSwitches,
          engagement_score: Math.round(engagementScore),
          session_id: sessionId,
          pause_count: summary.pauseCount,
          rewind_count: summary.rewindCount,
          skip_count: summary.skipCount,
          completion_rate: summary.completionRate,
          max_playback_rate: summary.maxPlaybackRate,
          drop_off_point: summary.dropOffPoint,
        },
        { onConflict: "user_id,video_id" }
      );

      resetEngagement();

      const updatedVideos = videos.map((v) =>
        v.id === videoId ? { ...v, completed: true } : v
      );
      setVideos(updatedVideos);
      calculateProgress(updatedVideos);

      const completedCount = updatedVideos.filter((v) => v.completed).length;
      const progressPercentage = Math.round(
        (completedCount / videos.length) * 100
      );

      await supabase
        .from("enrollments")
        .update({
          progress_percentage: progressPercentage,
          completed_at:
            progressPercentage === 100 ? new Date().toISOString() : null,
        })
        .eq("user_id", user?.id)
        .eq("course_id", courseId);

      toast.success("Video marked as completed!");
    } catch (error) {
      console.error("Error marking video completed:", error);
      toast.error("Failed to update progress");
    }
  };

  const handleNextVideo = () => {
    if (currentVideoIndex < videos.length - 1) {
      durationCapturedRef.current = null;
      setCurrentVideoIndex(currentVideoIndex + 1);
    }
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return "N/A";
    const mins = Math.floor(seconds / 60);
    return `${mins} min`;
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">Loading course...</div>
      </div>
    );
  }

  if (!course || videos.length === 0) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">No videos available for this course.</div>
      </div>
    );
  }

  if (quizId && !hasCompletedPreQuiz) {
    return (
      <div className="min-h-screen bg-background">
        <UserNav />
        <div className="container mx-auto px-4 py-16">
          <Card className="max-w-lg mx-auto">
            <CardContent className="p-8 text-center space-y-6">
              <FileText className="h-16 w-16 mx-auto text-primary" />
              <h1 className="text-2xl font-bold">{course.title}</h1>
              <p className="text-muted-foreground">
                Before you start this course, please take a short pre-quiz to
                assess your current knowledge.
              </p>
              <Button
                onClick={() => navigate(`/quiz/${quizId}?type=pre`)}
                size="lg"
                className="w-full"
              >
                <FileText className="mr-2 h-5 w-5" />
                Take Pre-Quiz
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <UserNav />
      <div className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Video Player Section */}
          <div className="lg:col-span-2 space-y-4">
            <Card>
              <CardContent className="p-0">
                <div className="aspect-video bg-black">
                  {isYouTube ? (
                    <div
                      id={containerId}
                      className="w-full h-full"
                    />
                  ) : (
                    <video
                      width="100%"
                      height="100%"
                      controls
                      src={activeVideo.video_url}
                    >
                      Your browser does not support the video tag.
                    </video>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6 space-y-4">
                <h1 className="text-2xl font-bold">{activeVideo.title}</h1>
                <p className="text-sm text-muted-foreground">
                  Video {currentVideoIndex + 1} of {videos.length} •{" "}
                  {formatDuration(activeVideo.duration_seconds)}
                </p>

                {activeVideo.description && (
                  <p className="text-muted-foreground">
                    {activeVideo.description}
                  </p>
                )}

                <div className="flex flex-wrap gap-4">
                  {!activeVideo.completed && (
                    <Button
                      onClick={() => markVideoCompleted(activeVideo.id)}
                      variant="default"
                    >
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Mark as Completed
                    </Button>
                  )}

                  {activeVideo.completed && (
                    <div className="flex items-center text-primary">
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Completed
                    </div>
                  )}

                  {currentVideoIndex < videos.length - 1 && (
                    <Button onClick={handleNextVideo} variant="outline">
                      Next Video
                    </Button>
                  )}

                  {progress === 100 && quizId && !hasCompletedPostQuiz && (
                    <Button
                      onClick={() => navigate(`/quiz/${quizId}?type=post`)}
                      variant="default"
                    >
                      <FileText className="mr-2 h-4 w-4" />
                      Take Final Quiz
                    </Button>
                  )}

                  {progress === 100 && hasCompletedPostQuiz && (
                    <Button
                      onClick={() => navigate("/certificates")}
                      variant="outline"
                    >
                      <Award className="mr-2 h-4 w-4" />
                      View Certificate
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Course Content Sidebar */}
          <div className="space-y-4">
            <Card>
              <CardContent className="p-6 space-y-4">
                <div>
                  <h2 className="text-xl font-bold mb-2">Your Progress</h2>
                  <div className="text-right text-sm font-semibold mb-2">
                    {progress}%
                  </div>
                  <Progress value={progress} className="h-2" />
                  <p className="text-sm text-muted-foreground mt-2">
                    {videos.filter((v) => v.completed).length} of{" "}
                    {videos.length} videos completed
                  </p>
                </div>

                {progress === 100 && quizId && !hasCompletedPostQuiz && (
                  <Button
                    onClick={() => navigate(`/quiz/${quizId}?type=post`)}
                    className="w-full"
                  >
                    <FileText className="mr-2 h-4 w-4" />
                    Take Final Quiz
                  </Button>
                )}
                {progress === 100 && hasCompletedPostQuiz && (
                  <Button
                    onClick={() => navigate("/certificates")}
                    className="w-full"
                  >
                    <Award className="mr-2 h-4 w-4" />
                    View Certificate
                  </Button>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold mb-4">Course Content</h3>
                <div className="space-y-2">
                  {videos.map((video, index) => (
                    <button
                      key={video.id}
                      onClick={() => { durationCapturedRef.current = null; setCurrentVideoIndex(index); }}
                      className={`w-full text-left p-3 rounded-lg border transition-colors ${
                        currentVideoIndex === index
                          ? "bg-primary/10 border-primary"
                          : "bg-card hover:bg-accent border-border"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {video.completed ? (
                          <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                        ) : (
                          <div className="h-5 w-5 rounded-full border-2 border-border flex-shrink-0 mt-0.5" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p
                            className={`font-medium text-sm line-clamp-2 ${
                              video.completed
                                ? "text-primary"
                                : currentVideoIndex === index
                                ? "text-primary"
                                : "text-foreground"
                            }`}
                          >
                            {video.title}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {formatDuration(video.duration_seconds)}
                          </p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CoursePlayer;
