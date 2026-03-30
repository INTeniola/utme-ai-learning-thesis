import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { QuizantLogo } from "@/components/ui/QuizantLogo";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import {
    ChevronLeft,
    Home,
    Settings,
    TrendingUp,
    User,
    MessageSquare,
    BookOpen,
    Brain,
    BarChart3
} from "lucide-react";
import { useState } from "react";

export type DashboardView =
  | 'home'
  | 'ai-tutor'
  | 'quiz'
  | 'flashcards'
  | 'analytics'
  | 'profile'
  | 'settings';

interface DashboardSidebarProps {
  currentView: DashboardView;
  onViewChange: (view: DashboardView) => void;
  isAdmin?: boolean;
}

interface NavItem {
  id: DashboardView;
  title: string;
  icon: React.ElementType;
}

/**
 * THESIS EDITION: Core Research Pillars
 * These are the 4 tools defined in the project aim.
 */
const researchPillars: NavItem[] = [
  { icon: Home, title: 'Overview', id: 'home' },
  { icon: MessageSquare, title: 'AI Tutor', id: 'ai-tutor' },
  { icon: BookOpen, title: 'Quiz Generator', id: 'quiz' },
  { icon: Brain, title: 'Flashcards', id: 'flashcards' },
  { icon: BarChart3, title: 'Analytics', id: 'analytics' }
];

const COLLAPSE_KEY = "sidebar-collapsed";

function getInitialCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === "true";
  } catch {
    return false;
  }
}

export function DashboardSidebar({ currentView, onViewChange }: DashboardSidebarProps) {
  const { user } = useAuth();
  const [collapsed, setCollapsed] = useState<boolean>(getInitialCollapsed);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(COLLAPSE_KEY, String(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const initials = user?.user_metadata?.full_name
    ?.split(" ")
    .map((n: string) => n[0])
    .join("")
    .toUpperCase() || "P";

  const sidebarWidth = collapsed ? "w-14" : "w-56";

  return (
    <div
      className={cn(
        "relative flex flex-col h-full border-r border-border/40 bg-background/50 backdrop-blur-sm transition-all duration-200 ease-linear",
        sidebarWidth
      )}
    >
      {/* Logo */}
      <div className="flex items-center justify-start h-14 px-3 shrink-0">
        <button 
          onClick={() => onViewChange('home')}
          className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 shrink-0 hover:bg-primary/20 transition-colors"
        >
          <QuizantLogo className="h-5 w-5 text-primary" />
        </button>
      </div>

      {/* Main Nav */}
      <nav className="flex-1 flex flex-col gap-1 px-2 py-2 overflow-y-auto">
        {researchPillars.map((item) => {
          const isActive = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onViewChange(item.id)}
              title={collapsed ? item.title : undefined}
              className={cn(
                "flex items-center gap-3 rounded-full px-3 h-11 w-full text-left transition-all duration-150",
                isActive
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:bg-primary/5 hover:text-foreground"
              )}
            >
              <item.icon className={cn("h-5 w-5 shrink-0", isActive && "text-primary")} />
              {!collapsed && (
                <span className="text-sm tracking-tight truncate">{item.title}</span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Bottom section */}
      <div className="flex flex-col gap-1 px-2 pb-2">
        <button
          onClick={toggleCollapsed}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={cn(
            "hidden md:flex items-center rounded-full px-3 h-9 w-full text-left transition-all duration-150",
            "text-muted-foreground hover:bg-primary/5 hover:text-foreground",
            collapsed ? "justify-center" : "gap-3"
          )}
        >
          <ChevronLeft
            className={cn(
              "h-4 w-4 shrink-0 transition-transform duration-200",
              collapsed && "rotate-180"
            )}
          />
          {!collapsed && (
            <span className="text-sm tracking-tight truncate">Collapse</span>
          )}
        </button>

        {/* User Profile */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex w-full items-center gap-3 rounded-full hover:bg-primary/5 px-3 h-11 transition-colors outline-none text-left">
              <Avatar className="h-7 w-7 border border-border shadow-sm shrink-0">
                <AvatarFallback className="bg-primary/10 text-primary font-medium text-xs">
                  {initials}
                </AvatarFallback>
              </Avatar>
              {!collapsed && (
                <div className="flex flex-1 items-center justify-between min-w-0">
                  <span className="text-sm font-medium truncate text-foreground/90">
                    Participant
                  </span>
                  <Settings className="h-4 w-4 text-muted-foreground shrink-0" />
                </div>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="start" side="right" forceMount>
            <DropdownMenuLabel className="font-normal">
              <p className="text-sm font-medium leading-none">Research Participant</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onViewChange('profile')} className="cursor-pointer">
              <User className="mr-2 h-4 w-4" />
              Settings
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

