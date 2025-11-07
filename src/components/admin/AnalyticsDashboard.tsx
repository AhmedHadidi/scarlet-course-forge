import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, Calendar as CalendarIcon, Users, BookOpen, Award, TrendingUp, Video, CheckCircle } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

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

      // Fetch total users
      const { count: totalUsers } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true });

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
      ...topCourses.map(course => [course.title, course.enrollments, `${course.completionRate}%`])
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
    </div>
  );
};
