import { useState, useRef, useEffect, useCallback, lazy, Suspense } from 'react';
import { useAITutor } from '@/hooks/useAITutor';
import { useSubject } from '@/contexts/SubjectContext';
import { motion, AnimatePresence } from 'framer-motion';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { useHybridTTS } from '@/hooks/useHybridTTS';
import { useStudyVault } from '@/hooks/useStudyVault';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { toast } from "sonner";
import { LatexRenderer } from './LatexRenderer';
import { TTSPlayer } from '@/components/ui/TTSPlayer';

// Lazy-load heavy controllers to optimize bundle size and resolve chunking conflicts
const QuizController = lazy(() => import('@/components/quiz/QuizController').then(m => ({ default: m.QuizController })));
const FlashcardController = lazy(() => import('@/components/flashcards/FlashcardController').then(m => ({ default: m.FlashcardController })));
const ConceptVisualizer = lazy(() => import('@/components/study/ConceptVisualizer').then(m => ({ default: m.ConceptVisualizer })));
const CBTSimulator = lazy(() => import('@/components/cbt/CBTSimulator').then(m => ({ default: m.CBTSimulator })));
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
  Bookmark,
  Bot,
  Brain,
  Flame,
  Flag,
  Loader2,
  MessageSquare,
  Plus,
  Rocket,
  Send,
  Sparkles,
  Hexagon,
  User,
  ThumbsUp,
  ThumbsDown,
  Volume2,
  VolumeX,
  PanelLeft,
  Mic,
  MicOff,
  Image as ImageIcon,
  X,
  MessageCirclePlus,
  Paperclip,
  Zap,
  Layers,
  GitBranch,
  ClipboardList,
  BookOpen,
  Trash2,
  FileText,
  Copy,
  Check,
  CheckCircle2,
  Upload,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { DocumentUploadModal } from '@/components/document/DocumentUploadModal';
import { DynamicLoadingText } from '@/components/ui/DynamicLoadingText';
import { Lightning, Cards, TreeStructure, ClipboardText, Books } from "@phosphor-icons/react";

interface MentatTutorProps {
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

export function MentatTutor({ subject, initialTopic, onBack, onNavigate }: MentatTutorProps) {
  const {
    loading,
    interactions,
    context,
    isSpeaking,
    conversations,
    activeConversationId,
    loadConversations,
    loadConversation,
    createNewConversation,
    deleteConversation,
    updateContext,
    sendMessage,
    speakText,
    stopSpeaking,
    orchestratorAction,
    triggerAction,
    clearOrchestratorAction,
    ingestToolResult,
    buildRichStudentContext,
    lastFailedMessage,
    submitFeedback,
    clearFailedMessage,
    quotaInfo,
    refreshQuota,
    getBestCTA,
    isAwaitingFirstToken,
    isHistoryLoading,
    visualSignal,
    clearVisualSignal,
    resetTutor
  } = useAITutor();

  const { saveToKnowledgeBase } = useStudyVault();

  const [streak, setStreak] = useState(0);
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [topics, setTopics] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isContextReady, setIsContextReady] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth < 768; // Default off on mobile
    }
    return false;
  });
  const [isMonitoringTool, setIsMonitoringTool] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [feedbackState, setFeedbackState] = useState<Record<string, 'positive' | 'negative'>>({});
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [greeting, setGreeting] = useState('');
  const [displaySubject, setDisplaySubject] = useState(subject.charAt(0).toUpperCase() + subject.slice(1).toLowerCase());
  const { setSubject } = useSubject();

  const [isDocumentUploadOpen, setIsDocumentUploadOpen] = useState(false);
  const [toolsSheetOpen, setToolsSheetOpen] = useState(false);
  const [showExtras, setShowExtras] = useState(false);
  const [confirmNewChat, setConfirmNewChat] = useState(false);
  const [isCreatingConversation, setIsCreatingConversation] = useState(false);
  const [userSubjects, setUserSubjects] = useState<string[]>([]);
  const [showAllConversations, setShowAllConversations] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [studyToolsCollapsed, setStudyToolsCollapsed] = useState<boolean>(
    () => localStorage.getItem('studyToolsCollapsed') === 'true'
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  const toggleStudyTools = () => {
    setStudyToolsCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('studyToolsCollapsed', String(next));
      return next;
    });
  };

  // Load the user's registered UTME subjects for the subject switcher
  useEffect(() => {
    const loadUserSubjects = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase
        .from('profiles')
        .select('subjects_meta')
        .eq('id', user.id)
        .single();
      const meta = profile?.subjects_meta as { selectedSubjects?: string[] } | null;
      if (meta?.selectedSubjects?.length) {
        // Ensure English is always first, then the others (capitalized)
        const others = meta.selectedSubjects
          .filter(s => s.toLowerCase() !== 'english')
          .map(s => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase());
        setUserSubjects(['English', ...others]);
      } else {
        setUserSubjects(['English', 'Mathematics', 'Physics']);
      }
    };
    loadUserSubjects();
  }, []);

  // Fix 4: Restore failed message to input
  useEffect(() => {
    if (lastFailedMessage && !input) {
      setInput(lastFailedMessage);
      clearFailedMessage();
    }
  }, [lastFailedMessage, input, clearFailedMessage]);

  // Fix 2: Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [interactions, loading]);

  // Initial quota fetch
  useEffect(() => {
    if (refreshQuota) refreshQuota();
  }, [refreshQuota, subject]); // Refresh on subject change too

  const { isListening, transcript, startListening, stopListening, resetTranscript, isSupported: speechSupported } = useSpeechRecognition();
  const tts = useHybridTTS();

  useEffect(() => {
    const initializeTutor = async () => {
      setIsContextReady(false);
      // Immediately wipe all visible state from the previous subject
      resetTutor();

      const { data } = await supabase
        .from('jamb_syllabus')
        .select('topic')
        .eq('subject', subject)
        .order('topic');

      let currentTopic = initialTopic || 'General';
      if (!initialTopic && data && data.length > 0) {
        const uniqueTopics = [...new Set(data.map(d => d.topic))];
        setTopics(uniqueTopics);
        currentTopic = uniqueTopics[0];
        setSelectedTopic(currentTopic);
      } else if (data) {
        const uniqueTopics = [...new Set(data.map(d => d.topic))];
        setTopics(uniqueTopics);
        setSelectedTopic(currentTopic);
      }

      await loadConversations(subject);
      // Proactively build the rich student context (mastery, syllabus, profile etc)
      await buildRichStudentContext(subject, currentTopic);

      // Bug 2 fix: explicitly load the most recent conversation for this subject.
      // Done here (not in a useEffect) so it never races with the streaming loop.
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: lastConv } = await supabase
            .from('conversations')
            .select('id')
            .eq('user_id', user.id)
            .eq('subject', subject)
            .order('updated_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (lastConv) {
            await loadConversation(lastConv.id);
          } else {
            // Fix: Clear previous interactions if no history exists for the new subject
            resetTutor();
          }
        }
      } catch (err) {
        console.warn('Failed to restore conversation history:', err);
      }

      setIsContextReady(true);
    };
    initializeTutor();
    setDisplaySubject(subject.charAt(0).toUpperCase() + subject.slice(1).toLowerCase());
  }, [subject, initialTopic]);

  /**
   * Addition 4 — Sidebar collapse behavior for all scenarios
   */
  useEffect(() => {
    if (orchestratorAction) {
      if (orchestratorAction.action === 'trigger_cbt' && onNavigate) {
        handleClearAction();
        onNavigate('cbt');
      } else {
        setSidebarCollapsed(true);
      }
    }
  }, [orchestratorAction, onNavigate]);


  useEffect(() => {
    const fetchUserData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (profile) setStreak(profile.current_streak || 0);

      const hour = new Date().getHours();
      const firstName = profile?.full_name?.split(' ')[0] || 'Student';

      let period = 'morning';
      if (hour >= 0 && hour < 5) period = 'late_night';
      else if (hour >= 5 && hour < 12) period = 'morning';
      else if (hour >= 12 && hour < 17) period = 'afternoon';
      else if (hour >= 17 && hour < 21) period = 'evening';
      else period = 'night';

      const greetings: Record<string, string[]> = {
        late_night: ["Burning the midnight oil?", "Ready for a late session?", "Quiet hours, deep focus."],
        morning: ["Rise and grind!", "New day, new goals.", "Fresh mind, let's learn."],
        afternoon: ["Good afternoon!", "Midday push!", "Stay sharp."],
        evening: ["Evening review.", "Solidifying concepts.", "Let's review."],
        night: ["One last review.", "Cementing the day's knowledge.", "Brief but effective."]
      };

      const options = greetings[period] || greetings['morning'];
      const capitalizedSubject = subject.charAt(0).toUpperCase() + subject.slice(1).toLowerCase();
      setGreeting(`${options[Math.floor(Math.random() * options.length)]} Hello ${firstName}, let's master ${capitalizedSubject}!`);
    };
    fetchUserData();
  }, [subject]);

  const handleTopicChange = async (newTopic: string) => {
    setSelectedTopic(newTopic);
    updateContext({ topic: newTopic });
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
    toast.success("Response copied to clipboard");
  };

  // Wrapped trigger to track monitoring state
  const handleTriggerAction = (actionData: { action: string, topic?: string }, monitoring = true) => {
    setIsMonitoringTool(monitoring);
    triggerAction(actionData);
  };

  // Wrapped clear to handle post-tool response if monitoring
  const handleClearAction = () => {
    if (isMonitoringTool) {
      // In a real app we might trigger a specific "Tell me about the results" prompt here
      // For now, we'll just ingestion and clear
    }
    clearOrchestratorAction();
    setIsMonitoringTool(false);
  };


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

  const handleNewConversation = async () => {
    console.log('[handleNewConversation] called. interactions:', interactions.length);
    if (window.innerWidth < 768) setSidebarCollapsed(true);

    // No messages in current session — do nothing
    if (!interactions || interactions.length === 0) return;

    // Already in flight — ignore double-clicks
    if (isCreatingConversation) return;

    setIsCreatingConversation(true);
    try {
      const topic = topics.length > 0 ? topics[0] : 'General';
      setSelectedTopic(topic);
      await createNewConversation({
        subject,
        topic,
        firstName: 'Student',
        weakTopics: [],
        strongTopics: [],
        recentQuizResults: [],
        lastStudiedDaysAgo: null,
        topicsNeverAttempted: [],
        currentSyllabusObjectives: [],
        sessionStartTime: Date.now(),
        studentStage: 'new_user',
        lastToolResult: null,
        selectedSubjects: [],
        examDate: null,
        daysToExam: null,
        knowledgeChunks: [],
        userUploads: [],
        learningPatterns: null,
        teachingQuestions: [],
        studentRank: null,
        leaderboardContext: [],
        lastSession: null,
        studentStyle: { tone: 'unknown', avgLength: 0, usesSlang: false, usesEmoji: false },
        examType: 'General',
        examFullName: 'General Examination'
      });
    } finally {
      setIsCreatingConversation(false);
    }
  };

  const handleSelectConversation = async (id: string, sub: string) => {
    if (window.innerWidth < 768) setSidebarCollapsed(true);
    await loadConversation(id);
  };

  useEffect(() => {
    if (transcript) setInput(transcript);
  }, [transcript]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setSelectedImage(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleVoiceToggle = () => {
    if (isListening) stopListening();
    else { resetTranscript(); startListening(); }
  };

  return (
    <div className="flex h-[100dvh] w-full bg-background overflow-hidden relative">
      
      {/* Mobile Backdrop for Sidebar */}
      {!sidebarCollapsed && (
        <div 
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 md:hidden animate-in fade-in"
          onClick={() => setSidebarCollapsed(true)}
        />
      )}

      {/* Column 1 — Sidebar, fixed width */}
      <div className={cn(
        "flex flex-col h-full border-r transition-all duration-300 shrink-0 overflow-hidden z-50",
        "absolute inset-y-0 left-0 bg-card shadow-2xl md:relative md:bg-muted/20 md:shadow-none",
        sidebarCollapsed ? "-translate-x-full md:-translate-x-0 md:w-0" : "translate-x-0 w-[280px] md:w-[256px]"
      )}>
        <ScrollArea className="flex-1 min-h-0 overflow-y-auto w-full">
          <div className="p-3 space-y-4">
            
            {/* New Chat & History Header */}
            <div className="space-y-4">
            {/* Subject Switcher Dropdown */}
            {userSubjects.length > 1 && (
              <div className="space-y-1.5 px-0.5">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest pl-1">
                  Active Subject
                </label>
                <Select
                  value={displaySubject}
                  onValueChange={(val) => {
                    if (val.toLowerCase() !== subject.toLowerCase()) {
                      setDisplaySubject(val); // Optimistic UI
                      setSubject(val); // Context update (triggers URL sync and re-fetch)
                    }
                  }}
                >
                  <SelectTrigger className="w-full bg-background border-border h-10 rounded-xl font-semibold shadow-sm focus:ring-1 focus:ring-primary/20">
                    <SelectValue placeholder="Select Subject" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-border shadow-xl">
                    {userSubjects.map((s) => (
                      <SelectItem 
                        key={s} 
                        value={s}
                        className="text-sm font-medium focus:bg-primary/5 focus:text-primary rounded-lg my-0.5"
                      >
                        {s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <Button 
                variant="default" 
                className="w-full justify-start gap-2 bg-primary/10 text-primary hover:bg-primary/20 border-none h-11 rounded-xl font-semibold"
                onClick={handleNewConversation}
                disabled={isCreatingConversation}
              >
                {isCreatingConversation ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                New Chat
              </Button>

              <div className="flex items-center justify-between px-1">
                <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <MessageSquare className="h-3 w-3" /> Chat History
                </h3>
                <Button variant="ghost" size="icon" onClick={() => setSidebarCollapsed(true)} className="h-6 w-6 md:hidden">
                  <ChevronLeft className="h-3 w-3" />
                </Button>
              </div>

              {confirmNewChat && (
                <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="rounded-xl bg-primary/5 border border-primary/20 p-3 space-y-3">
                    <p className="text-[11px] font-medium leading-tight">Start fresh? Current chat will be saved to history.</p>
                    <div className="flex gap-2">
                      <Button variant="default" size="sm" className="h-7 text-[10px] flex-1 rounded-lg" onClick={handleNewConversation}>
                        Confirm
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 text-[10px] flex-1 rounded-lg border border-border" onClick={() => setConfirmNewChat(false)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                </div>
              )}
              
              <div className="space-y-1">
                {isHistoryLoading && conversations.length === 0 ? (
                  <div className="space-y-2 py-2">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="w-full h-12 bg-muted/50 animate-pulse rounded-lg" />
                    ))}
                  </div>
                ) : (
                  (showAllConversations ? conversations : conversations.slice(0, 20)).map((group) => (
                  <div key={group.id} className="group relative">
                    {confirmDeleteId === group.id ? (
                      /* Inline delete confirmation */
                      <div className="flex flex-col gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                        <p className="text-[11px] font-medium text-destructive">Delete this chat?</p>
                        <div className="flex gap-2">
                          <button
                            className="flex-1 rounded-md bg-destructive px-2 py-1 text-[10px] font-semibold text-destructive-foreground hover:bg-destructive/90 transition-colors"
                            onClick={async () => {
                              setConfirmDeleteId(null);
                              await deleteConversation(group.id);
                            }}
                          >
                            Yes, delete
                          </button>
                          <button
                            className="flex-1 rounded-md border px-2 py-1 text-[10px] text-muted-foreground hover:bg-muted transition-colors"
                            onClick={() => setConfirmDeleteId(null)}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleSelectConversation(group.id, group.subject)}
                        className={cn(
                          'flex w-full flex-col items-start gap-0.5 rounded-lg p-3 text-left hover:bg-muted/50 border-l-2 transition-colors pr-7',
                          activeConversationId === group.id
                            ? 'border-l-primary bg-muted/40'
                            : 'border-l-transparent'
                        )}
                      >
                        <span className="font-medium line-clamp-2 text-sm leading-snug">{group.title}</span>
                      </button>
                    )}
                    {/* Trash icon — hover only, skipped during confirmation */}
                    {confirmDeleteId !== group.id && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(group.id); }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded text-muted-foreground hover:text-destructive"
                        title="Delete conversation"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                )))}
              </div>

              {conversations.length > 20 && !showAllConversations && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full mt-2 text-[10px] text-muted-foreground hover:text-foreground"
                  onClick={() => setShowAllConversations(true)}
                >
                  Show older conversations ({conversations.length - 20} more)
                </Button>
              )}

              {(!isHistoryLoading && conversations.length === 0) && <p className="py-3 text-xs text-muted-foreground italic text-center">No history yet</p>}
            </div>
          </div>
        </ScrollArea>
      </div>

      {/* Column 2 — Chat, fills all remaining space */}
      <div className="flex flex-col flex-1 min-w-0 h-full overflow-hidden">
          {/* Top Bar */}
          <header className="flex items-center justify-between border-b px-4 py-3 shrink-0 bg-background/80 backdrop-blur-md">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={onBack} title="Back to Dashboard" className="h-8 w-8 rounded-full">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)} 
                className={cn("h-8 w-8", sidebarCollapsed && "text-primary bg-primary/10")} 
                title={sidebarCollapsed ? "Show History" : "Hide History"}
              >
                <PanelLeft className="h-4 w-4" />
              </Button>
              <div className="flex items-center gap-2.5 ml-1">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 border border-primary/20">
                  <Hexagon className="h-4 w-4 text-primary rotate-90" />
                </div>
                <div>
                  <h1 className="text-sm font-bold leading-none">Mentat Tutor</h1>
                  <p className="text-[10px] text-muted-foreground mt-1 line-clamp-1">
                    {displaySubject.charAt(0).toUpperCase() + displaySubject.slice(1).toLowerCase()} • {selectedTopic}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Mobile Study Tools button — only visible below md */}
              <Sheet open={toolsSheetOpen} onOpenChange={setToolsSheetOpen}>
                <SheetTrigger asChild>
                  <Button variant="outline" size="sm" className="md:hidden h-8 rounded-full gap-1.5 px-3 text-[11px] font-bold font-mono tracking-tighter" title="Study Tools">
                    ⚡ Tools
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-[85vw] sm:w-[380px] p-0 overflow-y-auto">
                  <SheetHeader className="p-4 border-b text-left sm:text-left">
                    <SheetTitle>Study Tools</SheetTitle>
                    <SheetDescription>Tap a tool to launch it.</SheetDescription>
                  </SheetHeader>
                  <div className="grid grid-cols-2 gap-3 p-4">
                    {[
                      { label: 'Quick Quiz', icon: <Zap className="h-6 w-6" />, color: 'bg-blue-500/10 text-blue-600', action: () => handleTriggerAction({ action: 'trigger_quiz', topic: selectedTopic || 'General' }, false) },
                      { label: 'Smart Cards', icon: <Layers className="h-6 w-6" />, color: 'bg-purple-500/10 text-purple-600', action: () => handleTriggerAction({ action: 'trigger_flashcards', topic: selectedTopic || 'General' }, false) },
                      { label: 'Concept Map', icon: <GitBranch className="h-6 w-6" />, color: 'bg-emerald-500/10 text-emerald-600', action: () => handleTriggerAction({ action: 'trigger_visualizer', topic: selectedTopic || 'General' }, false) },
                      { label: 'Mock Exam', icon: <ClipboardList className="h-6 w-6" />, color: 'bg-orange-500/10 text-orange-600', action: () => handleTriggerAction({ action: 'trigger_cbt', topic: 'Full Exam' }, false) },
                      { label: 'Knowledge Vault', icon: <BookOpen className="h-6 w-6" />, color: 'bg-slate-500/10 text-slate-600', action: () => setIsDocumentUploadOpen(true), fullWidth: true },
                    ].map(({ label, icon, color, action, fullWidth }) => (
                      <button key={label} onClick={() => { setToolsSheetOpen(false); action(); }}
                        className={cn(
                          "flex flex-col items-center justify-center gap-2 p-4 rounded-2xl border bg-card hover:bg-muted/50 transition-colors text-center shadow-sm",
                          fullWidth && "col-span-2 flex-row text-left justify-start"
                        )}
                      >
                        <div className={`h-11 w-11 shrink-0 rounded-xl flex items-center justify-center ${color}`}>{icon}</div>
                        <span className="text-xs font-bold">{label}</span>
                      </button>
                    ))}
                  </div>
                </SheetContent>
              </Sheet>

              {quotaInfo && (
                <div className={cn(
                  "hidden lg:flex items-center gap-1.5 px-2 py-1 rounded-full border text-[10px] font-medium transition-colors",
                  quotaInfo.remaining <= 5
                    ? "bg-orange-50 border-orange-200 text-orange-600"
                    : "bg-muted/30 border-border text-muted-foreground"
                )}>
                  <Rocket className={cn("h-3 w-3", quotaInfo.remaining <= 5 && "animate-pulse")} />
                  <span title="Chat=1cr · Quiz=3cr · Concept Map=5cr">{quotaInfo.used}/{quotaInfo.limit} Credits</span>
                </div>
              )}
              {streak > 0 && (
                <Badge variant="outline" className="gap-1 border-orange-200 bg-orange-50 text-orange-600 animate-pulse">
                  <Flame className="h-3 w-3" /> {streak}
                </Badge>
              )}
            </div>
          </header>

          {/* Message area — always fills space between header and input */}
          <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4" ref={scrollRef}>
            <ScrollArea className="h-full">
              <div className="space-y-6 py-6">
              {!isContextReady ? (
                <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
                  <Loader2 className="h-8 w-8 animate-spin text-primary opacity-50" />
                  <DynamicLoadingText className="text-primary/70" />
                </div>
              ) : interactions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center space-y-6">
                  <div className="h-16 w-16 rounded-3xl bg-primary/5 flex items-center justify-center border border-primary/10">
                    <Hexagon className="h-8 w-8 text-primary/40 rotate-90" />
                  </div>
                  <div className="space-y-2 max-w-sm">
                    <h2 className="text-xl font-bold tracking-tight">{greeting}</h2>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      I'm your AI Orchestrator. Ask me to explain a concept, or just start a quiz from the panel on the right.
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  {interactions.map((msg, i) => (
                    <div key={i} className={cn("flex gap-3 w-full", msg.role === 'student' ? "justify-end" : "justify-start")}>
                      {msg.role === 'tutor' && msg.content && (
                        <div className="h-8 w-8 rounded-full border bg-muted flex items-center justify-center shrink-0 mt-1">
                          <Hexagon className="h-3.5 w-3.5 text-primary rotate-90" />
                        </div>
                      )}

                      <div className={cn(
                        "group relative",
                        msg.role === 'student'
                          ? "max-w-[75%] rounded-2xl px-4 py-3 bg-primary text-primary-foreground rounded-br-none shadow-sm break-words"
                          : "max-w-none flex-1 min-w-0 py-1"
                      )}>
                        <div className={cn(
                          "text-sm prose prose-sm dark:prose-invert max-w-none break-words overflow-wrap-anywhere prose-pre:overflow-x-auto",
                          msg.role === 'student' ? "text-primary-foreground" : "text-foreground"
                        )}>
                          <LatexRenderer content={msg.content.replace(/```json\s*\{[\s\S]*?"action"[\s\S]*?\}\s*```/g, '').replace(/\{[\s\S]*?"action"[\s\S]*?:[\s\S]*?"trigger_[^}]*\}\s*/g, '').trim()} />
                        </div>

                        {msg.role === 'tutor' && (
                          <div className="mt-2 flex flex-col gap-3 group/actions">
                            {/* CTA Section — Limited to one best action */}
                            {i === interactions.length - 1 && !loading && (
                              <div className="flex flex-wrap gap-2 mt-2">
                                {(() => {
                                  const cta = getBestCTA(msg.content);
                                  const IconMap: Record<string, any> = {
                                    trigger_quiz: Zap,
                                    trigger_flashcards: Layers,
                                    trigger_visualizer: GitBranch,
                                    trigger_cbt: ClipboardList
                                  };
                                  const Icon = IconMap[cta.action] || Zap;
                                  
                                  return (
                                    <Button 
                                      variant="secondary" 
                                      size="sm" 
                                      className="h-9 px-4 text-xs gap-2 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 border-none transition-all shadow-sm"
                                      onClick={() => handleTriggerAction({ action: cta.action, topic: selectedTopic || 'the current topic' })}
                                    >
                                      <Icon className="h-4 w-4" /> {cta.label}
                                    </Button>
                                  );
                                })()}
                              </div>
                            )}

                            {/* Toolbar — Icon only actions */}
                            <div className="flex items-center gap-1 opacity-0 group-hover/actions:opacity-100 transition-opacity pt-2 border-t border-border/10">
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted"
                                onClick={() => handleCopy(msg.id!, msg.content)}
                                title="Copy response"
                              >
                                {copiedId === msg.id ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                              </Button>
                              <div className="flex items-center gap-0.5 ml-auto border-l pl-2 border-border/20">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className={cn("h-8 w-8 transition-colors", feedbackState[msg.id!] === 'positive' ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-primary hover:bg-primary/5")}
                                  onClick={() => {
                                      if (feedbackState[msg.id!]) return;
                                      msg.id && submitFeedback(msg.id, 'positive');
                                      if (msg.id) setFeedbackState(p => ({ ...p, [msg.id]: 'positive' }));
                                  }}
                                  title="Handy"
                                >
                                  <ThumbsUp className={cn("h-3.5 w-3.5", feedbackState[msg.id!] === 'positive' && "fill-current")} />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className={cn("h-8 w-8 transition-colors", feedbackState[msg.id!] === 'negative' ? "text-destructive bg-destructive/10" : "text-muted-foreground hover:text-destructive hover:bg-destructive/5")}
                                  onClick={() => {
                                      if (feedbackState[msg.id!]) return;
                                      msg.id && submitFeedback(msg.id, 'negative');
                                      if (msg.id) setFeedbackState(p => ({ ...p, [msg.id]: 'negative' }));
                                  }}
                                  title="Not helpful"
                                >
                                  <ThumbsDown className={cn("h-3.5 w-3.5", feedbackState[msg.id!] === 'negative' && "fill-current")} />
                                </Button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {msg.role === 'student' && (
                        <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center shrink-0 mt-1">
                          <User className="h-4 w-4 text-primary-foreground" />
                        </div>
                      )}
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
                  <div className="flex items-center gap-1.5 h-8 mt-1">
                    <ThreeDotsLoader />
                    <span className="text-[10px] text-muted-foreground animate-pulse font-medium">Mentat is thinking...</span>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
          </div>

          {/* Input Area (Persistent) */}
          <div className="shrink-0 border-t border-border px-4 py-3 bg-background">
            <div>
              <div className="relative flex gap-2 items-end">
                {speechSupported && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn("h-11 w-11 rounded-xl shrink-0 transition-colors z-10", isListening ? "text-red-500 bg-red-500/10 animate-pulse" : "text-muted-foreground hover:bg-muted/50")}
                    onPointerDown={(e) => { e.preventDefault(); handleVoiceToggle(); }}
                  >
                    <Mic className="h-5 w-5 pointer-events-none" />
                  </Button>
                )}
                <Textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask Mentat..."
                  className="min-h-[44px] max-h-32 rounded-xl text-[16px] md:text-sm py-3 flex-1 bg-muted/30 border-none shadow-none focus-visible:ring-1 focus-visible:ring-primary/20"
                  rows={1}
                />

                <Button
                  onClick={handleSend}
                  disabled={!input.trim() || loading}
                  className="h-11 w-11 rounded-xl shrink-0"
                  size="icon"
                >
                  <Send className="h-5 w-5" />
                </Button>
              </div>
              <p className="text-[10px] text-center text-muted-foreground mt-3 opacity-60">
                AI can make mistakes. Verify important info.
              </p>
              {/* Subject Switcher Removed from bottom */}
            </div>
          </div>
        </div>

      {/* Column 3 — Studio Panel, DYNAMIC width (Strip, Hub, or Tool) */}
      <div className={cn(
        "flex-col border-l transition-all duration-300 shrink-0",
        orchestratorAction 
          ? "absolute inset-0 z-50 flex bg-background md:relative md:bg-muted/10 md:w-1/2" 
          : "hidden md:flex md:bg-muted/10",
        !orchestratorAction && (studyToolsCollapsed ? "w-16" : "w-80")
      )}>

          {/* Collapsed icon strip OR Hub View (Visible when no tool is active) */}
          {!orchestratorAction && (
            <div className="flex flex-col h-full bg-slate-50/50 dark:bg-slate-900/30">
              {/* Header with expand/collapse toggle */}
              <div className="p-4 border-b flex items-center justify-between min-h-[64px]">
                {!studyToolsCollapsed && (
                  <div className="animate-in fade-in slide-in-from-left-2 duration-300">
                    <h2 className="text-sm font-bold tracking-tight">Studio Hub</h2>
                    <p className="text-[10px] text-muted-foreground">Browse study tools</p>
                  </div>
                )}
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={toggleStudyTools} 
                  className={cn("h-8 w-8 rounded-full", studyToolsCollapsed ? "mx-auto" : "")}
                >
                  <PanelLeft className={cn("h-4 w-4 transition-transform", studyToolsCollapsed ? "rotate-180" : "")} />
                </Button>
              </div>

              {/* Tools List */}
              <div className={cn(
                "flex flex-col gap-3 p-4 overflow-y-auto flex-1 scrollbar-hide",
                studyToolsCollapsed ? "items-center" : ""
              )}>
                {[
                  { id: 'trigger_quiz', label: 'Quick Quiz', icon: <Lightning weight="duotone" className="h-5 w-5" />, color: 'bg-blue-500/10 text-blue-600', desc: 'Personalized practice' },
                  { id: 'trigger_flashcards', label: 'Smart Cards', icon: <Cards weight="duotone" className="h-5 w-5" />, color: 'bg-purple-500/10 text-purple-600', desc: 'Active recall' },
                  { id: 'trigger_visualizer', label: 'Concept Map', icon: <TreeStructure weight="duotone" className="h-5 w-5" />, color: 'bg-emerald-500/10 text-emerald-600', desc: 'Visual logic' },
                  { id: 'trigger_cbt', label: 'Mock Exam', icon: <ClipboardText weight="duotone" className="h-5 w-5" />, color: 'bg-orange-500/10 text-orange-600', desc: 'Full simulation' },
                  { id: 'vault', label: 'Knowledge Vault', icon: <Books weight="duotone" className="h-5 w-5" />, color: 'bg-slate-500/10 text-slate-600', desc: 'Your materials' },
                ].map((tool) => (
                  <button
                    key={tool.id}
                    title={tool.label}
                    onClick={() => {
                      if (tool.id === 'vault') setIsDocumentUploadOpen(true);
                      else handleTriggerAction({ action: tool.id, topic: selectedTopic || 'General' }, false);
                    }}
                    className={cn(
                      "group flex items-center gap-3 rounded-xl border bg-card/50 transition-all hover:bg-primary/[0.03] hover:border-primary/30",
                      studyToolsCollapsed ? "h-12 w-12 justify-center" : "p-3 w-full"
                    )}
                  >
                    <div className={cn(
                      "flex items-center justify-center shrink-0 rounded-lg group-hover:scale-110 transition-transform",
                      tool.color,
                      studyToolsCollapsed ? "h-9 w-9" : "h-10 w-10"
                    )}>
                      {tool.icon}
                    </div>
                    {!studyToolsCollapsed && (
                      <div className="text-left animate-in fade-in slide-in-from-left-2 duration-300">
                        <p className="text-xs font-bold leading-none">{tool.label}</p>
                        <p className="text-[10px] text-muted-foreground mt-1">{tool.desc}</p>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Study Tools Header — only when an active tool is running */}
          {orchestratorAction && (
            <div className="flex items-center justify-between px-4 py-3 border-b bg-background/50">
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={handleClearAction} title="Close Tool">
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <span className="text-xs font-bold uppercase tracking-widest text-primary">Live Tool: {orchestratorAction.action.replace('trigger_', '')}</span>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={handleClearAction}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}

          {/* Expanded tool content (Visible when tool is active) */}
          {orchestratorAction && (
          <div className="relative flex-1 h-full flex flex-col overflow-y-auto scrollbar-hide">
            <Suspense fallback={<div className="flex-1 flex items-center justify-center bg-slate-50/50 dark:bg-slate-900/30"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
              {orchestratorAction?.action === 'trigger_quiz' ? (
                <QuizController
                  initialSubject={subject}
                  initialTopic={orchestratorAction.topic}
                  onBack={handleClearAction}
                  onComplete={(res) => ingestToolResult('quiz', res)}
                />
              ) : orchestratorAction?.action === 'trigger_flashcards' ? (
                <FlashcardController
                  initialSubject={subject}
                  onBack={handleClearAction}
                  onComplete={(res) => ingestToolResult('flashcards', res)}
                />
              ) : orchestratorAction?.action === 'trigger_cbt' ? (
                <CBTSimulator
                  onBack={handleClearAction}
                  onComplete={(res) => ingestToolResult('cbt', res)}
                />
              ) : orchestratorAction?.action === 'trigger_visualizer' ? (
                <ConceptVisualizer subject={subject} onBack={handleClearAction} activeFocusId={visualSignal} />
              ) : (
              /* Study Tools hub */
              <div className="flex-1 flex flex-col overflow-y-auto bg-slate-50/50 dark:bg-slate-900/30 scrollbar-hide">
                <div className="p-4 border-b">
                  <h2 className="text-sm font-bold tracking-tight">Study Tools</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">Select a tool or let Mentat launch one.</p>
                </div>

                {/* 2-column card grid */}
                <div className="grid grid-cols-2 gap-3 p-4">
                  {[
                    {
                      label: 'Quick Quiz',
                      desc: 'Test yourself on any topic with questions that adapt to your level.',
                      icon: <Lightning weight="duotone" className="h-5 w-5" />,
                      color: 'bg-blue-500/10 text-blue-600',
                      span: '',
                      onClick: () => triggerAction({ action: 'trigger_quiz', topic: selectedTopic || 'General' }),
                    },
                    {
                      label: 'Smart Cards',
                      desc: 'Active recall flashcards built from your syllabus.',
                      icon: <Cards weight="duotone" className="h-5 w-5" />,
                      color: 'bg-purple-500/10 text-purple-600',
                      span: '',
                      onClick: () => triggerAction({ action: 'trigger_flashcards', topic: selectedTopic || 'General' }),
                    },
                    {
                      icon: <TreeStructure weight="duotone" className="h-5 w-5" />,
                      color: 'bg-emerald-500/10 text-emerald-600',
                      span: '',
                      onClick: () => {
                        clearVisualSignal();
                        triggerAction({ action: 'trigger_visualizer', topic: selectedTopic || 'General' });
                      },
                    },
                    {
                      label: 'Mock Exam',
                      desc: 'Full exam simulation — 4 subjects, timed, JAMB format.',
                      icon: <ClipboardText weight="duotone" className="h-5 w-5" />,
                      color: 'bg-orange-500/10 text-orange-600',
                      span: '',
                      onClick: () => {
                        if (onNavigate) onNavigate('cbt');
                      },
                    },
                    {
                      label: 'Knowledge Vault',
                      desc: 'Upload your notes and textbooks to give Mentat deeper context.',
                      icon: <Books weight="duotone" className="h-5 w-5" />,
                      color: 'bg-slate-500/10 text-slate-600',
                      span: 'col-span-2',
                      onClick: () => setIsDocumentUploadOpen(true),
                    },
                  ].map(({ label, desc, icon, color, span, onClick }) => (
                    <button
                      key={label}
                      onClick={onClick}
                      className={`group flex flex-col gap-3 p-4 rounded-xl border bg-card hover:bg-primary/[0.03] hover:border-primary/30 transition-all text-left hover:shadow-sm ${span}`}
                    >
                      <div className={`h-9 w-9 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform ${color}`}>
                        {icon}
                      </div>
                      <div>
                        <p className="text-sm font-semibold leading-snug">{label}</p>
                        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
            </Suspense>
          </div>
        )}
      </div>

      {/* Full-screen Overlays with independent Suspense for chunking */}
      <Suspense fallback={<div className="fixed inset-0 z-[100] bg-background/50 backdrop-blur-sm flex items-center justify-center"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>}>
        {orchestratorAction?.action === 'trigger_quiz_overlay' && (
          <div className="fixed inset-0 z-[100] bg-background animate-in fade-in duration-300">
            <QuizController 
              onBack={handleClearAction}
              initialSubject={subject}
              initialTopic={orchestratorAction.topic || selectedTopic || undefined}
            />
          </div>
        )}

        {orchestratorAction?.action === 'trigger_flashcards_overlay' && (
          <div className="fixed inset-0 z-[100] bg-background animate-in fade-in duration-300">
            <FlashcardController
              onBack={handleClearAction}
              initialSubject={subject}
            />
          </div>
        )}

        {orchestratorAction?.action === 'trigger_cbt_overlay' && (
          <div className="fixed inset-0 z-[100] bg-background animate-in slide-in-from-bottom duration-500">
            <CBTSimulator
              onBack={handleClearAction}
            />
          </div>
        )}
      </Suspense>

      <DocumentUploadModal
        isOpen={isDocumentUploadOpen}
        onClose={() => setIsDocumentUploadOpen(false)}
        initialSubject={subject}
        activeSources={context?.userUploads}
        onUploadComplete={() => setIsDocumentUploadOpen(false)}
      />
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
    </div>
  );
}
