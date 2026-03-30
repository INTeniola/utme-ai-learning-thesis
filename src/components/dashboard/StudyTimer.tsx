import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { Pause, Play, RotateCcw, Timer } from "lucide-react";
import { useEffect, useState } from "react";

interface StudyTimerProps {
  dailyGoalMinutes?: number;
  onSessionComplete?: (minutes: number) => void;
}

export function StudyTimer({ dailyGoalMinutes = 60, onSessionComplete }: StudyTimerProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [todayMinutes, setTodayMinutes] = useState(25); // Mock: minutes studied today

  const focusQuotes = [
    'Focus is the mind-awakener.',
    'The path is shortened by discipline.',
    'Every minute counts on the path.',
  ];
  const [quoteIndex, setQuoteIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setQuoteIndex(prev => (prev + 1) % focusQuotes.length);
    }, 15 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRunning) {
      interval = setInterval(() => {
        setSeconds((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRunning]);

  const formatTime = (totalSeconds: number) => {
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;

    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleReset = () => {
    if (seconds > 60) {
      const minutesStudied = Math.floor(seconds / 60);
      setTodayMinutes((prev) => prev + minutesStudied);
      onSessionComplete?.(minutesStudied);
    }
    setSeconds(0);
    setIsRunning(false);
  };

  const goalProgress = Math.min((todayMinutes / dailyGoalMinutes) * 100, 100);

  return (
    <Card>
      <CardContent className="p-3 sm:p-4">
        <div className="mb-2 sm:mb-3 flex items-center gap-2">
          <Timer className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary" />
          <span className="text-xs sm:text-sm font-medium">Focus Mode</span>
        </div>

        {/* Timer Display */}
        <div className="mb-3 sm:mb-4 text-center">
          <span className={cn(
            "font-mono text-2xl sm:text-3xl font-bold block",
            isRunning && "text-primary"
          )}>
            {formatTime(seconds)}
          </span>
          <p className="text-sm text-muted-foreground italic transition-opacity duration-700 mt-2">
            {focusQuotes[quoteIndex]}
          </p>
        </div>

        {/* Controls */}
        <div className="mb-3 sm:mb-4 flex justify-center gap-2">
          <Button
            size="sm"
            variant={isRunning ? "secondary" : "default"}
            className="gap-1.5 sm:gap-2 h-8 sm:h-9 text-xs sm:text-sm px-3 sm:px-4"
            onClick={() => setIsRunning(!isRunning)}
          >
            {isRunning ? (
              <>
                <Pause className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                Pause
              </>
            ) : (
              <>
                <Play className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                Start
              </>
            )}
          </Button>
          {seconds > 0 && (
            <Button size="sm" variant="outline" onClick={handleReset} className="h-8 sm:h-9 w-8 sm:w-9 p-0">
              <RotateCcw className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </Button>
          )}
        </div>

        {/* Daily Progress */}
        <div className="space-y-1.5 sm:space-y-2">
          <div className="flex items-center justify-between text-[10px] sm:text-xs">
            <span className="text-muted-foreground">Daily Goal</span>
            <span className="font-medium">{todayMinutes}/{dailyGoalMinutes} min</span>
          </div>
          <Progress value={goalProgress} className="h-1.5 sm:h-2" />
          {goalProgress >= 100 && (
            <p className="text-center text-[10px] sm:text-xs text-primary font-medium">
              🎉 Daily goal complete!
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
