import { LatexRenderer } from "@/components/study/LatexRenderer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { sanitizeQuestion } from "@/lib/textUtils";
import { cn } from "@/lib/utils";
import {
    BookmarkPlus,
    Check,
    ChevronLeft,
    ChevronRight,
    Filter,
    Lightbulb,
    RotateCcw,
    X,
    BookOpen,
    Calculator,
    Beaker,
    Atom,
    Dna,
    BarChart,
    Briefcase,
    Globe,
    History,
    Calendar,
    ArrowRight,
    Search
} from "lucide-react";
import { useEffect, useState, useMemo, useRef } from "react";
import { toast } from "sonner";

interface PastQuestion {
  id: string;
  year: number;
  subject: string;
  topic: string;
  subtopic: string | null;
  difficulty: string | null;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  metadata: any;
}

interface QuestionWithAnswer extends PastQuestion {
  userAnswer?: string;
  isCorrect?: boolean;
  correctAnswer?: string;
  explanation?: string;
}

interface PastQuestionsBrowserProps {
  onBack: () => void;
  initialSubject?: string | null;
}

type BrowserStep = 'subject' | 'year' | 'questions';

const SUBJECT_METADATA: Record<string, { icon: any, color: string, description: string }> = {
  "Mathematics": { icon: Calculator, color: "text-blue-500 bg-blue-500/10", description: "Algebra, Calculus, Geometry" },
  "English": { icon: BookOpen, color: "text-purple-500 bg-purple-500/10", description: "Comprehension, Lexis, Structure" },
  "Physics": { icon: Atom, color: "text-orange-500 bg-orange-500/10", description: "Mechanics, Optics, Electricity" },
  "Chemistry": { icon: Beaker, color: "text-emerald-500 bg-emerald-500/10", description: "Organic, Inorganic, Physical" },
  "Biology": { icon: Dna, color: "text-pink-500 bg-pink-500/10", description: "Genetics, Ecology, Physiology" },
  "Economics": { icon: BarChart, color: "text-cyan-500 bg-cyan-500/10", description: "Micro, Macro, Statistics" },
  "Commerce": { icon: Briefcase, color: "text-amber-500 bg-amber-500/10", description: "Trade, Finance, Marketing" },
  "Government": { icon: Globe, color: "text-indigo-500 bg-indigo-500/10", description: "Constitution, Politics, Rights" },
};

const SUBJECTS = Object.keys(SUBJECT_METADATA);
const YEARS = Array.from({ length: 20 }, (_, i) => 2024 - i);

const toTitleCase = (str: string) => {
  if (!str) return "";
  return str.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
};

const getSubjectMeta = (subjName: string) => {
  if (!subjName) return { icon: BookOpen, color: "text-muted-foreground bg-muted/10", description: "General Subject" };
  const normalized = toTitleCase(subjName);
  const key = Object.keys(SUBJECT_METADATA).find(k => k === normalized);
  return key ? SUBJECT_METADATA[key] : { icon: BookOpen, color: "text-muted-foreground bg-muted/10", description: "General Subject" };
};
const QUESTIONS_PER_PAGE = 10;

export function PastQuestionsBrowser({ onBack, initialSubject }: PastQuestionsBrowserProps) {
  const { user } = useAuth();
  const [step, setStep] = useState<BrowserStep>(initialSubject ? 'year' : 'subject');
  const [userSubjects, setUserSubjects] = useState<string[] | null>(null);
  const topRef = useRef<HTMLDivElement>(null);
  
  // Selection state
  const [selectedSubject, setSelectedSubject] = useState<string>(() => initialSubject ? toTitleCase(initialSubject) : "");
  const [selectedYear, setSelectedYear] = useState<string>("all");
  const [selectedTopic, setSelectedTopic] = useState<string>("all");
  
  // Data state
  const [questions, setQuestions] = useState<QuestionWithAnswer[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [availableTopics, setAvailableTopics] = useState<string[]>([]);

  // Sync initialSubject if it arrives after mount (prevents flashes)
  useEffect(() => {
    if (initialSubject && !selectedSubject) {
      const normalized = toTitleCase(initialSubject);
      setSelectedSubject(normalized);
      setStep('year');
    }
  }, [initialSubject]);

  // Answer tracking
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({});
  const [submittedQuestions, setSubmittedQuestions] = useState<Set<string>>(new Set());
  const [showExplanation, setShowExplanation] = useState<Record<string, boolean>>({});
  const [isSubmitting, setIsSubmitting] = useState<Record<string, boolean>>({});

  // Fetch topics based on selected subject
  useEffect(() => {
    async function fetchTopics() {
      if (!selectedSubject) {
        setAvailableTopics([]);
        return;
      }

      const { data } = await supabase
        .from("past_questions_public" as any)
        .select("topic")
        .eq("subject", toTitleCase(selectedSubject));

      if (data) {
        const topics = data as unknown as { topic: string }[];
        let uniqueTopics = [...new Set(topics.map((d) => d.topic).filter(Boolean))];
        // Filter out garbage English topics (comprehension passages / long instructions)
        uniqueTopics = uniqueTopics.filter(t => 
          t.length <= 60 && 
          !t.toLowerCase().includes("choose the option") &&
          !t.toLowerCase().includes("read the passage") &&
          !t.toLowerCase().includes("this question is based on")
        );
        setAvailableTopics(uniqueTopics.sort());
      }
    }
    fetchTopics();
  }, [selectedSubject]);

  // Fetch user registered subjects
  useEffect(() => {
    async function fetchUserSubjects() {
      if (!user) return;
      
      const { data, error } = await supabase
        .from('profiles')
        .select('subjects_meta')
        .eq('id', user.id)
        .single();
        
      if (!error && data?.subjects_meta) {
        const meta = data.subjects_meta as any;
        if (meta.selectedSubjects && Array.isArray(meta.selectedSubjects) && meta.selectedSubjects.length > 0) {
          setUserSubjects(meta.selectedSubjects.map((s: string) => toTitleCase(s)));
          return;
        }
      }
      
      // Fallback if no subjects selected or on error
      setUserSubjects(SUBJECTS.map(s => toTitleCase(s)));
    }
    fetchUserSubjects();
  }, [user]);

  // Fetch questions when step is 'questions'
  useEffect(() => {
    if (step !== 'questions') return;

    async function fetchQuestions() {
      setLoading(true);

      let query = supabase
        .from("past_questions_public" as any)
        .select("*");

      if (selectedSubject) query = query.eq("subject", toTitleCase(selectedSubject));
      if (selectedYear !== "all") query = query.eq("year", parseInt(selectedYear));
      if (selectedTopic !== "all") query = query.eq("topic", selectedTopic);

      const from = (currentPage - 1) * QUESTIONS_PER_PAGE;
      const to = from + QUESTIONS_PER_PAGE; // fetch one extra to check for next page

      const { data, error } = await query
        .order("year", { ascending: false })
        .order("id")
        .range(from, to);

      if (error) {
        console.error("Error fetching questions:", error);
        toast.error("Failed to load questions");
      } else {
        const results = (data as unknown as QuestionWithAnswer[]) || [];
        setHasNextPage(results.length > QUESTIONS_PER_PAGE);
        setQuestions(results.slice(0, QUESTIONS_PER_PAGE));
      }

      setLoading(false);
    }

    fetchQuestions();
  }, [step, selectedSubject, selectedYear, selectedTopic, currentPage]);

  const handleSubjectSelect = (subject: string) => {
    // Prevent state leakage between subjects
    setQuestions([]);
    setSelectedAnswers({});
    setSubmittedQuestions(new Set());
    setShowExplanation({});
    setIsSubmitting({});
    setHasNextPage(false);
    setCurrentPage(1);
    setSelectedTopic("all");
    setSelectedYear("all");

    setSelectedSubject(toTitleCase(subject));
    setStep('year');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleYearSelect = (year: string) => {
    setSelectedYear(year);
    setStep('questions');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleAnswerSelect = (questionId: string, answer: string) => {
    if (submittedQuestions.has(questionId)) return;
    setSelectedAnswers((prev) => ({ ...prev, [questionId]: answer }));
  };

  const handleSubmitAnswer = async (question: QuestionWithAnswer) => {
    const userAnswer = selectedAnswers[question.id];
    if (!userAnswer) {
      toast.error("Please select an answer first");
      return;
    }

    setIsSubmitting(prev => ({ ...prev, [question.id]: true }));

    try {
      const { data, error } = await supabase.functions.invoke("verify-exam-answers", {
        body: {
          questionIds: [question.id],
          answers: { [question.id]: userAnswer },
        },
      });

      if (error) throw error;

      const result = data?.results?.[0];
      if (result) {
        setQuestions((prev) =>
          prev.map((q) =>
            q.id === question.id
              ? {
                ...q,
                userAnswer,
                isCorrect: result.isCorrect,
                correctAnswer: result.correctAnswer,
                explanation: result.explanation,
              }
              : q
          )
        );
        setSubmittedQuestions((prev) => new Set([...prev, question.id]));
      }
    } catch (error) {
      console.error("Error verifying answer:", error);
      toast.error("Failed to verify answer");
    } finally {
      setIsSubmitting(prev => ({ ...prev, [question.id]: false }));
    }
  };

  const resetBrowser = () => {
    setStep('subject');
    setSelectedSubject("");
    setSelectedYear("all");
    setSelectedTopic("all");
    setCurrentPage(1);
    setHasNextPage(false);
  };

  const getOptionClass = (question: QuestionWithAnswer, option: string) => {
    const optionLetter = option.toUpperCase();
    const isSelected = selectedAnswers[question.id] === optionLetter;
    const isSubmitted = submittedQuestions.has(question.id);

    if (!isSubmitted) {
      return isSelected
        ? "border-primary bg-primary/5 ring-2 ring-primary"
        : "border-border hover:border-primary/50 hover:bg-muted/50";
    }

    const isCorrectAnswer = question.correctAnswer === optionLetter;
    const isUserAnswer = question.userAnswer === optionLetter;

    if (isCorrectAnswer) return "border-green-500 bg-green-50 dark:bg-green-950/30 ring-2 ring-green-500";
    if (isUserAnswer && !question.isCorrect) return "border-destructive bg-destructive/10 ring-2 ring-destructive";
    return "border-border opacity-60";
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Dynamic Header */}
      <header className="sticky top-0 z-50 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="container max-w-6xl mx-auto h-16 flex items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => {
              if (step === 'questions') setStep('year');
              else if (step === 'year') setStep('subject');
              else onBack();
            }}>
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <div className="flex flex-col">
              <h1 className="text-lg font-bold leading-none">
                {step === 'subject' && "Browse Subjects"}
                {step === 'year' && selectedSubject}
                {step === 'questions' && `${selectedSubject} (${selectedYear})`}
              </h1>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
                <span className={cn(step === 'subject' ? "text-primary font-medium" : "cursor-pointer hover:underline")} onClick={() => setStep('subject')}>Subjects</span>
                {step !== 'subject' && (
                  <>
                    <ChevronRight className="h-3 w-3" />
                    <span className={cn(step === 'year' ? "text-primary font-medium" : "cursor-pointer hover:underline")} onClick={() => setStep('year')}>Selection</span>
                  </>
                )}
                {step === 'questions' && (
                  <>
                    <ChevronRight className="h-3 w-3" />
                    <span className="text-primary font-medium">Practice</span>
                  </>
                )}
              </div>
            </div>
          </div>
          
          {/* Hide exact count badge to improve fetch performance */}
        </div>
      </header>

      <main className="container max-w-5xl mx-auto px-4 pt-8">
        {/* STEP 1: SUBJECT PICKER */}
        {step === 'subject' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="text-center space-y-2">
              <h2 className="text-3xl font-bold tracking-tight">Select a Subject</h2>
              <p className="text-muted-foreground max-w-lg mx-auto">
                Explore thousands of verified JAMB past questions organized by subject and difficulty.
              </p>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {userSubjects === null ? (
                // Skeleton Loader
                Array.from({ length: 8 }).map((_, i) => (
                  <Card key={i} className="h-48 rounded-2xl border-2">
                    <CardContent className="p-6 space-y-4">
                      <Skeleton className="h-12 w-12 rounded-xl" />
                      <Skeleton className="h-6 w-32" />
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-3 w-20 pt-4" />
                    </CardContent>
                  </Card>
                ))
              ) : (
                userSubjects.map((subject) => {
                  const meta = getSubjectMeta(subject);
                  const Icon = meta.icon;
                  return (
                    <Card 
                      key={subject}
                      className="group cursor-pointer hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300"
                      onClick={() => handleSubjectSelect(subject)}
                    >
                      <CardContent className="p-6">
                        <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110", meta.color)}>
                          <Icon className="h-6 w-6" />
                        </div>
                        <h3 className="font-bold text-lg mb-1">{subject}</h3>
                        <p className="text-xs text-muted-foreground mb-4">{meta.description}</p>
                        <div className="flex items-center text-primary text-xs font-semibold">
                          View Exams <ArrowRight className="h-3 w-3 ml-1 group-hover:translate-x-1 transition-transform" />
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* STEP 2: YEAR/TOPIC PICKER */}
        {step === 'year' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
            <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div className="space-y-1">
                <Badge className={cn("mb-2", getSubjectMeta(selectedSubject).color)}>Selected Subject</Badge>
                <h2 className="text-3xl font-bold">{selectedSubject} Archives</h2>
                <p className="text-muted-foreground">Select an exam year to begin practicing or filter by topic.</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => handleYearSelect("all")}>
                View All Questions
              </Button>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-6">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <Calendar className="h-4 w-4" /> Exam Years
                </h3>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                  {YEARS.map(year => (
                    <Button
                      key={year}
                      variant="outline"
                      className="h-16 flex flex-col items-center justify-center gap-1 hover:border-primary hover:bg-primary/5"
                      onClick={() => handleYearSelect(year.toString())}
                    >
                      <span className="text-lg font-bold">{year}</span>
                      <span className="text-[10px] uppercase text-muted-foreground">Exam</span>
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <Search className="h-4 w-4" /> Filter by Topic
                </h3>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex flex-wrap gap-2">
                      <Badge 
                        variant={selectedTopic === "all" ? "default" : "outline"} 
                        className="cursor-pointer py-1.5 px-3"
                        onClick={() => setSelectedTopic("all")}
                      >
                        All Topics
                      </Badge>
                      {availableTopics.slice(0, 15).map(topic => (
                        <Badge 
                          key={topic}
                          variant={selectedTopic === topic ? "default" : "outline"} 
                          className="cursor-pointer py-1.5 px-3"
                          onClick={() => {
                            setSelectedTopic(topic);
                            setStep('questions');
                          }}
                        >
                          {topic}
                        </Badge>
                      ))}
                    </div>
                    {availableTopics.length > 15 && (
                      <p className="text-xs text-muted-foreground mt-4 text-center italic">
                        + {availableTopics.length - 15} more topics available in filter menu
                      </p>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: QUESTIONS FEED */}
        {step === 'questions' && (
          <div ref={topRef} className="space-y-6 max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500 pt-4 scroll-mt-24">
            {/* Context bar / Filter override */}
            <div className="flex items-center justify-between p-4 bg-muted/40 rounded-2xl border mb-6">
              <div className="flex items-center gap-4">
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">Active Filters</span>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="secondary" className="font-normal">{selectedSubject}</Badge>
                    <Badge variant="secondary" className="font-normal">{selectedYear === 'all' ? 'All Years' : selectedYear}</Badge>
                    {selectedTopic !== 'all' && <Badge variant="secondary" className="font-normal">{selectedTopic}</Badge>}
                  </div>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setStep('year')} className="text-xs text-primary">
                Change Filters
              </Button>
            </div>

            {loading ? (
              <div className="space-y-6">
                {[1, 2, 3].map((i) => (
                  <Card key={i} className="rounded-2xl border-2">
                    <CardContent className="p-6 space-y-4">
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="h-20 w-full" />
                      <div className="space-y-2">
                        <Skeleton className="h-14 w-full rounded-xl" />
                        <Skeleton className="h-14 w-full rounded-xl" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : questions.length === 0 ? (
              <Card className="rounded-2xl border-dashed border-2 p-12 text-center">
                <CardContent className="space-y-4">
                  <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto">
                    <Search className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-xl font-bold">No Questions Found</h3>
                  <p className="text-muted-foreground">We couldn't find any questions matching your current filters. Try selecting a different year or topic.</p>
                  <Button onClick={() => setStep('year')} variant="outline">Back to Selection</Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-6">
                {questions.map((question, index) => {
                  const questionNumber = (currentPage - 1) * QUESTIONS_PER_PAGE + index + 1;
                  const isSubmitted = submittedQuestions.has(question.id);
                  const options = [
                    { letter: "A", text: question.option_a },
                    { letter: "B", text: question.option_b },
                    { letter: "C", text: question.option_c },
                    { letter: "D", text: question.option_d },
                  ];

                  return (
                    <Card key={question.id} className="overflow-hidden rounded-2xl border-2 transition-all hover:border-primary/20">
                      <CardContent className="p-6">
                        <div className="flex flex-wrap items-center gap-2 mb-6">
                          <span className="text-xs font-black text-primary/40 uppercase tracking-tighter mr-2">Question {questionNumber}</span>
                          <Badge variant="outline" className="text-[10px] rounded-full px-3">{question.year}</Badge>
                          {question.topic && <Badge variant="outline" className="text-[10px] rounded-full px-3 max-w-[150px] truncate">{question.topic}</Badge>}
                          {question.difficulty && (
                            <Badge variant="secondary" className="text-[10px] rounded-full px-3 capitalize ml-auto">
                              {question.difficulty}
                            </Badge>
                          )}
                        </div>

                        <div className="mb-8 text-base sm:text-lg leading-relaxed font-medium text-foreground/90">
                          <LatexRenderer content={sanitizeQuestion(question.question_text)} />
                        </div>

                        <RadioGroup
                          value={selectedAnswers[question.id] || ""}
                          onValueChange={(value) => handleAnswerSelect(question.id, value)}
                          className="space-y-3"
                        >
                          {options.map((option) => (
                            <label
                              key={option.letter}
                              className={cn(
                                "flex items-start gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all active:scale-[0.98]",
                                getOptionClass(question, option.letter),
                                isSubmitted && "cursor-default active:scale-100"
                              )}
                            >
                              <div className={cn(
                                "w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-bold mt-0.5 transition-colors",
                                selectedAnswers[question.id] === option.letter ? "bg-primary border-primary text-primary-foreground" : "bg-card border-border text-muted-foreground"
                              )}>
                                {option.letter}
                              </div>
                              <div className="flex-1 min-w-0">
                                <span className="text-sm sm:text-base leading-snug">
                                  <LatexRenderer content={sanitizeQuestion(option.text)} />
                                </span>
                              </div>
                              {isSubmitted && question.correctAnswer === option.letter && (
                                <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
                                  <Check className="h-4 w-4 text-white" />
                                </div>
                              )}
                              {isSubmitted && selectedAnswers[question.id] === option.letter && !question.isCorrect && (
                                <div className="w-6 h-6 rounded-full bg-destructive flex items-center justify-center">
                                  <X className="h-4 w-4 text-white" />
                                </div>
                              )}
                            </label>
                          ))}
                        </RadioGroup>

                        <div className="flex items-center justify-between mt-8 pt-6 border-t">
                          {!isSubmitted ? (
                            <Button
                              onClick={() => handleSubmitAnswer(question)}
                              disabled={!selectedAnswers[question.id] || isSubmitting[question.id]}
                              className="w-full sm:w-auto px-8 rounded-xl font-bold"
                            >
                              {isSubmitting[question.id] ? "Verifying..." : "Submit Answer"}
                            </Button>
                          ) : (
                            <div className="flex flex-wrap items-center gap-3 w-full">
                              <Badge 
                                variant={question.isCorrect ? "default" : "destructive"} 
                                className={cn("px-4 py-1.5 rounded-lg text-sm", question.isCorrect && "bg-green-600")}
                              >
                                {question.isCorrect ? "Correct Result" : "Incorrect Result"}
                              </Badge>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setShowExplanation((prev) => ({ ...prev, [question.id]: !prev[question.id] }))}
                                className="rounded-lg gap-2"
                              >
                                <Lightbulb className="h-4 w-4" />
                                {showExplanation[question.id] ? "Hide" : "Show"} Explanation
                              </Button>
                            </div>
                          )}
                        </div>

                        {isSubmitted && showExplanation[question.id] && (
                          <div className="mt-6 p-5 bg-primary/5 rounded-2xl border border-primary/10 animate-in zoom-in-95 duration-200">
                            <div className="flex items-start gap-3">
                              <Lightbulb className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
                              <div className="space-y-2">
                                <p className="text-sm font-bold text-primary">Explanation & Strategy</p>
                                <div className="text-sm leading-relaxed text-muted-foreground">
                                  {question.explanation ? (
                                    <LatexRenderer content={sanitizeQuestion(question.explanation)} />
                                  ) : (
                                    <p>The correct answer is <strong>{question.correctAnswer}</strong>. Detailed analysis for this {selectedSubject} topic is being processed by our mentors.</p>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
                
                {/* Simplified Pagination */}
                {(currentPage > 1 || hasNextPage) && (
                  <div className="flex items-center justify-between gap-4 mt-8 bg-card p-4 rounded-2xl border">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setCurrentPage(p => Math.max(1, p - 1));
                        setTimeout(() => topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
                      }}
                      disabled={currentPage === 1}
                      className="gap-2"
                    >
                      <ChevronLeft className="h-4 w-4" /> Previous
                    </Button>
                    <span className="text-sm font-medium">Page {currentPage}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setCurrentPage(p => p + 1);
                        setTimeout(() => topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
                      }}
                      disabled={!hasNextPage}
                      className="gap-2"
                    >
                      Next <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
