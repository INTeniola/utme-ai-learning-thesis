import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface SubjectSection {
  subject: string;
  count: number;
}

interface CBTQuestionPaletteProps {
  totalQuestions: number;
  currentIndex: number;
  answers: Record<string, string>;
  questionIds: string[];
  subjectSections: SubjectSection[];
  onSelect: (index: number) => void;
}

export function CBTQuestionPalette({
  totalQuestions,
  currentIndex,
  answers,
  questionIds,
  subjectSections,
  onSelect,
}: CBTQuestionPaletteProps) {
  // Build a flat map: questionIndex → subjectLabel
  let offset = 0;
  const sectionBoundaries = subjectSections.map(s => {
    const start = offset;
    offset += s.count;
    return { ...s, start, end: offset - 1 };
  });

  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-medium">Question Palette</span>
        <span className="text-xs text-muted-foreground">
          {Object.keys(answers).length}/{totalQuestions} answered
        </span>
      </div>

      {/* Legend */}
      <div className="mb-3 flex flex-wrap gap-3 text-xs">
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded bg-green-500" />
          <span>Answered</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded border-2 border-primary bg-primary/20" />
          <span>Current</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded bg-muted" />
          <span>Unanswered</span>
        </div>
      </div>

      {/* Question Grid — grouped by subject */}
      <ScrollArea className="h-[420px] pr-2">
        <div className="space-y-4">
          {sectionBoundaries.map(section => (
            <div key={section.subject}>
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {section.subject} ({section.count} Qs)
              </p>
              <div className="grid grid-cols-5 gap-1.5">
                {Array.from({ length: section.count }, (_, i) => {
                  const gIdx = section.start + i;
                  const questionId = questionIds[gIdx];
                  const isAnswered = questionId && answers[questionId];
                  const isCurrent = gIdx === currentIndex;
                  return (
                    <Button
                      key={gIdx}
                      variant="ghost"
                      size="sm"
                      className={cn(
                        'h-8 w-8 p-0 text-xs font-medium',
                        isAnswered && !isCurrent && 'bg-green-500 text-white hover:bg-green-600',
                        isCurrent && 'border-2 border-primary bg-primary/20 hover:bg-primary/30',
                        !isAnswered && !isCurrent && 'bg-muted hover:bg-muted/80'
                      )}
                      onClick={() => onSelect(gIdx)}
                    >
                      {gIdx + 1}
                    </Button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
