import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { addDays, format, startOfWeek, subDays } from "date-fns";
import { useState } from "react";

export interface DailyActivity {
  date: string;
  minutes: number;
  quizzes: number;
  flashcards: number;
}

interface StudyActivityCalendarProps {
  activities: DailyActivity[];
  days?: number;
}

export function StudyActivityCalendar({ 
  activities, 
  days = 60 
}: StudyActivityCalendarProps) {
  const [selectedDay, setSelectedDay] = useState<DailyActivity | null>(null);

  // Create a map for quick lookup
  const activityMap = new Map(
    activities.map((a) => [a.date, a])
  );

  // Generate days for the calendar
  const today = new Date();
  const startDate = subDays(today, days - 1);
  
  // Align to start of week (Sunday)
  const calendarStart = startOfWeek(startDate);
  
  // Generate all days from calendarStart to today
  const calendarDays: Date[] = [];
  let currentDay = calendarStart;
  while (currentDay <= today) {
    calendarDays.push(currentDay);
    currentDay = addDays(currentDay, 1);
  }

  // Group by weeks
  const weeks: Date[][] = [];
  for (let i = 0; i < calendarDays.length; i += 7) {
    weeks.push(calendarDays.slice(i, i + 7));
  }

  const getIntensity = (minutes: number): string => {
    if (minutes === 0) return "bg-muted";
    if (minutes < 30) return "bg-green-200 dark:bg-green-900";
    if (minutes < 60) return "bg-green-400 dark:bg-green-700";
    if (minutes < 120) return "bg-green-500 dark:bg-green-600";
    return "bg-green-600 dark:bg-green-500";
  };

  const formatMinutes = (minutes: number): string => {
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  // Calculate stats
  const totalDaysStudied = activities.filter(a => a.minutes > 0).length;
  const avgMinutesPerDay = activities.length > 0
    ? Math.round(activities.reduce((sum, a) => sum + a.minutes, 0) / days)
    : 0;

  // Find best day pattern
  const dayTotals: Record<string, number> = {};
  activities.forEach((a) => {
    const dayOfWeek = format(new Date(a.date), 'EEEE');
    dayTotals[dayOfWeek] = (dayTotals[dayOfWeek] || 0) + a.minutes;
  });
  const bestDay = Object.entries(dayTotals).sort((a, b) => b[1] - a[1])[0]?.[0];

  return (
    <Card>
      <CardHeader className="pb-2 px-3 sm:px-6 pt-3 sm:pt-6">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm sm:text-base font-semibold">
            Study Activity
          </CardTitle>
          <Badge variant="secondary" className="text-[10px] sm:text-xs">
            Last {days} days
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
        {/* Calendar Grid */}
        <div className="overflow-x-auto">
          <div className="flex gap-0.5 sm:gap-1 min-w-fit">
            <TooltipProvider delayDuration={100}>
              {weeks.map((week, weekIndex) => (
                <div key={weekIndex} className="flex flex-col gap-0.5 sm:gap-1">
                  {week.map((day) => {
                    const dateStr = format(day, 'yyyy-MM-dd');
                    const activity = activityMap.get(dateStr);
                    const isBeforeRange = day < startDate;
                    const isFuture = day > today;

                    if (isBeforeRange || isFuture) {
                      return (
                        <div
                          key={dateStr}
                          className="h-2.5 w-2.5 sm:h-3 sm:w-3 rounded-sm bg-transparent"
                        />
                      );
                    }

                    return (
                      <Tooltip key={dateStr}>
                        <TooltipTrigger asChild>
                          <button
                            className={cn(
                              "h-2.5 w-2.5 sm:h-3 sm:w-3 rounded-sm transition-all hover:ring-2 hover:ring-primary/50",
                              getIntensity(activity?.minutes || 0)
                            )}
                            onClick={() => setSelectedDay(activity || { 
                              date: dateStr, 
                              minutes: 0, 
                              quizzes: 0, 
                              flashcards: 0 
                            })}
                          />
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-xs">
                          <p className="font-medium">
                            {format(day, 'MMM d, yyyy')}
                          </p>
                          {activity ? (
                            <>
                              <p>{formatMinutes(activity.minutes)}</p>
                              {activity.quizzes > 0 && (
                                <p>{activity.quizzes} quizzes</p>
                              )}
                              {activity.flashcards > 0 && (
                                <p>{activity.flashcards} flashcards</p>
                              )}
                            </>
                          ) : (
                            <p className="text-muted-foreground">No activity</p>
                          )}
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>
              ))}
            </TooltipProvider>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center justify-between mt-3 pt-3 border-t">
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <span>Less</span>
            <div className="h-2.5 w-2.5 rounded-sm bg-muted" />
            <div className="h-2.5 w-2.5 rounded-sm bg-green-200 dark:bg-green-900" />
            <div className="h-2.5 w-2.5 rounded-sm bg-green-400 dark:bg-green-700" />
            <div className="h-2.5 w-2.5 rounded-sm bg-green-500 dark:bg-green-600" />
            <div className="h-2.5 w-2.5 rounded-sm bg-green-600 dark:bg-green-500" />
            <span>More</span>
          </div>
          <div className="text-[10px] text-muted-foreground">
            {totalDaysStudied} days active
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t">
          <div className="text-center p-2 bg-muted/50 rounded-lg">
            <p className="text-lg font-bold">{avgMinutesPerDay}</p>
            <p className="text-[10px] text-muted-foreground">avg mins/day</p>
          </div>
          <div className="text-center p-2 bg-muted/50 rounded-lg">
            <p className="text-sm font-bold truncate">{bestDay || '—'}</p>
            <p className="text-[10px] text-muted-foreground">most active day</p>
          </div>
        </div>

        {/* Selected Day Detail */}
        {selectedDay && (
          <div className="mt-3 p-3 bg-muted/50 rounded-lg">
            <p className="text-sm font-medium">
              {format(new Date(selectedDay.date), 'MMMM d, yyyy')}
            </p>
            <div className="flex gap-4 mt-1 text-xs text-muted-foreground">
              <span>{formatMinutes(selectedDay.minutes)} studied</span>
              {selectedDay.quizzes > 0 && (
                <span>{selectedDay.quizzes} quizzes</span>
              )}
              {selectedDay.flashcards > 0 && (
                <span>{selectedDay.flashcards} flashcards</span>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
