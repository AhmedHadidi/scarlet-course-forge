import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, Award, FileText, Lock } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import UserNav from "@/components/UserNav";
import { useVideoEngagement } from "@/hooks/useVideoEngagement";
import { useYouTubePlayer } from "@/hooks/useYouTubePlayer";
import { useVideoEventTracker } from "@/hooks/useVideoEventTracker";
import { useVideoProgressSync } from "@/hooks/useVideoProgressSync";

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
  const { t } = useTranslation();
  const [course, setCourse] = useState<Course | null>(null);
  const [videos, setVideos] = useState<Video[]>([]);
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [quizId, setQuizId] = useState<string | null>(null);
  const [hasCompletedPreQuiz, setHasCompletedPreQuiz] = useState(false);
  const [hasCompletedPostQuiz, setHasCompletedPostQuiz] = useState(false);
  const [trackingOptIn, setTrackingOptIn] = useState(true);
  const [resumeReady, setResumeReady] = useState(false);
  const [startPosition, setStartPosition] = useState(0);

  const [sessionId] = useState(() => generateSessionId());

  const videosRef = useRef<Video[]>([]);
  videosRef.current = videos;
  const currentVideoIndexRef = useRef(currentVideoIndex);
  currentVideoIndexRef.current = currentVideoIndex;

  const watchedSecondsThisSessionRef = useRef(0);
  const durationCapturedRef = useRef<string | null>(null);

  const activeVideo = videos[currentVideoIndex];
  const isYouTube = activeVideo?.video_source === "youtube_single";

  // ── Engagement tracking ───────────────────────────────────────────────────
  const { engagement, resetEngagement, setManualDuration, addPlaySeconds } =
    useVideoEngagement({
      videoId: activeVideo?.id || "",
      videoDuration: activeVideo?.duration_seconds || null,
    });
  const engagementRef = useRef(engagement);
  engagementRef.current = engagement;

  // ── Event tracker ─────────────────────────────────────────────────────────
  const { trackEvent, getSummary, flushEvents } = useVideoEventTracker({
    userId: user?.id,
    videoId: activeVideo?.id || "",
    sessionId,
    trackingEnabled: trackingOptIn,
  });

  // Forward refs for functions used in callbacks
  const flushEventsRef = useRef(flushEvents);
  flushEventsRef.current = flushEvents;
  const getSummaryRef = useRef(getSummary);
  getSummaryRef.current = getSummary;

  // ── YouTube player ────────────────────────────────────────────────────────
  const containerId = "yt-player-stable";
  const handlePlayerEventRef = useRef<(e: any) => void>(() => { });

  const {
    isPlaying: ytIsPlaying,
    currentTime: ytCurrentTime,
    totalDuration: ytTotalDuration,
  } = useYouTubePlayer({
    containerId,
    videoUrl: activeVideo?.video_url || "",
    enabled: isYouTube && !!activeVideo && resumeReady,
    startSeconds: startPosition,
    onEvent: useCallback((e: any) => handlePlayerEventRef.current(e), []),
  });

  // ── Progress sync (position only, localStorage based) ────────────────────
  const progressSync = useVideoProgressSync({
    userId: user?.id,
    videoId: activeVideo?.id || "",
    courseId: courseId || "",
    isPlaying: ytIsPlaying,
    currentTime: ytCurrentTime,
    totalDuration: ytTotalDuration || activeVideo?.duration_seconds || 0,
  });
  const progressSyncRef = useRef(progressSync);
  progressSyncRef.current = progressSync;

  // ── Baseline: snapshot of DB values at session start (fetched once) ────────
  const baselineRef = useRef<{
    watchTime: number; pauses: number; rewinds: number;
    skips: number; tabSwitches: number; loaded: boolean;
  }>({ watchTime: 0, pauses: 0, rewinds: 0, skips: 0, tabSwitches: 0, loaded: false });

  // Fetch baseline from DB once per video
  useEffect(() => {
    if (!user?.id || !activeVideo?.id) return;
    let cancelled = false;

    baselineRef.current = { watchTime: 0, pauses: 0, rewinds: 0, skips: 0, tabSwitches: 0, loaded: false };

    supabase
      .from("video_engagement")
      .select("watch_time_seconds, pause_count, rewind_count, skip_count, tab_switches")
      .eq("user_id", user.id)
      .eq("video_id", activeVideo.id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        baselineRef.current = {
          watchTime: data?.watch_time_seconds || 0,
          pauses: data?.pause_count || 0,
          rewinds: data?.rewind_count || 0,
          skips: data?.skip_count || 0,
          tabSwitches: data?.tab_switches || 0,
          loaded: true,
        };
      });

    return () => { cancelled = true; };
  }, [user?.id, activeVideo?.id]);

  // ── Save engagement to video_engagement table ─────────────────────────────
  const saveEngagementToDb = useCallback(
    async (videoId: string, isFinalSave = false) => {
      if (!user?.id || !videoId) return;

      const eng = engagementRef.current;
      const sessionWatchTime = eng.watchTimeSeconds;

      // GUARD: never overwrite DB with zero values
      if (sessionWatchTime < 1 && !isFinalSave) return;

      await flushEventsRef.current();
      const summary = getSummaryRef.current();
      const base = baselineRef.current;

      const effectiveDuration =
        eng.totalDurationSeconds > 0
          ? eng.totalDurationSeconds
          : videosRef.current.find(v => v.id === videoId)?.duration_seconds ||
          Math.max(sessionWatchTime, 1);

      // baseline + session (no re-reading, no double-counting)
      const totalWatchTime = base.watchTime + sessionWatchTime;
      const totalPauses = base.pauses + summary.pauseCount;
      const totalRewinds = base.rewinds + summary.rewindCount;
      const totalSkips = base.skips + summary.skipCount;
      const totalTabSwitches = base.tabSwitches + eng.tabSwitches;

      const engagementScore =
        effectiveDuration > 0
          ? Math.min(100, Math.round((totalWatchTime / effectiveDuration) * 100))
          : 0;

      const completionRate = isFinalSave ? 100 : summary.completionRate;

      try {
        await supabase.from("video_engagement").upsert(
          {
            user_id: user.id,
            video_id: videoId,
            watch_time_seconds: totalWatchTime,
            total_duration_seconds: Math.round(effectiveDuration),
            tab_switches: totalTabSwitches,
            engagement_score: Math.round(engagementScore),
            session_id: sessionId,
            pause_count: totalPauses,
            rewind_count: totalRewinds,
            skip_count: totalSkips,
            completion_rate: completionRate,
            max_playback_rate: Math.max(summary.maxPlaybackRate, 1),
            drop_off_point: isFinalSave ? null : summary.dropOffPoint,
          },
          { onConflict: "user_id,video_id" }
        );
      } catch (err) {
        console.error("saveEngagementToDb error:", err);
      }
    },
    [user, sessionId]
  );
  const saveEngagementRef = useRef(saveEngagementToDb);
  saveEngagementRef.current = saveEngagementToDb;

  // ── PERIODIC engagement save every 10s while playing ──────────────────────
  const engagementSaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (ytIsPlaying && activeVideo?.id) {
      engagementSaveTimerRef.current = setInterval(() => {
        saveEngagementRef.current(activeVideo.id, false);
      }, 10000); // every 10 seconds
    } else {
      if (engagementSaveTimerRef.current) {
        clearInterval(engagementSaveTimerRef.current);
        engagementSaveTimerRef.current = null;
      }
    }
    return () => {
      if (engagementSaveTimerRef.current) {
        clearInterval(engagementSaveTimerRef.current);
        engagementSaveTimerRef.current = null;
      }
    };
  }, [ytIsPlaying, activeVideo?.id]);

  // NOTE: No beforeunload engagement save needed. The periodic 10s save
  // already handles accumulation via fetch + merge. Losing ≤10s of data on
  // tab close is acceptable versus risking overwriting accumulated values.

  const calculateProgress = (videoList: Video[]) => {
    const completed = videoList.filter(v => v.completed).length;
    const total = videoList.length;
    setProgress(total > 0 ? Math.round((completed / total) * 100) : 0);
  };

  const markVideoCompleted = useCallback(
    async (videoId: string) => {
      try {
        await saveEngagementRef.current(videoId, true);

        // Use ONLY existing columns — no last_watched_position!
        const { error } = await supabase.from("video_progress").upsert(
          {
            user_id: user?.id,
            video_id: videoId,
            completed: true,
            last_watched_at: new Date().toISOString(),
          },
          { onConflict: "user_id,video_id" }
        );

        if (error) throw error;

        // Clear saved position in localStorage
        if (user?.id) {
          try { localStorage.removeItem(`vp_${user.id}_${videoId}`); } catch { }
        }

        resetEngagement();
        watchedSecondsThisSessionRef.current = 0;
        progressSyncRef.current.reset();

        setVideos(prev => {
          const updated = prev.map(v =>
            v.id === videoId ? { ...v, completed: true } : v
          );
          calculateProgress(updated);

          const completedCount = updated.filter(v => v.completed).length;
          const progressPercentage = Math.round(
            (completedCount / updated.length) * 100
          );

          supabase
            .from("enrollments")
            .update({
              progress_percentage: progressPercentage,
              completed_at:
                progressPercentage === 100 ? new Date().toISOString() : null,
            })
            .eq("user_id", user?.id)
            .eq("course_id", courseId)
            .then(() => { });

          return updated;
        });

        toast.success(t("coursePlayer.videoCompleted"));
      } catch (error) {
        console.error("Error marking video completed:", error);
        toast.error(t("coursePlayer.failedUpdateProgress"));
      }
    },
    [user, courseId, resetEngagement]
  );

  // Auto-advance after completion
  const handleAutoComplete = useCallback(
    async (videoId: string) => {
      await markVideoCompleted(videoId);
      setCurrentVideoIndex(prev => {
        if (prev < videosRef.current.length - 1) {
          durationCapturedRef.current = null;
          return prev + 1;
        }
        return prev;
      });
    },
    [markVideoCompleted]
  );

  // ── Wire up the player event handler ──────────────────────────────────────
  handlePlayerEventRef.current = (event: any) => {
    try {
      const vid = videosRef.current[currentVideoIndexRef.current];

      // Capture duration once per video
      if (
        event.totalDuration > 0 &&
        vid &&
        durationCapturedRef.current !== vid.id
      ) {
        durationCapturedRef.current = vid.id;
        setManualDuration(event.totalDuration);
        if (!vid.duration_seconds) {
          const rounded = Math.round(event.totalDuration);
          supabase
            .from("course_videos")
            .update({ duration_seconds: rounded })
            .eq("id", vid.id)
            .then(({ error: e }) => {
              if (!e) {
                setVideos(prev =>
                  prev.map(v =>
                    v.id === vid.id ? { ...v, duration_seconds: rounded } : v
                  )
                );
              }
            });
        }
      }

      // Accumulate actual play seconds (every 5s tick = 5 real seconds)
      if (event.eventType === "progress") {
        addPlaySeconds(5);
        watchedSecondsThisSessionRef.current += 5;
        console.log('[PROGRESS-TICK]', { watchedThisSession: watchedSecondsThisSessionRef.current, engWatchTime: engagementRef.current.watchTimeSeconds });
      }

      // Auto-complete + advance when video ends
      if (event.eventType === "completed" && vid && !vid.completed) {
        handleAutoComplete(vid.id);
      }

      trackEvent(event);
    } catch (err) {
      console.error("handlePlayerEvent error:", err);
    }
  };

  // ── Tracking preference ───────────────────────────────────────────────────
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
    if (user && courseId) fetchCourseData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        toast.error(t("coursePlayer.notEnrolled"));
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

      // Only select existing columns from video_progress
      const { data: progressData } = await supabase
        .from("video_progress")
        .select("video_id, completed, last_watched_at")
        .eq("user_id", user?.id);

      const progressMap = new Map(
        (progressData || []).map(p => [p.video_id, p])
      );

      const videosWithProgress = videosData.map(video => ({
        ...video,
        completed: progressMap.get(video.id)?.completed || false,
      }));

      setVideos(videosWithProgress);
      calculateProgress(videosWithProgress);

      // ── Determine resume index using localStorage for positions ──────────
      let resumeIndex = 0;
      let latestWatchedAt = "";
      let partialIndex = -1;

      videosWithProgress.forEach((video, idx) => {
        if (!video.completed && user?.id) {
          try {
            const raw = localStorage.getItem(`vp_${user.id}_${video.id}`);
            if (raw) {
              const cached = JSON.parse(raw);
              const pos = Number(cached.position ?? 0);
              // Use last_watched_at from DB to determine most recently watched
              const watchedAt = progressMap.get(video.id)?.last_watched_at || "";
              if (pos > 0 && watchedAt > latestWatchedAt) {
                latestWatchedAt = watchedAt;
                partialIndex = idx;
              }
            }
          } catch { /* ignore */ }
        }
      });

      const firstIncompleteIdx = videosWithProgress.findIndex(v => !v.completed);
      if (partialIndex >= 0) {
        resumeIndex = partialIndex;
        try {
          const raw = localStorage.getItem(
            `vp_${user?.id}_${videosWithProgress[partialIndex].id}`
          );
          if (raw) {
            setStartPosition(Number(JSON.parse(raw).position ?? 0));
          }
        } catch { /* ignore */ }
      } else if (firstIncompleteIdx >= 0) {
        resumeIndex = firstIncompleteIdx;
        setStartPosition(0);
      } else {
        resumeIndex = videosWithProgress.length - 1;
        setStartPosition(0);
      }

      setCurrentVideoIndex(resumeIndex);
      setResumeReady(true);

      // ── Quiz ──────────────────────────────────────────────────────────────
      const { data: quizData } = await supabase
        .from("quizzes")
        .select("id")
        .eq("course_id", courseId)
        .maybeSingle();

      if (quizData) {
        setQuizId(quizData.id);

        const [preRes, postRes] = await Promise.all([
          supabase
            .from("quiz_attempts")
            .select("id")
            .eq("user_id", user?.id)
            .eq("quiz_id", quizData.id)
            .eq("attempt_type", "pre")
            .maybeSingle(),
          supabase
            .from("quiz_attempts")
            .select("passed")
            .eq("user_id", user?.id)
            .eq("quiz_id", quizData.id)
            .eq("attempt_type", "post")
            .eq("passed", true)
            .maybeSingle(),
        ]);

        setHasCompletedPreQuiz(!!preRes.data);
        setHasCompletedPostQuiz(!!postRes.data);
      }

      setLoading(false);
    } catch (error) {
      console.error("Error fetching course data:", error);
      toast.error(t("coursePlayer.failedLoadCourse"));
      setLoading(false);
    }
  };

  // Check if a video index is accessible (completed or first uncompleted)
  const isVideoAccessible = useCallback(
    (index: number) => {
      const video = videosRef.current[index];
      if (!video) return false;
      // Already completed videos can always be revisited
      if (video.completed) return true;
      // Current video is always accessible
      if (index === currentVideoIndex) return true;
      // First uncompleted video is accessible only if all previous are completed
      const allPreviousCompleted = videosRef.current
        .slice(0, index)
        .every((v) => v.completed);
      return allPreviousCompleted;
    },
    [currentVideoIndex]
  );

  // Switch video with position loading
  const switchToVideo = useCallback(
    async (index: number) => {
      if (index === currentVideoIndex) return;

      // Block navigation to inaccessible videos
      if (!isVideoAccessible(index)) {
        toast.error(t("coursePlayer.completeCurrentFirst"));
        return;
      }

      // Save current engagement before switching
      if (activeVideo?.id) {
        saveEngagementRef.current(activeVideo.id, false);
      }
      progressSyncRef.current.saveProgress(ytCurrentTime);

      const targetVideo = videosRef.current[index];
      let pos = 0;
      if (targetVideo && user?.id && !targetVideo.completed) {
        try {
          const raw = localStorage.getItem(`vp_${user.id}_${targetVideo.id}`);
          if (raw) pos = Number(JSON.parse(raw).position ?? 0);
        } catch { /* ignore */ }
      }

      durationCapturedRef.current = null;
      resetEngagement();
      watchedSecondsThisSessionRef.current = 0;
      setStartPosition(pos);
      setResumeReady(false);
      setCurrentVideoIndex(index);
      setTimeout(() => setResumeReady(true), 300);
    },
    [currentVideoIndex, activeVideo, user, ytCurrentTime, resetEngagement, isVideoAccessible, t]
  );

  const handleNextVideo = () => {
    if (currentVideoIndex < videos.length - 1) {
      switchToVideo(currentVideoIndex + 1);
    }
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return "";
    const mins = Math.floor(seconds / 60);
    return t("coursePlayer.min", { mins });
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        {t("coursePlayer.loadingCourse")}
      </div>
    );
  }

  if (!course || videos.length === 0) {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        {t("coursePlayer.noVideos")}
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
                {t("coursePlayer.preQuizPrompt")}
              </p>
              <Button
                onClick={() => navigate(`/quiz/${quizId}?type=pre`)}
                size="lg"
                className="w-full"
              >
                <FileText className="mr-2 h-5 w-5" />
                {t("coursePlayer.takePreQuiz")}
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
          {/* ── Video Player ── */}
          <div className="lg:col-span-2 space-y-4">
            <Card>
              <CardContent className="p-0">
                <div className="aspect-video bg-black relative">
                  {isYouTube ? (
                    <>
                      <div
                        id={containerId}
                        className="w-full h-full"
                        style={{ display: resumeReady ? "block" : "none" }}
                      />
                      {!resumeReady && (
                        <div className="absolute inset-0 flex items-center justify-center text-white text-sm opacity-60">
                          {t("coursePlayer.loading")}
                        </div>
                      )}
                    </>
                  ) : (
                    <video
                      width="100%"
                      height="100%"
                      controls
                      src={activeVideo.video_url}
                    >
                      {t("coursePlayer.videoUnsupported")}
                    </video>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6 space-y-4">
                <h1 className="text-2xl font-bold">{activeVideo.title}</h1>
                <p className="text-sm text-muted-foreground">
                  {t("coursePlayer.videoOf", { current: currentVideoIndex + 1, total: videos.length })}
                  {activeVideo.duration_seconds
                    ? ` · ${formatDuration(activeVideo.duration_seconds)}`
                    : ""}
                </p>

                {activeVideo.description && (
                  <p className="text-muted-foreground">
                    {activeVideo.description}
                  </p>
                )}

                <div className="flex flex-wrap gap-4">
                  {!activeVideo.completed && (
                    <Button onClick={() => markVideoCompleted(activeVideo.id)}>
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      {t("coursePlayer.markCompleted")}
                    </Button>
                  )}

                  {activeVideo.completed && (
                    <div className="flex items-center text-primary font-medium">
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      {t("coursePlayer.completed")}
                    </div>
                  )}

                  {currentVideoIndex < videos.length - 1 && (
                    <Button
                      onClick={handleNextVideo}
                      variant="outline"
                      disabled={!activeVideo.completed}
                      title={!activeVideo.completed ? t("coursePlayer.completeCurrentFirst") : ""}
                    >
                      {t("coursePlayer.nextVideo")}
                    </Button>
                  )}

                  {progress === 100 && quizId && !hasCompletedPostQuiz && (
                    <Button onClick={() => navigate(`/quiz/${quizId}?type=post`)}>
                      <FileText className="mr-2 h-4 w-4" />
                      {t("coursePlayer.takeFinalQuiz")}
                    </Button>
                  )}

                  {progress === 100 && hasCompletedPostQuiz && (
                    <Button
                      onClick={() => navigate("/certificates")}
                      variant="outline"
                    >
                      <Award className="mr-2 h-4 w-4" />
                      {t("coursePlayer.viewCertificate")}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ── Sidebar ── */}
          <div className="space-y-4">
            <Card>
              <CardContent className="p-6 space-y-4">
                <h2 className="text-xl font-bold">{t("coursePlayer.yourProgress")}</h2>
                <div className="text-right text-sm font-semibold">{progress}%</div>
                <Progress value={progress} className="h-2" />
                <p className="text-sm text-muted-foreground">
                  {t("coursePlayer.videosCompleted", { completed: videos.filter(v => v.completed).length, total: videos.length })}
                </p>

                {progress === 100 && quizId && !hasCompletedPostQuiz && (
                  <Button
                    onClick={() => navigate(`/quiz/${quizId}?type=post`)}
                    className="w-full"
                  >
                    <FileText className="mr-2 h-4 w-4" />
                    {t("coursePlayer.takeFinalQuiz")}
                  </Button>
                )}
                {progress === 100 && hasCompletedPostQuiz && (
                  <Button
                    onClick={() => navigate("/certificates")}
                    className="w-full"
                  >
                    <Award className="mr-2 h-4 w-4" />
                    {t("coursePlayer.viewCertificate")}
                  </Button>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold mb-4">{t("coursePlayer.courseContent")}</h3>
                <div className="space-y-2">
                  {videos.map((video, index) => {
                    const accessible = video.completed || index === currentVideoIndex || isVideoAccessible(index);
                    return (
                      <button
                        key={video.id}
                        onClick={() => switchToVideo(index)}
                        disabled={!accessible}
                        className={`w-full text-left p-3 rounded-lg border transition-colors ${currentVideoIndex === index
                          ? "bg-primary/10 border-primary"
                          : accessible
                            ? "bg-card hover:bg-accent border-border"
                            : "bg-muted/50 border-border/50 opacity-50 cursor-not-allowed"
                          }`}
                      >
                        <div className="flex items-start gap-3">
                          {video.completed ? (
                            <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                          ) : !accessible ? (
                            <Lock className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                          ) : (
                            <div className="h-5 w-5 rounded-full border-2 border-border flex-shrink-0 mt-0.5" />
                          )}
                          <div className="flex-1 min-w-0">
                            <p
                              className={`font-medium text-sm line-clamp-2 ${video.completed || currentVideoIndex === index
                                ? "text-primary"
                                : accessible
                                  ? "text-foreground"
                                  : "text-muted-foreground"
                                }`}
                            >
                              {video.title}
                            </p>
                            {video.duration_seconds && (
                              <p className="text-xs text-muted-foreground mt-1">
                                {formatDuration(video.duration_seconds)}
                              </p>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
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
