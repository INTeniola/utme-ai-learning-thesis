import { useState, useRef, useEffect, lazy, Suspense } from 'react';
import { useAITutor } from '@/hooks/useAITutor';
import { useSubject } from '@/contexts/SubjectContext';
import { motion } from 'framer-motion';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { useHybridTTS } from '@/hooks/useHybridTTS';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { toast } from "sonner";
import { LatexRenderer } from './LatexRenderer';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  Plus,
  Send,
  Hexagon,
  User,
  ThumbsUp,
  ThumbsDown,
  Volume2,
  VolumeX,
  PanelLeft,
  Mic,
  Trash2,
  Copy,
  Check,
  Zap,
  Layers,
  GitBranch,
  Loader2,
  Brain
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { DynamicLoadingText } from '@/components/ui/DynamicLoadingText';
import { Lightning, Cards, TreeStructure } from "@phosphor-icons/react";

// Tools for the 4 pillars
const QuizController = lazy(() => import('@/components/quiz/QuizController').then(m => ({ default: m.QuizController })));
const FlashcardController = lazy(() => import('@/components/flashcards/FlashcardController').then(m => ({ default: m.FlashcardController })));
const ConceptVisualizer = lazy(() => import('@/components/study/ConceptVisualizer').then(m => ({ default: m.ConceptVisualizer })));

interface SavantTutorProps {
  subject: string;
  initialTopic?: string;
  onBack: () => void;
  onNavigate: (view: any) => void;
}

const ThreeDotsLoader = () => (
  <div className="flex gap-1 items-center h-4 ml-1">
    {[0, 1, 2].map((i) => (
      <motion.div
        key={i}
        initial={{ opacity: 0.3, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{
          repeat: Infinity,
          repeatType: "reverse",
          duration: 0.6,
          delay: i * 0.2
        }}
        className="h-1 w-1 rounded-full bg-primary/40"
      />
    ))}
  </div>
);

/**
 * THESIS EDITION: Minimal Savant Tutor
 * Purely functional research interface. No rewards, no uploads, no distractions.
 */
export function SavantTutor({ subject, initialTopic, onBack, onNavigate }: SavantTutorProps) {
  const {
    loading,
    interactions,
    isSpeaking,
    conversations,
    activeConversationId,
    loadConversations,
    loadConversation,
    createNewConversation,
    deleteConversation,
    updateContext,
    sendMessage,
    orchestratorAction,
    triggerAction,
    clearOrchestratorAction,
    buildRichStudentContext,
    ingestToolResult,
    getBestCTA,
    lastFailedMessage,
    submitFeedback,
    clearFailedMessage,
    isAwaitingFirstToken,
    resetTutor
  } = useAITutor();

  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [topics, setTopics] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isContextReady, setIsContextReady] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [input, setInput] = useState('');
  const [feedbackState, setFeedbackState] = useState<Record<string, 'positive' | 'negative'>>({});
  const [greeting, setGreeting] = useState('');
  const [displaySubject, setDisplaySubject] = useState(subject.charAt(0).toUpperCase() + subject.slice(1).toLowerCase());
  const { setSubject } = useSubject();
  const [userSubjects, setUserSubjects] = useState<string[]>([]);
  const [toolsSheetOpen, setToolsSheetOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [studyToolsCollapsed, setStudyToolsCollapsed] = useState(false);

  // Load subject list
  useEffect(() => {
    const loadUserSubjects = async () => {
      const { data: profile } = await supabase
        .from('profiles')
        .select('subjects_meta')
        .single();
      const meta = profile?.subjects_meta as { selectedSubjects?: string[] } | null;
      if (meta?.selectedSubjects?.length) {
        const list = meta.selectedSubjects.map(s => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase());
        setUserSubjects(list);
      }
    };
    loadUserSubjects();
  }, []);

  // Initialize
  useEffect(() => {
    const initializeTutor = async () => {
      setIsContextReady(false);
      resetTutor();
      
      const { data } = await supabase
        .from('jamb_syllabus')
        .select('topic')
        .eq('subject', subject)
        .order('topic');

      if (data && data.length > 0) {
        const uniqueTopics = [...new Set(data.map(d => d.topic))];
        setTopics(uniqueTopics);
        const currentTopic = initialTopic || uniqueTopics[0];
        setSelectedTopic(currentTopic);
        await buildRichStudentContext(subject, currentTopic);
      }

      await loadConversations(subject);
      
      // Load last conversation if it exists
      const { data: lastConv } = await supabase
        .from('conversations')
        .select('id')
        .eq('subject', subject)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (lastConv) {
        await loadConversation(lastConv.id);
      }

      setIsContextReady(true);
    };
    initializeTutor();
  }, [subject]);

  useEffect(() => {
    setGreeting(`Research Mode: ${subject.toUpperCase()} Session Active.`);
  }, [subject]);

  const { isListening, startListening, stopListening, resetTranscript, transcript, isSupported: speechSupported } = useSpeechRecognition();

  useEffect(() => {
    if (transcript) setInput(transcript);
  }, [transcript]);

  const handleSend = async () => {
    if (!input.trim() || loading || !isContextReady) return;
    const message = input.trim();
    setInput('');
    resetTranscript();
    await sendMessage(message);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
    toast.success("Copied to clipboard");
  };

  return (
    <div className="flex h-[100dvh] w-full bg-background overflow-hidden relative">
      
      {/* Mobile Sidebar Backdrop */}
      {!sidebarCollapsed && (
        <div 
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setSidebarCollapsed(true)}
        />
      )}

      {/* History Sidebar */}
      <div className={cn(
        "flex flex-col h-full border-r transition-all duration-300 shrink-0 overflow-hidden z-50",
        "absolute inset-y-0 left-0 bg-card md:relative md:bg-muted/20",
        sidebarCollapsed ? "-translate-x-full md:-translate-x-0 md:w-0" : "translate-x-0 w-[260px]"
      )}>
        <ScrollArea className="flex-1">
          <div className="p-4 space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest pl-1">
                Active Subject
              </label>
              <Select value={displaySubject} onValueChange={(val) => setSubject(val)}>
                <SelectTrigger className="w-full bg-background rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {userSubjects.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <Button 
              className="w-full justify-start gap-2 h-11 rounded-xl font-bold bg-primary/10 text-primary hover:bg-primary/20 border-none"
              onClick={() => createNewConversation({ subject, topic: selectedTopic || 'General', firstName: 'Participant' } as any)}
            >
              <Plus className="h-4 w-4" /> New Chat
            </Button>

            <div className="space-y-2">
               <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-1">History</h3>
               {conversations.map(conv => (
                 <button
                   key={conv.id}
                   onClick={() => loadConversation(conv.id)}
                   className={cn(
                     "w-full text-left p-3 rounded-xl text-sm transition-colors group relative",
                     activeConversationId === conv.id ? "bg-primary/10 text-primary font-bold" : "hover:bg-muted"
                   )}
                 >
                   <span className="line-clamp-2">{conv.title}</span>
                   <Trash2 
                    className="h-3 w-3 absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                    onClick={(e) => { e.stopPropagation(); deleteConversation(conv.id); }}
                   />
                 </button>
               ))}
            </div>
          </div>
        </ScrollArea>
      </div>

      {/* Main Chat Area */}
      <div className="flex flex-col flex-1 min-w-0 h-full overflow-hidden">
        <header className="flex items-center justify-between border-b px-4 py-3 shrink-0 bg-background/80 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={onBack} className="h-8 w-8 rounded-full">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setSidebarCollapsed(!sidebarCollapsed)} className="h-8 w-8 rounded-full">
              <PanelLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-sm font-bold leading-none">Savant AI Tutor</h1>
              <p className="text-[10px] text-muted-foreground mt-1">{displaySubject} • {selectedTopic}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-full border text-[10px] font-medium bg-muted/30 text-muted-foreground">
              <Brain className="h-3 w-3" />
              <span>Study Mode</span>
            </div>
          </div>
        </header>

        <ScrollArea className="flex-1">
          <div className="max-w-3xl mx-auto space-y-6 py-8 px-4">
            {!isContextReady ? (
               <div className="flex flex-col items-center justify-center py-20 gap-4">
                 <Loader2 className="h-8 w-8 animate-spin text-primary/50" />
                 <DynamicLoadingText />
               </div>
            ) : interactions.length === 0 ? (
               <div className="text-center py-20 space-y-4">
                 <div className="h-12 w-12 rounded-2xl bg-primary/5 flex items-center justify-center border mx-auto">
                    <Hexagon className="h-6 w-6 text-primary rotate-90" />
                 </div>
                 <h2 className="text-xl font-bold">{greeting}</h2>
                 <p className="text-sm text-muted-foreground">Start by asking a question about {selectedTopic}.</p>
               </div>
            ) : (
              <>
                {interactions.map((msg, i) => (
                  <div key={i} className={cn("flex gap-3", msg.role === 'student' ? "justify-end" : "justify-start")}>
                    {msg.role === 'tutor' && (
                      <div className="h-8 w-8 rounded-full border bg-muted flex items-center justify-center shrink-0 mt-1">
                        <Hexagon className="h-4 w-4 text-primary rotate-90" />
                      </div>
                    )}
                    <div className={cn(
                      "group relative",
                      msg.role === 'student' ? "max-w-[80%] bg-primary text-primary-foreground p-4 rounded-2xl rounded-br-none" : "flex-1"
                    )}>
                      <div className="text-sm leading-relaxed prose dark:prose-invert">
                        <LatexRenderer content={msg.content} />
                      </div>
                      {msg.role === 'tutor' && (
                        <div className="mt-4 flex flex-wrap gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                           <Button variant="ghost" size="sm" className="h-7 px-2 text-[10px] gap-1" onClick={() => handleCopy(msg.id!, msg.content)}>
                             <Copy className="h-3 w-3" /> Copy
                           </Button>
                           <Button variant="ghost" size="sm" className="h-7 px-2 text-[10px] gap-1" onClick={() => submitFeedback(msg.id!, 'positive')}>
                             <ThumbsUp className="h-3 w-3" />
                           </Button>
                           <Button variant="ghost" size="sm" className="h-7 px-2 text-[10px] gap-1" onClick={() => submitFeedback(msg.id!, 'negative')}>
                             <ThumbsDown className="h-3 w-3" />
                           </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </>
            )}
            {isAwaitingFirstToken && (
               <div className="flex gap-3">
                 <div className="h-8 w-8 rounded-full border bg-muted flex items-center justify-center shrink-0 mt-1">
                   <Hexagon className="h-3.5 w-3.5 text-primary rotate-90" />
                 </div>
                 <ThreeDotsLoader />
               </div>
            )}
          </div>
        </ScrollArea>

        {/* Input */}
        <div className="p-4 border-t bg-background">
          <div className="max-w-3xl mx-auto flex gap-2 items-end">
            {speechSupported && (
              <Button 
                variant="ghost" 
                size="icon" 
                className={cn("h-11 w-11 rounded-xl", isListening && "text-red-500 bg-red-500/10 animate-pulse")}
                onPointerDown={(e) => { e.preventDefault(); isListening ? stopListening() : startListening(); }}
              >
                <Mic className="h-5 w-5" />
              </Button>
            )}
            <Textarea 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask a question..."
              className="min-h-[44px] max-h-32 rounded-xl bg-muted/30 border-none shadow-none focus-visible:ring-1"
              rows={1}
            />
            <Button onClick={handleSend} disabled={loading || !input.trim()} className="h-11 w-11 rounded-xl shrink-0">
              <Send className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Tools Panel */}
      <div className={cn(
        "flex flex-col border-l transition-all duration-300 bg-slate-50/50 dark:bg-slate-900/30",
        orchestratorAction ? "w-1/2 absolute inset-0 z-[60] bg-background md:relative" : (studyToolsCollapsed ? "w-16" : "w-80"),
        !orchestratorAction && "hidden md:flex"
      )}>
        <div className="p-4 border-b flex items-center justify-between min-h-[64px]">
           {!studyToolsCollapsed && !orchestratorAction && <h2 className="text-sm font-bold">Research Tools</h2>}
           <Button variant="ghost" size="icon" onClick={() => setStudyToolsCollapsed(!studyToolsCollapsed)} className="mx-auto h-8 w-8 rounded-full">
              <PanelLeft className={cn("h-4 w-4 transition-transform", studyToolsCollapsed && "rotate-180")} />
           </Button>
        </div>

        <div className="flex-1 p-4 space-y-3">
           {orchestratorAction ? (
              <div className="h-full flex flex-col">
                <header className="flex items-center justify-between mb-4">
                   <h3 className="text-sm font-bold capitalize">{orchestratorAction.action.replace('trigger_', '').replace('_', ' ')}</h3>
                   <Button variant="ghost" size="icon" onClick={clearOrchestratorAction}><Plus className="h-4 w-4 rotate-45" /></Button>
                </header>
                <div className="flex-1 min-h-0 bg-card rounded-2xl border shadow-sm overflow-hidden">
                   <Suspense fallback={<div className="h-full flex items-center justify-center"><Loader2 className="animate-spin" /></div>}>
                      {orchestratorAction.action === 'trigger_quiz' && (
                        <QuizController 
                          initialTopic={orchestratorAction.topic || selectedTopic || 'General'} 
                          initialSubject={subject} 
                          onBack={clearOrchestratorAction}
                          onComplete={(res) => {
                            ingestToolResult('quiz', res);
                            toast.success("Quiz results recorded for research.");
                          }}
                        />
                      )}
                      {orchestratorAction.action === 'trigger_flashcards' && (
                        <FlashcardController 
                          initialSubject={subject} 
                          onBack={clearOrchestratorAction}
                          onComplete={(res) => {
                            ingestToolResult('flashcards', res);
                            toast.success("Progress updated.");
                          }}
                        />
                      )}
                      {orchestratorAction.action === 'trigger_visualizer' && (
                        <ConceptVisualizer 
                          subject={subject} 
                          onBack={clearOrchestratorAction} 
                        />
                      )}
                   </Suspense>
                </div>
              </div>
           ) : (
             <>
               {[
                 { id: 'trigger_quiz', label: 'Adaptive Quiz', desc: 'Personalized practice', icon: <Lightning className="h-5 w-5" />, color: 'text-blue-600 bg-blue-500/10' },
                 { id: 'trigger_flashcards', label: 'Flashcards', desc: 'Active recall', icon: <Cards className="h-5 w-5" />, color: 'text-purple-600 bg-purple-500/10' },
                 { id: 'trigger_visualizer', label: 'Concept Map', desc: 'Visual logic', icon: <TreeStructure className="h-5 w-5" />, color: 'text-emerald-600 bg-emerald-500/10' },
               ].map(tool => (
                 <button 
                  key={tool.id} 
                  onClick={() => triggerAction({ action: tool.id, topic: selectedTopic || 'General' })}
                  className={cn(
                    "w-full flex items-center gap-3 p-3 rounded-xl border bg-card/50 transition-all hover:bg-primary/5",
                    studyToolsCollapsed && "justify-center p-3 h-12 w-12"
                  )}
                 >
                   <div className={cn("h-10 w-10 shrink-0 rounded-lg flex items-center justify-center", tool.color)}>{tool.icon}</div>
                   {!studyToolsCollapsed && (
                     <div className="text-left">
                       <p className="text-sm font-bold">{tool.label}</p>
                       <p className="text-[10px] text-muted-foreground">{tool.desc}</p>
                     </div>
                   )}
                 </button>
               ))}
             </>
           )}
        </div>
      </div>
    </div>
  );
}
