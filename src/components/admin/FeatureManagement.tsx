import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Award, Bell } from "lucide-react";

interface FeatureSetting {
  id: string;
  feature_name: string;
  is_enabled: boolean;
}

export const FeatureManagement = () => {
  const [features, setFeatures] = useState<FeatureSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchFeatures();
  }, []);

  const fetchFeatures = async () => {
    try {
      const { data, error } = await supabase
        .from("feature_settings")
        .select("*")
        .order("feature_name");

      if (error) throw error;
      if (data) setFeatures(data);
    } catch (error) {
      console.error("Error fetching features:", error);
      toast({
        title: "Error",
        description: "Failed to load feature settings",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleFeature = async (featureId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from("feature_settings")
        .update({ is_enabled: !currentStatus })
        .eq("id", featureId);

      if (error) throw error;

      setFeatures(features.map(f => 
        f.id === featureId ? { ...f, is_enabled: !currentStatus } : f
      ));

      toast({
        title: "Success",
        description: `Feature ${!currentStatus ? 'enabled' : 'disabled'} successfully`,
      });
    } catch (error) {
      console.error("Error updating feature:", error);
      toast({
        title: "Error",
        description: "Failed to update feature setting",
        variant: "destructive",
      });
    }
  };

  const getFeatureIcon = (featureName: string) => {
    switch (featureName) {
      case "certificates":
        return Award;
      case "notifications":
        return Bell;
      default:
        return Award;
    }
  };

  const getFeatureDescription = (featureName: string) => {
    switch (featureName) {
      case "certificates":
        return "Allow users to view and download their certificates";
      case "notifications":
        return "Allow users to receive and view notifications";
      default:
        return "Feature setting";
    }
  };

  if (loading) {
    return <div className="text-muted-foreground">Loading feature settings...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">Feature Visibility</h3>
        <p className="text-sm text-muted-foreground">
          Control which features are visible to users
        </p>
      </div>

      <div className="grid gap-4">
        {features.map((feature) => {
          const Icon = getFeatureIcon(feature.feature_name);
          return (
            <Card key={feature.id} className="border-border/50">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg gradient-crimson flex items-center justify-center">
                      <Icon className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-base capitalize">
                        {feature.feature_name}
                      </CardTitle>
                      <CardDescription>
                        {getFeatureDescription(feature.feature_name)}
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label 
                      htmlFor={`feature-${feature.id}`}
                      className="text-sm text-muted-foreground"
                    >
                      {feature.is_enabled ? "Enabled" : "Disabled"}
                    </Label>
                    <Switch
                      id={`feature-${feature.id}`}
                      checked={feature.is_enabled}
                      onCheckedChange={() => toggleFeature(feature.id, feature.is_enabled)}
                    />
                  </div>
                </div>
              </CardHeader>
            </Card>
          );
        })}
      </div>
    </div>
  );
};
