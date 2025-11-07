import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, BookOpen } from "lucide-react";
import UserNav from "@/components/UserNav";
import { useToast } from "@/hooks/use-toast";

interface Course {
  id: string;
  title: string;
  description: string;
  difficulty_level: string;
  thumbnail_url: string | null;
  video_count: number;
}

const Courses = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [courses, setCourses] = useState<Course[]>([]);
  const [filteredCourses, setFilteredCourses] = useState<Course[]>([]);
  const [enrolledIds, setEnrolledIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [difficultyFilter, setDifficultyFilter] = useState("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCourses();
  }, [user]);

  useEffect(() => {
    filterCourses();
  }, [courses, searchQuery, difficultyFilter]);

  const fetchCourses = async () => {
    if (!user) return;

    try {
      const { data: coursesData } = await supabase
        .from("courses")
        .select("*")
        .eq("is_published", true)
        .order("created_at", { ascending: false });

      const { data: enrollmentData } = await supabase
        .from("enrollments")
        .select("course_id")
        .eq("user_id", user.id);

      if (coursesData) setCourses(coursesData);
      if (enrollmentData) setEnrolledIds(enrollmentData.map((e) => e.course_id));
    } catch (error) {
      console.error("Error fetching courses:", error);
    } finally {
      setLoading(false);
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
    if (!user) return;

    try {
      const { error } = await supabase.from("enrollments").insert({
        user_id: user.id,
        course_id: courseId,
        progress_percentage: 0,
      });

      if (!error) {
        setEnrolledIds([...enrolledIds, courseId]);
        toast({
          title: "Enrolled Successfully",
          description: "You can now access this course from your dashboard.",
        });
        // Navigate to course player
        navigate(`/courses/${courseId}`);
      }
    } catch (error: any) {
      console.error("Error enrolling:", error);
      if (error.code === "23505") {
        // Already enrolled, navigate to course
        navigate(`/courses/${courseId}`);
      } else {
        toast({
          title: "Enrollment Failed",
          description: "Please try again later.",
          variant: "destructive",
        });
      }
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <UserNav />

      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold mb-2">All Courses</h2>
          <p className="text-muted-foreground">Browse and enroll in courses</p>
        </div>

        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-4 mb-8">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search courses..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={difficultyFilter} onValueChange={setDifficultyFilter}>
            <SelectTrigger className="w-full md:w-48">
              <SelectValue placeholder="Difficulty Level" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Levels</SelectItem>
              <SelectItem value="beginner">Beginner</SelectItem>
              <SelectItem value="intermediate">Intermediate</SelectItem>
              <SelectItem value="advanced">Advanced</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Courses Grid */}
        {loading ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Loading courses...</p>
          </div>
        ) : filteredCourses.length === 0 ? (
          <div className="text-center py-12">
            <BookOpen className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No courses found</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCourses.map((course) => {
              const isEnrolled = enrolledIds.includes(course.id);
              return (
                <Card key={course.id} className="border-border transition-smooth hover:shadow-crimson">
                  <CardHeader>
                    <div className="flex items-start justify-between mb-2">
                      <Badge variant="secondary" className="capitalize">
                        {course.difficulty_level}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        {course.video_count} videos
                      </span>
                    </div>
                    <CardTitle className="text-lg">{course.title}</CardTitle>
                    <CardDescription className="line-clamp-3">
                      {course.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
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
                        Enroll Now
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default Courses;
