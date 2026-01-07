import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, Award, FileText } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import UserNav from "@/components/UserNav";

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

  useEffect(() => {
    if (user && courseId) {
      fetchCourseData();
    }
  }, [user, courseId]);

  const fetchCourseData = async () => {
    try {
      // Check enrollment
      const { data: enrollment, error: enrollmentError } = await supabase
        .from("enrollments")
        .select("*")
        .eq("user_id", user?.id)
        .eq("course_id", courseId)
        .single();

      if (enrollmentError || !enrollment) {
        toast.error("You are not enrolled in this course");
        navigate("/courses");
        return;
      }

      // Fetch course details
      const { data: courseData, error: courseError } = await supabase
        .from("courses")
        .select("id, title, description")
        .eq("id", courseId)
        .single();

      if (courseError) throw courseError;
      setCourse(courseData);

      // Fetch videos
      const { data: videosData, error: videosError } = await supabase
        .from("course_videos")
        .select("*")
        .eq("course_id", courseId)
        .order("order_index", { ascending: true });

      if (videosError) throw videosError;

      // Fetch video progress
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

      // Check if there's a quiz for this course
      const { data: quizData } = await supabase
        .from("quizzes")
        .select("id")
        .eq("course_id", courseId)
        .maybeSingle();

      if (quizData) {
        setQuizId(quizData.id);

        // Check if user has completed the pre-quiz
        const { data: preAttemptData } = await supabase
          .from("quiz_attempts")
          .select("id")
          .eq("user_id", user?.id)
          .eq("quiz_id", quizData.id)
          .eq("attempt_type", "pre")
          .maybeSingle();

        setHasCompletedPreQuiz(!!preAttemptData);

        // Check if user has passed the post-quiz
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

      // Update local state
      const updatedVideos = videos.map((v) =>
        v.id === videoId ? { ...v, completed: true } : v
      );
      setVideos(updatedVideos);
      calculateProgress(updatedVideos);

      // Update enrollment progress
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
      setCurrentVideoIndex(currentVideoIndex + 1);
    }
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return "N/A";
    const mins = Math.floor(seconds / 60);
    return `${mins} min`;
  };

  const getYouTubeEmbedUrl = (url: string) => {
    const videoId = url.match(
      /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/
    )?.[1];
    return videoId ? `https://www.youtube.com/embed/${videoId}` : url;
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

  const currentVideo = videos[currentVideoIndex];

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
                  {currentVideo.video_source === "youtube_single" ? (
                    <iframe
                      width="100%"
                      height="100%"
                      src={getYouTubeEmbedUrl(currentVideo.video_url)}
                      title={currentVideo.title}
                      frameBorder="0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  ) : (
                    <video
                      width="100%"
                      height="100%"
                      controls
                      src={currentVideo.video_url}
                    >
                      Your browser does not support the video tag.
                    </video>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6 space-y-4">
                <h1 className="text-2xl font-bold">{currentVideo.title}</h1>
                <p className="text-sm text-muted-foreground">
                  Video {currentVideoIndex + 1} of {videos.length} •{" "}
                  {formatDuration(currentVideo.duration_seconds)}
                </p>

                {currentVideo.description && (
                  <p className="text-muted-foreground">
                    {currentVideo.description}
                  </p>
                )}

                <div className="flex gap-4">
                  {!currentVideo.completed && (
                    <Button
                      onClick={() => markVideoCompleted(currentVideo.id)}
                      variant="default"
                    >
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Mark as Completed
                    </Button>
                  )}

                  {currentVideo.completed && (
                    <div className="flex items-center text-green-600">
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Completed
                    </div>
                  )}

                  {currentVideoIndex < videos.length - 1 && (
                    <Button onClick={handleNextVideo} variant="outline">
                      Next Video
                    </Button>
                  )}

                  {quizId && !hasCompletedPreQuiz && (
                    <Button
                      onClick={() => navigate(`/quiz/${quizId}?type=pre`)}
                      variant="default"
                    >
                      <FileText className="mr-2 h-4 w-4" />
                      Take Pre-Quiz
                    </Button>
                  )}

                  {progress === 100 && quizId && hasCompletedPreQuiz && !hasCompletedPostQuiz && (
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
                    {videos.filter((v) => v.completed).length} of {videos.length}{" "}
                    videos completed
                  </p>
                </div>

                {quizId && !hasCompletedPreQuiz && (
                  <Button
                    onClick={() => navigate(`/quiz/${quizId}?type=pre`)}
                    className="w-full"
                  >
                    <FileText className="mr-2 h-4 w-4" />
                    Take Pre-Quiz First
                  </Button>
                )}
                {progress === 100 && quizId && hasCompletedPreQuiz && !hasCompletedPostQuiz && (
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
                    onClick={() => navigate('/certificates')}
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
                      onClick={() => setCurrentVideoIndex(index)}
                      className={`w-full text-left p-3 rounded-lg border transition-colors ${
                        currentVideoIndex === index
                          ? "bg-primary/10 border-primary"
                          : "bg-card hover:bg-accent border-border"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {video.completed ? (
                          <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                        ) : (
                          <div className="h-5 w-5 rounded-full border-2 border-border flex-shrink-0 mt-0.5" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p
                            className={`font-medium text-sm line-clamp-2 ${
                              video.completed
                                ? "text-green-600"
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
