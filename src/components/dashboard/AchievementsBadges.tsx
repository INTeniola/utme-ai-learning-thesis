import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import {
    Award,
    BookOpen,
    Crown,
    Flame,
    Layers,
    Moon,
    Star,
    Sun,
    Target,
    TrendingUp,
    Trophy,
    Zap
} from "lucide-react";

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: keyof typeof iconMap;
  earned: boolean;
  earnedAt?: string;
  progress?: number;
  target?: number;
  color: string;
}

const iconMap = {
  flame: Flame,
  crown: Crown,
  target: Target,
  star: Star,
  sun: Sun,
  moon: Moon,
  award: Award,
  trending: TrendingUp,
  layers: Layers,
  zap: Zap,
  book: BookOpen,
  trophy: Trophy,
};

interface AchievementsBadgesProps {
  achievements: Achievement[];
  compact?: boolean;
}

export function AchievementsBadges({ 
  achievements, 
  compact = false 
}: AchievementsBadgesProps) {
  const earnedCount = achievements.filter(a => a.earned).length;
  const sortedAchievements = [...achievements].sort((a, b) => {
    // Earned first
    if (a.earned !== b.earned) return a.earned ? -1 : 1;
    
    // For unearned: sort by progress % descending (closest to completion first)
    const aProgress = a.progress !== undefined && a.target ? a.progress / a.target : 0;
    const bProgress = b.progress !== undefined && b.target ? b.progress / b.target : 0;
    
    // If both have no progress, keep original order
    if (aProgress === 0 && bProgress === 0) return 0;
    
    return bProgress - aProgress;
  });

  // In compact mode, show only first 4
  const displayAchievements = compact 
    ? sortedAchievements.slice(0, 4) 
    : sortedAchievements;

  return (
    <Card>
      <CardHeader className="pb-2 px-3 sm:px-6 pt-3 sm:pt-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy className="h-4 w-4 sm:h-5 sm:w-5 text-yellow-500" />
            <CardTitle className="text-sm sm:text-base font-semibold">
              Achievements
            </CardTitle>
          </div>
          <Badge variant="secondary" className="text-[10px] sm:text-xs">
            {earnedCount}/{achievements.length} unlocked
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
        <div className={cn(
          "grid gap-2 sm:gap-3",
          compact ? "grid-cols-2" : "grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
        )}>
          {displayAchievements.map((achievement) => {
            const Icon = iconMap[achievement.icon] || Trophy;
            const progressPercent = achievement.progress && achievement.target
              ? Math.min(100, (achievement.progress / achievement.target) * 100)
              : 0;

            return (
              <div
                key={achievement.id}
                className={cn(
                  "relative flex flex-col items-center gap-1.5 sm:gap-2 rounded-lg border p-2 sm:p-3 text-center transition-all",
                  achievement.earned 
                    ? "bg-card" 
                    : "bg-muted/30 opacity-70"
                )}
              >
                {/* Badge Icon */}
                <div className={cn(
                  "flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-full transition-all",
                  achievement.earned
                    ? achievement.color
                    : "bg-muted text-muted-foreground"
                )}>
                  <Icon className={cn(
                    "h-5 w-5 sm:h-6 sm:w-6",
                    achievement.earned && "drop-shadow-md"
                  )} />
                </div>

                {/* Name & Status */}
                <div className="space-y-0.5">
                  <p className="text-[10px] sm:text-xs font-medium leading-tight">
                    {achievement.name}
                  </p>
                  {achievement.earned ? (
                    <p className="text-[10px] text-green-500 font-medium">
                      ✓ Unlocked
                    </p>
                  ) : achievement.progress !== undefined && achievement.target ? (
                    <div className="space-y-1">
                      <Progress 
                        value={progressPercent} 
                        className="h-1 w-full" 
                      />
                      <p className="text-[10px] text-muted-foreground">
                        {achievement.progress}/{achievement.target}
                      </p>
                    </div>
                  ) : (
                    <p className="text-[10px] text-muted-foreground">
                      Locked
                    </p>
                  )}
                </div>

                {/* Glow effect for earned */}
                {achievement.earned && (
                  <div className={cn(
                    "absolute inset-0 rounded-lg opacity-10",
                    achievement.color.replace('text-', 'bg-')
                  )} />
                )}
              </div>
            );
          })}
        </div>

        {/* Show more link in compact mode */}
        {compact && achievements.length > 4 && (
          <p className="text-center text-xs text-muted-foreground mt-3">
            +{achievements.length - 4} more achievements
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// Default achievements definition
export const DEFAULT_ACHIEVEMENTS: Omit<Achievement, 'earned' | 'earnedAt' | 'progress'>[] = [
  {
    id: 'early_bird',
    name: 'Early Bird',
    description: 'Start 5 study sessions before 8:00 AM',
    icon: 'sun',
    target: 5,
    color: 'bg-amber-100 text-amber-600 dark:bg-amber-900/50 dark:text-amber-400',
  },
  {
    id: 'night_owl',
    name: 'Night Owl',
    description: 'Complete 5 sessions after 10:00 PM',
    icon: 'moon',
    target: 5,
    color: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/50 dark:text-indigo-400',
  },
  {
    id: 'flashcard_pro',
    name: 'Flashcard Pro',
    description: 'Review 100 flashcards to build recall',
    icon: 'layers',
    target: 100,
    color: 'bg-pink-100 text-pink-600 dark:bg-pink-900/50 dark:text-pink-400',
  },
  {
    id: 'week_warrior',
    name: 'Week Warrior',
    description: 'Maintain a 7-day study streak',
    icon: 'flame',
    target: 7,
    color: 'bg-orange-100 text-orange-600 dark:bg-orange-900/50 dark:text-info',
  },
  {
    id: 'quiz_master',
    name: 'Quiz Master',
    description: 'Complete 10 full-length practice quizzes',
    icon: 'target',
    target: 10,
    color: 'bg-primary/20 text-primary dark:bg-blue-900/50 dark:text-primary',
  },
  {
    id: 'bookworm',
    name: 'Bookworm',
    description: 'Total study time exceeding 10 hours',
    icon: 'book',
    target: 600,
    color: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/50 dark:text-emerald-400',
  },
  {
    id: 'comeback_kid',
    name: 'Comeback Kid',
    description: 'Improve accuracy by 20% in a weak topic',
    icon: 'trending',
    target: 20,
    color: 'bg-teal-100 text-teal-600 dark:bg-teal-900/50 dark:text-teal-400',
  },
  {
    id: 'speed_demon',
    name: 'Speed Demon',
    description: 'Average under 45s per question in a quiz',
    icon: 'zap',
    target: 1,
    color: 'bg-red-100 text-red-600 dark:bg-red-900/50 dark:text-red-400',
  },
  {
    id: 'month_champion',
    name: 'Month Champion',
    description: 'Elite 30-day consistent study streak',
    icon: 'crown',
    target: 30,
    color: 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/50 dark:text-yellow-400',
  },
  {
    id: 'quiz_legend',
    name: 'Quiz Legend',
    description: 'Complete 50 rigorous practice sessions',
    icon: 'star',
    target: 50,
    color: 'bg-purple-100 text-purple-600 dark:bg-purple-900/50 dark:text-secondary',
  },
  {
    id: 'subject_expert',
    name: 'Subject Expert',
    description: 'Reach 90% mastery in any core subject',
    icon: 'award',
    target: 90,
    color: 'bg-green-100 text-green-600 dark:bg-green-900/50 dark:text-green-400',
  },
  {
    id: 'perfect_score',
    name: 'Perfect Score',
    description: 'Achieve 100% accuracy in a 40-question set',
    icon: 'trophy',
    target: 1,
    color: 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/50 dark:text-yellow-400',
  },
];
