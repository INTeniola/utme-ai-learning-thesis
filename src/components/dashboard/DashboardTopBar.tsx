import { ThemeToggle } from "@/components/ThemeToggle";
import { useState } from "react";
import { UpcomingEventsPopover } from "./UpcomingEventsPopover";
import { QuizantLogo } from "@/components/ui/QuizantLogo";
import { useNavigate } from "react-router-dom";

interface DashboardTopBarProps {
  examDate?: Date;
  onNavigateToProfile?: () => void;
  onNavigateToSettings?: () => void;
  onNavigateToCbt?: () => void;
  mobileSidebarContent?: React.ReactNode;
}

export function DashboardTopBar({
  examDate = new Date("2026-03-15"),
  onNavigateToProfile,
  onNavigateToSettings,
  onNavigateToCbt,
  mobileSidebarContent
}: DashboardTopBarProps) {
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-50 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
      <div className="flex h-12 sm:h-14 items-center gap-2 sm:gap-4 px-2 sm:px-4">
        {/* Logo — always navigates to internal home view, not the raw domain root */}
        <button
          onClick={() => navigate('/?view=home')}
          className="flex items-center gap-2 cursor-pointer transition-transform hover:scale-105"
        >
          <div className="flex items-center justify-center pointer-events-none md:hidden shrink-0 pt-[2px]">
            <QuizantLogo className="h-5 w-5 text-primary" />
          </div>
          <span className="font-display font-semibold text-xl tracking-tight text-foreground md:pl-0 pl-1">
            Quizant
          </span>
        </button>

        {/* Spacer */}
        <div className="flex-1" />

        {/* JAMB Countdown - Now a Popover Trigger */}
        <UpcomingEventsPopover
          examDate={examDate}
          onNavigateToCbt={onNavigateToCbt}
        />

        {/* Theme Toggle */}
        <ThemeToggle />
      </div>
    </header>
  );
}
