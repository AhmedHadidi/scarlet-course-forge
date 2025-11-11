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
  score: number;
  passed: boolean;
  attempted_at: string;
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

      // Build date filter
      let dateFilter = "";
      if (dateFrom) {
        dateFilter = `created_at.gte.${dateFrom.toISOString()}`;
      }
      if (dateTo) {
        dateFilter += dateFilter ? `,created_at.lte.${dateTo.toISOString()}` : `created_at.lte.${dateTo.toISOString()}`;
      }

      // Fetch total users using edge function for accurate count
      const { data: { session } } = await supabase.auth.getSession();
      const { data: usersData } = await supabase.functions.invoke('admin-operations', {
        body: { operation: 'listUsers' },
        headers: { Authorization: `Bearer ${session?.access_token}` }
      });
      const totalUsers = usersData?.users?.length || 0;

      // Fetch active users (users with enrollments)
      const { data: activeUsersData } = await supabase
        .from("enrollments")
        .select("user_id", { count: "exact" });
      const activeUsers = new Set(activeUsersData?.map(e => e.user_id)).size;

      // Fetch enrollments with optional date filter
      let enrollmentQuery = supabase.from("enrollments").select("*", { count: "exact", head: true });
      const { count: totalEnrollments } = await enrollmentQuery;

      // Fetch courses with optional category filter
      let courseQuery = supabase.from("courses").select("*", { count: "exact", head: true });
      if (categoryFilter !== "all") {
        courseQuery = courseQuery.eq("category_id", categoryFilter);
      }
      const { count: totalCourses } = await courseQuery;

      // Fetch certificates
      const { count: totalCertificates } = await supabase
        .from("certificates")
        .select("*", { count: "exact", head: true });

      // Fetch total videos
      const { count: totalVideos } = await supabase
        .from("course_videos")
        .select("*", { count: "exact", head: true });

      // Fetch quiz attempts for average score
      const { data: quizAttempts } = await supabase
        .from("quiz_attempts")
        .select("score");
      
      const avgQuizScore = quizAttempts && quizAttempts.length > 0
        ? Math.round(quizAttempts.reduce((sum, attempt) => sum + attempt.score, 0) / quizAttempts.length)
        : 0;

      // Fetch enrollments for completion rate
      const { data: enrollments } = await supabase
        .from("enrollments")
        .select("progress_percentage");
      
      const completionRate = enrollments && enrollments.length > 0
        ? Math.round(enrollments.reduce((sum, e) => sum + e.progress_percentage, 0) / enrollments.length)
        : 0;

      // Fetch top courses
      const { data: coursesData } = await supabase
        .from("courses")
        .select(`
          id,
          title,
          enrollments (
            id,
            progress_percentage
          )
        `);

      const topCoursesData = (coursesData || [])
        .map(course => ({
          title: course.title,
          enrollments: course.enrollments?.length || 0,
          completionRate: course.enrollments && course.enrollments.length > 0
            ? Math.round(
                course.enrollments.reduce((sum: number, e: any) => sum + e.progress_percentage, 0) / 
                course.enrollments.length
              )
            : 0
        }))
        .sort((a, b) => b.enrollments - a.enrollments)
        .slice(0, 5);

      setStats({
        totalUsers: totalUsers || 0,
        activeUsers,
        totalEnrollments: totalEnrollments || 0,
        totalCourses: totalCourses || 0,
        totalCertificates: totalCertificates || 0,
        totalVideos: totalVideos || 0,
        avgQuizScore,
        completionRate,
      });

      setTopCourses(topCoursesData);

      // Fetch top engaged users
      const { data: enrollmentsForUsers } = await supabase
        .from("enrollments")
        .select(`
          user_id,
          progress_percentage,
          profiles (
            full_name
          )
        `);

      const userEnrollments: { [key: string]: { name: string; count: number; totalProgress: number } } = {};
      enrollmentsForUsers?.forEach((enrollment: any) => {
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

      // Fetch top watched videos (based on video progress records)
      const { data: videoProgressData } = await supabase
        .from("video_progress")
        .select(`
          video_id,
          course_videos (
            title,
            courses (
              title
            )
          )
        `);

      const videoViews: { [key: string]: { title: string; course_title: string; count: number } } = {};
      videoProgressData?.forEach((vp: any) => {
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

      // Fetch enrollment trend (last 7 days)
      const last7Days = Array.from({ length: 7 }, (_, i) => {
        const date = new Date();
        date.setDate(date.getDate() - (6 - i));
        return date.toISOString().split('T')[0];
      });

      const { data: trendData } = await supabase
        .from("enrollments")
        .select("enrolled_at");

      const trendCounts: { [key: string]: number } = {};
      last7Days.forEach(day => {
        trendCounts[day] = 0;
      });

      trendData?.forEach((enrollment: any) => {
        const date = enrollment.enrolled_at.split('T')[0];
        if (trendCounts[date] !== undefined) {
          trendCounts[date]++;
        }
      });

      const enrollmentTrendData = last7Days.map(day => ({
        date: format(new Date(day), "MMM dd"),
        enrollments: trendCounts[day]
      }));

      setEnrollmentTrend(enrollmentTrendData);

      // Fetch detailed user progress
      const { data: userProgressData } = await supabase
        .from("enrollments")
        .select(`
          progress_percentage,
          enrolled_at,
          profiles (
            full_name
          ),
          courses (
            title
          )
        `)
        .order('enrolled_at', { ascending: false })
        .limit(50);

      const userProgressList = (userProgressData || []).map((enrollment: any) => ({
        user_name: enrollment.profiles?.full_name || "Unknown",
        course_title: enrollment.courses?.title || "Unknown",
        progress_percentage: enrollment.progress_percentage,
        enrolled_at: format(new Date(enrollment.enrolled_at), "MMM dd, yyyy")
      }));

      setUserProgress(userProgressList);

      // Fetch user quiz performance
      const { data: quizPerformanceData } = await supabase
        .from("quiz_attempts")
        .select(`
          score,
          passed,
          attempted_at,
          profiles (
            full_name
          ),
          quizzes (
            title,
            courses (
              title
            )
          )
        `)
        .order('attempted_at', { ascending: false })
        .limit(50);

      const quizPerformanceList = (quizPerformanceData || []).map((attempt: any) => ({
        user_name: attempt.profiles?.full_name || "Unknown",
        quiz_title: attempt.quizzes?.title || "Unknown",
        course_title: attempt.quizzes?.courses?.title || "Unknown",
        score: attempt.score,
        passed: attempt.passed,
        attempted_at: format(new Date(attempt.attempted_at), "MMM dd, yyyy HH:mm")
      }));

      setUserQuizPerformance(quizPerformanceList);
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
          <CardTitle>User Quiz Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="max-h-[500px] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User Name</TableHead>
                  <TableHead>Course</TableHead>
                  <TableHead>Quiz</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Attempted At</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {userQuizPerformance.map((performance, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">{performance.user_name}</TableCell>
                    <TableCell>{performance.course_title}</TableCell>
                    <TableCell>{performance.quiz_title}</TableCell>
                    <TableCell>
                      <span className={performance.score >= 70 ? "text-green-600 font-semibold" : "text-red-600"}>
                        {performance.score}%
                      </span>
                    </TableCell>
                    <TableCell>
                      {performance.passed ? (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          Passed
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                          Failed
                        </span>
                      )}
                    </TableCell>
                    <TableCell>{performance.attempted_at}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
