import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ReadinessMap } from "@/hooks/useAllSubjectsReadiness";
import { cn } from "@/lib/utils";
import {
    Atom,
    BookMarked,
    Calculator,
    DollarSign,
    FlaskConical,
    Globe, Landmark,
    Dna,
    Plus, Settings
} from "lucide-react";

export interface SubjectData {
  id: string;
  name: string;
  mastery: number;
}

interface SubjectCardsProps {
  subjects: SubjectData[];
  loading?: boolean;
  /** Pre-computed readiness scores from the parent's batch hook */
  readinessMap?: ReadinessMap;
  readinessLoading?: boolean;
  onSubjectClick: (subjectId: string, subjectName: string) => void;
  onManageSubjects?: () => void;
}

const EnglishIcon = ({ className }: { className?: string }) => (
  <span
    className={cn("font-serif font-bold text-xl leading-none flex items-center justify-center", className)}
    aria-label="English"
  >
    Aa
  </span>
);

const SUBJECT_CONFIG: Record<string, { icon: React.ElementType, bgClass: string, iconClass: string }> = {
  english: { icon: EnglishIcon, bgClass: "bg-red-50 dark:bg-red-950/30", iconClass: "text-red-500 dark:text-red-400" },
  mathematics: { icon: Calculator, bgClass: "bg-blue-50 dark:bg-blue-950/30", iconClass: "text-blue-500 dark:text-blue-400" },
  physics: { icon: Atom, bgClass: "bg-indigo-50 dark:bg-indigo-950/30", iconClass: "text-indigo-500 dark:text-indigo-400" },
  chemistry: { icon: FlaskConical, bgClass: "bg-purple-50 dark:bg-purple-950/30", iconClass: "text-purple-500 dark:text-purple-400" },
  biology: { icon: Dna, bgClass: "bg-green-50 dark:bg-green-950/30", iconClass: "text-green-500 dark:text-green-400" },
  geography: { icon: Globe, bgClass: "bg-amber-50 dark:bg-amber-950/30", iconClass: "text-amber-500 dark:text-amber-400" },
  government: { icon: Landmark, bgClass: "bg-slate-50 dark:bg-slate-900/50", iconClass: "text-slate-600 dark:text-slate-400" },
  economics: { icon: DollarSign, bgClass: "bg-emerald-50 dark:bg-emerald-950/30", iconClass: "text-emerald-500 dark:text-emerald-400" },
  literature: { icon: BookMarked, bgClass: "bg-rose-50 dark:bg-rose-950/30", iconClass: "text-rose-500 dark:text-rose-400" },
};

function getSubjectDisplayName(id: string): string {
  const names: Record<string, string> = {
    english: "English",
    mathematics: "Mathematics",
    physics: "Physics",
    chemistry: "Chemistry",
    biology: "Biology",
    geography: "Geography",
    government: "Government",
    economics: "Economics",
    literature: "Literature",
  };
  return names[id] || id.charAt(0).toUpperCase() + id.slice(1);
}

function SubjectCard({
  subject,
  readiness,
  readinessLoading,
  onClick,
}: {
  subject: SubjectData;
  readiness?: ReadinessMap[string];
  readinessLoading?: boolean;
  onClick: () => void;
}) {
  const config = SUBJECT_CONFIG[subject.id] || SUBJECT_CONFIG.english;
  const Icon = config.icon;
  const displayName = subject.name || getSubjectDisplayName(subject.id);
  const isLoading = readinessLoading || !readiness;

  return (
    <Card
      className={cn(
        "group cursor-pointer overflow-hidden transition-all duration-300",
        "hover:shadow-lg hover:scale-[1.02] hover:border-primary/50"
      )}
      onClick={onClick}
    >
      <CardContent className="flex flex-col h-full p-4 sm:p-5">
        {/* Icon and Score Row */}
        <div className="flex items-start justify-between mb-3">
          <div
            className={cn(
              "flex h-11 w-11 sm:h-14 sm:w-14 items-center justify-center rounded-xl",
              config.bgClass,
              "group-hover:scale-110 transition-transform duration-300"
            )}
          >
            <Icon className={cn("h-5 w-5 sm:h-7 sm:w-7", config.iconClass)} />
          </div>
          {/* Score removed per user request */}
        </div>

        {/* Subject Name */}
        <div className="mt-auto">
          <h3 className="font-semibold text-base sm:text-lg truncate">{displayName}</h3>
          <p className="text-[10px] text-muted-foreground mt-1 opacity-70">Tap to start studying</p>
        </div>
      </CardContent>
    </Card>
  );
}

export function SubjectCards({
  subjects,
  loading,
  readinessMap,
  readinessLoading,
  onSubjectClick,
  onManageSubjects,
}: SubjectCardsProps) {
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-36 sm:h-44 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {subjects.length === 0 ? (
        <Card className="border-dashed border-2 py-8 sm:py-12">
          <CardContent className="flex flex-col items-center text-center p-4">
            <div className="flex h-16 w-16 sm:h-20 sm:w-20 items-center justify-center rounded-full bg-primary/10 mb-4 animate-in zoom-in-50 duration-500">
              <Plus className="h-8 w-8 sm:h-10 sm:w-10 text-primary" />
            </div>
            <h3 className="text-lg sm:text-xl font-bold mb-2">Start Your Journey</h3>
            <p className="text-sm text-muted-foreground max-w-[280px] sm:max-w-xs mb-6">
              You haven't selected any subjects yet. Choose your 4 JAMB subjects to get your personalized study plan.
            </p>
            {onManageSubjects && (
              <Button onClick={onManageSubjects} size="lg" className="w-full sm:w-auto">
                <Plus className="h-4 w-4 mr-2" />
                Select Your Subjects
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          {subjects.map((subject) => {
            const displayName = subject.name || getSubjectDisplayName(subject.id);
            return (
              <SubjectCard
                key={subject.id}
                subject={subject}
                readiness={readinessMap?.[subject.id]}
                readinessLoading={readinessLoading}
                onClick={() => onSubjectClick(subject.id, displayName)}
              />
            );
          })}
        </div>
      )}

      {onManageSubjects && (
        <Button
          variant="outline"
          className="w-full gap-2 h-10 text-sm text-muted-foreground hover:text-foreground"
          onClick={onManageSubjects}
        >
          <Settings className="h-4 w-4" />
          Manage Subjects
        </Button>
      )}
    </div>
  );
}
