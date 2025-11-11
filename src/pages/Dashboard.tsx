import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { BookOpen, Trophy, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import UserNav from "@/components/UserNav";

interface Course {
  id: string;
  title: string;
  description: string;
  difficulty_level: string;
  thumbnail_url: string | null;
  category_id: string | null;
}

interface Enrollment {
  id: string;
  progress_percentage: number;
  enrolled_at: string;
  courses: Course;
}

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [allCourses, setAllCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [user]);

  const fetchData = async () => {
    if (!user) return;

    try {
      // Fetch user enrollments
      const { data: enrollmentData } = await supabase
        .from("enrollments")
        .select(`
          *,
          courses (*)
        `)
        .eq("user_id", user.id);

      if (enrollmentData) {
        setEnrollments(enrollmentData);
      }

      // Fetch all published courses
      const { data: coursesData } = await supabase
        .from("courses")
        .select("*")
        .eq("is_published", true)
        .order("created_at", { ascending: false });

      if (coursesData) {
        setAllCourses(coursesData);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleEnroll = async (courseId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from("enrollments")
        .insert({
          user_id: user.id,
          course_id: courseId,
          progress_percentage: 0,
        });

      if (!error) {
        fetchData();
      }
    } catch (error) {
      console.error("Error enrolling:", error);
    }
  };

  const enrolledCourseIds = enrollments.map((e) => e.courses.id);
  const availableCourses = allCourses.filter((c) => !enrolledCourseIds.includes(c.id));

  const stats = [
    {
      title: "Enrolled Courses",
      value: enrollments.length,
      icon: BookOpen,
    },
    {
      title: "Completed",
      value: enrollments.filter((e) => e.progress_percentage === 100).length,
      icon: Trophy,
    },
    {
      title: "In Progress",
      value: enrollments.filter((e) => e.progress_percentage > 0 && e.progress_percentage < 100).length,
      icon: TrendingUp,
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <UserNav />

      <div className="container mx-auto px-4 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold mb-2">Welcome back!</h2>
          <p className="text-muted-foreground">Continue your learning journey</p>
        </div>

        {/* Stats Grid */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          {stats.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <Card key={index} className="border-border/50">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">{stat.title}</p>
                      <p className="text-3xl font-bold">{stat.value}</p>
                    </div>
                    <div className="h-12 w-12 rounded-lg gradient-crimson flex items-center justify-center">
                      <Icon className="h-6 w-6 text-white" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* My Courses */}
        {enrollments.length > 0 && (
          <div className="mb-12">
            <h3 className="text-2xl font-bold mb-6">My Courses</h3>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {enrollments.map((enrollment) => (
                <Card key={enrollment.id} className="border-border/50 transition-smooth hover:shadow-crimson">
                  <CardHeader>
                    <div className="flex items-start justify-between mb-2">
                      <Badge variant="secondary" className="capitalize">
                        {enrollment.courses.difficulty_level}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        {enrollment.progress_percentage}%
                      </span>
                    </div>
                    <CardTitle className="text-lg">{enrollment.courses.title}</CardTitle>
                    <CardDescription className="line-clamp-2">
                      {enrollment.courses.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Progress value={enrollment.progress_percentage} className="mb-4" />
                    <Button 
                      className="w-full" 
                      variant="outline"
                      onClick={() => navigate(`/courses/${enrollment.courses.id}`)}
                    >
                      Continue Learning
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Available Courses */}
        {availableCourses.length > 0 && (
          <div>
            <h3 className="text-2xl font-bold mb-6">Explore More Courses</h3>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {availableCourses.slice(0, 6).map((course) => (
                <Card key={course.id} className="border-border/50 transition-smooth hover:shadow-crimson">
                  <CardHeader>
                    <Badge variant="secondary" className="capitalize w-fit mb-2">
                      {course.difficulty_level}
                    </Badge>
                    <CardTitle className="text-lg">{course.title}</CardTitle>
                    <CardDescription className="line-clamp-2">
                      {course.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button
                      className="w-full gradient-crimson"
                      onClick={() => handleEnroll(course.id)}
                    >
                      Enroll Now
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {loading && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Loading courses...</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
