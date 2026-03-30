import { Card, CardContent } from "@/components/ui/card";
import { useAllSubjectsReadiness } from "@/hooks/useAllSubjectsReadiness";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { queryCache } from "@/lib/queryCache";
import { MessageSquare, BookOpen, Brain, BarChart3, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import { DashboardView } from "./DashboardSidebar";
import { SubjectCards, SubjectData } from "./SubjectCards";

interface DashboardHomeProps {
  onNavigate: (view: DashboardView) => void;
  onNavigateWithContext: (view: DashboardView, subject: string) => void;
  onManageSubjects: () => void;
}

/**
 * THESIS EDITION: Research Hub
 * This home view organizes the 4 research pillars and subject-specific entry points.
 */
export function DashboardHome({
  onNavigate,
  onNavigateWithContext,
  onManageSubjects,
}: DashboardHomeProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [subjects, setSubjects] = useState<SubjectData[]>([]);

  useEffect(() => {
    const fetchSubjects = async () => {
      if (!user) return;
      try {
        const { data: profile } = await supabase
          .from("profiles")
          .select("subjects_meta")
          .eq("id", user.id)
          .single();

        const subjectsMeta = (profile?.subjects_meta as { selectedSubjects?: string[] } | null);
        const selectedSubjects = subjectsMeta?.selectedSubjects || ['english', 'mathematics', 'physics', 'chemistry'];

        const subjectData: SubjectData[] = selectedSubjects.map((id) => ({
          id,
          name: id.charAt(0).toUpperCase() + id.slice(1),
          mastery: 0
        }));

        setSubjects(subjectData);
      } finally {
        setLoading(false);
      }
    };

    fetchSubjects();
  }, [user]);

  const { readinessMap, loading: readinessLoading } = useAllSubjectsReadiness(
    user?.id,
    subjects.map(s => s.id)
  );

  const pillars = [
    { id: 'ai-tutor', title: 'AI Tutor', desc: 'Conversational RAG logic', icon: MessageSquare, color: 'text-blue-500' },
    { id: 'quiz', title: 'Adaptive Quiz', desc: 'Difficulty adjustment generator', icon: BookOpen, color: 'text-green-500' },
    { id: 'flashcards', title: 'Flashcards', desc: 'Spaced-repetition system', icon: Brain, color: 'text-purple-500' },
    { id: 'analytics', title: 'Analytics', desc: 'Pattern & gain visualization', icon: BarChart3, color: 'text-orange-500' },
  ] as const;

  return (
    <div className="max-w-4xl mx-auto space-y-12 pb-12 px-4">
      <div className="text-center pt-8">
        <h1 className="text-3xl font-bold tracking-tight">Research Platform</h1>
        <p className="text-muted-foreground mt-2 max-w-lg mx-auto">
          Evaluating AI-driven tool preferences and self-regulated learning outcomes.
        </p>
      </div>

      {/* Core Pillars Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {pillars.map((pillar) => (
          <Card 
            key={pillar.id}
            className="cursor-pointer hover:shadow-md transition-all border-2 border-border/50 hover:border-primary/50 group"
            onClick={() => onNavigate(pillar.id as DashboardView)}
          >
            <CardContent className="p-6">
              <div className={pillar.color + " mb-4 p-3 rounded-xl bg-current/10 w-fit"}>
                <pillar.icon className="h-6 w-6" />
              </div>
              <h3 className="font-bold text-lg flex items-center justify-between">
                {pillar.title}
                <ChevronRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
              </h3>
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                {pillar.desc}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="space-y-6">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
            Subject-Specific Training
          </h2>
        </div>
        
        <SubjectCards
          subjects={subjects}
          loading={loading}
          readinessMap={readinessMap}
          readinessLoading={readinessLoading}
          onSubjectClick={(id, name) => onNavigateWithContext('ai-tutor', name)}
          onManageSubjects={onManageSubjects}
        />
      </div>
    </div>
  );
}
