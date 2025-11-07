import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Award, Download, Calendar } from "lucide-react";
import UserNav from "@/components/UserNav";

interface Certificate {
  id: string;
  issued_at: string;
  certificate_url: string | null;
  courses: {
    title: string;
    difficulty_level: string;
  };
}

const Certificates = () => {
  const { user } = useAuth();
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCertificates();
  }, [user]);

  const fetchCertificates = async () => {
    if (!user) return;

    try {
      const { data } = await supabase
        .from("certificates")
        .select(`
          *,
          courses (
            title,
            difficulty_level
          )
        `)
        .eq("user_id", user.id)
        .order("issued_at", { ascending: false });

      if (data) setCertificates(data);
    } catch (error) {
      console.error("Error fetching certificates:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = (certificateUrl: string | null) => {
    if (certificateUrl) {
      window.open(certificateUrl, "_blank");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <UserNav />

      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold mb-2">My Certificates</h2>
          <p className="text-muted-foreground">View and download your earned certificates</p>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Loading certificates...</p>
          </div>
        ) : certificates.length === 0 ? (
          <div className="text-center py-12">
            <Award className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground mb-2">No certificates earned yet</p>
            <p className="text-sm text-muted-foreground">
              Complete courses to earn your certificates
            </p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {certificates.map((certificate) => (
              <Card key={certificate.id} className="border-border transition-smooth hover:shadow-crimson">
                <CardHeader>
                  <div className="h-32 gradient-crimson rounded-lg flex items-center justify-center mb-4">
                    <Award className="h-16 w-16 text-white" />
                  </div>
                  <CardTitle className="text-lg">{certificate.courses.title}</CardTitle>
                  <CardDescription className="capitalize">
                    {certificate.courses.difficulty_level} Level
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                    <Calendar className="h-4 w-4" />
                    <span>
                      Issued {new Date(certificate.issued_at).toLocaleDateString()}
                    </span>
                  </div>
                  <Button
                    className="w-full gradient-crimson"
                    onClick={() => handleDownload(certificate.certificate_url)}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Download
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Certificates;
