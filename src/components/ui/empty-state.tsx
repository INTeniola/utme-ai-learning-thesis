import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { BarChart3, BookOpen, FileQuestion, LucideIcon, Target } from 'lucide-react';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export function EmptyState({
  icon: Icon = FileQuestion,
  title,
  description,
  actionLabel,
  onAction,
  className,
}: EmptyStateProps) {
  return (
    <div className={cn(
      'flex flex-col items-center justify-center py-12 px-4 text-center',
      className
    )}>
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
        <Icon className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="mb-2 text-lg font-semibold">{title}</h3>
      <p className="mb-6 max-w-sm text-sm text-muted-foreground">{description}</p>
      {actionLabel && onAction && (
        <Button onClick={onAction}>{actionLabel}</Button>
      )}
    </div>
  );
}

// Pre-configured empty states for common scenarios
export function NoExamsEmptyState({ onStart }: { onStart: () => void }) {
  return (
    <EmptyState
      icon={Target}
      title="No Exams Taken Yet"
      description="Start your first mock exam to see your performance data and track your progress toward your UTME goals."
      actionLabel="Take Mock Exam"
      onAction={onStart}
    />
  );
}

export function NoQuestionsEmptyState({ onUpload }: { onUpload: () => void }) {
  return (
    <EmptyState
      icon={BookOpen}
      title="No Study Materials"
      description="Upload your textbooks or notes to start building your personalized knowledge base."
      actionLabel="Upload Notes"
      onAction={onUpload}
    />
  );
}

export function NoAnalyticsEmptyState({ onStart }: { onStart: () => void }) {
  return (
    <EmptyState
      icon={BarChart3}
      title="No Analytics Data"
      description="Complete some study sessions or exams to start seeing your learning analytics and progress charts."
      actionLabel="Start Practicing"
      onAction={onStart}
    />
  );
}

export function NoChatHistoryEmptyState() {
  return (
    <EmptyState
      icon={FileQuestion}
      title="Start a Conversation"
      description="Ask your AI Tutor anything about the current topic. I'll guide you with hints and explanations, never just giving you the answer."
    />
  );
}
