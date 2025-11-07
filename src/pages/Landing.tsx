import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { GraduationCap, BookOpen, Trophy, Users, ArrowRight, CheckCircle2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Landing = () => {
  const navigate = useNavigate();

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
    { value: "100+", label: "Courses Available" },
    { value: "10k+", label: "Active Learners" },
    { value: "95%", label: "Success Rate" },
  ];

  return (
    <div className="min-h-screen gradient-dark">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48cGF0dGVybiBpZD0iZ3JpZCIgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBwYXR0ZXJuVW5pdHM9InVzZXJTcGFjZU9uVXNlIj48cGF0aCBkPSJNIDQwIDAgTCAwIDAgMCA0MCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJyZ2JhKDI1NSwyNTUsMjU1LDAuMDUpIiBzdHJva2Utd2lkdGg9IjEiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjZ3JpZCkiLz48L3N2Zz4=')] opacity-20"></div>
        
        <div className="container mx-auto px-4 py-20 relative z-10">
          <div className="text-center max-w-4xl mx-auto space-y-8">
            <div className="inline-flex h-20 w-20 items-center justify-center rounded-full gradient-crimson shadow-crimson mx-auto mb-6">
              <GraduationCap className="h-10 w-10 text-white" />
            </div>
            
            <h1 className="text-5xl md:text-6xl font-bold tracking-tight">
              Master New Skills with
              <span className="block mt-2 bg-gradient-to-r from-secondary to-accent bg-clip-text text-transparent">
                Expert-Led Courses
              </span>
            </h1>
            
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Join thousands of learners advancing their careers with our comprehensive online learning platform. Track progress, earn certificates, and achieve your goals.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-4">
              <Button
                size="lg"
                className="gradient-crimson shadow-crimson hover:opacity-90 transition-smooth text-lg px-8"
                onClick={() => navigate("/auth")}
              >
                Get Started Free
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="text-lg px-8"
                onClick={() => navigate("/auth")}
              >
                Browse Courses
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
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="container mx-auto px-4 py-20">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold mb-4">Why Choose LearnHub?</h2>
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

      {/* Footer */}
      <footer className="border-t border-border/50 py-8">
        <div className="container mx-auto px-4 text-center text-muted-foreground">
          <p>&copy; 2025 LearnHub. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
