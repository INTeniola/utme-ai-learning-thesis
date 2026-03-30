import { LatexRenderer } from '@/components/study/LatexRenderer';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from '@/components/ui/use-toast';
import { useCBTExam } from '@/hooks/useCBTExam';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { cleanQuestionText } from '@/lib/textUtils';
import { cn } from '@/lib/utils';
import {
    AlertTriangle,
    Calculator,
    Check,
    ChevronLeft,
    ChevronRight,
    Clock,
    Flag,
    Loader2,
    Play,
    Save,
    ShieldX,
    Target,
    Menu,
} from 'lucide-react';
import { ClipboardText } from '@phosphor-icons/react';
import { QuizantLogo } from '@/components/ui/QuizantLogo';
import { useEffect, useState } from 'react';
import { CBTCalculator } from './CBTCalculator';
import { CBTQuestionPalette } from './CBTQuestionPalette';
import { DiagnosticReport } from './DiagnosticReport';

interface CBTSimulatorProps {
  onBack: () => void;
  onComplete?: (result: any) => void;
}

// English is mandatory in JAMB — pick exactly 3 additional subjects
// Subject names MUST match exactly what is stored in the DB (case-sensitive)
const OTHER_SUBJECTS: { dbName: string; label: string }[] = [
  { dbName: 'Physics', label: 'Physics' },
  { dbName: 'Chemistry', label: 'Chemistry' },
  { dbName: 'Biology', label: 'Biology' },
  { dbName: 'Mathematics', label: 'Mathematics' },
  { dbName: 'Government', label: 'Government' },
  { dbName: 'Economics', label: 'Economics' },
  { dbName: 'Literature', label: 'Literature in English' },
  { dbName: 'Crs', label: 'Christian Religious Studies' },
  { dbName: 'Commerce', label: 'Commerce' },
  { dbName: 'Accounting', label: 'Accounting' },
  { dbName: 'Agricultural Science', label: 'Agricultural Science' },
];
const JAMB_TOTAL_QUESTIONS = 180; // 60 English + 40×3 others


export function CBTSimulator({ onBack, onComplete }: CBTSimulatorProps) {
  const [otherSubjects, setOtherSubjects] = useState<string[]>([]);
  const [profileSubjects, setProfileSubjects] = useState<string[]>([]);
  const [selectedYear, setSelectedYear] = useState<number | 'random'>('random');
  const [profileLoading, setProfileLoading] = useState(true);
  const [showCalculator, setShowCalculator] = useState(false);
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [showAbandonDialog, setShowAbandonDialog] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  const {
    loading,
    session,
    questions,
    currentQuestion,
    currentIndex,
    answers,
    remainingTime,
    answeredCount,
    isSubmitting,
    diagnosticData,
    examTerminated,
    resetExamTerminated,
    startExam,
    selectAnswer,
    goToQuestion,
    submitExam,
    abandonExam,
  } = useCBTExam();

  // Load user profile to filter subjects
  useEffect(() => {
    async function loadProfile() {
      if (!user) return;
      try {
        const { data } = await supabase
          .from('profiles')
          .select('subjects_meta')
          .eq('id', user.id)
          .single();
        
        if (data?.subjects_meta && typeof data.subjects_meta === 'object') {
          const meta = data.subjects_meta as { selectedSubjects?: string[] };
          if (meta.selectedSubjects) {
            setProfileSubjects(meta.selectedSubjects.map(s => s.toLowerCase()));
          }
        }
      } catch (err) {
        console.error("Failed to load profile subjects:", err);
      } finally {
        setProfileLoading(false);
      }
    }
    loadProfile();
  }, [user]);

  // Warn before browser close/refresh during exam
  useEffect(() => {
    if (!session || session.status !== 'in_progress') return;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = 'Your exam will be lost if you leave. Are you sure?';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [session]);

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const toggleOther = (subject: string) => {
    setOtherSubjects(prev =>
      prev.includes(subject) ? prev.filter(s => s !== subject) : [...prev, subject]
    );
  };

  const allSelected = ['English', ...otherSubjects];
  const canStart = otherSubjects.length >= 1 && otherSubjects.length <= 3;

  const handleStartExam = async () => {
    if (!canStart) return;
    // Standard JAMB is 120 mins for 4 subjects. (30 mins per subject)
    const timeLimit = (allSelected.length) * 30;
    
    try {
      await startExam(allSelected, timeLimit, selectedYear);
    } catch (err: any) {
      toast({ 
        variant: "destructive", 
        title: "Session Initialization Failed", 
        description: err?.message || "Verify your connection. Our question archive may be temporarily synchronized." 
      });
    }
  };

  const handleSubmitExam = async () => {
    await submitExam();
    toast({ description: 'Exam submitted successfully.' });
    setShowSubmitDialog(false);
    if (onComplete && diagnosticData) {
      onComplete(diagnosticData);
    }
  };

  const handleAbandon = () => {
    abandonExam();
    setShowAbandonDialog(false);
  };

  // Subject sections for palette (computed from questions grouped by subject)
  const subjectSections = session
    ? allSelected.map(subj => ({
      subject: subj,
      count: questions.filter(q => q.subject === subj).length,
    })).filter(s => s.count > 0)
    : [];

  // Filter OTHER_SUBJECTS to only those the user has in their profile (excluding English)
  const filteredAvailableSubjects = OTHER_SUBJECTS.filter(s => 
    profileSubjects.includes(s.dbName.toLowerCase()) && s.dbName.toLowerCase() !== 'english'
  );

  // ── Exam Terminated Screen ───────────────────────────────────────────────
  if (examTerminated) {
    return (
      <div className="flex min-h-[80vh] flex-col items-center justify-center gap-6 px-4 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-destructive/10">
          <ShieldX className="h-10 w-10 text-destructive" />
        </div>
        <div>
          <h2 className="text-xl font-bold">Exam Terminated</h2>
          <p className="mt-2 text-sm text-muted-foreground max-w-sm">
            You switched away from the exam tab. Under JAMB CBT rules, leaving the exam
            screen causes automatic termination. You must restart.
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={onBack}>Back to Dashboard</Button>
          <Button onClick={resetExamTerminated}>Try Again</Button>
        </div>
      </div>
    );
  }

  // ── Diagnostic Report ───────────────────────────────────────────────────
  if (session?.status === 'completed' && diagnosticData) {
    return (
      <DiagnosticReport
        diagnostic={diagnosticData}
        questions={questions}
        answers={answers}
        onBack={onBack}
      />
    );
  }

  // ── Subject Selection Screen ─────────────────────────────────────────────
  if (!session) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col">
        {/* HackerRank-style Header */}
        <header className="border-b border-border bg-card px-6 py-4 flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="p-2 rounded-full hover:bg-muted transition-colors"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-xl font-black tracking-tight flex items-center gap-2">
                <ClipboardText weight="duotone" className="h-6 w-6 text-orange-500" />
                JAMB UTME Mock Examination
              </h1>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Standard CBT Simulation</p>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-2 text-sm font-medium text-muted-foreground bg-muted/30 px-4 py-2 rounded-full">
            <Clock className="h-4 w-4" />
            <span>{(allSelected.length) * 30} mins total time</span>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 max-w-7xl mx-auto w-full p-6 grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left Column: Subject Configuration */}
          <div className="lg:col-span-8 space-y-8">
            <div className="rounded-2xl border border-border bg-card p-8 shadow-sm">
              <div className="mb-6 border-b border-border pb-4">
                <h2 className="text-xl font-bold">1. Select Subject Combination</h2>
                <p className="text-sm text-muted-foreground mt-1">English is mandatory. Select between 1 and 3 core electives based on your intended course of study.</p>
              </div>

              {/* Year Selection Section */}
              <div className="mb-8 p-4 rounded-xl border border-border bg-muted/20">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-100 text-orange-600">
                      <Clock className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm">Question Source Year</h3>
                      <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">JAMB Past Series</p>
                    </div>
                  </div>
                  <Select 
                    value={selectedYear.toString()} 
                    onValueChange={(val) => setSelectedYear(val === 'random' ? 'random' : parseInt(val))}
                  >
                    <SelectTrigger className="w-full sm:w-[180px] h-10 border-2 font-bold focus:ring-orange-500">
                      <SelectValue placeholder="Select Year" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="random">Mixed (Random Years)</SelectItem>
                      {[2024, 2023, 2022, 2021, 2020, 2019, 2018, 2017, 2016, 2015, 2014, 2013, 2012, 2011, 2010].map(y => (
                        <SelectItem key={y} value={y.toString()}>JAMB {y} Series</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="space-y-4">
                {/* Mandatory English Row */}
                <div className="flex items-center justify-between p-4 rounded-xl border-2 border-primary/20 bg-primary/5">
                  <div className="flex items-center gap-4">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <Check className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg">Use of English</h3>
                      <p className="text-xs text-muted-foreground uppercase font-semibold">60 Questions • Core Requirement</p>
                    </div>
                  </div>
                  <Badge className="bg-primary hover:bg-primary text-primary-foreground font-black tracking-widest uppercase text-[10px]">Mandatory</Badge>
                </div>

                {/* Electives List */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  {profileLoading ? (
                    <div className="col-span-full py-8 flex items-center justify-center text-muted-foreground">
                      <Loader2 className="h-5 w-5 animate-spin mr-2" /> Syncing profile...
                    </div>
                  ) : filteredAvailableSubjects.length === 0 ? (
                    <div className="col-span-full py-8 text-center bg-muted/30 rounded-xl border border-dashed border-border text-sm text-muted-foreground">
                      No elective subjects found in your profile.
                    </div>
                  ) : (
                    filteredAvailableSubjects.map(({ dbName, label }) => {
                      const checked = otherSubjects.includes(dbName);
                      const disabled = !checked && otherSubjects.length >= 3;
                      
                      return (
                        <div
                          key={dbName}
                          onClick={() => !disabled && toggleOther(dbName)}
                          className={cn(
                            "group cursor-pointer flex items-center gap-4 p-4 rounded-xl border-2 transition-all duration-200",
                            checked ? "border-primary bg-primary/5" : "border-border hover:border-primary/30",
                            disabled && "opacity-50 cursor-not-allowed grayscale"
                          )}
                        >
                          <div className={cn(
                            "flex h-6 w-6 shrink-0 items-center justify-center rounded border-2 transition-colors",
                            checked ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/30"
                          )}>
                            {checked && <Check className="h-4 w-4" />}
                          </div>
                          <div>
                            <h3 className={cn("font-bold", checked ? "text-primary" : "text-foreground")}>{label}</h3>
                            <p className="text-xs text-muted-foreground uppercase font-semibold">40 Questions</p>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
            
            <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <h3 className="font-black uppercase tracking-widest text-destructive text-sm flex items-center gap-2 mb-3">
                <AlertTriangle className="h-4 w-4" /> Assessment Integrity Rules
              </h3>
              <p className="text-sm text-destructive/80 font-medium leading-relaxed">
                This environment strictly simulates the JAMB CBT system. Leaving the exam screen, refreshing the browser, or opening new tabs will trigger an automatic session termination. Ensure you have a stable connection before proceeding.
              </p>
            </div>
          </div>

          {/* Right Column: CTA & Summary */}
          <div className="lg:col-span-4">
            <div className="sticky top-24 rounded-2xl border border-border bg-card shadow-lg shadow-background/5 overflow-hidden">
              <div className="p-6 border-b border-border bg-muted/10">
                <h2 className="font-black text-lg">Readiness Check</h2>
                <p className="text-xs text-muted-foreground mt-1">Review your configuration.</p>
              </div>
              
              <div className="p-6 space-y-6">
                <div className="space-y-3">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground font-semibold">Total Subjects</span>
                    <span className="font-black text-lg">{1 + otherSubjects.length}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground font-semibold">Total Questions</span>
                    <span className="font-black text-lg">{60 + otherSubjects.length * 40}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm pt-3 border-t border-border">
                    <span className="text-muted-foreground font-semibold">Time Allotted</span>
                    <span className="font-black text-primary text-xl">{(allSelected.length) * 30}<span className="text-xs ml-1 text-muted-foreground">m</span></span>
                  </div>
                </div>

                <div className="pt-4">
                  <Button
                    onClick={handleStartExam}
                    disabled={!canStart || loading || profileLoading}
                    className="w-full h-14 rounded-xl text-sm font-black uppercase tracking-widest shadow-md hover:shadow-xl transition-all"
                  >
                    {loading ? (
                      <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Initializing Sandbox...</>
                    ) : (
                      <>Start Assessment <ChevronRight className="h-4 w-4 ml-2" /></>
                    )}
                  </Button>
                  
                  {!canStart && !loading && (
                    <p className="text-[10px] text-center font-bold text-destructive uppercase mt-3 tracking-widest">
                      {otherSubjects.length === 0 
                        ? "Select at least 1 more subject" 
                        : `Select exactly ${3 - otherSubjects.length} more subject${3 - otherSubjects.length === 1 ? '' : 's'}`
                      }
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
          
        </main>
      </div>
    );
  }

  // ── Loading Spinner / Questions fetching ──────────────────────────────────────────────────────
  if (!currentQuestion) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-6 text-center animate-in fade-in duration-500">
        <div className="relative mb-8">
          <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full scale-150 animate-pulse" />
          <Loader2 className="h-16 w-16 animate-spin text-primary relative z-10" />
        </div>
        <h2 className="text-2xl font-black tracking-tighter mb-2">Simulating Environment</h2>
        <p className="text-muted-foreground font-medium max-w-xs mb-8">Synchronizing questions from the archive to match your selected subjects...</p>
        <Button 
          variant="outline" 
          onClick={abandonExam}
          className="rounded-full px-8 h-12 font-black uppercase tracking-widest text-[10px] border-border/50 hover:bg-muted transition-all"
        >
          Cancel and Go Back
        </Button>
      </div>
    );
  }

  const isTimeWarning = remainingTime <= 600; // 10 min
  const isTimeCritical = remainingTime <= 60;

  // ── Active Exam Screen ───────────────────────────────────────────────────
  return (
    <div
      className="min-h-screen bg-muted/30 select-none"
      onContextMenu={e => e.preventDefault()}
      onCopy={e => e.preventDefault()}
      onCut={e => e.preventDefault()}
    >
      {/* Header — Professional Assessment Style */}
      <header className="sticky top-0 z-50 border-b bg-background shadow-sm px-6 py-3">
        <div className="mx-auto flex max-w-screen-2xl items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <QuizantLogo className="h-6 w-6" />
              <span className="text-sm font-black tracking-tighter uppercase">Exam Portal</span>
            </div>
            
            <div className="h-6 w-[1px] bg-border hidden sm:block" />
            
            <div className="flex items-center gap-4">
              <div className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-full border bg-muted/30",
                isTimeCritical ? "border-destructive/50 bg-destructive/5" : "border-border"
              )}>
                <Clock className={cn("h-4 w-4", isTimeCritical ? "text-destructive animate-pulse" : "text-muted-foreground")} />
                <span className={cn(
                  'font-mono font-black text-sm',
                  isTimeCritical && 'text-destructive',
                  isTimeWarning && !isTimeCritical && 'text-amber-600'
                )}>
                  {formatTime(remainingTime)}
                </span>
              </div>
              
              <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full border bg-muted/30">
                <Target className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs font-bold text-muted-foreground">
                  {answeredCount} <span className="opacity-50">/</span> {questions.length} <span className="text-[10px] uppercase opacity-50 ml-1">Answered</span>
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setShowCalculator(true)} 
              className="h-9 rounded-lg gap-2 text-xs font-bold"
            >
              <Calculator className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Calculator</span>
            </Button>
            
            <Button
              variant="ghost" 
              size="sm"
              onClick={() => setShowAbandonDialog(true)}
              className="h-9 rounded-lg gap-2 text-xs font-bold text-muted-foreground hover:text-destructive hover:bg-destructive/5"
            >
              <Flag className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Abandon</span>
            </Button>
            
            <Button 
              size="sm" 
              onClick={() => setShowSubmitDialog(true)} 
              disabled={isSubmitting} 
              className="h-9 rounded-lg gap-2 px-5 bg-primary hover:bg-primary/90 font-black text-[10px] uppercase tracking-widest shadow-lg shadow-primary/20"
            >
              {isSubmitting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
              Submit Exam
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content — HackerRank Spread */}
      <div className="mx-auto max-w-screen-2xl px-6 py-6 lg:flex lg:gap-8 h-[calc(100vh-64px)] overflow-hidden">
        
        {/* Left Sidebar: Question Navigation */}
        <div className="hidden lg:flex flex-col w-72 shrink-0 border rounded-2xl bg-card overflow-hidden">
          <div className="p-4 border-b bg-muted/10">
            <h3 className="text-xs font-black uppercase tracking-widest flex items-center gap-2">
              <Menu className="h-3.5 w-3.5 text-primary" />
              Question Palette
            </h3>
          </div>
          <div className="flex-1 overflow-y-auto scrollbar-hide">
            <CBTQuestionPalette
              totalQuestions={questions.length}
              currentIndex={currentIndex}
              answers={answers}
              questionIds={questions.map(q => q.id)}
              subjectSections={subjectSections}
              onSelect={goToQuestion}
            />
          </div>
        </div>

        {/* Center: Question Workspace */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex-1 overflow-y-auto scrollbar-hide pr-2">
            <div className="mb-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-primary/10 border border-primary/20 text-primary font-black text-lg">
                  {currentIndex + 1}
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-black uppercase tracking-widest text-primary">{currentQuestion.subject}</span>
                  <span className="text-[10px] font-bold text-muted-foreground">{currentQuestion.topic}</span>
                </div>
              </div>
              <Badge variant="outline" className="rounded-md px-3 font-bold border-muted-foreground/20 text-[10px] tracking-widest uppercase">
                {currentQuestion.year} JAMB Standard
              </Badge>
            </div>

            <Card className="rounded-3xl border shadow-sm mb-6">
              <CardContent className="p-5 sm:p-10">
                <div className="mb-10 text-lg leading-relaxed sm:text-xl font-medium text-foreground/90">
                  <LatexRenderer content={cleanQuestionText(currentQuestion.questionText)} />
                </div>

                <div className="grid grid-cols-1 gap-4">
                  {(['A', 'B', 'C', 'D'] as const).map(option => {
                    const isSelected = answers[currentQuestion.id] === option;
                    return (
                      <button
                        key={option}
                        onClick={() => selectAnswer(currentQuestion.id, option)}
                        className={cn(
                          'flex w-full items-center gap-5 rounded-2xl border-2 p-5 text-left transition-all group',
                          isSelected 
                            ? 'border-primary bg-primary/5 ring-4 ring-primary/10' 
                            : 'border-transparent bg-muted/30 hover:bg-muted/50 hover:border-border'
                        )}
                      >
                        <div className={cn(
                          'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border-2 text-sm font-black transition-all',
                          isSelected 
                            ? 'border-primary bg-primary text-primary-foreground shadow-lg shadow-primary/20 scale-110' 
                            : 'border-muted-foreground/20 bg-background group-hover:border-primary/50'
                        )}>
                          {option}
                        </div>
                        <span className={cn(
                          "min-w-0 flex-1 text-base font-semibold",
                          isSelected ? "text-primary" : "text-muted-foreground"
                        )}>
                          <LatexRenderer content={currentQuestion.options[option]} />
                        </span>
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="shrink-0 pt-4 border-t mt-auto flex items-center justify-between pb-4 sticky bottom-0 bg-background z-10">
            <Button 
              variant="outline" 
              onClick={() => goToQuestion(currentIndex - 1)} 
              disabled={currentIndex === 0} 
              className="h-12 px-6 rounded-xl gap-2 font-bold transition-all hover:translate-x-[-2px]"
            >
              <ChevronLeft className="h-4 w-4" /> Previous
            </Button>
            
            <span className="hidden sm:inline-flex items-center gap-2 px-4 py-2 rounded-full bg-muted/50 border text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              Progress: {currentIndex + 1} of {questions.length}
            </span>
            
            <Button 
              variant="outline" 
              onClick={() => goToQuestion(currentIndex + 1)} 
              disabled={currentIndex === questions.length - 1} 
              className="h-12 px-6 rounded-xl gap-2 font-bold transition-all hover:translate-x-[2px]"
            >
              Next <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Mobile Palette Drawer / Right Stats (Hidden lg) */}
        <div className="lg:hidden mt-8">
          <CBTQuestionPalette
            totalQuestions={questions.length}
            currentIndex={currentIndex}
            answers={answers}
            questionIds={questions.map(q => q.id)}
            subjectSections={subjectSections}
            onSelect={goToQuestion}
          />
        </div>
      </div>

      <CBTCalculator isOpen={showCalculator} onClose={() => setShowCalculator(false)} />

      <AlertDialog open={showSubmitDialog} onOpenChange={setShowSubmitDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Submit Exam?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>You have answered {answeredCount} out of {questions.length} questions.</p>
              {answeredCount < questions.length && (
                <p className="font-medium text-yellow-600">
                  Warning: {questions.length - answeredCount} questions are unanswered!
                </p>
              )}
              <p>This action cannot be undone.</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continue Exam</AlertDialogCancel>
            <AlertDialogAction onClick={handleSubmitExam}>Submit Exam</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showAbandonDialog} onOpenChange={setShowAbandonDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Abandon Exam?</AlertDialogTitle>
            <AlertDialogDescription>
              Your progress will be lost and this cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continue Exam</AlertDialogCancel>
            <AlertDialogAction onClick={handleAbandon} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Abandon Exam
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
