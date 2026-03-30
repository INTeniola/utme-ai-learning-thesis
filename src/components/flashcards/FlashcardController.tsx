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
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Flashcard, useFlashcards } from '@/hooks/useFlashcards';
import { calculateMastery } from '@/lib/spacedRepetition';
import {
    ArrowLeft,
    BookOpen,
    Filter,
    Flame,
    Loader2,
    Play,
    Plus,
    Search,
    Target,
    Trash2
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { FlashcardCreator } from './FlashcardCreator';
import { FlashcardReview } from './FlashcardReview';
import { FlashcardStats } from './FlashcardStats';

type View = 'home' | 'create' | 'review' | 'browse';

interface FlashcardControllerProps {
  onBack: () => void;
  initialSubject?: string | null;
  onComplete?: (result: any) => void;
}

const SUBJECTS = ['All', 'Mathematics', 'English', 'Physics', 'Chemistry', 'Biology'];

export function FlashcardController({ onBack, initialSubject, onComplete }: FlashcardControllerProps) {
  const {
    cards,
    dueCards,
    stats,
    loading,
    fetchCards,
    fetchDueCards,
    fetchStats,
    deleteCard
  } = useFlashcards();

  const [view, setView] = useState<View>('home');
  const [searchQuery, setSearchQuery] = useState('');
  // Initialize filter with subject if provided
  const [subjectFilter, setSubjectFilter] = useState(initialSubject || 'All');
  const [cardToDelete, setCardToDelete] = useState<Flashcard | null>(null);

  // Filtered cards for browsing
  const filteredCards = cards.filter(card => {
    const matchesSearch =
      card.front_text.toLowerCase().includes(searchQuery.toLowerCase()) ||
      card.back_text.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSubject = subjectFilter === 'All' || card.subject === subjectFilter;
    return matchesSearch && matchesSubject;
  });

  const handleCardCreated = () => {
    fetchCards();
    fetchDueCards();
    fetchStats();
  };

  const handleReviewComplete = () => {
    toast.success('Review session complete! Great job! 🎉');

    if (onComplete) {
      // Calculate basic accuracy for the session if possible, or just send count
      onComplete({
        count: dueCards.length,
        accuracy: 100, // Placeholder until session tracking is better
        timestamp: new Date().toISOString()
      });
    }

    fetchDueCards();
    fetchStats();
    setView('home');
  };

  const handleDeleteCard = async () => {
    if (cardToDelete) {
      await deleteCard(cardToDelete.id);
      setCardToDelete(null);
    }
  };

  // Render based on current view
  if (view === 'create') {
    return (
      <FlashcardCreator
        onBack={() => setView('home')}
        onCardCreated={handleCardCreated}
      />
    );
  }

  if (view === 'review' && dueCards.length > 0) {
    return (
      <FlashcardReview
        cards={dueCards}
        onBack={() => setView('home')}
        onComplete={handleReviewComplete}
      />
    );
  }

  if (view === 'browse') {
    return (
      <div className="space-y-4 p-4 md:p-6 pb-16">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setView('home')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h2 className="text-xl font-semibold">Browse Flashcards</h2>
          <Badge variant="secondary">{filteredCards.length} cards</Badge>
        </div>

        {/* Filters */}
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search cards..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select
            value={subjectFilter}
            onValueChange={setSubjectFilter}
            disabled={!!initialSubject}
          >
            <SelectTrigger className="w-[150px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SUBJECTS.map(s => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Cards list */}
        <ScrollArea className="flex-1 min-h-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredCards.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <BookOpen className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No flashcards found</p>
              <Button
                variant="link"
                onClick={() => setView('create')}
                className="mt-2"
              >
                Create your first card
              </Button>
            </div>
          ) : (
            <div className="space-y-3 pr-4">
              {filteredCards.map(card => {
                const mastery = calculateMastery(Number(card.easiness_factor), card.repetitions);
                return (
                  <Card key={card.id} className="group">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant="outline" className="text-xs">
                              {card.subject}
                            </Badge>
                            <Badge variant="secondary" className="text-xs">
                              {card.topic}
                            </Badge>
                            <Badge
                              variant={mastery >= 80 ? 'default' : 'outline'}
                              className="text-xs"
                            >
                              {mastery}% mastery
                            </Badge>
                          </div>
                          <p className="font-medium line-clamp-2 mb-1">
                            {card.front_text}
                          </p>
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {card.back_text}
                          </p>
                          {card.source_reference && (
                            <p className="text-xs text-muted-foreground mt-2">
                              Source: {card.source_reference}
                            </p>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive"
                          onClick={() => setCardToDelete(card)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </ScrollArea>

        {/* Delete confirmation dialog */}
        <AlertDialog open={!!cardToDelete} onOpenChange={() => setCardToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Flashcard?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete this flashcard and all its review history.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteCard} className="bg-destructive text-destructive-foreground">
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  // Home view
  return (
    <div className="space-y-6 p-4 md:p-6 pb-16">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Daily Mastery</h1>
          <p className="text-sm text-muted-foreground">
            Master concepts with The Mastery Loop
          </p>
        </div>
      </div>

      {/* Due today banner */}
      {stats && stats.dueToday > 0 && (
        <Card className="bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-primary/20">
                  <Target className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-semibold">
                    {stats.dueToday} card{stats.dueToday !== 1 ? 's' : ''} due today!
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Keep your streak going 🔥
                  </p>
                </div>
              </div>
              <Button onClick={() => setView('review')}>
                <Play className="h-4 w-4 mr-2" />
                Start Review
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card
          className="cursor-pointer hover:border-primary/50 transition-colors"
          onClick={() => setView('create')}
        >
          <CardContent className="py-4 text-center">
            <div className="p-3 rounded-full bg-primary/10 w-fit mx-auto mb-2">
              <Plus className="h-6 w-6 text-primary" />
            </div>
            <p className="font-medium">Create Cards</p>
            <p className="text-xs text-muted-foreground">Add new flashcards</p>
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer hover:border-primary/50 transition-colors"
          onClick={() => setView('review')}
        >
          <CardContent className="py-4 text-center">
            <div className="p-3 rounded-full bg-green-500/10 w-fit mx-auto mb-2">
              <Play className="h-6 w-6 text-green-500" />
            </div>
            <p className="font-medium">Review</p>
            <p className="text-xs text-muted-foreground">
              {stats?.dueToday || 0} cards due
            </p>
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer hover:border-primary/50 transition-colors"
          onClick={() => setView('browse')}
        >
          <CardContent className="py-4 text-center">
            <div className="p-3 rounded-full bg-primary/10 w-fit mx-auto mb-2">
              <BookOpen className="h-6 w-6 text-primary" />
            </div>
            <p className="font-medium">Browse</p>
            <p className="text-xs text-muted-foreground">
              {stats?.totalCards || 0} total cards
            </p>
          </CardContent>
        </Card>

        <Card className="cursor-default">
          <CardContent className="py-4 text-center">
            <div className="p-3 rounded-full bg-info/10 w-fit mx-auto mb-2">
              <Flame className="h-6 w-6 text-info" />
            </div>
            <p className="font-medium">{stats?.reviewStreak || 0} Day Streak</p>
            <p className="text-xs text-muted-foreground">Keep it up!</p>
          </CardContent>
        </Card>
      </div>

      {/* Stats */}
      <FlashcardStats stats={stats} />
    </div>
  );
}
