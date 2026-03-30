import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Recommendation } from "@/hooks/useProgressDashboard";
import { cn } from "@/lib/utils";
import {
    AlertTriangle,
    ArrowRight,
    Brain,
    Clock,
    Layers,
    Lightbulb,
    Sparkles,
    Target
} from "lucide-react";

interface AIRecommendationsProps {
  recommendations: Recommendation[];
  onStartQuiz?: (subject: string, topic?: string) => void;
  onStartTutor?: (subject: string, topic?: string) => void;
  onStartFlashcards?: (subject: string, topic?: string) => void;
}

export function AIRecommendations({ 
  recommendations,
  onStartQuiz,
  onStartTutor,
  onStartFlashcards,
}: AIRecommendationsProps) {
  if (recommendations.length === 0) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">All Caught Up!</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Great job! You're on track with your studies. Keep practicing to maintain your progress.
          </p>
        </CardContent>
      </Card>
    );
  }

  const getTypeConfig = (type: Recommendation['type']) => {
    switch (type) {
      case 'weak':
        return {
          icon: AlertTriangle,
          color: 'text-destructive',
          bgColor: 'bg-destructive/10',
          label: 'Needs Work',
        };
      case 'stale':
        return {
          icon: Clock,
          color: 'text-yellow-500',
          bgColor: 'bg-yellow-500/10',
          label: 'Review',
        };
      case 'strong':
        return {
          icon: Sparkles,
          color: 'text-green-500',
          bgColor: 'bg-green-500/10',
          label: 'Challenge',
        };
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2 px-3 sm:px-4 pt-3 sm:pt-4">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10">
            <Lightbulb className="h-3.5 w-3.5 text-primary" />
          </div>
          <CardTitle className="text-sm font-semibold">
            🎯 Focus This Week
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="px-3 sm:px-4 pb-3 sm:pb-4 space-y-3">
        {recommendations.slice(0, 4).map((rec, index) => {
          const config = getTypeConfig(rec.type);
          const Icon = config.icon;

          return (
            <div 
              key={rec.id}
              className="rounded-lg border p-3 space-y-2 transition-all hover:bg-muted/50"
            >
              <div className="flex items-start gap-2">
                <div className={cn(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full mt-0.5",
                  config.bgColor
                )}>
                  <Icon className={cn("h-3.5 w-3.5", config.color)} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-medium truncate">
                      {index + 1}. {rec.title}
                    </span>
                    <Badge 
                      variant="secondary" 
                      className={cn(
                        "text-[10px] px-1.5 py-0",
                        config.bgColor,
                        config.color
                      )}
                    >
                      {config.label}
                    </Badge>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {rec.subject} • {rec.description}
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-1.5 pl-8">
                {rec.type === 'weak' && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-[10px] gap-1 flex-1"
                      onClick={() => onStartQuiz?.(rec.subject, rec.topic)}
                    >
                      <Target className="h-3 w-3" />
                      Practice Quiz
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-[10px] gap-1 flex-1"
                      onClick={() => onStartTutor?.(rec.subject, rec.topic)}
                    >
                      <Brain className="h-3 w-3" />
                      AI Tutor
                    </Button>
                  </>
                )}
                {rec.type === 'stale' && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-[10px] gap-1 flex-1"
                      onClick={() => onStartFlashcards?.(rec.subject, rec.topic)}
                    >
                      <Layers className="h-3 w-3" />
                      Flashcards
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-[10px] gap-1 flex-1"
                      onClick={() => onStartQuiz?.(rec.subject, rec.topic)}
                    >
                      <Target className="h-3 w-3" />
                      Quick Quiz
                    </Button>
                  </>
                )}
                {rec.type === 'strong' && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-[10px] gap-1 flex-1"
                    onClick={() => onStartQuiz?.(rec.subject, rec.topic)}
                  >
                    <Sparkles className="h-3 w-3" />
                    Hard Quiz
                    <ArrowRight className="h-3 w-3 ml-auto" />
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
