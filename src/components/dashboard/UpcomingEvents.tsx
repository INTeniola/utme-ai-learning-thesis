import { Card, CardContent } from "@/components/ui/card";
import { differenceInDays } from "date-fns";
import { Calendar, Clock } from "lucide-react";

interface UpcomingEvent {
  id: string;
  title: string;
  date: Date;
  type: "exam" | "quiz" | "deadline";
}

interface UpcomingEventsProps {
  events?: UpcomingEvent[];
  examDate?: Date;
}

export function UpcomingEvents({ 
  events,
  examDate = new Date("2026-03-15") // Default UTME date
}: UpcomingEventsProps) {
  const daysToExam = differenceInDays(examDate, new Date());
  
  const defaultEvents: UpcomingEvent[] = events || [
    {
      id: "1",
      title: "Mock Exam - Full UTME",
      date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      type: "exam",
    },
    {
      id: "2",
      title: "Physics Quiz",
      date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      type: "quiz",
    },
  ];

  return (
    <Card>
      <CardContent className="p-4">
        <div className="mb-3 flex items-center gap-2">
          <Calendar className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Upcoming</span>
        </div>

        {/* UTME Countdown */}
        <div className="mb-4 rounded-lg bg-primary/10 p-3 text-center">
          <p className="text-xs text-muted-foreground">UTME 2026</p>
          <p className="text-2xl font-bold text-primary">{daysToExam}</p>
          <p className="text-xs text-muted-foreground">days remaining</p>
        </div>

        {/* Events List */}
        <div className="space-y-2">
          {defaultEvents.slice(0, 3).map((event) => {
            const daysAway = differenceInDays(event.date, new Date());
            return (
              <div 
                key={event.id} 
                className="flex items-center gap-3 rounded-lg border p-2"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="truncate text-xs font-medium">{event.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {daysAway === 0 ? "Today" : daysAway === 1 ? "Tomorrow" : `In ${daysAway} days`}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
