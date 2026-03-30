import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { format, formatDistanceToNow } from 'date-fns';
import { ChevronRight, Flame, History, MessageSquare } from 'lucide-react';
import { useEffect, useState } from 'react';
import { LatexRenderer } from './LatexRenderer';

interface HistoricalSession {
  sessionKey: string;
  subject: string;
  topic: string;
  date: Date;
  messageCount: number;
  lastMessage: string;
}

interface ConversationMessage {
  id: string;
  role: 'student' | 'tutor';
  content: string;
  timestamp: Date;
}

interface ConversationHistoryProps {
  currentSubject?: string;
  currentTopic?: string;
  onLoadSession?: (messages: ConversationMessage[]) => void;
}

export function ConversationHistory({ currentSubject, currentTopic, onLoadSession }: ConversationHistoryProps) {
  const [sessions, setSessions] = useState<HistoricalSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<HistoricalSession | null>(null);
  const [sessionMessages, setSessionMessages] = useState<ConversationMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [streak, setStreak] = useState(0);
  const [open, setOpen] = useState(false);

  // Fetch historical sessions and streak on mount
  useEffect(() => {
    if (open) {
      fetchSessions();
      fetchStreak();
    }
  }, [open]);

  const fetchStreak = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from('profiles')
      .select('current_streak')
      .eq('id', user.id)
      .single();

    if (!error && data) {
      setStreak(data.current_streak || 0);
    }
  };

  const fetchSessions = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('ai_interactions')
        .select('id, content, message_type, created_at, session_id, metadata, context')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(500);

      if (error) throw error;

      // Group by session key
      const sessionMap = new Map<string, {
        messages: typeof data;
        subject: string;
        topic: string;
        date: Date;
      }>();

      data?.forEach(msg => {
        const metadata = msg.metadata as { session_key?: string } | null;
        const context = msg.context as { subject?: string; topic?: string } | null;
        const sessionKey = metadata?.session_key;
        
        if (!sessionKey) return;

        if (!sessionMap.has(sessionKey)) {
          sessionMap.set(sessionKey, {
            messages: [],
            subject: context?.subject || 'Unknown',
            topic: context?.topic || 'Unknown',
            date: new Date(msg.created_at!),
          });
        }
        sessionMap.get(sessionKey)!.messages.push(msg);
      });

      // Convert to array and get today's key to exclude current session
      const today = new Date().toISOString().split('T')[0];
      const currentSessionKey = currentSubject && currentTopic 
        ? `${currentSubject}-${currentTopic}-${today}`.toLowerCase().replace(/\s+/g, '-')
        : null;

      const historicalSessions: HistoricalSession[] = Array.from(sessionMap.entries())
        .filter(([key]) => key !== currentSessionKey)
        .map(([key, value]) => ({
          sessionKey: key,
          subject: value.subject,
          topic: value.topic,
          date: value.date,
          messageCount: value.messages.length,
          lastMessage: value.messages[0]?.content.slice(0, 100) + '...' || '',
        }))
        .sort((a, b) => b.date.getTime() - a.date.getTime());

      setSessions(historicalSessions);
    } catch (error) {
      console.error('Failed to fetch sessions:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadSessionMessages = async (session: HistoricalSession) => {
    setSelectedSession(session);
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('ai_interactions')
        .select('id, content, message_type, created_at, metadata')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })
        .limit(200);

      if (error) throw error;

      // Filter by session key
      const messages = data?.filter(msg => {
        const metadata = msg.metadata as { session_key?: string } | null;
        return metadata?.session_key === session.sessionKey;
      }).map(msg => ({
        id: msg.id,
        role: msg.message_type as 'student' | 'tutor',
        content: msg.content,
        timestamp: new Date(msg.created_at!),
      })) || [];

      setSessionMessages(messages);
    } catch (error) {
      console.error('Failed to load session messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    setSelectedSession(null);
    setSessionMessages([]);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs">
          <History className="h-3 w-3" />
          History
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[80vh] sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              {selectedSession ? (
                <>
                  <Button variant="ghost" size="sm" onClick={handleBack} className="mr-2 h-7 px-2">
                    ← Back
                  </Button>
                  {selectedSession.topic}
                </>
              ) : (
                'Conversation History'
              )}
            </DialogTitle>
            {!selectedSession && streak > 0 && (
              <div className="flex items-center gap-1.5 rounded-full bg-orange-100 px-3 py-1 text-sm font-medium text-orange-600 dark:bg-orange-900/30 dark:text-info">
                <Flame className="h-4 w-4" />
                {streak} day streak
              </div>
            )}
          </div>
        </DialogHeader>

        <ScrollArea className="h-[400px] pr-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : selectedSession ? (
            // Show messages for selected session
            <div className="space-y-3">
              <p className="mb-4 text-xs text-muted-foreground">
                {format(selectedSession.date, 'MMMM d, yyyy')} • {selectedSession.subject}
              </p>
              {sessionMessages.map((msg, idx) => (
                <div
                  key={msg.id || idx}
                  className={cn(
                    'flex',
                    msg.role === 'student' ? 'justify-end' : 'justify-start'
                  )}
                >
                  <div
                    className={cn(
                      'max-w-[85%] rounded-lg px-3 py-2 text-sm',
                      msg.role === 'student'
                        ? 'rounded-tr-none bg-primary text-primary-foreground'
                        : 'rounded-tl-none bg-muted'
                    )}
                  >
                    <LatexRenderer content={msg.content} />
                    <p className="mt-1 text-[10px] opacity-60">
                      {format(msg.timestamp, 'h:mm a')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : sessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <MessageSquare className="mb-4 h-12 w-12 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No previous conversations</p>
              <p className="mt-1 text-xs text-muted-foreground/60">
                Your tutor conversations will appear here
              </p>
            </div>
          ) : (
            // Show list of sessions
            <div className="space-y-2">
              {sessions.map((session) => (
                <button
                  key={session.sessionKey}
                  onClick={() => loadSessionMessages(session)}
                  className="flex w-full items-center justify-between rounded-lg border p-3 text-left transition-colors hover:bg-muted"
                >
                  <div className="flex-1 overflow-hidden">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{session.topic}</span>
                      <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                        {session.subject}
                      </span>
                    </div>
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      {session.lastMessage}
                    </p>
                    <p className="mt-1 text-[10px] text-muted-foreground/60">
                      {formatDistanceToNow(session.date, { addSuffix: true })} • {session.messageCount} messages
                    </p>
                  </div>
                  <ChevronRight className="ml-2 h-4 w-4 shrink-0 text-muted-foreground" />
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
