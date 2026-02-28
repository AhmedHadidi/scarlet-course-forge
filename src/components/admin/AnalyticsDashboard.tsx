import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Download, Calendar as CalendarIcon, Users, BookOpen, Award, TrendingUp, Video, CheckCircle, Eye, Brain, ChevronDown, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { VideoEngagementAnalytics } from "./VideoEngagementAnalytics";

interface AnalyticsStats {
  totalUsers: number;
  activeUsers: number;
  totalEnrollments: number;
  totalCourses: number;
  totalCertificates: number;
  totalVideos: number;
  avgQuizScore: number;
  completionRate: number;
}

interface TopCourse {
  title: string;
  enrollments: number;
  completionRate: number;
}

interface TopUser {
  full_name: string;
  enrollments: number;
  avgProgress: number;
}

interface TopVideo {
  title: string;
  course_title: string;
  views: number;
}

interface UserProgressCourse {
  course_title: string;
  progress_percentage: number;
  enrolled_at: string;
}

interface UserProgressGrouped {
  user_name: string;
  userId: string;
  courses: UserProgressCourse[];
  avgProgress: number;
  totalCourses: number;
}

interface UserQuizPerformance {
  user_name: string;
  quiz_title: string;
  course_title: string;
  pre_score: number | null;
  post_score: number | null;
  passed: boolean | null;
  pre_attempted_at: string | null;
  post_attempted_at: string | null;
}

interface CertificateDetail {
  certificate_id: string;
  user_name: string;
  course_title: string;
  issued_at: string;
}

export const AnalyticsDashboard = () => {
  const { t } = useTranslation();
  const [stats, setStats] = useState<AnalyticsStats>({
    totalUsers: 0,
    activeUsers: 0,
    totalEnrollments: 0,
    totalCourses: 0,
    totalCertificates: 0,
    totalVideos: 0,
    avgQuizScore: 0,
    completionRate: 0,
  });
  const [topCourses, setTopCourses] = useState<TopCourse[]>([]);
  const [topUsers, setTopUsers] = useState<TopUser[]>([]);
  const [topVideos, setTopVideos] = useState<TopVideo[]>([]);
  const [userProgress, setUserProgress] = useState<UserProgressGrouped[]>([]);
  const [userQuizPerformance, setUserQuizPerformance] = useState<UserQuizPerformance[]>([]);
  const [certificateDetails, setCertificateDetails] = useState<CertificateDetail[]>([]);
  const [enrollmentTrend, setEnrollmentTrend] = useState<any[]>([]);
  const [dateFrom, setDateFrom] = useState<Date>();
  const [dateTo, setDateTo] = useState<Date>();
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedProgressUsers, setExpandedProgressUsers] = useState<Set<string>>(new Set());
  const [progressSearchQuery, setProgressSearchQuery] = useState("");
  const [expandedQuizUsers, setExpandedQuizUsers] = useState<Set<string>>(new Set());
  const [quizSearchQuery, setQuizSearchQuery] = useState("");
  const [expandedCertUsers, setExpandedCertUsers] = useState<Set<string>>(new Set());
  const [certSearchQuery, setCertSearchQuery] = useState("");

  useEffect(() => {
    fetchAnalytics();
    fetchCategories();
  }, [dateFrom, dateTo, categoryFilter]);

  const fetchCategories = async () => {
    const { data } = await supabase.from("categories").select("*");
    setCategories(data || []);
  };

  const fetchAnalytics = async () => {
    try {
      setLoading(true);

      // Get session once
      const { data: { session } } = await supabase.auth.getSession();

      // Run all independent queries in parallel for faster loading
      const [
        usersResult,
        activeUsersResult,
        enrollmentCountResult,
        courseCountResult,
        certificateCountResult,
        videoCountResult,
        quizAttemptsResult,
        enrollmentsProgressResult,
        coursesWithEnrollmentsResult,
        enrollmentsForUsersResult,
        videoProgressResult,
        enrollmentTrendResult,
        enrollmentsDetailResult,
        quizAttemptsDetailResult,
        certificatesDetailResult,
      ] = await Promise.all([
        // Total users via edge function
        supabase.functions.invoke('admin-operations', {
          body: { operation: 'listUsers' },
          headers: { Authorization: `Bearer ${session?.access_token}` }
        }),
        // Active users
        supabase.from("enrollments").select("user_id"),
        // Enrollment count
        supabase.from("enrollments").select("*", { count: "exact", head: true }),
        // Course count with optional filter
        categoryFilter !== "all"
          ? supabase.from("courses").select("*", { count: "exact", head: true }).eq("category_id", categoryFilter)
          : supabase.from("courses").select("*", { count: "exact", head: true }),
        // Certificates count
        supabase.from("certificates").select("*", { count: "exact", head: true }),
        // Videos count
        supabase.from("course_videos").select("*", { count: "exact", head: true }),
        // Quiz attempts for avg score
        supabase.from("quiz_attempts").select("score"),
        // Enrollments for completion rate
        supabase.from("enrollments").select("progress_percentage"),
        // Courses with enrollments for top courses
        supabase.from("courses").select(`id, title, enrollments (id, progress_percentage)`),
        // Enrollments for top users (no FK to profiles, so fetch separately)
        supabase.from("enrollments").select("user_id, progress_percentage"),
        // Video progress for top videos
        supabase.from("video_progress").select(`video_id, course_videos (title, courses (title))`),
        // Enrollment trend data
        supabase.from("enrollments").select("enrolled_at"),
        // User progress detail
        supabase.from("enrollments").select("user_id, course_id, progress_percentage, enrolled_at").order('enrolled_at', { ascending: false }),
        // Quiz attempts detail
        supabase.from("quiz_attempts").select("user_id, quiz_id, score, passed, attempted_at, attempt_type").order('attempted_at', { ascending: false }).limit(100),
        // Certificate details
        supabase.from("certificates").select("id, user_id, course_id, issued_at").order('issued_at', { ascending: false }).limit(100),
      ]);

      // Process results
      const totalUsers = usersResult.data?.users?.length || 0;
      const activeUsers = new Set(activeUsersResult.data?.map(e => e.user_id)).size;
      const totalEnrollments = enrollmentCountResult.count || 0;
      const totalCourses = courseCountResult.count || 0;
      const totalCertificates = certificateCountResult.count || 0;
      const totalVideos = videoCountResult.count || 0;

      const quizAttempts = quizAttemptsResult.data;
      const avgQuizScore = quizAttempts && quizAttempts.length > 0
        ? Math.round(quizAttempts.reduce((sum, attempt) => sum + attempt.score, 0) / quizAttempts.length)
        : 0;

      const enrollments = enrollmentsProgressResult.data;
      const completionRate = enrollments && enrollments.length > 0
        ? Math.round(enrollments.reduce((sum, e) => sum + e.progress_percentage, 0) / enrollments.length)
        : 0;

      // Top courses
      const topCoursesData = (coursesWithEnrollmentsResult.data || [])
        .map(course => ({
          title: course.title,
          enrollments: course.enrollments?.length || 0,
          completionRate: course.enrollments && course.enrollments.length > 0
            ? Math.round(course.enrollments.reduce((sum: number, e: any) => sum + e.progress_percentage, 0) / course.enrollments.length)
            : 0
        }))
        .sort((a, b) => b.enrollments - a.enrollments)
        .slice(0, 5);

      setStats({
        totalUsers,
        activeUsers,
        totalEnrollments,
        totalCourses,
        totalCertificates,
        totalVideos,
        avgQuizScore,
        completionRate,
      });

      setTopCourses(topCoursesData);

      // Top engaged users – fetch profile names separately
      const enrollUsersData = enrollmentsForUsersResult.data || [];
      const enrollUserIds = [...new Set(enrollUsersData.map((e: any) => e.user_id))];

      let topUsersProfilesMap = new Map<string, string>();
      if (enrollUserIds.length > 0) {
        const { data: enrollProfiles } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", enrollUserIds);
        (enrollProfiles || []).forEach(p => topUsersProfilesMap.set(p.id, p.full_name));
      }

      const userEnrollments: { [key: string]: { name: string; count: number; totalProgress: number } } = {};
      enrollUsersData.forEach((enrollment: any) => {
        const userId = enrollment.user_id;
        if (!userEnrollments[userId]) {
          userEnrollments[userId] = {
            name: topUsersProfilesMap.get(userId) || "Unknown",
            count: 0,
            totalProgress: 0
          };
        }
        userEnrollments[userId].count++;
        userEnrollments[userId].totalProgress += enrollment.progress_percentage;
      });

      const topUsersData = Object.values(userEnrollments)
        .map(u => ({
          full_name: u.name,
          enrollments: u.count,
          avgProgress: Math.round(u.totalProgress / u.count)
        }))
        .sort((a, b) => b.enrollments - a.enrollments)
        .slice(0, 5);

      setTopUsers(topUsersData);

      // Top watched videos
      const videoViews: { [key: string]: { title: string; course_title: string; count: number } } = {};
      videoProgressResult.data?.forEach((vp: any) => {
        const videoId = vp.video_id;
        if (!videoViews[videoId] && vp.course_videos) {
          videoViews[videoId] = {
            title: vp.course_videos.title,
            course_title: vp.course_videos.courses?.title || "Unknown",
            count: 0
          };
        }
        if (videoViews[videoId]) {
          videoViews[videoId].count++;
        }
      });

      const topVideosData = Object.values(videoViews)
        .sort((a, b) => b.count - a.count)
        .slice(0, 5)
        .map(v => ({
          title: v.title,
          course_title: v.course_title,
          views: v.count
        }));

      setTopVideos(topVideosData);

      // Enrollment trend (last 7 days)
      const last7Days = Array.from({ length: 7 }, (_, i) => {
        const date = new Date();
        date.setDate(date.getDate() - (6 - i));
        return date.toISOString().split('T')[0];
      });

      const trendCounts: { [key: string]: number } = {};
      last7Days.forEach(day => { trendCounts[day] = 0; });

      enrollmentTrendResult.data?.forEach((enrollment: any) => {
        const date = enrollment.enrolled_at.split('T')[0];
        if (trendCounts[date] !== undefined) {
          trendCounts[date]++;
        }
      });

      setEnrollmentTrend(last7Days.map(day => ({
        date: format(new Date(day), "MMM dd"),
        enrollments: trendCounts[day]
      })));

      // User progress - fetch related data in parallel
      const enrollmentsData = enrollmentsDetailResult.data || [];
      const userIds = [...new Set(enrollmentsData.map(e => e.user_id))];
      const courseIds = [...new Set(enrollmentsData.map(e => e.course_id))];

      const [profilesResult, coursesForProgressResult] = await Promise.all([
        userIds.length > 0 ? supabase.from("profiles").select("id, full_name").in("id", userIds) : { data: [] as { id: string; full_name: string }[] },
        courseIds.length > 0 ? supabase.from("courses").select("id, title").in("id", courseIds) : { data: [] as { id: string; title: string }[] },
      ]);

      const profilesMap = new Map<string, string>((profilesResult.data || []).map(p => [p.id, p.full_name]));
      const coursesMap = new Map<string, string>((coursesForProgressResult.data || []).map(c => [c.id, c.title]));

      // Group progress by user
      const progressByUser = new Map<string, { userName: string; courses: UserProgressCourse[] }>();
      enrollmentsData.forEach((enrollment: any) => {
        const userId = enrollment.user_id;
        if (!progressByUser.has(userId)) {
          progressByUser.set(userId, { userName: profilesMap.get(userId) || "Unknown", courses: [] });
        }
        progressByUser.get(userId)!.courses.push({
          course_title: coursesMap.get(enrollment.course_id) || "Unknown",
          progress_percentage: enrollment.progress_percentage,
          enrolled_at: format(new Date(enrollment.enrolled_at), "MMM dd, yyyy"),
        });
      });

      setUserProgress(Array.from(progressByUser.entries()).map(([userId, data]) => ({
        user_name: data.userName,
        userId,
        courses: data.courses,
        avgProgress: Math.round(data.courses.reduce((s, c) => s + c.progress_percentage, 0) / data.courses.length),
        totalCourses: data.courses.length,
      })).sort((a, b) => a.user_name.localeCompare(b.user_name)));

      // Quiz performance - fetch related data in parallel
      const quizAttemptsData = quizAttemptsDetailResult.data || [];
      const quizUserIds = [...new Set(quizAttemptsData.map(qa => qa.user_id))];
      const quizIds = [...new Set(quizAttemptsData.map(qa => qa.quiz_id))];

      const [quizProfilesResult, quizzesResult] = await Promise.all([
        quizUserIds.length > 0 ? supabase.from("profiles").select("id, full_name").in("id", quizUserIds) : { data: [] as { id: string; full_name: string }[] },
        quizIds.length > 0 ? supabase.from("quizzes").select("id, title, course_id").in("id", quizIds) : { data: [] as { id: string; title: string; course_id: string }[] },
      ]);

      const quizCourseIds = [...new Set((quizzesResult.data || []).map(q => q.course_id))];
      const quizCoursesResult = quizCourseIds.length > 0
        ? await supabase.from("courses").select("id, title").in("id", quizCourseIds)
        : { data: [] as { id: string; title: string }[] };

      const quizProfilesMap = new Map<string, string>((quizProfilesResult.data || []).map(p => [p.id, p.full_name]));
      const quizzesMap = new Map<string, { title: string; course_id: string }>((quizzesResult.data || []).map(q => [q.id, { title: q.title, course_id: q.course_id }]));
      const quizCoursesMap = new Map<string, string>((quizCoursesResult.data || []).map(c => [c.id, c.title]));

      // Group attempts by user+quiz
      const userQuizMap = new Map<string, UserQuizPerformance>();

      quizAttemptsData.forEach((attempt: any) => {
        const quiz = quizzesMap.get(attempt.quiz_id);
        const key = `${attempt.user_id}-${attempt.quiz_id}`;

        if (!userQuizMap.has(key)) {
          userQuizMap.set(key, {
            user_name: quizProfilesMap.get(attempt.user_id) || "Unknown",
            quiz_title: quiz?.title || "Unknown",
            course_title: quiz ? quizCoursesMap.get(quiz.course_id) || "Unknown" : "Unknown",
            pre_score: null,
            post_score: null,
            passed: null,
            pre_attempted_at: null,
            post_attempted_at: null,
          });
        }

        const entry = userQuizMap.get(key)!;
        const attemptType = attempt.attempt_type || "post";

        if (attemptType === "pre") {
          entry.pre_score = attempt.score;
          entry.pre_attempted_at = format(new Date(attempt.attempted_at), "MMM dd, yyyy HH:mm");
        } else {
          entry.post_score = attempt.score;
          entry.passed = attempt.passed;
          entry.post_attempted_at = format(new Date(attempt.attempted_at), "MMM dd, yyyy HH:mm");
        }
      });

      setUserQuizPerformance(Array.from(userQuizMap.values()));

      // Certificate details - fetch related data in parallel
      const certificatesData = certificatesDetailResult.data || [];
      const certUserIds = [...new Set(certificatesData.map(c => c.user_id))];
      const certCourseIds = [...new Set(certificatesData.map(c => c.course_id))];

      const [certProfilesResult, certCoursesResult] = await Promise.all([
        certUserIds.length > 0 ? supabase.from("profiles").select("id, full_name").in("id", certUserIds) : { data: [] as { id: string; full_name: string }[] },
        certCourseIds.length > 0 ? supabase.from("courses").select("id, title").in("id", certCourseIds) : { data: [] as { id: string; title: string }[] },
      ]);

      const certProfilesMap = new Map<string, string>((certProfilesResult.data || []).map(p => [p.id, p.full_name]));
      const certCoursesMap = new Map<string, string>((certCoursesResult.data || []).map(c => [c.id, c.title]));

      setCertificateDetails(certificatesData.map((cert: any) => ({
        certificate_id: cert.id,
        user_name: certProfilesMap.get(cert.user_id) || "Unknown",
        course_title: certCoursesMap.get(cert.course_id) || "Unknown",
        issued_at: format(new Date(cert.issued_at), "MMM dd, yyyy HH:mm")
      })));
    } catch (error) {
      console.error("Error fetching analytics:", error);
      toast.error("Failed to load analytics");
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = () => {
    const csvContent = [
      ["Metric", "Value"],
      ["Total Users", stats.totalUsers],
      ["Active Users", stats.activeUsers],
      ["Total Enrollments", stats.totalEnrollments],
      ["Total Courses", stats.totalCourses],
      ["Total Certificates", stats.totalCertificates],
      ["Total Videos", stats.totalVideos],
      ["Average Quiz Score", `${stats.avgQuizScore}%`],
      ["Completion Rate", `${stats.completionRate}%`],
      [],
      ["Top Courses", "Enrollments", "Completion Rate"],
      ...topCourses.map(course => [course.title, course.enrollments, `${course.completionRate}%`]),
      [],
      ["Top Engaged Users", "Enrollments", "Avg Progress"],
      ...topUsers.map(user => [user.full_name, user.enrollments, `${user.avgProgress}%`]),
      [],
      ["Top Watched Videos", "Course", "Views"],
      ...topVideos.map(video => [video.title, video.course_title, video.views]),
      [],
      ["Certificate Details"],
      ["Certificate ID", "User Name", "Course", "Issued At"],
      ...certificateDetails.map(cert => [cert.certificate_id, cert.user_name, cert.course_title, cert.issued_at])
    ].map(row => row.join(",")).join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `analytics_${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    toast.success("Analytics exported to CSV");
  };

  const statCards = [
    { title: t("analytics.totalUsers"), value: stats.totalUsers, icon: Users, color: "bg-blue-500" },
    { title: t("analytics.activeLearners"), value: stats.activeUsers, icon: Users, color: "bg-green-500" },
    { title: t("analytics.enrollments"), value: stats.totalEnrollments, icon: BookOpen, color: "bg-purple-500" },
    { title: t("analytics.courses"), value: stats.totalCourses, icon: BookOpen, color: "bg-orange-500" },
    { title: t("analytics.certificatesIssued"), value: stats.totalCertificates, icon: Award, color: "bg-yellow-500" },
    { title: t("analytics.totalVideos"), value: stats.totalVideos, icon: Video, color: "bg-pink-500" },
    { title: t("analytics.avgQuizScore"), value: `${stats.avgQuizScore}%`, icon: CheckCircle, color: "bg-indigo-500" },
    { title: t("analytics.completionRate"), value: `${stats.completionRate}%`, icon: TrendingUp, color: "bg-teal-500" },
  ];

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>{t("analytics.filters")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-[200px] justify-start">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateFrom ? format(dateFrom, "PPP") : t("analytics.fromDate")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} />
            </PopoverContent>
          </Popover>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-[200px] justify-start">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateTo ? format(dateTo, "PPP") : t("analytics.toDate")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar mode="single" selected={dateTo} onSelect={setDateTo} />
            </PopoverContent>
          </Popover>

          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("analytics.allCategories")}</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat.id} value={cat.id}>
                  {cat.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button onClick={exportToCSV} variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <Card key={index}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-4">
                  <div className={`h-12 w-12 rounded-lg ${stat.color} flex items-center justify-center`}>
                    <Icon className="h-6 w-6 text-white" />
                  </div>
                </div>
                <p className="text-3xl font-bold mb-1">{stat.value}</p>
                <p className="text-sm text-muted-foreground">{stat.title}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Enrollment Trend Chart */}
      <Card>
        <CardHeader>
          <CardTitle>{t("analytics.enrollmentTrend")}</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={enrollmentTrend}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="enrollments" stroke="hsl(var(--primary))" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Top Courses */}
      <Card>
        <CardHeader>
          <CardTitle>{t("analytics.topCourses")}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("analytics.courseTitle")}</TableHead>
                <TableHead>{t("analytics.enrollments")}</TableHead>
                <TableHead>{t("analytics.completionRate")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {topCourses.map((course, index) => (
                <TableRow key={index}>
                  <TableCell className="font-medium">{course.title}</TableCell>
                  <TableCell>{course.enrollments}</TableCell>
                  <TableCell>{course.completionRate}%</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Top Engaged Users */}
      <Card>
        <CardHeader>
          <CardTitle>{t("analytics.topUsers")}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("analytics.userName")}</TableHead>
                <TableHead>{t("analytics.enrollments")}</TableHead>
                <TableHead>{t("analytics.avgProgress")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {topUsers.map((user, index) => (
                <TableRow key={index}>
                  <TableCell className="font-medium">{user.full_name}</TableCell>
                  <TableCell>{user.enrollments}</TableCell>
                  <TableCell>{user.avgProgress}%</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Top Watched Videos */}
      <Card>
        <CardHeader>
          <CardTitle>{t("analytics.topVideos")}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("analytics.videoTitle")}</TableHead>
                <TableHead>{t("analytics.course")}</TableHead>
                <TableHead className="flex items-center gap-1">
                  <Eye className="h-4 w-4" />
                  {t("analytics.views")}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {topVideos.map((video, index) => (
                <TableRow key={index}>
                  <TableCell className="font-medium">{video.title}</TableCell>
                  <TableCell>{video.course_title}</TableCell>
                  <TableCell>{video.views}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* User Course Progress - Grouped by User */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            User Course Progress ({userProgress.length} {t("analytics.users")})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative max-w-md">
            <Input placeholder={t("analytics.searchUserCourse")} value={progressSearchQuery} onChange={e => setProgressSearchQuery(e.target.value)} className="pl-3" />
          </div>
          <div className="max-h-[600px] overflow-y-auto space-y-2">
            {userProgress
              .filter(u => {
                if (!progressSearchQuery) return true;
                const q = progressSearchQuery.toLowerCase();
                return u.user_name.toLowerCase().includes(q) || u.courses.some(c => c.course_title.toLowerCase().includes(q));
              })
              .map(user => {
                const isExpanded = expandedProgressUsers.has(user.userId);
                return (
                  <div key={user.userId} className="border rounded-lg border-border">
                    <button
                      onClick={() => setExpandedProgressUsers(prev => { const n = new Set(prev); n.has(user.userId) ? n.delete(user.userId) : n.add(user.userId); return n; })}
                      className="w-full flex items-center justify-between p-4 hover:bg-accent/50 transition-colors rounded-lg text-left"
                    >
                      <div className="flex items-center gap-2">
                        {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                        <Users className="h-4 w-4 text-primary" />
                        <span className="font-semibold">{user.user_name}</span>
                        <span className="text-xs text-muted-foreground ml-2">{user.totalCourses} {user.totalCourses !== 1 ? t("analytics.courses") : t("analytics.course")}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-primary transition-all" style={{ width: `${user.avgProgress}%` }} />
                        </div>
                        <span className="text-sm font-medium w-10 text-right">{user.avgProgress}%</span>
                      </div>
                    </button>
                    {isExpanded && (
                      <div className="px-4 pb-4">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>{t("analytics.course")}</TableHead>
                              <TableHead>{t("analytics.progress")}</TableHead>
                              <TableHead>{t("analytics.enrolledDate")}</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {user.courses.map((course, cIdx) => (
                              <TableRow key={cIdx}>
                                <TableCell className="font-medium">{course.course_title}</TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                                      <div className="h-full bg-primary transition-all" style={{ width: `${course.progress_percentage}%` }} />
                                    </div>
                                    <span className="text-sm">{course.progress_percentage}%</span>
                                  </div>
                                </TableCell>
                                <TableCell>{course.enrolled_at}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        </CardContent>
      </Card>



      {/* User Quiz Performance - Grouped by User */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            User Quiz Performance ({t("analytics.preVsPost")})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative max-w-md">
            <Input placeholder={t("analytics.searchUserCourseQuiz")} value={quizSearchQuery} onChange={e => setQuizSearchQuery(e.target.value)} className="pl-3" />
          </div>
          {(() => {
            // Group quiz performance by user
            const quizByUser = new Map<string, { userName: string; quizzes: UserQuizPerformance[] }>();
            userQuizPerformance.forEach(perf => {
              const key = perf.user_name;
              if (!quizByUser.has(key)) {
                quizByUser.set(key, { userName: perf.user_name, quizzes: [] });
              }
              quizByUser.get(key)!.quizzes.push(perf);
            });
            const groupedQuizUsers = Array.from(quizByUser.entries())
              .map(([key, data]) => ({ key, ...data }))
              .filter(u => {
                if (!quizSearchQuery) return true;
                const q = quizSearchQuery.toLowerCase();
                return u.userName.toLowerCase().includes(q) || u.quizzes.some(qz => qz.course_title.toLowerCase().includes(q) || qz.quiz_title.toLowerCase().includes(q));
              })
              .sort((a, b) => a.userName.localeCompare(b.userName));

            if (groupedQuizUsers.length === 0) {
              return <div className="text-center py-10 text-muted-foreground">{t("analytics.noQuizAttempts")}</div>;
            }

            return (
              <div className="max-h-[600px] overflow-y-auto space-y-2">
                {groupedQuizUsers.map(user => {
                  const isExpanded = expandedQuizUsers.has(user.key);
                  const passedCount = user.quizzes.filter(q => q.passed === true).length;
                  return (
                    <div key={user.key} className="border rounded-lg border-border">
                      <button
                        onClick={() => setExpandedQuizUsers(prev => { const n = new Set(prev); n.has(user.key) ? n.delete(user.key) : n.add(user.key); return n; })}
                        className="w-full flex items-center justify-between p-4 hover:bg-accent/50 transition-colors rounded-lg text-left"
                      >
                        <div className="flex items-center gap-2">
                          {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                          <Users className="h-4 w-4 text-primary" />
                          <span className="font-semibold">{user.userName}</span>
                          <span className="text-xs text-muted-foreground ml-2">{user.quizzes.length} {user.quizzes.length !== 1 ? t("analytics.quizzes") : t("analytics.quiz")}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <span>{passedCount}/{user.quizzes.length} {t("analytics.passed")}</span>
                        </div>
                      </button>
                      {isExpanded && (
                        <div className="px-4 pb-4">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>{t("analytics.course")}</TableHead>
                                <TableHead>{t("analytics.quiz")}</TableHead>
                                <TableHead>{t("analytics.preScore")}</TableHead>
                                <TableHead>{t("analytics.postScore")}</TableHead>
                                <TableHead>{t("analytics.improvement")}</TableHead>
                                <TableHead>{t("analytics.status")}</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {user.quizzes.map((perf, idx) => {
                                const improvement = perf.pre_score !== null && perf.post_score !== null ? perf.post_score - perf.pre_score : null;
                                return (
                                  <TableRow key={idx}>
                                    <TableCell>{perf.course_title}</TableCell>
                                    <TableCell>{perf.quiz_title}</TableCell>
                                    <TableCell>{perf.pre_score !== null ? <span className="text-muted-foreground">{perf.pre_score}%</span> : <span className="text-muted-foreground text-xs">{t("analytics.notTaken")}</span>}</TableCell>
                                    <TableCell>{perf.post_score !== null ? <span className={perf.passed ? "text-green-600 font-semibold" : "text-red-600"}>{perf.post_score}%</span> : <span className="text-muted-foreground text-xs">{t("analytics.notTaken")}</span>}</TableCell>
                                    <TableCell>{improvement !== null ? <span className={improvement >= 0 ? "text-green-600 font-semibold" : "text-red-600"}>{improvement >= 0 ? "+" : ""}{improvement}%</span> : <span className="text-muted-foreground text-xs">—</span>}</TableCell>
                                    <TableCell>
                                      {perf.passed !== null ? (
                                        perf.passed ? (
                                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">{t("analytics.passedStatus")}</span>
                                        ) : (
                                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">{t("analytics.failedStatus")}</span>
                                        )
                                      ) : (
                                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">{t("analytics.inProgress")}</span>
                                      )}
                                    </TableCell>
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
            );
          })()}
        </CardContent>
      </Card>

      {/* Certificate Details - Grouped by User */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="h-5 w-5" />
            {t("analytics.certDetails")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative max-w-md">
            <Input placeholder={t("analytics.searchUserCourse")} value={certSearchQuery} onChange={e => setCertSearchQuery(e.target.value)} className="pl-3" />
          </div>
          {(() => {
            // Group certificates by user
            const certByUser = new Map<string, { userName: string; certs: CertificateDetail[] }>();
            certificateDetails.forEach(cert => {
              const key = cert.user_name;
              if (!certByUser.has(key)) {
                certByUser.set(key, { userName: cert.user_name, certs: [] });
              }
              certByUser.get(key)!.certs.push(cert);
            });
            const groupedCertUsers = Array.from(certByUser.entries())
              .map(([key, data]) => ({ key, ...data }))
              .filter(u => {
                if (!certSearchQuery) return true;
                const q = certSearchQuery.toLowerCase();
                return u.userName.toLowerCase().includes(q) || u.certs.some(c => c.course_title.toLowerCase().includes(q));
              })
              .sort((a, b) => a.userName.localeCompare(b.userName));

            if (groupedCertUsers.length === 0) {
              return <div className="text-center py-10 text-muted-foreground">{t("analytics.noCerts")}</div>;
            }

            return (
              <div className="max-h-[600px] overflow-y-auto space-y-2">
                {groupedCertUsers.map(user => {
                  const isExpanded = expandedCertUsers.has(user.key);
                  return (
                    <div key={user.key} className="border rounded-lg border-border">
                      <button
                        onClick={() => setExpandedCertUsers(prev => { const n = new Set(prev); n.has(user.key) ? n.delete(user.key) : n.add(user.key); return n; })}
                        className="w-full flex items-center justify-between p-4 hover:bg-accent/50 transition-colors rounded-lg text-left"
                      >
                        <div className="flex items-center gap-2">
                          {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                          <Users className="h-4 w-4 text-primary" />
                          <span className="font-semibold">{user.userName}</span>
                          <span className="text-xs text-muted-foreground ml-2">{user.certs.length} certificate{user.certs.length !== 1 ? "s" : ""}</span>
                        </div>
                      </button>
                      {isExpanded && (
                        <div className="px-4 pb-4">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Certificate ID</TableHead>
                                <TableHead>Course</TableHead>
                                <TableHead>Issued At</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {user.certs.map((cert, idx) => (
                                <TableRow key={idx}>
                                  <TableCell className="font-mono text-xs">{cert.certificate_id}</TableCell>
                                  <TableCell>{cert.course_title}</TableCell>
                                  <TableCell>{cert.issued_at}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </CardContent>
      </Card>

      {/* Video Engagement Analytics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            {t("analytics.videoEngagement")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <VideoEngagementAnalytics />
        </CardContent>
      </Card>
    </div>
  );
};
