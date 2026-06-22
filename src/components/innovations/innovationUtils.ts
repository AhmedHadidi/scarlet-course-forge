export type InnovationCategory = "time_saving" | "performance" | "automation" | "quality";
export type InnovationStatus = "idea" | "in_progress" | "implemented" | "evaluated";

export const CATEGORY_KEYS: InnovationCategory[] = ["time_saving", "performance", "automation", "quality"];
export const STATUS_KEYS: InnovationStatus[] = ["idea", "in_progress", "implemented", "evaluated"];

export const CATEGORY_COLORS: Record<InnovationCategory, string> = {
  time_saving: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30",
  performance: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
  automation: "bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30",
  quality: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30",
};

export const STATUS_COLORS: Record<InnovationStatus, string> = {
  idea: "bg-muted text-muted-foreground",
  in_progress: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  implemented: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  evaluated: "bg-primary/15 text-primary",
};

export interface Innovation {
  id: string;
  user_id: string;
  department_id: string | null;
  title: string;
  description: string;
  category: InnovationCategory;
  status: InnovationStatus;
  progress_percentage: number;
  impact_description: string | null;
  time_saved_hours: number | null;
  cost_saved: number | null;
  tools_used: string[] | null;
  start_date: string | null;
  completion_date: string | null;
  attachments_urls: string[] | null;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
}
