import { Button } from "@/components/ui/button";
import {
    Popover,
    PopoverContent,
    PopoverTrigger
} from "@/components/ui/popover";
import { differenceInDays, format } from "date-fns";
import { Calendar, ChevronRight, GraduationCap } from "lucide-react";
import { useState } from "react";

interface UpcomingEventsPopoverProps {
  examDate: Date;
  onNavigateToCbt?: () => void;
}

export function UpcomingEventsPopover({ examDate, onNavigateToCbt }: UpcomingEventsPopoverProps) {
  const [open, setOpen] = useState(false);

  // Calculate using Nigeria timezone
  const nowLagos = new Date(new Date().toLocaleString("en-US", { timeZone: "Africa/Lagos" }));
  const daysToExam = Math.max(0, differenceInDays(examDate, nowLagos));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          className="flex items-center gap-1.5 sm:gap-2 rounded-full bg-primary/10 px-2 py-1 sm:px-3 sm:py-1.5 h-auto hover:bg-primary/20"
        >
          <Calendar className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary" />
          <span className="text-xs sm:text-sm font-medium">
            <span className="font-bold text-primary">{daysToExam}</span>
            <span className="text-muted-foreground hidden xs:inline"> days</span>
            <span className="text-muted-foreground xs:hidden">d</span>
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 sm:w-80 p-0 overflow-hidden" align="end">
        {/* UTME Countdown */}
        <div className="bg-primary/5 p-6 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <GraduationCap className="h-6 w-6 text-primary" />
            <span className="text-sm font-medium text-primary">UTME 2026</span>
          </div>
          <p className="text-4xl font-bold text-primary mb-1">{daysToExam}</p>
          <p className="text-sm text-muted-foreground">days remaining</p>
          <p className="text-xs text-muted-foreground mt-2">
            {format(examDate, "EEEE, MMMM d, yyyy")}
          </p>
        </div>

        {/* Action Button */}
        <div className="p-4 bg-background">
          <Button
            className="w-full justify-between shadow-sm group"
            onClick={() => {
              setOpen(false);
              if (onNavigateToCbt) {
                onNavigateToCbt();
              }
            }}
          >
            <span>Take Mock Exam</span>
            <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Button>
          <p className="text-xs text-center text-muted-foreground mt-3">
            Simulate the real testing environment
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}
