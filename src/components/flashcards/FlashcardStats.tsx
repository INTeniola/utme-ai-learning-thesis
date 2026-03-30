import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { FlashcardStats as FlashcardStatsType } from '@/hooks/useFlashcards';
import {
    BookOpen,
    Brain,
    Flame,
    Target,
    TrendingUp
} from 'lucide-react';

interface FlashcardStatsProps {
  stats: FlashcardStatsType | null;
}

export function FlashcardStats({ stats }: FlashcardStatsProps) {
  if (!stats) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Loading stats...
        </CardContent>
      </Card>
    );
  }

  const subjectColors: Record<string, string> = {
    Mathematics: 'bg-[var(--subject-maths)]',
    English: 'bg-[var(--subject-english)]',
    Physics: 'bg-[var(--subject-physics)]',
    Chemistry: 'bg-[var(--subject-chemistry)]',
    Biology: 'bg-[var(--subject-biology,theme(colors.pink.500))]',
  };

  return (
    <div className="space-y-4">
      {/* Overview Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-primary/10">
                <BookOpen className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.totalCards}</p>
                <p className="text-xs text-muted-foreground">Total Cards</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-info/10">
                <Target className="h-5 w-5 text-info" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.dueToday}</p>
                <p className="text-xs text-muted-foreground">Due Today</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-green-500/10">
                <Brain className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.masteredCards}</p>
                <p className="text-xs text-muted-foreground">Mastered</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-red-500/10">
                <Flame className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.reviewStreak}</p>
                <p className="text-xs text-muted-foreground">Day Streak</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Mastery Progress */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Overall Mastery
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Progress</span>
              <span className="font-medium">{stats.masteryPercentage}%</span>
            </div>
            <Progress value={stats.masteryPercentage} className="h-3" />
            <p className="text-xs text-muted-foreground">
              {stats.masteredCards} of {stats.totalCards} concepts mastered
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Subject Breakdown */}
      {Object.keys(stats.subjectBreakdown).length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Subject Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Object.entries(stats.subjectBreakdown).map(([subject, data]) => {
                const masteryPercent = data.total > 0 
                  ? Math.round((data.mastered / data.total) * 100) 
                  : 0;
                
                return (
                  <div key={subject} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${subjectColors[subject] || 'bg-gray-500'}`} />
                        <span className="font-medium">{subject}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {data.due > 0 && (
                          <Badge variant="outline" className="text-orange-600">
                            {data.due} due
                          </Badge>
                        )}
                        <span className="text-sm text-muted-foreground">
                          {data.total} cards
                        </span>
                      </div>
                    </div>
                    <Progress value={masteryPercent} className="h-2" />
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
