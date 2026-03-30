import { Achievement, DEFAULT_ACHIEVEMENTS } from "@/components/dashboard/AchievementsBadges";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { Trophy, Award, Flame, Target, Star, Sun, Moon, TrendingUp, Layers, Zap, BookOpen, Crown } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

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

interface AchievementsViewProps {
  achievements: Achievement[];
}

export function AchievementsView({ achievements }: AchievementsViewProps) {
  const earnedCount = achievements.filter(a => a.earned).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black tracking-tighter">Achievements</h2>
          <p className="text-sm text-muted-foreground">Track your academic milestones and consistency</p>
        </div>
        <Badge variant="outline" className="h-8 rounded-xl px-4 font-black">
          {earnedCount} / {achievements.length} UNLOCKED
        </Badge>
      </div>

      <TooltipProvider delayDuration={0}>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {achievements.map((achievement) => {
            const Icon = iconMap[achievement.icon as keyof typeof iconMap] || Trophy;
            const progressPercent = achievement.progress && achievement.target
              ? Math.min(100, (achievement.progress / achievement.target) * 100)
              : 0;

            return (
              <Tooltip key={achievement.id}>
                <TooltipTrigger asChild>
                  <div className={cn(
                    "group relative flex flex-col items-center gap-3 rounded-[2rem] border-2 p-6 text-center transition-all cursor-default",
                    achievement.earned 
                      ? "bg-card border-primary/20 hover:border-primary/40" 
                      : "bg-muted/30 border-transparent opacity-60 grayscale hover:grayscale-0 hover:opacity-100"
                  )}>
                    <div className={cn(
                      "flex h-16 w-16 items-center justify-center rounded-2xl transition-all shadow-sm",
                      achievement.earned ? achievement.color : "bg-muted text-muted-foreground"
                    )}>
                      <Icon className={cn("h-8 w-8", achievement.earned && "drop-shadow-md")} />
                    </div>
                    
                    <div className="space-y-1">
                      <p className="text-sm font-black tracking-tight">{achievement.name}</p>
                      {achievement.earned ? (
                        <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Unlocked</p>
                      ) : (
                        <div className="w-20 mx-auto space-y-1.5">
                          <Progress value={progressPercent} className="h-1" />
                          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-tighter">
                            {achievement.progress || 0}/{achievement.target}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-[200px] rounded-2xl p-4 border-2 shadow-xl">
                  <div className="space-y-2">
                    <p className="font-black text-xs uppercase tracking-widest text-primary">{achievement.name}</p>
                    <p className="text-xs font-medium leading-relaxed">{achievement.description}</p>
                    {!achievement.earned && achievement.target && (
                      <div className="pt-2 border-t border-border/50">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Unlock Logic</p>
                        <p className="text-[10px] font-medium italic mt-1">Requires {achievement.target} {achievement.id.replace('_', ' ')} milestones</p>
                      </div>
                    )}
                  </div>
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      </TooltipProvider>
    </div>
  );
}
