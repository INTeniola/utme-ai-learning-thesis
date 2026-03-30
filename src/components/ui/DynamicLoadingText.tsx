import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

const FUN_PHRASES = [
  "Calibrating your Mentat Tutor...",
  "Brewing some smart responses...",
  "Reticulating splines...",
  "Consulting the digital oracle...",
  "Warming up the neural nets...",
  "Gathering knowledge crystals...",
  "Synthesizing syllabus data...",
  "Polishing the chalkboards...",
  "Sharpening virtual pencils..."
];

export function DynamicLoadingText({ className }: { className?: string }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setIndex((current) => (current + 1) % FUN_PHRASES.length);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  return (
    <p className={cn("text-sm text-muted-foreground font-medium animate-pulse", className)}>
      {FUN_PHRASES[index]}
    </p>
  );
}
