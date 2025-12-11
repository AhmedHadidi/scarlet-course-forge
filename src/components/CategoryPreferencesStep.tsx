import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Category {
  id: string;
  name: string;
  description: string | null;
}

interface CategoryPreferencesStepProps {
  userId: string;
  onComplete: () => void;
  onSkip: () => void;
}

export const CategoryPreferencesStep = ({
  userId,
  onComplete,
  onSkip,
}: CategoryPreferencesStepProps) => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase
        .from("news_categories")
        .select("*")
        .order("name");

      if (error) throw error;
      setCategories(data || []);
    } catch (error) {
      console.error("Error fetching categories:", error);
    } finally {
      setLoading(false);
    }
  };

  const toggleCategory = (categoryId: string) => {
    setSelectedCategories((prev) =>
      prev.includes(categoryId)
        ? prev.filter((id) => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  const handleSave = async () => {
    if (selectedCategories.length === 0) {
      toast.error("Please select at least one category");
      return;
    }

    setSaving(true);
    try {
      const preferences = selectedCategories.map((categoryId) => ({
        user_id: userId,
        category_id: categoryId,
      }));

      const { error } = await supabase
        .from("user_category_preferences")
        .insert(preferences);

      if (error) throw error;

      toast.success("Preferences saved successfully!");
      onComplete();
    } catch (error: any) {
      toast.error("Error saving preferences: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (categories.length === 0) {
    return (
      <div className="space-y-4">
        <p className="text-muted-foreground text-center">
          No categories available yet. You can set your preferences later.
        </p>
        <Button onClick={onSkip} className="w-full">
          Continue
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-lg font-semibold mb-2">Select Your Interests</h3>
        <p className="text-sm text-muted-foreground">
          Choose the AI topics you're interested in to receive personalized weekly news bulletins.
        </p>
      </div>

      <div className="grid gap-3 max-h-[300px] overflow-y-auto p-1">
        {categories.map((category) => (
          <div
            key={category.id}
            className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
              selectedCategories.includes(category.id)
                ? "border-primary bg-primary/5"
                : "border-border hover:bg-muted"
            }`}
            onClick={() => toggleCategory(category.id)}
          >
            <Checkbox
              id={`pref-${category.id}`}
              checked={selectedCategories.includes(category.id)}
              onCheckedChange={() => toggleCategory(category.id)}
            />
            <div className="flex-1">
              <Label
                htmlFor={`pref-${category.id}`}
                className="cursor-pointer font-medium"
              >
                {category.name}
              </Label>
              {category.description && (
                <p className="text-xs text-muted-foreground mt-1">
                  {category.description}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <Button variant="outline" onClick={onSkip} className="flex-1">
          Skip for now
        </Button>
        <Button
          onClick={handleSave}
          disabled={saving || selectedCategories.length === 0}
          className="flex-1"
        >
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save Preferences ({selectedCategories.length})
        </Button>
      </div>
    </div>
  );
};
