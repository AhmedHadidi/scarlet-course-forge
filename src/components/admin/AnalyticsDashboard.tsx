import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, Calendar as CalendarIcon, Users, BookOpen, Award, TrendingUp, Video, CheckCircle, Eye } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

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

interface UserProgress {
  user_name: string;
  course_title: string;
  progress_percentage: number;
  enrolled_at: string;
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

export const AnalyticsDashboard = () => {
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
  const [userProgress, setUserProgress] = useState<UserProgress[]>([]);
  const [userQuizPerformance, setUserQuizPerformance] = useState<UserQuizPerformance[]>([]);
  const [enrollmentTrend, setEnrollmentTrend] = useState<any[]>([]);
  const [dateFrom, setDateFrom] = useState<Date>();
  const [dateTo, setDateTo] = useState<Date>();
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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
        // Enrollments for top users
        supabase.from("enrollments").select(`user_id, progress_percentage, profiles (full_name)`),
        // Video progress for top videos
        supabase.from("video_progress").select(`video_id, course_videos (title, courses (title))`),
        // Enrollment trend data
        supabase.from("enrollments").select("enrolled_at"),
        // User progress detail
        supabase.from("enrollments").select("user_id, course_id, progress_percentage, enrolled_at").order('enrolled_at', { ascending: false }).limit(50),
        // Quiz attempts detail
        supabase.from("quiz_attempts").select("user_id, quiz_id, score, passed, attempted_at, attempt_type").order('attempted_at', { ascending: false }).limit(100),
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

      // Top engaged users
      const userEnrollments: { [key: string]: { name: string; count: number; totalProgress: number } } = {};
      enrollmentsForUsersResult.data?.forEach((enrollment: any) => {
        const userId = enrollment.user_id;
        if (!userEnrollments[userId]) {
          userEnrollments[userId] = {
            name: enrollment.profiles?.full_name || "Unknown",
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

      setUserProgress(enrollmentsData.map((enrollment: any) => ({
        user_name: profilesMap.get(enrollment.user_id) || "Unknown",
        course_title: coursesMap.get(enrollment.course_id) || "Unknown",
        progress_percentage: enrollment.progress_percentage,
        enrolled_at: format(new Date(enrollment.enrolled_at), "MMM dd, yyyy")
      })));

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
      ...topVideos.map(video => [video.title, video.course_title, video.views])
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
    { title: "Total Users", value: stats.totalUsers, icon: Users, color: "bg-blue-500" },
    { title: "Active Learners", value: stats.activeUsers, icon: Users, color: "bg-green-500" },
    { title: "Enrollments", value: stats.totalEnrollments, icon: BookOpen, color: "bg-purple-500" },
    { title: "Courses", value: stats.totalCourses, icon: BookOpen, color: "bg-orange-500" },
    { title: "Certificates Issued", value: stats.totalCertificates, icon: Award, color: "bg-yellow-500" },
    { title: "Total Videos", value: stats.totalVideos, icon: Video, color: "bg-pink-500" },
    { title: "Avg Quiz Score", value: `${stats.avgQuizScore}%`, icon: CheckCircle, color: "bg-indigo-500" },
    { title: "Completion Rate", value: `${stats.completionRate}%`, icon: TrendingUp, color: "bg-teal-500" },
  ];

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-[200px] justify-start">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateFrom ? format(dateFrom, "PPP") : "From Date"}
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
                {dateTo ? format(dateTo, "PPP") : "To Date"}
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
              <SelectItem value="all">All Categories</SelectItem>
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
          <CardTitle>Enrollment Trend (Last 7 Days)</CardTitle>
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
          <CardTitle>Top Performing Courses</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Course Title</TableHead>
                <TableHead>Enrollments</TableHead>
                <TableHead>Completion Rate</TableHead>
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
          <CardTitle>Top Engaged Users</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User Name</TableHead>
                <TableHead>Enrollments</TableHead>
                <TableHead>Avg Progress</TableHead>
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
          <CardTitle>Top Watched Videos</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Video Title</TableHead>
                <TableHead>Course</TableHead>
                <TableHead className="flex items-center gap-1">
                  <Eye className="h-4 w-4" />
                  Views
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

      {/* User Course Progress */}
      <Card>
        <CardHeader>
          <CardTitle>User Course Progress</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="max-h-[500px] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User Name</TableHead>
                  <TableHead>Course</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead>Enrolled Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {userProgress.map((progress, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">{progress.user_name}</TableCell>
                    <TableCell>{progress.course_title}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-primary transition-all" 
                            style={{ width: `${progress.progress_percentage}%` }}
                          />
                        </div>
                        <span className="text-sm">{progress.progress_percentage}%</span>
                      </div>
                    </TableCell>
                    <TableCell>{progress.enrolled_at}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* User Quiz Performance */}
      <Card>
        <CardHeader>
          <CardTitle>User Quiz Performance (Pre vs Post)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="max-h-[500px] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User Name</TableHead>
                  <TableHead>Course</TableHead>
                  <TableHead>Quiz</TableHead>
                  <TableHead>Pre-Quiz Score</TableHead>
                  <TableHead>Post-Quiz Score</TableHead>
                  <TableHead>Improvement</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {userQuizPerformance.map((performance, index) => {
                  const improvement = performance.pre_score !== null && performance.post_score !== null
                    ? performance.post_score - performance.pre_score
                    : null;
                  return (
                    <TableRow key={index}>
                      <TableCell className="font-medium">{performance.user_name}</TableCell>
                      <TableCell>{performance.course_title}</TableCell>
                      <TableCell>{performance.quiz_title}</TableCell>
                      <TableCell>
                        {performance.pre_score !== null ? (
                          <span className="text-muted-foreground">{performance.pre_score}%</span>
                        ) : (
                          <span className="text-muted-foreground text-xs">Not taken</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {performance.post_score !== null ? (
                          <span className={performance.passed ? "text-green-600 font-semibold" : "text-red-600"}>
                            {performance.post_score}%
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-xs">Not taken</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {improvement !== null ? (
                          <span className={improvement >= 0 ? "text-green-600 font-semibold" : "text-red-600"}>
                            {improvement >= 0 ? "+" : ""}{improvement}%
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {performance.passed !== null ? (
                          performance.passed ? (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              Passed
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                              Failed
                            </span>
                          )
                        ) : (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                            In Progress
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
