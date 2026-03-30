import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { QuizConfig, WeakTopic } from '@/hooks/useQuiz';
import { User } from '@supabase/supabase-js';
import { AlertTriangle, ArrowLeft, Loader2, Sparkles, Target } from 'lucide-react';
import { Lightning } from '@phosphor-icons/react';
import { useEffect, useState } from 'react';

const SUBJECTS = [
  { value: 'Mathematics', label: 'Mathematics' },
  { value: 'English', label: 'English' },
  { value: 'Physics', label: 'Physics' },
  { value: 'Chemistry', label: 'Chemistry' },
  { value: 'Biology', label: 'Biology' },
];

interface QuizConfigPageProps {
  onStartQuiz: () => void;
  onBack: () => void;
  initialSubject?: string | null;
  initialTopic?: string | null;
  generateQuiz: (config: QuizConfig) => Promise<boolean>;
  isGenerating: boolean;
  fetchWeakTopics: (subject?: string) => Promise<WeakTopic[]>;
  user: User | null;
  authLoading: boolean;
}

export function QuizConfigPage({
  onStartQuiz,
  onBack,
  initialSubject,
  initialTopic,
  generateQuiz,
  isGenerating,
  fetchWeakTopics,
  user,
  authLoading
}: QuizConfigPageProps) {
  const [config, setConfig] = useState<QuizConfig>({
    subject: initialSubject || '',
    topic: initialTopic || '',
    focusWeakTopics: !initialTopic, // Don't focus weak topics if we have a specific target
    questionCount: 10, // Default to 10 for AI triggered
    difficultyMode: 'auto-adapt',
  });
  const [loadingWeakTopics, setLoadingWeakTopics] = useState(false);
  const [subjectWeakTopics, setSubjectWeakTopics] = useState<WeakTopic[]>([]);

  // Fetch weak topics when subject changes
  useEffect(() => {
    async function loadWeakTopics() {
      if (!config.subject) {
        setSubjectWeakTopics([]);
        return;
      }

      setLoadingWeakTopics(true);
      const topics = await fetchWeakTopics(config.subject);
      setSubjectWeakTopics(topics);
      setLoadingWeakTopics(false);
    }

    loadWeakTopics();
  }, [config.subject, fetchWeakTopics]);

  // Auto-generate if specific topic is provided
  useEffect(() => {
    if (initialTopic && config.subject && user && !authLoading && !isGenerating) {
      handleGenerateQuiz();
    }
  }, [initialTopic, user, authLoading, config.subject]);

  const handleGenerateQuiz = async () => {
    if (!config.subject) return;

    const success = await generateQuiz(config);
    if (success) {
      // Trigger the transition - QuizController will wait for questions to load
      onStartQuiz();
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6">
      <div className="mx-auto max-w-2xl">
        <Button
          variant="ghost"
          onClick={onBack}
          className="mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Dashboard
        </Button>

        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-500/10">
              <Lightning weight="duotone" className="h-8 w-8 text-blue-600" />
            </div>
            <CardTitle className="text-2xl">Quick Quiz Setup</CardTitle>
            <CardDescription>
              Configure your adaptive quiz settings for JAMB preparation
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Subject Selection */}
            <div className="space-y-2">
              <Label htmlFor="subject">Select Subject</Label>
              <Select
                value={config.subject}
                onValueChange={(value) => setConfig(prev => ({ ...prev, subject: value }))}
                disabled={!!initialSubject}
              >
                <SelectTrigger id="subject">
                  <SelectValue placeholder="Choose a subject" />
                </SelectTrigger>
                <SelectContent>
                  {SUBJECTS.map((subject) => (
                    <SelectItem key={subject.value} value={subject.value}>
                      {subject.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Weak Topics Focus */}
            <div className="space-y-3">
              <div className="flex items-start space-x-3">
                <Checkbox
                  id="weak-topics"
                  checked={config.focusWeakTopics}
                  onCheckedChange={(checked) =>
                    setConfig(prev => ({ ...prev, focusWeakTopics: checked as boolean }))
                  }
                  disabled={!config.subject || subjectWeakTopics.length === 0}
                />
                <div className="space-y-1">
                  <Label
                    htmlFor="weak-topics"
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <Target className="h-4 w-4 text-primary" />
                    Focus on my weak topics
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Prioritize questions from topics where you scored below 60%
                  </p>
                </div>
              </div>

              {/* Show weak topics if available */}
              {config.subject && (
                <div className="ml-7">
                  {loadingWeakTopics ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Analyzing your performance...
                    </div>
                  ) : subjectWeakTopics.length > 0 ? (
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-destructive flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        {subjectWeakTopics.length} weak topic{subjectWeakTopics.length !== 1 ? 's' : ''} detected:
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {subjectWeakTopics.slice(0, 5).map((topic, index) => (
                          <Badge key={index} variant="secondary" className="text-xs">
                            {topic.topic} ({topic.accuracy.toFixed(0)}%)
                          </Badge>
                        ))}
                        {subjectWeakTopics.length > 5 && (
                          <Badge variant="outline" className="text-xs">
                            +{subjectWeakTopics.length - 5} more
                          </Badge>
                        )}
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No weak topics detected yet. Complete more quizzes to unlock this feature.
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Question Count */}
            <div className="space-y-3">
              <Label>Number of Questions</Label>
              <RadioGroup
                value={config.questionCount.toString()}
                onValueChange={(value) =>
                  setConfig(prev => ({ ...prev, questionCount: parseInt(value) as 10 | 20 }))
                }
                className="flex gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="10" id="q-10" />
                  <Label htmlFor="q-10" className="cursor-pointer">10 Questions (20 min)</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="20" id="q-20" />
                  <Label htmlFor="q-20" className="cursor-pointer">20 Questions (40 min)</Label>
                </div>
              </RadioGroup>
            </div>

            {/* Difficulty Mode */}
            <div className="space-y-3">
              <Label>Difficulty Level</Label>
              <RadioGroup
                value={config.difficultyMode}
                onValueChange={(value) =>
                  setConfig(prev => ({
                    ...prev,
                    difficultyMode: value as 'easy' | 'medium' | 'hard' | 'auto-adapt'
                  }))
                }
                className="grid grid-cols-2 gap-3"
              >
                <div className="flex items-center space-x-2 rounded-md border p-3">
                  <RadioGroupItem value="easy" id="d-easy" />
                  <Label htmlFor="d-easy" className="cursor-pointer flex-1">
                    <span className="block font-medium">Easy</span>
                    <span className="text-xs text-muted-foreground">Basic concepts</span>
                  </Label>
                </div>
                <div className="flex items-center space-x-2 rounded-md border p-3">
                  <RadioGroupItem value="medium" id="d-medium" />
                  <Label htmlFor="d-medium" className="cursor-pointer flex-1">
                    <span className="block font-medium">Medium</span>
                    <span className="text-xs text-muted-foreground">Standard JAMB level</span>
                  </Label>
                </div>
                <div className="flex items-center space-x-2 rounded-md border p-3">
                  <RadioGroupItem value="hard" id="d-hard" />
                  <Label htmlFor="d-hard" className="cursor-pointer flex-1">
                    <span className="block font-medium">Hard</span>
                    <span className="text-xs text-muted-foreground">Challenging problems</span>
                  </Label>
                </div>
                <div className="flex items-center space-x-2 rounded-md border p-3 border-primary bg-primary/5">
                  <RadioGroupItem value="auto-adapt" id="d-auto" />
                  <Label htmlFor="d-auto" className="cursor-pointer flex-1">
                    <span className="block font-medium flex items-center gap-1">
                      <Sparkles className="h-3 w-3 text-primary" />
                      Auto-Adapt
                    </span>
                    <span className="text-xs text-muted-foreground">Adjusts to your level</span>
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {/* Generate Button */}
            <Button
              className="w-full h-12 text-lg"
              onClick={handleGenerateQuiz}
              disabled={!config.subject || isGenerating}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Generating Quiz...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-5 w-5" />
                  Generate Quiz
                </>
              )}
            </Button>

            {/* Info text */}
            <p className="text-center text-xs text-muted-foreground">
              Quiz includes 70% past JAMB questions and 30% AI-generated questions
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
