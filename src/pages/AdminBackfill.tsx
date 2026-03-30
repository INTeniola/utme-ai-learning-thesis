import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useAuth } from '@/hooks/useAuth';
import { backfillTableEmbeddings } from '@/services/embeddingService';
import { CheckCircle2, Database, FileText, GraduationCap } from 'lucide-react';
import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { toast } from 'sonner';

/** Only these email addresses can access this page. Add yours here. */
const ADMIN_EMAILS = [
  'ayedunteniola007@gmail.com',
  'dunmadenifemi@gmail.com',
];

type BackfillState = {
  running: boolean;
  done: number;
  total: number;
  finished: boolean;
};

export default function AdminBackfill() {
  const { user, loading } = useAuth();
  
  const [kgState, setKgState] = useState<BackfillState>({ running: false, done: 0, total: 0, finished: false });
  const [kbState, setKbState] = useState<BackfillState>({ running: false, done: 0, total: 0, finished: false });
  const [pqState, setPqState] = useState<BackfillState>({ running: false, done: 0, total: 0, finished: false });

  // Wait for auth session to be fetched before redirecting
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground animate-pulse">Checking permissions...</p>
      </div>
    );
  }

  // Step 1: not logged in → send to login
  if (!user) return <Navigate to="/login" replace />;

  // Step 2: logged in but not an admin → generic 404 (don't confirm page exists)
  if (!ADMIN_EMAILS.includes(user.email ?? '')) {
    return <Navigate to="/404" replace />;
  }

  const runBackfill = async (
    table: 'knowledge_graph' | 'knowledge_base' | 'past_questions',
    contentCol: string,
    stateKey: 'kg' | 'kb' | 'pq'
  ) => {
    const setState = stateKey === 'kg' ? setKgState : stateKey === 'kb' ? setKbState : setPqState;
    
    setState(prev => ({ ...prev, running: true, finished: false, done: 0, total: 0 }));

    try {
      await backfillTableEmbeddings(table, contentCol, 'embedding_768', (d, t) => {
        setState({ running: true, done: d, total: t, finished: false });
      });
      setState(prev => ({ ...prev, running: false, done: prev.total, finished: true }));
      toast.success(`Backfill for ${table} complete!`);
    } catch (err) {
      toast.error(`Backfill for ${table} failed.`);
      console.error(err);
      setState(prev => ({ ...prev, running: false }));
    }
  };

  const renderSection = (
    title: string,
    description: string,
    icon: any,
    state: BackfillState,
    onStart: () => void
  ) => {
    const pct = state.total > 0 ? Math.round((state.done / state.total) * 100) : 0;
    const Icon = icon;

    return (
      <div className="border rounded-xl p-6 space-y-4 bg-card shadow-sm">
        <div className="flex items-start gap-4">
          <div className="p-2 rounded-lg bg-primary/10 text-primary">
            <Icon size={20} />
          </div>
          <div>
            <h2 className="font-semibold">{title}</h2>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
        </div>

        {state.finished ? (
          <div className="flex items-center gap-2 text-sm text-green-600 font-medium bg-green-50 dark:bg-green-950/30 p-3 rounded-lg border border-green-100 dark:border-green-900">
            <CheckCircle2 size={16} />
            Unified Index Active
          </div>
        ) : state.running ? (
          <div className="space-y-2">
            <Progress value={pct} className="h-1.5" />
            <p className="text-xs text-center text-muted-foreground">
              {state.done} / {state.total} ({pct}%)
            </p>
          </div>
        ) : (
          <Button 
            onClick={onStart} 
            variant="outline" 
            size="sm" 
            className="w-full"
            disabled={kgState.running || kbState.running || pqState.running}
          >
            Index Table
          </Button>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950/50 p-8 flex flex-col items-center">
      <div className="max-w-2xl w-full space-y-8 mt-12">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">RAG Unified Indexer</h1>
          <p className="text-muted-foreground">
            Standardize all knowledge sources to Gemini 768-dim embeddings for the Mentat Swarm.
          </p>
        </div>

        <div className="grid gap-6">
          {renderSection(
            "Knowledge Graph",
            "The new structural knowledge base for core syllabus topics.",
            Database,
            kgState,
            () => runBackfill('knowledge_graph', 'content_chunk', 'kg')
          )}

          {renderSection(
            "Reference Library",
            "Legacy knowledge_base containing textbooks and uploaded PDFs.",
            FileText,
            kbState,
            () => runBackfill('knowledge_base', 'content', 'kb')
          )}

          {renderSection(
            "Question Bank",
            "Past questions and novel backfills (The Lekki Headmaster, etc.).",
            GraduationCap,
            pqState,
            () => runBackfill('past_questions', 'question_text', 'pq')
          )}
        </div>

        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-lg p-4">
          <p className="text-xs text-amber-800 dark:text-amber-400 leading-relaxed">
            <strong>Note:</strong> Each operation generates vectors using the Gemini API. Avoid running multiple backfills simultaneously to respect rate limits. If a process stops, you can refresh and restart; it will only process remaining rows.
          </p>
        </div>
      </div>
    </div>
  );
}
