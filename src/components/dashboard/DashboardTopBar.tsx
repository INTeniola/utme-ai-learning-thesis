import { ThemeToggle } from "@/components/ThemeToggle";
import { QuizantLogo } from "@/components/ui/QuizantLogo";
import { useNavigate } from "react-router-dom";

interface DashboardTopBarProps {
  examDate?: Date;
  onNavigateToProfile?: () => void;
  onNavigateToSettings?: () => void;
  onNavigateToCbt?: () => void;
  mobileSidebarContent?: React.ReactNode;
}

/**
 * THESIS EDITION: Minimal TopBar
 * Focuses on identity and theme. Removes countdowns and event trackers.
 */
export function DashboardTopBar({
  onNavigateToProfile,
  mobileSidebarContent
}: DashboardTopBarProps) {
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-50 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
      <div className="flex h-12 sm:h-14 items-center gap-2 sm:gap-4 px-2 sm:px-4">
        {/* Logo */}
        <button
          onClick={() => navigate('/?view=home')}
          className="flex items-center gap-2 cursor-pointer transition-transform hover:scale-105"
        >
          <QuizantLogo className="h-6 w-6 text-primary" />
          <span className="font-display font-semibold text-xl tracking-tight text-foreground">
            Research Platform
          </span>
        </button>

        <div className="flex-1" />

        {/* Minimal Actions */}
        <ThemeToggle />
        
        {onNavigateToProfile && (
          <button 
            onClick={onNavigateToProfile}
            className="h-8 w-8 rounded-full bg-accent flex items-center justify-center text-xs font-bold border hover:bg-accent/80 transition-colors"
          >
            P
          </button>
        )}
      </div>
    </header>
  );
}
