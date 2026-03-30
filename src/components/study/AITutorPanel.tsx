import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { useAITutor } from '@/hooks/useAITutor';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import {
    Bot,
    Brain,
    Flame,
    Loader2,
    Send,
    Sparkles,
    User,
    Volume2,
    VolumeX,
    X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { ConversationHistory } from './ConversationHistory';
import { LatexRenderer } from './LatexRenderer';
import { sanitizeQuestion } from '@/lib/textUtils';

interface AITutorPanelProps {
  subject: string;
  topic: string;
  subtopic?: string;
  currentQuestion?: string;
  studentAnswer?: string;
  correctAnswer?: string;
  masteryScore?: number;
  consecutiveErrors?: number;
  isOpen: boolean;
  onClose: () => void;
}

export function AITutorPanel({
  subject,
  topic,
  subtopic,
  currentQuestion,
  studentAnswer,
  correctAnswer,
  masteryScore,
  consecutiveErrors,
  isOpen,
  onClose,
}: AITutorPanelProps) {
  const {
    loading,
    interactions,
    isSpeaking,
    initializeContext,
    sendMessage,
    speakText,
    stopSpeaking,
  } = useAITutor();

  const [inputMessage, setInputMessage] = useState('');
  const [streak, setStreak] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Fetch user streak
  useEffect(() => {
    const fetchStreak = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('profiles')
        .select('current_streak')
        .eq('id', user.id)
        .single();

      if (data) {
        setStreak(data.current_streak || 0);
      }
    };
    
    if (isOpen) {
      fetchStreak();
    }
  }, [isOpen]);

  // Initialize context when panel opens
  useEffect(() => {
    if (isOpen) {
      initializeContext({
        subject,
        topic,
        subtopic,
        currentQuestion,
        studentAnswer,
        correctAnswer,
        masteryScore,
        consecutiveErrors,
      });
    }
  }, [isOpen, subject, topic, subtopic, currentQuestion, studentAnswer, correctAnswer, masteryScore, consecutiveErrors, initializeContext]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [interactions]);

  // Start with a greeting if there's context about a wrong answer
  useEffect(() => {
    if (isOpen && studentAnswer && correctAnswer && interactions.length === 0) {
      sendMessage("I got this question wrong. Can you help me understand where I went wrong?");
    }
  }, [isOpen, studentAnswer, correctAnswer, interactions.length, sendMessage]);

  const handleSend = async () => {
    if (!inputMessage.trim() || loading) return;
    
    const message = inputMessage.trim();
    setInputMessage('');
    await sendMessage(message);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm sm:inset-auto sm:bottom-4 sm:right-4 sm:left-auto sm:top-auto">
      <Card className="flex h-full w-full flex-col sm:h-[600px] sm:w-[400px] sm:rounded-xl sm:shadow-2xl">
        {/* Header */}
        <CardHeader className="flex flex-row items-center justify-between border-b pb-3 pt-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <Brain className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                Mentat Tutor
                {streak > 0 && (
                  <span className="flex items-center gap-1 rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-600 dark:bg-orange-900/30 dark:text-info">
                    <Flame className="h-3 w-3" />
                    {streak}
                  </span>
                )}
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                {topic} {subtopic && `• ${subtopic}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <ConversationHistory currentSubject={subject} currentTopic={topic} />
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>

        {/* Messages */}
        <ScrollArea className="flex-1 px-4" ref={scrollRef}>
          <div className="space-y-4 py-4">
            {/* Welcome message */}
            {interactions.length === 0 && !loading && (
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <Bot className="h-4 w-4 text-primary" />
                </div>
                <div className="rounded-lg rounded-tl-none bg-muted px-3 py-2">
                  <p className="text-sm">
                    Hi! I'm your AI tutor. I'm here to guide you through {topic} concepts 
                    using the Socratic method. I won't give you direct answers, but I'll 
                    help you discover them yourself! 
                  </p>
                  <p className="mt-2 text-sm">
                    Ask me anything about the current topic, or tell me where you're stuck.
                  </p>
                </div>
              </div>
            )}

            {/* Interaction history */}
            {interactions.map((interaction, index) => (
              <div
                key={index}
                className={cn(
                  'flex items-start gap-3',
                  interaction.role === 'student' && 'flex-row-reverse'
                )}
              >
                <div
                  className={cn(
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
                    interaction.role === 'student'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-primary/10'
                  )}
                >
                  {interaction.role === 'student' ? (
                    <User className="h-4 w-4" />
                  ) : (
                    <Bot className="h-4 w-4 text-primary" />
                  )}
                </div>
                <div
                  className={cn(
                    'max-w-[80%] rounded-lg px-3 py-2',
                    interaction.role === 'student'
                      ? 'rounded-tr-none bg-primary text-primary-foreground'
                      : 'rounded-tl-none bg-muted'
                  )}
                >
                  <div className="text-sm">
                    <LatexRenderer content={interaction.content} />
                  </div>
                  {interaction.role === 'tutor' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-2 h-7 gap-1.5 px-2 text-xs"
                      onClick={() => isSpeaking ? stopSpeaking() : speakText(interaction.content)}
                    >
                      {isSpeaking ? (
                        <>
                          <VolumeX className="h-3 w-3" />
                          Stop
                        </>
                      ) : (
                        <>
                          <Volume2 className="h-3 w-3" />
                          Listen
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </div>
            ))}

            {/* Loading indicator */}
            {loading && (
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <Bot className="h-4 w-4 text-primary" />
                </div>
                <div className="rounded-lg rounded-tl-none bg-muted px-3 py-2">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    <span className="text-sm text-muted-foreground">Thinking...</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Input area */}
        <CardContent className="border-t p-4">
          {/* Quick prompts */}
          <div className="mb-3 flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-7 gap-1 text-xs"
              onClick={() => sendMessage("Can you give me a hint?")}
              disabled={loading}
            >
              <Sparkles className="h-3 w-3" />
              Hint
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 gap-1 text-xs"
              onClick={() => sendMessage("Can you explain this concept from the beginning?")}
              disabled={loading}
            >
              <Brain className="h-3 w-3" />
              Explain basics
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 gap-1 text-xs"
              onClick={() => sendMessage("Can you show me a similar example?")}
              disabled={loading}
            >
              Similar example
            </Button>
          </div>

          <div className="flex gap-2">
            <Textarea
              placeholder="Ask your tutor..."
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              className="min-h-[44px] resize-none"
              rows={1}
              disabled={loading}
            />
            <Button
              size="icon"
              onClick={handleSend}
              disabled={!inputMessage.trim() || loading}
              className="shrink-0"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>

          <p className="mt-2 text-center text-[10px] text-muted-foreground">
            AI responses are verified for mathematical accuracy
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
