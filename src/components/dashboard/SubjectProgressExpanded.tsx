import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import {
    AlertTriangle,
    CheckCircle,
    ChevronDown,
    FileQuestion,
    Minus,
    Target,
    TrendingDown,
    TrendingUp
} from "lucide-react";
import { useState } from "react";

export interface TopicDetail {
  topic: string;
  accuracy: number;
  attempts: number;
  trend: 'up' | 'down' | 'stable';
  lastPracticed: string | null;
}

export interface SubjectWithTopics {
  name: string;
  mastery: number;
  weeklyChange: number;
  color: string;
  topics: TopicDetail[];
}

interface SubjectProgressExpandedProps {
  subjects: SubjectWithTopics[];
  onReviewTopic?: (subject: string, topic: string) => void;
}

export function SubjectProgressExpanded({
  subjects,
  onReviewTopic
}: SubjectProgressExpandedProps) {
  const [openSubject, setOpenSubject] = useState<string | null>(null);

  const sortedSubjects = [...subjects].sort((a, b) => b.mastery - a.mastery);

  const getMasteryColor = (mastery: number) => {
    if (mastery >= 70) return "text-green-500";
    if (mastery >= 50) return "text-yellow-500";
    return "text-destructive";
  };

  const getProgressColor = (mastery: number) => {
    if (mastery >= 70) return "[&>div]:bg-green-500";
    if (mastery >= 50) return "[&>div]:bg-yellow-500";
    return "[&>div]:bg-destructive";
  };

  const TrendIcon = ({ trend, change }: { trend: 'up' | 'down' | 'stable'; change: number }) => {
    if (trend === 'up') {
      return (
        <span className="flex items-center gap-0.5 text-green-500 text-xs">
          <TrendingUp className="h-3 w-3" />
          +{change}%
        </span>
      );
    }
    if (trend === 'down') {
      return (
        <span className="flex items-center gap-0.5 text-destructive text-xs">
          <TrendingDown className="h-3 w-3" />
          {change}%
        </span>
      );
    }
    return (
      <span className="flex items-center gap-0.5 text-muted-foreground text-xs">
        <Minus className="h-3 w-3" />
        0%
      </span>
    );
  };

  const hasSubjects = sortedSubjects.length > 0;

  return (
    <Card>
      <CardHeader className="pb-2 sm:pb-3 px-3 sm:px-6 pt-3 sm:pt-6">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm sm:text-base font-semibold">
            Syllabus Mastery
          </CardTitle>
          {hasSubjects && (
            <Badge variant="secondary" className="text-[10px] sm:text-xs">
              Click to expand
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-2 px-3 sm:px-6 pb-3 sm:pb-6">
        {!hasSubjects ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <FileQuestion className="h-6 w-6 text-muted-foreground" />
            </div>
            <h4 className="mb-1 text-sm font-medium">No Progress Yet</h4>
            <p className="mb-4 max-w-[200px] text-xs text-muted-foreground">
              Complete your first quiz to start tracking subject mastery
            </p>
            {onReviewTopic && (
              <Button
                variant="default"
                size="sm"
                className="h-8 text-xs"
                onClick={() => onReviewTopic("", "")}
              >
                <Target className="h-3.5 w-3.5 mr-1.5" />
                Take First Quiz
              </Button>
            )}
          </div>
        ) : sortedSubjects.map((subject) => (
          <Collapsible
            key={subject.name}
            open={openSubject === subject.name}
            onOpenChange={(open) => setOpenSubject(open ? subject.name : null)}
          >
            <CollapsibleTrigger asChild>
              <div className="cursor-pointer rounded-lg border p-3 transition-all hover:bg-muted/50">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className="text-xs sm:text-sm font-medium truncate">
                      {subject.name}
                    </span>
                    {subject.mastery >= 90 && (
                      <CheckCircle className="h-3.5 w-3.5 text-green-500 shrink-0" />
                    )}
                    {subject.mastery < 50 && (
                      <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0" />
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <TrendIcon
                      trend={subject.weeklyChange > 0 ? 'up' : subject.weeklyChange < 0 ? 'down' : 'stable'}
                      change={subject.weeklyChange}
                    />
                    <span className={cn(
                      "text-xs sm:text-sm font-semibold",
                      getMasteryColor(subject.mastery)
                    )}>
                      {subject.mastery}%
                    </span>
                    <ChevronDown className={cn(
                      "h-4 w-4 text-muted-foreground transition-transform",
                      openSubject === subject.name && "rotate-180"
                    )} />
                  </div>
                </div>
                <Progress
                  value={subject.mastery}
                  className="h-1.5 mt-2 [&>div]:bg-primary"
                />
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="mt-1 ml-3 border-l-2 border-muted pl-3 space-y-2">
                {subject.topics.length > 0 ? (
                  subject.topics
                    .sort((a, b) => a.accuracy - b.accuracy)
                    .map((topic) => (
                      <div
                        key={topic.topic}
                        className="flex items-center justify-between gap-2 py-1.5"
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          {topic.accuracy >= 70 ? (
                            <CheckCircle className="h-3 w-3 text-green-500 shrink-0" />
                          ) : (
                            <AlertTriangle className="h-3 w-3 text-yellow-500 shrink-0" />
                          )}
                          <span className="text-xs truncate">{topic.topic}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={cn(
                            "text-xs font-medium",
                            getMasteryColor(topic.accuracy)
                          )}>
                            {topic.accuracy}%
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            ({topic.attempts})
                          </span>
                          {topic.accuracy < 60 && onReviewTopic && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 px-2 text-[10px]"
                              onClick={(e) => {
                                e.stopPropagation();
                                onReviewTopic(subject.name, topic.topic);
                              }}
                            >
                              <Target className="h-3 w-3 mr-1" />
                              Review
                            </Button>
                          )}
                        </div>
                      </div>
                    ))
                ) : (
                  <p className="text-xs text-muted-foreground py-2">
                    No topic data yet. Complete quizzes to track progress.
                  </p>
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>
        ))}
      </CardContent>
    </Card>
  );
}
