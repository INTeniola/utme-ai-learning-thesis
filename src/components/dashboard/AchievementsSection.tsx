import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Flame, Star, Target, TrendingUp, Trophy } from "lucide-react";

interface Achievement {
  id: string;
  icon: React.ReactNode;
  title: string;
  value: string;
  color: string;
  unlocked: boolean;
}

interface AchievementsSectionProps {
  streak?: number;
  points?: number;
  rank?: string;
}

export function AchievementsSection({ 
  streak = 7, 
  points = 500,
  rank = "Top 10%"
}: AchievementsSectionProps) {
  const achievements: Achievement[] = [
    {
      id: "streak",
      icon: <Flame className="h-4 w-4" />,
      title: "Study Streak",
      value: `${streak}-day`,
      color: "bg-orange-100 text-orange-600",
      unlocked: streak >= 7,
    },
    {
      id: "points",
      icon: <Star className="h-4 w-4" />,
      title: "Points",
      value: `${points}`,
      color: "bg-yellow-100 text-yellow-600",
      unlocked: true,
    },
    {
      id: "quizmaster",
      icon: <Target className="h-4 w-4" />,
      title: "Quiz Master",
      value: "Unlocked",
      color: "bg-primary/20 text-primary",
      unlocked: points >= 200,
    },
    {
      id: "rank",
      icon: <TrendingUp className="h-4 w-4" />,
      title: "Ranking",
      value: rank,
      color: "bg-green-100 text-green-600",
      unlocked: true,
    },
  ];

  return (
    <Card>
      <CardContent className="p-3 sm:p-4">
        <div className="mb-3 sm:mb-4 flex items-center gap-2">
          <Trophy className="h-4 w-4 sm:h-5 sm:w-5 text-warning" />
          <span className="text-sm sm:text-base font-semibold">Achievements</span>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:gap-3">
          {achievements.map((achievement) => (
            <div
              key={achievement.id}
              className={cn(
                "flex flex-col items-center gap-1.5 sm:gap-2 rounded-lg border p-2 sm:p-3 text-center transition-all",
                achievement.unlocked 
                  ? "bg-card" 
                  : "bg-muted/50 opacity-50"
              )}
            >
              <div className={cn(
                "flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full",
                achievement.color
              )}>
                {achievement.icon}
              </div>
              <div>
                <p className="text-[10px] sm:text-xs text-muted-foreground">{achievement.title}</p>
                <p className="text-xs sm:text-sm font-semibold">{achievement.value}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
