import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { GraduationCap, BookOpen, Trophy, Users, ArrowRight, CheckCircle2, Clock, Award } from "lucide-react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import UserNav from "@/components/UserNav";
import ThemeToggle from "@/components/ThemeToggle";

interface Course {
  id: string;
  title: string;
  description: string;
  difficulty_level: string;
  thumbnail_url: string | null;
  video_count: number;
  instructor_name: string | null;
}

const Landing = () => {
  const navigate = useNavigate();
  const { user, userRole, loading } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [filteredCourses, setFilteredCourses] = useState<Course[]>([]);
  const [enrolledCourseIds, setEnrolledCourseIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [difficultyFilter, setDifficultyFilter] = useState("all");
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [userName, setUserName] = useState<string>("");

  useEffect(() => {
    fetchCourses();
    if (user) {
      fetchUserName();
    }
  }, [user]);

  const fetchUserName = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .maybeSingle();
    setUserName(data?.full_name || "User");
  };

  useEffect(() => {
    filterCourses();
  }, [courses, searchQuery, difficultyFilter]);

  const fetchCourses = async () => {
    try {
      // Fetch all published courses
      const { data: coursesData, error: coursesError } = await supabase
        .from("courses")
        .select("*")
        .eq("is_published", true)
        .order("created_at", { ascending: false });

      if (coursesError) throw coursesError;
      setCourses(coursesData || []);

      // If user is logged in, fetch their enrollments
      if (user) {
        const { data: enrollmentsData } = await supabase
          .from("enrollments")
          .select("course_id")
          .eq("user_id", user.id);

        setEnrolledCourseIds(enrollmentsData?.map((e) => e.course_id) || []);
      }
    } catch (error) {
      console.error("Error fetching courses:", error);
    } finally {
      setLoadingCourses(false);
    }
  };

  const filterCourses = () => {
    let filtered = courses;

    if (searchQuery) {
      filtered = filtered.filter(
        (course) =>
          course.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          course.description.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (difficultyFilter !== "all") {
      filtered = filtered.filter((course) => course.difficulty_level === difficultyFilter);
    }

    setFilteredCourses(filtered);
  };

  const handleEnroll = async (courseId: string) => {
    if (!user) {
      navigate("/auth");
      return;
    }

    try {
      const { error } = await supabase.from("enrollments").insert({
        user_id: user.id,
        course_id: courseId,
        progress_percentage: 0,
      });

      if (error) throw error;

      setEnrolledCourseIds([...enrolledCourseIds, courseId]);
      navigate(`/courses/${courseId}`);
    } catch (error: any) {
      console.error("Error enrolling:", error);
      if (error.code === "23505") {
        // Already enrolled, navigate to course
        navigate(`/courses/${courseId}`);
      }
    }
  };

  const getDifficultyColor = (level: string) => {
    switch (level) {
      case "beginner":
        return "bg-green-500/10 text-green-600";
      case "intermediate":
        return "bg-yellow-500/10 text-yellow-600";
      case "advanced":
        return "bg-red-500/10 text-red-600";
      default:
        return "bg-gray-500/10 text-gray-600";
    }
  };

  const features = [
    {
      icon: BookOpen,
      title: "Comprehensive Courses",
      description: "Access a wide range of courses across multiple categories and difficulty levels.",
    },
    {
      icon: Trophy,
      title: "Earn Certificates",
      description: "Complete courses and quizzes to earn verified certificates of completion.",
    },
    {
      icon: Users,
      title: "Expert Instructors",
      description: "Learn from industry professionals and experienced educators.",
    },
  ];

  const stats = [
    { value: courses.length.toString(), label: "Courses Available" },
    { value: "10k+", label: "Active Learners" },
    { value: "95%", label: "Success Rate" },
  ];

  return (
    <div className="min-h-screen bg-background">
      {user ? <UserNav /> : (
        <header className="border-b border-border bg-card/30 backdrop-blur-sm sticky top-0 z-10">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between">
            <Link to="/" className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full gradient-crimson flex items-center justify-center">
                <GraduationCap className="h-5 w-5 text-white" />
              </div>
              <h1 className="text-xl font-bold">MOI AI Learning Hub</h1>
            </Link>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <Button size="sm" onClick={() => navigate("/auth")}>Sign In</Button>
            </div>
          </div>
        </header>
      )}
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48cGF0dGVybiBpZD0iZ3JpZCIgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBwYXR0ZXJuVW5pdHM9InVzZXJTcGFjZU9uVXNlIj48cGF0aCBkPSJNIDQwIDAgTCAwIDAgMCA0MCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJyZ2JhKDI1NSwyNTUsMjU1LDAuMDUpIiBzdHJva2Utd2lkdGg9IjEiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjZ3JpZCkiLz48L3N2Zz4=')] opacity-20"></div>
        
        <div className="container mx-auto px-4 py-20 relative z-10">
          <div className="text-center max-w-4xl mx-auto space-y-8">
            <div className="inline-flex h-20 w-20 items-center justify-center rounded-full gradient-crimson shadow-crimson mx-auto mb-6">
              <GraduationCap className="h-10 w-10 text-white" />
            </div>
            
            {user && userName ? (
              <h1 className="text-5xl md:text-6xl font-bold tracking-tight">
                Welcome back, <span className="bg-gradient-to-r from-secondary to-accent bg-clip-text text-transparent">{userName}</span>!
              </h1>
            ) : (
              <>
                <h1 className="text-5xl md:text-6xl font-bold tracking-tight">
                  Welcome to the
                  <span className="block mt-2 bg-gradient-to-r from-secondary to-accent bg-clip-text text-transparent">
                    MOI AI Learning Hub
                  </span>
                </h1>
                
                <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
                  Empowering the Ministry's employees to lead the future of media through Artificial Intelligence and advanced technologies.
                </p>
                <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
                  Discover a growing collection of expert-led courses designed to help you understand, apply, and innovate with AI.
                </p>
                <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
                  From fundamentals of machine learning to real-world applications in media, communication, and digital transformation — this platform is your gateway to mastering tomorrow's skills, today.
                </p>
                <p className="text-2xl font-semibold text-secondary mt-6">
                  Learn. Innovate. Transform.
                </p>
              </>
            )}
            
            {!user && (
              <>
                <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-4">
                  <Button
                    size="lg"
                    className="gradient-crimson shadow-crimson hover:opacity-90 transition-smooth text-lg px-8"
                    onClick={() => navigate("/auth")}
                  >
                    Get Started Free
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-8 pt-12 max-w-2xl mx-auto">
                  {stats.map((stat, index) => (
                    <div key={index} className="text-center">
                      <div className="text-3xl font-bold text-secondary">{stat.value}</div>
                      <div className="text-sm text-muted-foreground mt-1">{stat.label}</div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Available Courses Section */}
      <div className="container mx-auto px-4 py-20">
        <div className="mb-8">
          <h2 className="text-4xl font-bold mb-4 text-center">Available Courses</h2>
          <p className="text-xl text-muted-foreground text-center mb-8">
            Browse our collection of courses and start learning today
          </p>

          {/* Filters */}
          <div className="flex flex-col md:flex-row gap-4 max-w-2xl mx-auto mb-8">
            <Input
              placeholder="Search courses..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1"
            />
            <Select value={difficultyFilter} onValueChange={setDifficultyFilter}>
              <SelectTrigger className="w-full md:w-[180px]">
                <SelectValue placeholder="Difficulty" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Levels</SelectItem>
                <SelectItem value="beginner">Beginner</SelectItem>
                <SelectItem value="intermediate">Intermediate</SelectItem>
                <SelectItem value="advanced">Advanced</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {loadingCourses ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Loading courses...</p>
          </div>
        ) : filteredCourses.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No courses found matching your criteria.</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCourses.map((course) => {
              const isEnrolled = enrolledCourseIds.includes(course.id);
              
              return (
                <Card key={course.id} className="border-border transition-smooth hover:shadow-crimson hover:scale-105">
                  <CardHeader>
                    <div className="flex items-start justify-between mb-2">
                      <Badge className={getDifficultyColor(course.difficulty_level)}>
                        {course.difficulty_level}
                      </Badge>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <BookOpen className="h-4 w-4" />
                        <span>{course.video_count} videos</span>
                      </div>
                    </div>
                    <CardTitle className="text-xl">{course.title}</CardTitle>
                    <CardDescription className="line-clamp-2">
                      {course.description}
                    </CardDescription>
                  </CardHeader>
                  <CardFooter>
                    {isEnrolled ? (
                      <Button
                        className="w-full"
                        onClick={() => navigate(`/courses/${course.id}`)}
                      >
                        Continue Learning
                      </Button>
                    ) : (
                      <Button
                        className="w-full gradient-crimson"
                        onClick={() => handleEnroll(course.id)}
                      >
                        {user ? "Enroll Now" : "Sign Up to Enroll"}
                      </Button>
                    )}
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Features Section */}
      <div className="container mx-auto px-4 py-20">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold mb-4">Why Choose MOI AI Learning Hub?</h2>
          <p className="text-xl text-muted-foreground">Everything you need to succeed in your learning journey</p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <Card key={index} className="border-border/50 transition-smooth hover:shadow-crimson hover:scale-105">
                <CardHeader>
                  <div className="h-12 w-12 rounded-lg gradient-crimson flex items-center justify-center mb-4">
                    <Icon className="h-6 w-6 text-white" />
                  </div>
                  <CardTitle>{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-base">{feature.description}</CardDescription>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Benefits Section */}
      {!user && (
        <div className="container mx-auto px-4 py-20">
          <Card className="border-border/50 max-w-4xl mx-auto overflow-hidden">
            <div className="gradient-crimson p-8 text-center">
              <h2 className="text-3xl font-bold text-white mb-4">Start Learning Today</h2>
              <p className="text-white/90 text-lg mb-6">
                Join our community and unlock your potential with structured learning paths
              </p>
            </div>
            <CardContent className="p-8">
              <div className="grid md:grid-cols-2 gap-6">
                {[
                  "Video lessons from industry experts",
                  "Interactive quizzes and assessments",
                  "Progress tracking and analytics",
                  "Downloadable certificates",
                  "Lifetime access to course materials",
                  "Mobile-friendly learning experience",
                ].map((benefit, index) => (
                  <div key={index} className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 text-secondary flex-shrink-0 mt-0.5" />
                    <span className="text-foreground">{benefit}</span>
                  </div>
                ))}
              </div>
              <div className="mt-8 text-center">
                <Button
                  size="lg"
                  className="gradient-crimson shadow-crimson hover:opacity-90 transition-smooth"
                  onClick={() => navigate("/auth")}
                >
                  Create Your Free Account
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-border/50 py-8">
        <div className="container mx-auto px-4 text-center text-muted-foreground">
          <p>&copy; 2025 MOI AI Learning Hub. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
