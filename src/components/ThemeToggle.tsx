import { useTheme } from "@/contexts/ThemeContext";
import { Button } from "@/components/ui/button";
import { Palette, Sparkles } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const ThemeToggle = () => {
  const { theme, setTheme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          {theme === "default" ? (
            <Palette className="h-4 w-4" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          <span className="hidden sm:inline">
            {theme === "default" ? "Default" : "Glass"}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onClick={() => setTheme("default")}
          className={theme === "default" ? "bg-accent" : ""}
        >
          <Palette className="mr-2 h-4 w-4" />
          Default Theme
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setTheme("glass")}
          className={theme === "glass" ? "bg-accent" : ""}
        >
          <Sparkles className="mr-2 h-4 w-4" />
          Glass Theme
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default ThemeToggle;
