import { useTheme } from "@/contexts/ThemeContext";
import { Button } from "@/components/ui/button";
import { Palette, Sparkles, Waves } from "lucide-react";
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
          ) : theme === "glass" ? (
            <Sparkles className="h-4 w-4" />
          ) : (
            <Waves className="h-4 w-4" />
          )}
          <span className="hidden sm:inline">
            {theme === "default" ? "Default" : theme === "glass" ? "Glass" : "Ocean"}
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
        <DropdownMenuItem
          onClick={() => setTheme("ocean")}
          className={theme === "ocean" ? "bg-accent" : ""}
        >
          <Waves className="mr-2 h-4 w-4" />
          Ocean Theme
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default ThemeToggle;
