import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { useAITutor } from '@/hooks/useAITutor';
import { cn } from '@/lib/utils';
import {
    Bot,
    Brain,
    Loader2,
    Send,
    Sparkles,
    User,
    Volume2,
    VolumeX,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { LatexRenderer } from './LatexRenderer';

interface AITutorSplitProps {
  subject: string;
  topic: string;
  subtopic?: string;
  currentQuestion?: string;
  studentAnswer?: string;
  correctAnswer?: string;
}

export function AITutorSplit({
  subject,
  topic,
  subtopic,
  currentQuestion,
  studentAnswer,
  correctAnswer,
}: AITutorSplitProps) {
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
  const scrollRef = useRef<HTMLDivElement>(null);
  const hasInitializedHelp = useRef(false);

  // Initialize context when component mounts or question changes
  useEffect(() => {
    initializeContext({
      subject,
      topic,
      subtopic,
      currentQuestion,
      studentAnswer,
      correctAnswer,
    });
    hasInitializedHelp.current = false;
  }, [subject, topic, subtopic, currentQuestion, initializeContext]);

  // Auto-send help request when there's a wrong answer
  useEffect(() => {
    if (studentAnswer && correctAnswer && studentAnswer !== correctAnswer && !hasInitializedHelp.current && interactions.length === 0) {
      hasInitializedHelp.current = true;
      sendMessage("I got this question wrong. Can you help me understand where I went wrong?");
    }
  }, [studentAnswer, correctAnswer, interactions.length, sendMessage]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [interactions]);

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

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Header */}
      <div className="flex items-center gap-3 border-b px-4 py-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
          <Brain className="h-4 w-4 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold">AI Tutor</h3>
          <p className="truncate text-xs text-muted-foreground">
            {topic} {subtopic && `• ${subtopic}`}
          </p>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 px-3" ref={scrollRef}>
        <div className="space-y-4 py-4">
          {/* Welcome message */}
          {interactions.length === 0 && !loading && (
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                <Bot className="h-4 w-4 text-primary" />
              </div>
              <div className="rounded-lg rounded-tl-none bg-muted px-3 py-2">
                <p className="text-sm">
                  Hi! I'm here to help you with this question. Ask me anything or click a quick prompt below.
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
                    : 'bg-muted'
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
                  'max-w-[85%] rounded-lg px-3 py-2',
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
                    className="mt-1 h-6 gap-1 px-2 text-xs opacity-70 hover:opacity-100"
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
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
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
      <div className="border-t p-3">
        {/* Quick prompts */}
        <div className="mb-2 flex flex-wrap gap-1.5">
          <Button
            variant="outline"
            size="sm"
            className="h-6 gap-1 px-2 text-xs"
            onClick={() => sendMessage("Give me a hint")}
            disabled={loading}
          >
            <Sparkles className="h-3 w-3" />
            Hint
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-6 gap-1 px-2 text-xs"
            onClick={() => sendMessage("Explain this concept")}
            disabled={loading}
          >
            <Brain className="h-3 w-3" />
            Explain
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={() => sendMessage("Show me a similar example")}
            disabled={loading}
          >
            Example
          </Button>
        </div>

        <div className="flex gap-2">
          <Textarea
            placeholder="Ask your tutor..."
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value.slice(0, 500))}
            onKeyDown={handleKeyDown}
            className="min-h-[40px] resize-none text-sm"
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
      </div>
    </div>
  );
}
