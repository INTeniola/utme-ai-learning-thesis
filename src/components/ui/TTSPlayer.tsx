import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Progress } from '@/components/ui/progress';
import { UseHybridTTSReturn } from '@/hooks/useHybridTTS';
import { cn } from '@/lib/utils';
import { Pause, Play, Square, Volume2 } from 'lucide-react';
import { useState } from 'react';

export interface TTSPlayerProps {
    tts: UseHybridTTSReturn;
    className?: string;
    autoHide?: boolean;
}

export function TTSPlayer({ tts, className, autoHide = true }: TTSPlayerProps) {
    const [rate, setRate] = useState(1.0);

    // If autoHide is true, only show the player when it's actively speaking, paused, or loading
    if (autoHide && !tts.isSpeaking && !tts.isPaused && !tts.isLoading) {
        return null;
    }

    const handleRateChange = (newRate: number) => {
        setRate(newRate);
        tts.setRate(newRate);
    };

    return (
        <div className={cn(
            "flex items-center gap-2 p-1.5 md:p-2 rounded-xl border bg-card/90 backdrop-blur-md shadow-lg",
            className
        )}>
            <div className="flex items-center gap-1 shrink-0">
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-full bg-primary/10 text-primary hover:bg-primary/20 hover:text-primary transition-colors"
                    onClick={() => {
                        if (tts.isPaused) {
                            tts.resume();
                        } else if (tts.isSpeaking) {
                            tts.pause();
                        }
                    }}
                    disabled={tts.isLoading}
                >
                    {tts.isPaused ? (
                        <Play className="h-4 w-4 fill-current" />
                    ) : (
                        <Pause className="h-4 w-4 fill-current" />
                    )}
                </Button>

                <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                    onClick={tts.stop}
                    disabled={!tts.isSpeaking && !tts.isPaused && !tts.isLoading}
                >
                    <Square className="h-4 w-4 fill-current" />
                </Button>
            </div>

            <div className="flex-1 px-2 flex items-center gap-3">
                {tts.isLoading && (!tts.isSpeaking && !tts.isPaused) ? (
                    <div className="flex flex-1 items-center gap-2 text-xs text-muted-foreground animate-pulse">
                        <Volume2 className="h-3 w-3" />
                        <span>Connecting to Voice Engine...</span>
                    </div>
                ) : (
                    <Progress
                        value={tts.progress * 100}
                        className="h-1.5 flex-1 bg-secondary cursor-pointer"
                        onClick={(e) => {
                            // Simple scrub feature
                            const bounds = e.currentTarget.getBoundingClientRect();
                            const x = e.clientX - bounds.left;
                            const percentage = x / bounds.width;
                            tts.seek(percentage);
                        }}
                    />
                )}
            </div>

            <div className="shrink-0">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 px-2 text-xs font-medium border-l border-border/50 rounded-none">
                            {rate}x
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="min-w-[80px]">
                        {[0.75, 1, 1.25, 1.5, 2].map(speed => (
                            <DropdownMenuItem
                                key={speed}
                                onClick={() => handleRateChange(speed)}
                                className={cn("text-xs justify-center", rate === speed && "bg-primary/10 font-bold text-primary")}
                            >
                                {speed}x
                            </DropdownMenuItem>
                        ))}
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </div>
    );
}
