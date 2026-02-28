import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Eye, AlertTriangle, Brain, Search, ChevronDown, ChevronRight, User, Clock, MonitorOff, BookOpen } from "lucide-react";
import { format } from "date-fns";

interface VideoRecord {
  videoTitle: string;
  watchTimeSeconds: number;
  totalDurationSeconds: number;
  watchPercentage: number;
  tabSwitches: number;
  engagementScore: number;
  pauseCount: number;
  rewindCount: number;
  skipCount: number;
  completionRate: number;
  maxPlaybackRate: number;
  dropOffPoint: number | null;
  updatedAt: string;
}

interface CourseGroup {
  courseTitle: string;
  videos: VideoRecord[];
  avgWatchPercentage: number;
  avgEngagementScore: number;
  totalTabSwitches: number;
  totalWatchTime: number;
  totalPauses: number;
  totalRewinds: number;
  totalSkips: number;
  avgCompletionRate: number;
}

interface UserEngagement {
  userName: string;
  userId: string;
  courses: CourseGroup[];
  avgWatchPercentage: number;
  avgEngagementScore: number;
  totalTabSwitches: number;
  totalWatchTime: number;
  videoCount: number;
  isSuspicious: boolean;
}

export interface VideoEngagementRecord {
  userName: string;
  videoTitle: string;
  courseTitle: string;
  watchTimeSeconds: number;
  totalDurationSeconds: number;
  watchPercentage: number;
  tabSwitches: number;
  engagementScore: number;
  pauseCount: number;
  rewindCount: number;
  skipCount: number;
  completionRate: number;
  maxPlaybackRate: number;
  dropOffPoint: number | null;
  updatedAt: string;
}

export const VideoEngagementAnalytics = () => {
  const { t } = useTranslation();
  const [userEngagements, setUserEngagements] = useState<UserEngagement[]>([]);
  const [allRecords, setAllRecords] = useState<VideoEngagementRecord[]>([]);
  const [summary, setSummary] = useState({ totalUsers: 0, totalRecords: 0, avgEngagementScore: 0, avgWatchPercentage: 0, suspiciousCount: 0 });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set());
  const [expandedCourses, setExpandedCourses] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchEngagementData();
  }, []);

  const fetchEngagementData = async () => {
    try {
      setLoading(true);

      const { data: engagementData, error } = await supabase
        .from("video_engagement")
        .select("*")
        .order("updated_at", { ascending: false })
        .limit(500);

      if (error) throw error;
      if (!engagementData || engagementData.length === 0) {
        setLoading(false);
        return;
      }

      const userIds = [...new Set(engagementData.map(e => e.user_id))];
      const videoIds = [...new Set(engagementData.map(e => e.video_id))];

      const [profilesResult, videosResult] = await Promise.all([
        userIds.length > 0 ? supabase.from("profiles").select("id, full_name").in("id", userIds) : { data: [] as any[] },
        videoIds.length > 0 ? supabase.from("course_videos").select("id, title, course_id, duration_seconds, courses(title)").in("id", videoIds) : { data: [] as any[] },
      ]);

      const profilesMap = new Map<string, string>((profilesResult.data || []).map(p => [p.id, p.full_name]));
      const videosMap = new Map<string, { title: string; courseTitle: string; courseId: string; durationSeconds: number | null }>(
        (videosResult.data || []).map((v: any) => [v.id, { title: v.title, courseTitle: v.courses?.title || "Unknown", courseId: v.course_id, durationSeconds: v.duration_seconds }])
      );

      // Group: user -> course -> videos
      const userMap = new Map<string, Map<string, { courseTitle: string; videos: VideoRecord[] }>>();
      const flatRecords: VideoEngagementRecord[] = [];

      engagementData.forEach(e => {
        // Use video's actual duration from course_videos if engagement record has 0
        const effectiveDuration = e.total_duration_seconds > 0
          ? e.total_duration_seconds
          : (videosMap.get(e.video_id)?.durationSeconds || 0);
        const watchPct = effectiveDuration > 0 ? Math.min(100, Math.round((e.watch_time_seconds / effectiveDuration) * 100)) : (e.watch_time_seconds > 0 ? 100 : 0);
        const video = videosMap.get(e.video_id);
        const userName = profilesMap.get(e.user_id) || "Unknown";
        const courseId = video?.courseId || "unknown";
        const courseTitle = video?.courseTitle || "Unknown";

        const rec: VideoRecord = {
          videoTitle: video?.title || "Unknown",
          watchTimeSeconds: e.watch_time_seconds,
          totalDurationSeconds: effectiveDuration,
          watchPercentage: watchPct,
          tabSwitches: e.tab_switches,
          engagementScore: Number(e.engagement_score),
          pauseCount: e.pause_count,
          rewindCount: e.rewind_count,
          skipCount: e.skip_count,
          completionRate: Number(e.completion_rate),
          maxPlaybackRate: Number(e.max_playback_rate),
          dropOffPoint: e.drop_off_point != null ? Number(e.drop_off_point) : null,
          updatedAt: e.updated_at,
        };

        flatRecords.push({ ...rec, userName, courseTitle });

        if (!userMap.has(e.user_id)) userMap.set(e.user_id, new Map());
        const courseMap = userMap.get(e.user_id)!;
        if (!courseMap.has(courseId)) courseMap.set(courseId, { courseTitle, videos: [] });
        courseMap.get(courseId)!.videos.push(rec);
      });

      const buildCourseGroup = (courseTitle: string, videos: VideoRecord[]): CourseGroup => ({
        courseTitle,
        videos,
        avgWatchPercentage: Math.round(videos.reduce((s, v) => s + v.watchPercentage, 0) / videos.length),
        avgEngagementScore: Math.round(videos.reduce((s, v) => s + v.engagementScore, 0) / videos.length),
        totalTabSwitches: videos.reduce((s, v) => s + v.tabSwitches, 0),
        totalWatchTime: videos.reduce((s, v) => s + v.watchTimeSeconds, 0),
        totalPauses: videos.reduce((s, v) => s + v.pauseCount, 0),
        totalRewinds: videos.reduce((s, v) => s + v.rewindCount, 0),
        totalSkips: videos.reduce((s, v) => s + v.skipCount, 0),
        avgCompletionRate: Math.round(videos.reduce((s, v) => s + v.completionRate, 0) / videos.length),
      });

      const grouped: UserEngagement[] = Array.from(userMap.entries()).map(([userId, courseMap]) => {
        const courses = Array.from(courseMap.values()).map(c => buildCourseGroup(c.courseTitle, c.videos));
        const allVideos = courses.flatMap(c => c.videos);
        const avgWatch = Math.round(allVideos.reduce((s, v) => s + v.watchPercentage, 0) / allVideos.length);
        const avgEng = Math.round(allVideos.reduce((s, v) => s + v.engagementScore, 0) / allVideos.length);
        const totalTabs = allVideos.reduce((s, v) => s + v.tabSwitches, 0);
        const totalWatch = allVideos.reduce((s, v) => s + v.watchTimeSeconds, 0);
        return {
          userName: profilesMap.get(userId) || "Unknown",
          userId, courses,
          avgWatchPercentage: avgWatch, avgEngagementScore: avgEng,
          totalTabSwitches: totalTabs, totalWatchTime: totalWatch,
          videoCount: allVideos.length,
          isSuspicious: totalTabs >= 10 && avgEng < 30,
        };
      });

      grouped.sort((a, b) => a.userName.localeCompare(b.userName));

      const totalRecords = flatRecords.length;
      setSummary({
        totalUsers: grouped.length, totalRecords,
        avgEngagementScore: totalRecords > 0 ? Math.round(flatRecords.reduce((s, r) => s + r.engagementScore, 0) / totalRecords) : 0,
        avgWatchPercentage: totalRecords > 0 ? Math.round(flatRecords.reduce((s, r) => s + r.watchPercentage, 0) / totalRecords) : 0,
        suspiciousCount: grouped.filter(u => u.isSuspicious).length,
      });
      setUserEngagements(grouped);
      setAllRecords(flatRecords);
    } catch (error) {
      console.error("Error fetching engagement data:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m ${s}s`;
  };

  const toggleUser = (userId: string) => {
    setExpandedUsers(prev => { const n = new Set(prev); n.has(userId) ? n.delete(userId) : n.add(userId); return n; });
  };

  const toggleCourse = (key: string) => {
    setExpandedCourses(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });
  };

  const filtered = userEngagements.filter(u => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return u.userName.toLowerCase().includes(q) || u.courses.some(c => c.courseTitle.toLowerCase().includes(q) || c.videos.some(v => v.videoTitle.toLowerCase().includes(q)));
  });

  if (loading) {
    return <Card><CardContent className="py-8 text-center text-muted-foreground">{t("engagement.loadingData")}</CardContent></Card>;
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-6"><div className="flex items-center gap-2 mb-2"><User className="h-5 w-5 text-primary" /><span className="text-sm text-muted-foreground">{t("engagement.totalUsers")}</span></div><p className="text-2xl font-bold">{summary.totalUsers}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="flex items-center gap-2 mb-2"><Eye className="h-5 w-5 text-primary" /><span className="text-sm text-muted-foreground">{t("engagement.totalRecords")}</span></div><p className="text-2xl font-bold">{summary.totalRecords}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="flex items-center gap-2 mb-2"><Brain className="h-5 w-5 text-primary" /><span className="text-sm text-muted-foreground">{t("engagement.avgEngagement")}</span></div><p className="text-2xl font-bold">{summary.avgEngagementScore}%</p></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="flex items-center gap-2 mb-2"><AlertTriangle className="h-5 w-5 text-amber-500" /><span className="text-sm text-muted-foreground">{t("engagement.suspiciousUsers")}</span></div><p className="text-2xl font-bold">{summary.suspiciousCount}</p></CardContent></Card>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder={t("engagement.searchPlaceholder")} value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Brain className="h-5 w-5" />{t("engagement.titleByUser", { count: filtered.length })}</CardTitle>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">{t("engagement.noData")}</p>
          ) : (
            <div className="space-y-2 max-h-[700px] overflow-y-auto">
              {filtered.map(user => {
                const isUserExpanded = expandedUsers.has(user.userId);
                return (
                  <div key={user.userId} className={`border rounded-lg ${user.isSuspicious ? "border-amber-300 dark:border-amber-700" : "border-border"}`}>
                    <button onClick={() => toggleUser(user.userId)} className="w-full flex items-center justify-between p-4 hover:bg-accent/50 transition-colors rounded-lg text-left">
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          {isUserExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                          <User className="h-5 w-5 text-primary" />
                          <span className="font-semibold truncate">{user.userName}</span>
                        </div>
                        {user.isSuspicious && (
                          <Badge variant="outline" className="border-amber-400 text-amber-600 text-xs shrink-0">
                            <AlertTriangle className="mr-1 h-3 w-3" />{t("engagement.suspicious")}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-6 text-sm text-muted-foreground shrink-0">
                        <div className="flex items-center gap-1" title={t("engagement.courses")}><BookOpen className="h-3.5 w-3.5" /><span>{user.courses.length}</span></div>
                        <div className="flex items-center gap-1" title={t("engagement.videos")}><Eye className="h-3.5 w-3.5" /><span>{user.videoCount}</span></div>
                        <div className="flex items-center gap-1" title={t("engagement.totalWatchTime")}><Clock className="h-3.5 w-3.5" /><span>{formatDuration(user.totalWatchTime)}</span></div>
                        <div className="flex items-center gap-1" title={t("engagement.tabSwitches")}><MonitorOff className="h-3.5 w-3.5" /><span className={user.totalTabSwitches / user.videoCount >= 5 ? "text-red-600 font-medium" : ""}>{user.totalTabSwitches}</span></div>
                        <div className="flex items-center gap-2 w-28">
                          <Progress value={user.avgEngagementScore} className={`h-2 w-14 ${user.avgEngagementScore < 50 ? "[&>div]:bg-red-500" : user.avgEngagementScore < 70 ? "[&>div]:bg-amber-500" : ""}`} />
                          <span className="font-medium">{user.avgEngagementScore}%</span>
                        </div>
                      </div>
                    </button>

                    {isUserExpanded && (
                      <div className="px-4 pb-4 space-y-2">
                        {user.courses.map((course, cIdx) => {
                          const courseKey = `${user.userId}-${cIdx}`;
                          const isCourseExpanded = expandedCourses.has(courseKey);
                          const courseSuspicious = course.avgEngagementScore < 50 || course.totalTabSwitches / course.videos.length >= 5;
                          return (
                            <div key={courseKey} className={`border rounded-md ${courseSuspicious ? "border-amber-200 dark:border-amber-800" : "border-border"}`}>
                              <button onClick={() => toggleCourse(courseKey)} className="w-full flex items-center justify-between p-3 hover:bg-accent/30 transition-colors rounded-md text-left">
                                <div className="flex items-center gap-2">
                                  {isCourseExpanded ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                                  <BookOpen className="h-4 w-4 text-primary" />
                                  <span className="font-medium text-sm">{course.courseTitle}</span>
                                  <Badge variant="secondary" className="text-xs ml-2">{course.videos.length !== 1 ? t("engagement.videosBadge", { count: course.videos.length }) : t("engagement.videoBadge", { count: course.videos.length })}</Badge>
                                </div>
                                <div className="flex items-center gap-5 text-sm text-muted-foreground shrink-0">
                                  <div className="flex items-center gap-1"><Clock className="h-3 w-3" /><span>{formatDuration(course.totalWatchTime)}</span></div>
                                  <div className="flex items-center gap-1"><MonitorOff className="h-3 w-3" /><span className={course.totalTabSwitches / course.videos.length >= 5 ? "text-red-600 font-medium" : ""}>{course.totalTabSwitches}</span></div>
                                  <div className="flex items-center gap-2 w-24">
                                    <Progress value={course.avgEngagementScore} className={`h-2 w-12 ${course.avgEngagementScore < 50 ? "[&>div]:bg-red-500" : course.avgEngagementScore < 70 ? "[&>div]:bg-amber-500" : ""}`} />
                                    <span className="text-xs font-medium">{course.avgEngagementScore}%</span>
                                  </div>
                                </div>
                              </button>

                              {isCourseExpanded && (
                                <div className="px-3 pb-3">
                                  <Table>
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead>{t("engagement.video")}</TableHead>
                                        <TableHead>{t("engagement.watchPercent")}</TableHead>
                                        <TableHead>{t("engagement.watchTime")}</TableHead>
                                        <TableHead>{t("engagement.completion")}</TableHead>
                                        <TableHead>{t("engagement.pauses")}</TableHead>
                                        <TableHead>{t("engagement.rewinds")}</TableHead>
                                        <TableHead>{t("engagement.skips")}</TableHead>
                                        <TableHead>{t("engagement.speed")}</TableHead>
                                        <TableHead>{t("engagement.tabSwitches")}</TableHead>
                                        <TableHead>{t("engagement.engagementLabel")}</TableHead>
                                        <TableHead>{t("engagement.date")}</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {course.videos.map((video, vIdx) => {
                                        const vSus = video.tabSwitches >= 5 || video.engagementScore < 50;
                                        return (
                                          <TableRow key={vIdx} className={vSus ? "bg-amber-50/50 dark:bg-amber-950/10" : ""}>
                                            <TableCell className="max-w-[200px] truncate" title={video.videoTitle}>{video.videoTitle}</TableCell>
                                            <TableCell><div className="flex items-center gap-2"><Progress value={video.watchPercentage} className="h-2 w-16" /><span className="text-sm">{video.watchPercentage}%</span></div></TableCell>
                                            <TableCell className="text-sm">{formatDuration(video.watchTimeSeconds)}{video.totalDurationSeconds > 0 ? ` / ${formatDuration(video.totalDurationSeconds)}` : ""}</TableCell>
                                            <TableCell className="text-sm">{Math.round(video.completionRate)}%</TableCell>
                                            <TableCell className="text-sm">{video.pauseCount}</TableCell>
                                            <TableCell className="text-sm">{video.rewindCount}</TableCell>
                                            <TableCell className="text-sm">{video.skipCount}</TableCell>
                                            <TableCell className="text-sm">{video.maxPlaybackRate}x</TableCell>
                                            <TableCell><span className={`font-medium ${video.tabSwitches >= 5 ? "text-red-600" : video.tabSwitches >= 3 ? "text-amber-600" : "text-foreground"}`}>{video.tabSwitches}{video.tabSwitches >= 5 && <AlertTriangle className="inline ml-1 h-3 w-3" />}</span></TableCell>
                                            <TableCell><div className="flex items-center gap-2"><Progress value={video.engagementScore} className={`h-2 w-16 ${video.engagementScore < 50 ? "[&>div]:bg-red-500" : video.engagementScore < 70 ? "[&>div]:bg-amber-500" : ""}`} /><span className="text-sm">{Math.round(video.engagementScore)}%</span></div></TableCell>
                                            <TableCell className="text-sm text-muted-foreground">{format(new Date(video.updatedAt), "MMM dd, yyyy")}</TableCell>
                                          </TableRow>
                                        );
                                      })}
                                    </TableBody>
                                  </Table>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export const getVideoEngagementCSVData = (records: VideoEngagementRecord[]) => {
  return [
    ["Video Engagement Details"],
    ["User", "Video", "Course", "Watch %", "Watch Time (s)", "Total Duration (s)", "Completion Rate", "Pauses", "Rewinds", "Skips", "Max Speed", "Tab Switches", "Engagement Score", "Date"],
    ...records.map(r => [
      r.userName, r.videoTitle, r.courseTitle, `${r.watchPercentage}%`,
      r.watchTimeSeconds, r.totalDurationSeconds, `${Math.round(r.completionRate)}%`,
      r.pauseCount, r.rewindCount, r.skipCount, `${r.maxPlaybackRate}x`,
      r.tabSwitches, `${Math.round(r.engagementScore)}%`,
      format(new Date(r.updatedAt), "MMM dd, yyyy"),
    ]),
  ];
};
