import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { TIMER_PRESETS, useStudyTimer } from '@/hooks/useStudyTimer';
import { cn } from '@/lib/utils';
import confetti from 'canvas-confetti';
import {
    ChevronLeft,
    Coffee,
    Expand,
    Minimize,
    Pause,
    Play,
    Quote,
    RotateCcw,
    Sparkles,
    Square,
    Target,
    Timer,
    Trophy,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { CircularProgress } from './CircularProgress';

interface StudyTimerFullProps {
  onBack: () => void;
  subjects?: string[];
}

const DEFAULT_SUBJECTS = [
  'Mathematics',
  'Physics',
  'Chemistry',
  'Biology',
  'English',
  'Government',
  'Economics',
  'Literature',
];

export function StudyTimerFull({ onBack, subjects = DEFAULT_SUBJECTS }: StudyTimerFullProps) {
  const timer = useStudyTimer();
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [selectedPreset, setSelectedPreset] = useState<number>(25);
  const [customDuration, setCustomDuration] = useState<string>('');

  // Trigger confetti on completion
  useEffect(() => {
    if (timer.mode === 'completed') {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#006633', '#FFD700', '#FFFFFF'],
      });
    }
  }, [timer.mode]);

  const handleStart = () => {
    const duration = customDuration ? parseInt(customDuration) : selectedPreset;
    if (duration > 0 && selectedSubject) {
      timer.startTimer(selectedSubject, duration);
    }
  };

  const handlePresetChange = (minutes: number) => {
    setSelectedPreset(minutes);
    setCustomDuration('');
  };

  // Idle/Setup Screen
  if (timer.mode === 'idle') {
    return (
      <div className="mx-auto max-w-lg px-4 py-6">
        <button
          onClick={onBack}
          className="mb-6 flex items-center w-fit gap-1 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          Dashboard
        </button>

        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Timer className="h-6 w-6 text-primary" />
            </div>
            <CardTitle className="text-xl">Focus Mode</CardTitle>
            <CardDescription>
              Start a focused study session to earn XP
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Subject Selection */}
            <div className="space-y-2">
              <Label htmlFor="subject">What are you studying?</Label>
              <Select value={selectedSubject} onValueChange={setSelectedSubject}>
                <SelectTrigger id="subject">
                  <SelectValue placeholder="Select subject" />
                </SelectTrigger>
                <SelectContent>
                  {subjects.map((subject) => (
                    <SelectItem key={subject} value={subject}>
                      {subject}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Duration Presets */}
            <div className="space-y-2">
              <Label>Session Duration</Label>
              <div className="grid grid-cols-3 gap-2">
                {TIMER_PRESETS.map((preset) => (
                  <Button
                    key={preset.minutes}
                    variant={selectedPreset === preset.minutes && !customDuration ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handlePresetChange(preset.minutes)}
                    className="h-12"
                  >
                    {preset.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Custom Duration */}
            <div className="space-y-2">
              <Label htmlFor="custom">Or enter custom (minutes)</Label>
              <Input
                id="custom"
                type="number"
                placeholder="e.g., 35"
                min={5}
                max={180}
                value={customDuration}
                onChange={(e) => {
                  setCustomDuration(e.target.value);
                  if (e.target.value) setSelectedPreset(0);
                }}
              />
            </div>

            {/* XP Preview */}
            <div className="rounded-lg border bg-muted/50 p-4 text-center">
              <p className="text-sm text-muted-foreground">You'll earn</p>
              <p className="text-2xl font-bold text-primary">
                +{customDuration || selectedPreset} XP
              </p>
              <p className="text-xs text-muted-foreground">
                (1 XP per minute studied)
              </p>
            </div>

            {/* Start Button */}
            <Button
              size="lg"
              className="w-full gap-2"
              disabled={!selectedSubject}
              onClick={handleStart}
            >
              <Play className="h-5 w-5" />
              Start Focus Session
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Completed Screen
  if (timer.mode === 'completed') {
    const durationMinutes = Math.floor(timer.elapsed / 60);

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-primary/20 via-background to-primary/10 p-4">
        <Card className="mx-auto w-full max-w-md text-center">
          <CardContent className="pt-8">
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-green-100">
              <Trophy className="h-10 w-10 text-green-600" />
            </div>

            <h2 className="mb-2 text-2xl font-bold">Session Complete! 🎉</h2>
            <p className="mb-6 text-muted-foreground">
              You studied <span className="font-semibold">{timer.subject}</span> for{' '}
              <span className="font-semibold">{durationMinutes} minutes</span>
            </p>

            {/* XP Earned */}
            <div className="mb-6 rounded-lg border-2 border-primary bg-primary/10 p-4">
              <p className="text-sm text-muted-foreground">XP Earned</p>
              <p className="text-4xl font-bold text-primary">+{timer.earnedXP}</p>
            </div>

            {/* Actions */}
            <div className="space-y-3">
              <Button
                variant="outline"
                className="w-full gap-2"
                onClick={() => timer.startBreak(10)}
              >
                <Coffee className="h-4 w-4" />
                Take a 10-minute break
              </Button>

              <Button
                className="w-full gap-2"
                onClick={timer.resetTimer}
              >
                <RotateCcw className="h-4 w-4" />
                Start Another Session
              </Button>

              <Button
                variant="ghost"
                className="w-full"
                onClick={onBack}
              >
                Back to Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Break Screen
  if (timer.mode === 'break') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-blue-500/20 via-background to-blue-500/10 p-4">
        <Card className="mx-auto w-full max-w-md text-center">
          <CardContent className="pt-8">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/20">
              <Coffee className="h-8 w-8 text-primary" />
            </div>

            <h2 className="mb-2 text-xl font-bold">Break Time</h2>
            <p className="mb-6 text-muted-foreground">
              Relax, stretch, or grab a drink
            </p>

            <CircularProgress
              progress={timer.progress}
              size={180}
              strokeWidth={10}
              className="mx-auto mb-6 text-primary"
            >
              <span className="text-4xl font-mono font-bold">
                {timer.formatTime(timer.remainingSeconds)}
              </span>
            </CircularProgress>

            <Button
              className="w-full gap-2"
              onClick={timer.resetTimer}
            >
              <Play className="h-4 w-4" />
              Start New Session
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Active Timer Screen (studying/paused)
  return (
    <div
      className={cn(
        'fixed inset-0 z-50 flex flex-col items-center justify-center transition-all',
        timer.isFullscreen
          ? 'bg-primary'
          : 'bg-gradient-to-br from-primary/90 via-primary/80 to-primary/70'
      )}
    >
      {/* Top Bar */}
      <div className="absolute left-4 right-4 top-4 flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          className="text-white hover:bg-white/10"
          onClick={timer.stopTimer}
        >
          <ChevronLeft className="mr-2 h-4 w-4" />
          Exit
        </Button>

        <Badge variant="secondary" className="gap-1.5 bg-white/20 text-white">
          <Target className="h-3 w-3" />
          {timer.subject}
        </Badge>

        <Button
          variant="ghost"
          size="icon"
          className="text-white hover:bg-white/10"
          onClick={timer.toggleFullscreen}
        >
          {timer.isFullscreen ? (
            <Minimize className="h-5 w-5" />
          ) : (
            <Expand className="h-5 w-5" />
          )}
        </Button>
      </div>

      {/* Main Timer */}
      <div className="flex flex-col items-center">
        <CircularProgress
          progress={timer.progress}
          size={280}
          strokeWidth={16}
          className="mb-8 text-white"
        >
          <div className="text-center">
            <span className="text-6xl font-mono font-bold text-white">
              {timer.formatTime(timer.remainingSeconds)}
            </span>
            <p className="mt-1 text-sm text-white/70">
              {timer.mode === 'paused' ? 'Paused' : 'remaining'}
            </p>
          </div>
        </CircularProgress>

        {/* Controls */}
        <div className="flex items-center gap-4">
          {timer.mode === 'paused' ? (
            <Button
              size="lg"
              className="h-14 w-14 rounded-full bg-white text-primary hover:bg-white/90"
              onClick={timer.resumeTimer}
            >
              <Play className="h-7 w-7" />
            </Button>
          ) : (
            <Button
              size="lg"
              className="h-14 w-14 rounded-full bg-white text-primary hover:bg-white/90"
              onClick={timer.pauseTimer}
            >
              <Pause className="h-7 w-7" />
            </Button>
          )}

          <Button
            size="lg"
            variant="ghost"
            className="h-12 w-12 rounded-full text-white hover:bg-white/10"
            onClick={timer.stopTimer}
          >
            <Square className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Motivational Quote */}
      <div className="absolute bottom-8 left-4 right-4 text-center">
        <div className="mx-auto max-w-md rounded-lg bg-white/10 p-4 backdrop-blur-sm">
          <Quote className="mx-auto mb-2 h-5 w-5 text-white/70" />
          <p className="text-lg italic text-white">{timer.currentQuote}</p>
        </div>
      </div>

      {/* XP Preview */}
      <div className="absolute right-4 top-1/2 -translate-y-1/2">
        <div className="rounded-lg bg-white/10 p-3 text-center backdrop-blur-sm">
          <Sparkles className="mx-auto mb-1 h-4 w-4 text-yellow-400" />
          <p className="text-xs text-white/70">Earning</p>
          <p className="font-bold text-white">
            +{Math.floor(timer.elapsed / 60)} XP
          </p>
        </div>
      </div>
    </div>
  );
}
