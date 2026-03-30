import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { Award, TrendingUp, Users } from "lucide-react";

interface PeerComparisonProps {
  percentileRank: number;
  insight: string;
  subjectRankings?: { subject: string; percentile: number }[];
}

export function PeerComparison({
  percentileRank,
  insight,
  subjectRankings = [],
}: PeerComparisonProps) {
  const getRankLabel = (percentile: number) => {
    if (percentile >= 90) return 'Top 10%';
    if (percentile >= 75) return 'Top 25%';
    if (percentile >= 50) return 'Top 50%';
    return 'Keep going!';
  };

  const getRankColor = (percentile: number) => {
    if (percentile >= 90) return 'text-yellow-500';
    if (percentile >= 75) return 'text-green-500';
    if (percentile >= 50) return 'text-primary';
    return 'text-muted-foreground';
  };

  return (
    <Card>
      <CardHeader className="pb-2 px-3 sm:px-6 pt-3 sm:pt-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm sm:text-base font-semibold">
              Peer Comparison
            </CardTitle>
          </div>
          <Badge variant="secondary" className="text-[10px] sm:text-xs">
            Anonymized
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6 space-y-4">
        {/* Overall Rank */}
        <div className="flex items-center gap-4 p-3 bg-muted/50 rounded-lg">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Award className={cn("h-6 w-6", getRankColor(percentileRank))} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold">{getRankLabel(percentileRank)}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Overall performance ranking
            </p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-primary">{percentileRank}%</p>
            <p className="text-[10px] text-muted-foreground">percentile</p>
          </div>
        </div>

        {/* Subject Rankings */}
        {subjectRankings.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">By Subject</p>
            {subjectRankings.slice(0, 4).map((ranking) => (
              <div key={ranking.subject} className="flex items-center gap-3">
                <span className="text-xs w-20 truncate">{ranking.subject}</span>
                <Progress value={ranking.percentile} className="flex-1 h-2" />
                <span className={cn(
                  "text-xs font-medium w-16 text-right",
                  getRankColor(ranking.percentile)
                )}>
                  {getRankLabel(ranking.percentile)}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Insight */}
        <div className="flex items-start gap-2 p-3 bg-primary/5 rounded-lg border border-primary/10">
          <TrendingUp className="h-4 w-4 text-primary shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground">{insight}</p>
        </div>
      </CardContent>
    </Card>
  );
}
