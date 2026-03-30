import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Calendar, Clock, Flame, Target } from "lucide-react";

interface SummaryCardsProps {
  daysToUTME: number | null;
  studyStreak: number;
  quizAverage: number;
  totalStudyHours: number;
}

export function SummaryCards({
  daysToUTME,
  studyStreak,
  quizAverage,
  totalStudyHours,
}: SummaryCardsProps) {
  const cards = [
    {
      id: "utme",
      icon: Calendar,
      value: daysToUTME !== null ? `${daysToUTME}` : "—",
      label: daysToUTME !== null ? "days to UTME" : "Set exam date",
      color: "bg-primary/10 text-primary",
      highlight: daysToUTME !== null && daysToUTME <= 30,
    },
    {
      id: "streak",
      icon: Flame,
      value: `${studyStreak}`,
      label: "day streak",
      color: "bg-info/10 text-info",
      highlight: studyStreak >= 7,
      animated: studyStreak >= 3,
    },
    {
      id: "average",
      icon: Target,
      value: `${quizAverage}%`,
      label: "quiz average",
      color: cn(
        quizAverage >= 70 ? "bg-green-500/10 text-green-500" :
        quizAverage >= 50 ? "bg-yellow-500/10 text-yellow-500" :
        "bg-destructive/10 text-destructive"
      ),
      highlight: quizAverage >= 80,
    },
    {
      id: "time",
      icon: Clock,
      value: `${totalStudyHours}`,
      label: "hours studied",
      color: "bg-violet-500/10 text-violet-500",
      highlight: totalStudyHours >= 50,
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
      {cards.map((card) => (
        <Card 
          key={card.id} 
          className={cn(
            "transition-all hover:shadow-md",
            card.highlight && "ring-1 ring-primary/20"
          )}
        >
          <CardContent className="flex items-center gap-3 p-3 sm:p-4">
            <div className={cn(
              "flex h-10 w-10 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-xl",
              card.color
            )}>
              <card.icon className={cn(
                "h-5 w-5 sm:h-6 sm:w-6",
                card.animated && "animate-pulse"
              )} />
            </div>
            <div className="min-w-0">
              <p className="text-lg sm:text-2xl font-bold leading-none">
                {card.value}
              </p>
              <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">
                {card.label}
              </p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
