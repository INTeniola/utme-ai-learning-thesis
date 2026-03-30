import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useDocumentIngestion } from '@/hooks/useDocumentIngestion';
import { CreateFlashcardInput, useFlashcards } from '@/hooks/useFlashcards';
import { supabase } from '@/integrations/supabase/client';
import { aiGateway } from '@/lib/aiGateway';
import { gemini } from '@/lib/gemini';
import {
    AlertCircle,
    ArrowLeft,
    BookOpen,
    Check,
    Loader2,
    Plus,
    Sparkles
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';

// User subjects will be loaded from database
const DEFAULT_SUBJECTS = [
  'Mathematics', 'English', 'Physics', 'Chemistry', 'Biology',
  'Accounting', 'Commerce', 'Economics', 'Government',
  'Literature in English', 'Christian Religious Studies'
];

interface QuizMistake {
  questionId: string;
  question: string;
  correctAnswer: string;
  selectedAnswer: string;
  explanation?: string;
  topic?: string;
  quizDate: string;
  subject: string;
}

interface FlashcardCreatorProps {
  onBack: () => void;
  onCardCreated?: () => void;
}

export function FlashcardCreator({ onBack, onCardCreated }: FlashcardCreatorProps) {
  const { createCard, createFromQuizMistakes } = useFlashcards();
  const [activeTab, setActiveTab] = useState('upload');

  // Manual creation state
  const [frontText, setFrontText] = useState('');
  const [backText, setBackText] = useState('');
  const [subject, setSubject] = useState('');
  const [topic, setTopic] = useState('');
  const [saving, setSaving] = useState(false);

  // Quiz mistakes state
  const [mistakes, setMistakes] = useState<QuizMistake[]>([]);
  const [selectedMistakes, setSelectedMistakes] = useState<Set<string>>(new Set());
  const [loadingMistakes, setLoadingMistakes] = useState(false);

  // AI generation state
  const [aiSubject, setAiSubject] = useState('');
  const [aiTopic, setAiTopic] = useState('');
  const [aiGenerating, setAiGenerating] = useState(false);
  const [generatedCards, setGeneratedCards] = useState<CreateFlashcardInput[]>([]);
  const [selectedGenerated, setSelectedGenerated] = useState<Set<number>>(new Set());

  // Document upload state
  const { processDocument, isProcessing, processedDocument, error: docError } = useDocumentIngestion();
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadSubject, setUploadSubject] = useState('');
  const [uploadTopic, setUploadTopic] = useState('');
  const fileUploadRef = useState<HTMLInputElement | null>(null);

  // Topics for selected subject
  const [topics, setTopics] = useState<string[]>([]);
  const [userSubjects, setUserSubjects] = useState<string[]>(DEFAULT_SUBJECTS);
  const [userId, setUserId] = useState<string | null>(null);

  // Get current user
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUserId(user?.id ?? null);
    });
  }, []);

  // Load user's selected UTME subjects
  useEffect(() => {
    const loadUserSubjects = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('subjects_meta')
        .eq('id', user.id)
        .single();

      if (profile?.subjects_meta) {
        const meta = profile.subjects_meta as { selectedSubjects?: string[] };
        if (meta.selectedSubjects && meta.selectedSubjects.length > 0) {
          // Capitalize first letter to match jamb_syllabus format
          const formatted = meta.selectedSubjects.map(s =>
            s.charAt(0).toUpperCase() + s.slice(1)
          );
          setUserSubjects(formatted);
        }
      }
    };
    loadUserSubjects();
  }, []);

  // Fetch topics when subject changes
  useEffect(() => {
    const fetchTopics = async () => {
      const selectedSubject = (aiSubject || subject)?.trim();
      if (!selectedSubject) return;

      const { data, error } = await supabase
        .from('jamb_syllabus')
        .select('topic')
        .eq('subject', selectedSubject);

      if (!error && data) {
        const uniqueTopics = [...new Set(data.map(d => d.topic).filter(Boolean))];
        setTopics(uniqueTopics);
      } else {
        console.error('Error fetching topics:', error);
        setTopics([]);
      }
    };
    fetchTopics();
  }, [subject, aiSubject]);

  // Fetch quiz mistakes
  useEffect(() => {
    const fetchMistakes = async () => {
      setLoadingMistakes(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: results } = await supabase
          .from('quiz_results')
          .select('*, quizzes(subject)')
          .eq('user_id', user.id)
          .order('completed_at', { ascending: false })
          .limit(10);

        const allMistakes: QuizMistake[] = [];

        (results || []).forEach(result => {
          const answers = result.answers as Record<string, any>;
          Object.entries(answers || {}).forEach(([questionId, answer]) => {
            if (answer.selected !== answer.correct) {
              allMistakes.push({
                questionId,
                question: answer.question || 'Question text not available',
                correctAnswer: answer.correct,
                selectedAnswer: answer.selected,
                explanation: answer.explanation,
                topic: answer.topic || 'General',
                quizDate: new Date(result.completed_at).toLocaleDateString(),
                subject: result.quizzes?.subject || 'General',
              });
            }
          });
        });

        setMistakes(allMistakes);
      } catch (error) {
        console.error('Error fetching mistakes:', error);
      } finally {
        setLoadingMistakes(false);
      }
    };

    if (activeTab === 'mistakes') {
      fetchMistakes();
    }
  }, [activeTab]);

  // Handle manual card creation
  const handleManualCreate = async () => {
    if (!frontText.trim() || !backText.trim() || !subject || !topic) {
      toast.error('Please fill in all fields');
      return;
    }

    setSaving(true);
    const result = await createCard({
      front_text: frontText,
      back_text: backText,
      subject,
      topic,
      source: 'manual',
    });

    if (result) {
      setFrontText('');
      setBackText('');
      onCardCreated?.();
    }
    setSaving(false);
  };

  // Handle creating cards from selected mistakes
  const handleCreateFromMistakes = async () => {
    if (selectedMistakes.size === 0) {
      toast.error('Please select at least one mistake');
      return;
    }

    setSaving(true);
    let created = 0;

    for (const mistakeId of selectedMistakes) {
      const mistake = mistakes.find(m => m.questionId === mistakeId);
      if (mistake) {
        const result = await createCard({
          front_text: mistake.question,
          back_text: `Correct answer: ${mistake.correctAnswer}\n\n${mistake.explanation || 'Review this concept carefully.'}`,
          subject: mistake.subject,
          topic: mistake.topic || 'General',
          source: 'quiz_mistake',
          source_reference: `Quiz from ${mistake.quizDate}`,
          source_question_id: mistake.questionId,
        });
        if (result) created++;
      }
    }

    toast.success(`Created ${created} flashcards!`);
    setSelectedMistakes(new Set());
    onCardCreated?.();
    setSaving(false);
  };

  // Handle AI generation
  const handleAIGenerate = async () => {
    if (!aiSubject || !aiTopic || !userId) {
      toast.error('Please select subject and topic');
      return;
    }

    setAiGenerating(true);
    setGeneratedCards([]); // Clear previous

    try {
      let knowledgeContext = "";

      try {
        const queryResult = await gemini.embedContent(aiTopic);
        const queryEmbedding = Array.from(queryResult.embedding.values).slice(0, 1536);

        const { data: kbMatches, error: kbError } = await (supabase.rpc as any)('match_knowledge_base', {
          query_embedding: queryEmbedding,
          match_threshold: 0.50, // Looser for broad context
          match_count: 5,
          filter_subject: aiSubject
        });

        if (!kbError && Array.isArray(kbMatches) && kbMatches.length > 0) {
          knowledgeContext = `\n\nUSE THIS VERIFIED CONTEXT TO CREATE THE FLASHCARDS:\n` + kbMatches.map((m: any) => `[${m.topic}] ${m.content}`).join('\n\n');
        }
      } catch (err) {
        console.error("Knowledge base retrieval failed:", err);
      }

      const prompt = `Generate 5 highly accurate flashcards for the topic "${aiTopic}" in "${aiSubject}".${knowledgeContext}
      Return ONLY a raw JSON array of objects. 
      Each object must have "front" (question/term) and "back" (answer/definition).
      No markdown formatting.`;

      const responseText = await aiGateway.generateSafe(prompt, {
        subject: aiSubject,
        featureType: 'flashcard_creation',
        userId: userId
      });
      const cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();

      let cardsData = [];
      try {
        cardsData = JSON.parse(cleanJson);
      } catch (e) {
        console.error("Failed to parse Gemini JSON", e);
        toast.error("AI response was malformed. Try again.");
        return;
      }

      const cards = cardsData.map((c: any) => ({
        front_text: c.front,
        back_text: c.back,
        subject: aiSubject,
        topic: aiTopic,
        source: 'ai_generated',
      }));

      setGeneratedCards(cards);
      setSelectedGenerated(new Set(cards.map((_: any, i: number) => i)));
    } catch (error) {
      console.error('Error generating flashcards:', error);
      toast.error('Failed to generate flashcards. Please try again.');
    } finally {
      setAiGenerating(false);
    }
  };

  // Save selected AI-generated cards
  const handleSaveGenerated = async () => {
    if (selectedGenerated.size === 0) {
      toast.error('Please select at least one card to save');
      return;
    }

    setSaving(true);
    let created = 0;

    for (const index of selectedGenerated) {
      const card = generatedCards[index];
      if (card) {
        const result = await createCard(card);
        if (result) created++;
      }
    }

    toast.success(`Created ${created} flashcards!`);
    setGeneratedCards([]);
    setSelectedGenerated(new Set());
    onCardCreated?.();
    setSaving(false);
  };

  const toggleMistakeSelection = (id: string) => {
    setSelectedMistakes(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleGeneratedSelection = (index: number) => {
    setSelectedGenerated(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadedFile(file);
    }
  };

  const handleDocumentProcess = async () => {
    if (!uploadedFile || !uploadSubject || !userId) {
      toast.error('Please select a file and subject');
      return;
    }

    try {
      const processed = await processDocument(uploadedFile, uploadSubject);

      if (processed && processed.cleanedMarkdown) {
        const prompt = `You are creating UTME flashcards for ${uploadSubject}.
        
Content:
"""
${processed.cleanedMarkdown.substring(0, 15000)}
"""
        
Generate 8-10 flashcards. Return ONLY a JSON array:
[{"front_text": "Question", "back_text": "Answer", "subject": "${uploadSubject}", "topic": "${uploadTopic || 'General'}"}]`;

        const response = await aiGateway.generateSafe(prompt, {
          subject: uploadSubject,
          featureType: 'flashcard_creation',
          userId: userId
        });
        const jsonMatch = response.match(/\[\s*\{[\s\S]*\}\s*\]/);

        if (jsonMatch) {
          const cards = JSON.parse(jsonMatch[0]);
          const formattedCards: CreateFlashcardInput[] = cards.map((card: any) => ({
            front_text: card.front_text,
            back_text: card.back_text,
            subject: uploadSubject,
            topic: uploadTopic || card.topic || 'General',
            source: 'upload',
          }));
          setGeneratedCards(formattedCards);
          setSelectedGenerated(new Set(formattedCards.map((_, i) => i)));
          toast.success(`Generated ${formattedCards.length} flashcards!`);
          setUploadedFile(null);
        } else {
          console.error('No JSON match found in response:', response);
          throw new Error('Invalid response');
        }
      } else {
        console.error('No cleaned markdown in processed document');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to generate flashcards');
    }
  };

  return (
    <div className="space-y-4 p-4 md:p-6 pb-16">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h2 className="text-xl font-semibold">Create Flashcards</h2>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="upload" className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Upload Document
          </TabsTrigger>
          <TabsTrigger value="mistakes" className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            From Mistakes
          </TabsTrigger>
          <TabsTrigger value="ai" className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            AI Generate
          </TabsTrigger>
        </TabsList>

        {/* Document Upload Tab */}
        <TabsContent value="upload" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Upload Study Material</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-sm text-muted-foreground">
                Upload a PDF, image, or document of your study notes and we'll generate flashcards automatically!
              </div>

              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label>Subject</Label>
                  <Select value={uploadSubject} onValueChange={setUploadSubject}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select subject" />
                    </SelectTrigger>
                    <SelectContent>
                      {userSubjects.map(s => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Topic (Optional)</Label>
                  <Input
                    placeholder="e.g., Quadratic Equations"
                    value={uploadTopic}
                    onChange={(e) => setUploadTopic(e.target.value)}
                  />
                </div>
              </div>

              <div className="border-2 border-dashed rounded-lg p-8">
                {uploadedFile ? (
                  <div className="text-center space-y-3">
                    <div className="flex items-center justify-center gap-2">
                      <BookOpen className="h-8 w-8 text-primary" />
                      <div className="text-left">
                        <p className="font-medium">{uploadedFile.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {(uploadedFile.size / 1024).toFixed(1)} KB
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2 justify-center">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setUploadedFile(null)}
                      >
                        Remove
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleDocumentProcess}
                        disabled={isProcessing || !uploadSubject}
                      >
                        {isProcessing ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Processing...
                          </>
                        ) : (
                          <>
                            <Sparkles className="mr-2 h-4 w-4" />
                            Generate Flashcards
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center space-y-3">
                    <BookOpen className="h-12 w-12 mx-auto text-muted-foreground" />
                    <div>
                      <p className="font-medium mb-1">Upload your study material</p>
                      <p className="text-sm text-muted-foreground">
                        Supported: PDF, JPG, PNG, DOCX (max 10MB)
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => document.getElementById('file-upload')?.click()}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Choose File
                    </Button>
                    <input
                      id="file-upload"
                      type="file"
                      accept="image/*,.pdf,.docx"
                      className="hidden"
                      onChange={handleFileSelect}
                    />
                  </div>
                )}
              </div>

              {/* Visual separator */}
              {generatedCards.length > 0 && (
                <div className="border-t pt-4 mt-4">
                  <div className="bg-primary/10 p-4 rounded-lg mb-4">
                    <p className="text-lg font-bold text-primary">
                      ✨ {generatedCards.length} Flashcards Generated!
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Review and select the cards you want to save
                    </p>
                  </div>
                </div>
              )}

              {generatedCards.length > 0 && (
                <>
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">
                      Select cards to save:
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        if (selectedGenerated.size === generatedCards.length) {
                          setSelectedGenerated(new Set());
                        } else {
                          setSelectedGenerated(new Set(generatedCards.map((_, i) => i)));
                        }
                      }}
                    >
                      {selectedGenerated.size === generatedCards.length ? 'Deselect All' : 'Select All'}
                    </Button>
                  </div>

                  <ScrollArea className="h-[300px] pr-4">
                    <div className="space-y-3">
                      {generatedCards.map((card, index) => (
                        <div
                          key={index}
                          className={`p-3 rounded-lg border cursor-pointer transition-colors ${selectedGenerated.has(index)
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:border-primary/50'
                            }`}
                          onClick={() => toggleGeneratedSelection(index)}
                        >
                          <div className="flex items-start gap-3">
                            <Checkbox
                              checked={selectedGenerated.has(index)}
                              onCheckedChange={() => toggleGeneratedSelection(index)}
                            />
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm mb-1">{card.front_text}</p>
                              <p className="text-xs text-muted-foreground line-clamp-2">
                                {card.back_text}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>

                  <Button
                    onClick={handleSaveGenerated}
                    disabled={saving || selectedGenerated.size === 0}
                    className="w-full"
                  >
                    {saving ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Check className="mr-2 h-4 w-4" />
                        Save {selectedGenerated.size} Card{selectedGenerated.size !== 1 ? 's' : ''}
                      </>
                    )}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* From Mistakes Tab */}
        <TabsContent value="mistakes" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center justify-between">
                <span>Recent Quiz Mistakes</span>
                {selectedMistakes.size > 0 && (
                  <Badge variant="secondary">
                    {selectedMistakes.size} selected
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingMistakes ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : mistakes.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <BookOpen className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No quiz mistakes found.</p>
                  <p className="text-sm">Take some quizzes to generate flashcards from your mistakes!</p>
                </div>
              ) : (
                <>
                  <ScrollArea className="h-[400px] pr-4">
                    <div className="space-y-3">
                      {mistakes.map((mistake) => (
                        <div
                          key={mistake.questionId}
                          className={`p-3 rounded-lg border cursor-pointer transition-colors ${selectedMistakes.has(mistake.questionId)
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:border-primary/50'
                            }`}
                          onClick={() => toggleMistakeSelection(mistake.questionId)}
                        >
                          <div className="flex items-start gap-3">
                            <Checkbox
                              checked={selectedMistakes.has(mistake.questionId)}
                              onCheckedChange={() => toggleMistakeSelection(mistake.questionId)}
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <Badge variant="outline" className="text-xs">
                                  {mistake.subject}
                                </Badge>
                                <span className="text-xs text-muted-foreground">
                                  {mistake.quizDate}
                                </span>
                              </div>
                              <p className="text-sm line-clamp-2">{mistake.question}</p>
                              <p className="text-xs text-muted-foreground mt-1">
                                Correct: <span className="text-green-600">{mistake.correctAnswer}</span>
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>

                  <Button
                    onClick={handleCreateFromMistakes}
                    disabled={saving || selectedMistakes.size === 0}
                    className="w-full mt-4"
                  >
                    {saving ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      <>
                        <Plus className="mr-2 h-4 w-4" />
                        Create {selectedMistakes.size} Flashcard{selectedMistakes.size !== 1 ? 's' : ''}
                      </>
                    )}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* AI Generation Tab */}
        <TabsContent value="ai" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                AI-Generated Cards
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Subject</Label>
                  <Select value={aiSubject} onValueChange={setAiSubject}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select subject" />
                    </SelectTrigger>
                    <SelectContent>
                      {userSubjects.map(s => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Topic</Label>
                  <Select value={aiTopic} onValueChange={setAiTopic} disabled={!aiSubject}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select topic" />
                    </SelectTrigger>
                    <SelectContent>
                      {topics.map(t => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button
                onClick={handleAIGenerate}
                disabled={aiGenerating || !aiSubject || !aiTopic}
                className="w-full"
                variant="outline"
              >
                {aiGenerating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Generate 5 Flashcards
                  </>
                )}
              </Button>

              {generatedCards.length > 0 && (
                <>
                  <ScrollArea className="h-[300px] pr-4">
                    <div className="space-y-3">
                      {generatedCards.map((card, index) => (
                        <div
                          key={index}
                          className={`p-3 rounded-lg border cursor-pointer transition-colors ${selectedGenerated.has(index)
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:border-primary/50'
                            }`}
                          onClick={() => toggleGeneratedSelection(index)}
                        >
                          <div className="flex items-start gap-3">
                            <Checkbox
                              checked={selectedGenerated.has(index)}
                              onCheckedChange={() => toggleGeneratedSelection(index)}
                            />
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm mb-1">{card.front_text}</p>
                              <p className="text-xs text-muted-foreground line-clamp-2">
                                {card.back_text}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>

                  <Button
                    onClick={handleSaveGenerated}
                    disabled={saving || selectedGenerated.size === 0}
                    className="w-full"
                  >
                    {saving ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Check className="mr-2 h-4 w-4" />
                        Save {selectedGenerated.size} Card{selectedGenerated.size !== 1 ? 's' : ''}
                      </>
                    )}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
