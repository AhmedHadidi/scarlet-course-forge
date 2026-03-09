import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { GraduationCap, BookOpen, Trophy, Users, ArrowRight, CheckCircle2 } from "lucide-react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import UserNav from "@/components/UserNav";
import ThemeToggle from "@/components/ThemeToggle";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useTranslation } from "react-i18next";

interface Course {
  id: string;
  title: string;
  description: string;
  difficulty_level: string;
  thumbnail_url: string | null;
  video_count: number;
  instructor_name: string | null;
  created_at: string;
}

const NEW_COURSE_DAYS = 3;
const isNewCourse = (createdAt: string) => {
  const created = new Date(createdAt);
  const now = new Date();
  return (now.getTime() - created.getTime()) < NEW_COURSE_DAYS * 24 * 60 * 60 * 1000;
};

const Landing = () => {
  const navigate = useNavigate();
  const { user, userRole, loading } = useAuth();
  const { t } = useTranslation();
  const [courses, setCourses] = useState<Course[]>([]);
  const [filteredCourses, setFilteredCourses] = useState<Course[]>([]);
  const [enrolledCourseIds, setEnrolledCourseIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [difficultyFilter, setDifficultyFilter] = useState("all");
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [userName, setUserName] = useState<string>("");
  const [totalLearners, setTotalLearners] = useState(0);
  const [completionRate, setCompletionRate] = useState(0);

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
      const { data: coursesData, error: coursesError } = await supabase
        .from("courses")
        .select("*")
        .eq("is_published", true)
        .order("created_at", { ascending: false });

      if (coursesError) throw coursesError;
      setCourses(coursesData || []);

      // Fetch real stats: total learners + completion rate
      try {
        const { count: learnersCount } = await supabase
          .from("enrollments")
          .select("*", { count: "exact", head: true });
        setTotalLearners(learnersCount || 0);

        const { count: totalEnrollments } = await supabase
          .from("enrollments")
          .select("*", { count: "exact", head: true });
        const { count: completedEnrollments } = await supabase
          .from("enrollments")
          .select("*", { count: "exact", head: true })
          .not("completed_at", "is", null);
        if (totalEnrollments && totalEnrollments > 0) {
          setCompletionRate(Math.round(((completedEnrollments || 0) / totalEnrollments) * 100));
        }
      } catch { /* stats are optional */ }

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
        navigate(`/courses/${courseId}`);
      }
    }
  };

  const getDifficultyColor = (level: string) => {
    switch (level) {
      case "beginner": return "bg-green-500/10 text-green-600";
      case "intermediate": return "bg-yellow-500/10 text-yellow-600";
      case "advanced": return "bg-red-500/10 text-red-600";
      default: return "bg-gray-500/10 text-gray-600";
    }
  };

  const getDifficultyLabel = (level: string) => {
    switch (level) {
      case "beginner": return t("landing.beginner");
      case "intermediate": return t("landing.intermediate");
      case "advanced": return t("landing.advanced");
      default: return level;
    }
  };

  const features = [
    { icon: BookOpen, title: t("landing.feature1Title"), description: t("landing.feature1Desc") },
    { icon: Trophy, title: t("landing.feature2Title"), description: t("landing.feature2Desc") },
    { icon: Users, title: t("landing.feature3Title"), description: t("landing.feature3Desc") },
  ];

  const stats = [
    { value: courses.length.toString(), label: t("landing.coursesAvailable") },
    { value: totalLearners.toString(), label: t("landing.activeLearners") },
    { value: `${completionRate}%`, label: t("landing.successRate") },
  ];

  const benefits = [
    t("landing.benefit1"),
    t("landing.benefit2"),
    t("landing.benefit3"),
    t("landing.benefit4"),
    t("landing.benefit5"),
    t("landing.benefit6"),
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
              <h1 className="text-xl font-bold">{t("nav.brand")}</h1>
            </Link>
            <div className="flex items-center gap-2">
              <LanguageSwitcher />
              <ThemeToggle />
              <Button size="sm" onClick={() => navigate("/auth")}>{t("nav.signIn")}</Button>
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
                {t("landing.welcomeBack", { name: userName })}
              </h1>
            ) : (
              <>
                <h1 className="text-5xl md:text-6xl font-bold tracking-tight">
                  {t("landing.welcomeTitle")}
                  <span className="block mt-2 bg-gradient-to-r from-secondary to-accent bg-clip-text text-transparent">
                    {t("nav.brand")}
                  </span>
                </h1>
                <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
                  {t("landing.heroSubtitle")}
                </p>
                <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
                  {t("landing.heroSubtitle2")}
                </p>
                <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
                  {t("landing.heroSubtitle3")}
                </p>
                <p className="text-2xl font-semibold text-secondary mt-6">
                  {t("landing.tagline")}
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
                    {t("landing.getStarted")}
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </div>

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
          <h2 className="text-4xl font-bold mb-4 text-center">{t("landing.availableCourses")}</h2>
          <p className="text-xl text-muted-foreground text-center mb-8">
            {t("landing.browseCourses")}
          </p>

          <div className="flex flex-col md:flex-row gap-4 max-w-2xl mx-auto mb-8">
            <Input
              placeholder={t("landing.searchCourses")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1"
            />
            <Select value={difficultyFilter} onValueChange={setDifficultyFilter}>
              <SelectTrigger className="w-full md:w-[180px]">
                <SelectValue placeholder={t("landing.difficulty")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("landing.allLevels")}</SelectItem>
                <SelectItem value="beginner">{t("landing.beginner")}</SelectItem>
                <SelectItem value="intermediate">{t("landing.intermediate")}</SelectItem>
                <SelectItem value="advanced">{t("landing.advanced")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {loadingCourses ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">{t("landing.loadingCourses")}</p>
          </div>
        ) : filteredCourses.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">{t("landing.noCoursesFound")}</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCourses.map((course) => {
              const isEnrolled = enrolledCourseIds.includes(course.id);
              return (
                <Card key={course.id} className="border-border transition-smooth hover:shadow-crimson hover:scale-105 relative overflow-hidden">
                  {!isEnrolled && course.created_at && isNewCourse(course.created_at) && (
                    <div className="absolute top-3 -right-8 z-10 rotate-45 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white text-xs font-bold px-10 py-1 shadow-md animate-pulse">
                      {t("landing.new")}
                    </div>
                  )}
                  <CardHeader>
                    <div className="flex items-start justify-between mb-2">
                      <Badge className={getDifficultyColor(course.difficulty_level)}>
                        {getDifficultyLabel(course.difficulty_level)}
                      </Badge>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <BookOpen className="h-4 w-4" />
                        <span>{course.video_count} {t("landing.videos")}</span>
                      </div>
                    </div>
                    <CardTitle className="text-xl">{course.title}</CardTitle>
                    <CardDescription className="line-clamp-2">{course.description}</CardDescription>
                  </CardHeader>
                  <CardFooter>
                    {isEnrolled ? (
                      <Button className="w-full" onClick={() => navigate(`/courses/${course.id}`)}>
                        {t("landing.continueLearning")}
                      </Button>
                    ) : (
                      <Button className="w-full gradient-crimson" onClick={() => handleEnroll(course.id)}>
                        {user ? t("landing.enrollNow") : t("landing.signUpToEnroll")}
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
          <h2 className="text-4xl font-bold mb-4">{t("landing.whyChoose")}</h2>
          <p className="text-xl text-muted-foreground">{t("landing.whySubtitle")}</p>
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
              <h2 className="text-3xl font-bold text-white mb-4">{t("landing.startLearning")}</h2>
              <p className="text-white/90 text-lg mb-6">{t("landing.startLearningSubtitle")}</p>
            </div>
            <CardContent className="p-8">
              <div className="grid md:grid-cols-2 gap-6">
                {benefits.map((benefit, index) => (
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
                  {t("landing.createAccount")}
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
          <p>{t("landing.footer")}</p>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
