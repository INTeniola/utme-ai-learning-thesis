import { AITutorPanel } from '@/components/study/AITutorPanel';
import { LatexRenderer } from '@/components/study/LatexRenderer';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Flashcard, useFlashcards } from '@/hooks/useFlashcards';
import { RATING_LABELS, getIntervalPreview } from '@/lib/spacedRepetition';
import { cn } from '@/lib/utils';
import { sanitizeQuestion } from '@/lib/textUtils';
import {
    ArrowLeft,
    ChevronLeft,
    ChevronRight,
    HelpCircle,
    RotateCcw,
    Trash2,
    Volume2,
    ImageIcon,
    Loader2
} from 'lucide-react';
import { generateVisualAid } from '@/lib/visualGenerator';
import { useEffect, useState } from 'react';

interface FlashcardReviewProps {
  cards: Flashcard[];
  onBack: () => void;
  onComplete: () => void;
}

export function FlashcardReview({ cards, onBack, onComplete }: FlashcardReviewProps) {
  // Clear session storage when completing
  const handleComplete = () => {
    sessionStorage.removeItem('flashcard_current_index');
    onComplete();
  };
  const { reviewCard, deleteCard } = useFlashcards();
  const [currentIndex, setCurrentIndex] = useState(() => {
    const saved = sessionStorage.getItem('flashcard_current_index');
    const parsed = saved ? parseInt(saved, 10) : 0;
    return cards.length > 0 ? Math.min(parsed, cards.length - 1) : 0;
  });

  useEffect(() => {
    sessionStorage.setItem('flashcard_current_index', currentIndex.toString());
  }, [currentIndex]);
  const [isFlipped, setIsFlipped] = useState(false);
  const [reviewStartTime, setReviewStartTime] = useState<number>(Date.now());
  const [showTutor, setShowTutor] = useState(false);
  const [reviewedCount, setReviewedCount] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [visualAid, setVisualAid] = useState<string | null>(null);
  const [isGeneratingVisual, setIsGeneratingVisual] = useState(false);

  const currentCard = cards[currentIndex];
  const progress = cards.length > 0 ? (reviewedCount / cards.length) * 100 : 0;

  // Reset timer when card changes
  useEffect(() => {
    setReviewStartTime(Date.now());
    setIsFlipped(false);
    setVisualAid(null); // Reset visual aid for new card
  }, [currentIndex]);

  // Handle rating submission
  const handleRate = async (rating: number) => {
    if (!currentCard || isSubmitting) return;

    setIsSubmitting(true);
    const timeToRecall = Date.now() - reviewStartTime;

    const success = await reviewCard(currentCard.id, rating, timeToRecall);

    if (success) {
      setReviewedCount(prev => prev + 1);

      // Move to next card or complete
      if (currentIndex < cards.length - 1) {
        setCurrentIndex(prev => prev + 1);
      } else {
        handleComplete();
      }
    }

    setIsSubmitting(false);
  };

  // Handle card deletion
  const handleDelete = async () => {
    if (!currentCard) return;

    const success = await deleteCard(currentCard.id);
    if (success) {
      if (cards.length === 1) {
        handleComplete();
      } else if (currentIndex >= cards.length - 1) {
        setCurrentIndex(prev => prev - 1);
      }
    }
  };

  // Speak card content
  const speakText = (text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.9;
      window.speechSynthesis.speak(utterance);
    }
  };

  const handleIllustrate = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentCard || isGeneratingVisual) return;

    setIsGeneratingVisual(true);
    try {
      const imageUrl = await generateVisualAid(currentCard.back_text, currentCard.subject);
      setVisualAid(imageUrl);
    } finally {
      setIsGeneratingVisual(false);
    }
  };

  if (!currentCard) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
        <p className="text-muted-foreground mb-4">No cards to review!</p>
        <Button onClick={onBack}>Go Back</Button>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-2xl mx-auto p-4 md:p-6 pb-16">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="text-center">
          <p className="text-sm text-muted-foreground">
            Reviewing {currentIndex + 1} of {cards.length}
          </p>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="outline">{currentCard.subject}</Badge>
            <Badge variant="secondary">{currentCard.topic}</Badge>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleDelete}
          className="text-destructive hover:text-destructive"
        >
          <Trash2 className="h-5 w-5" />
        </Button>
      </div>

      {/* Progress bar */}
      <div className="space-y-1">
        <Progress value={progress} className="h-2" />
        <p className="text-xs text-muted-foreground text-center">
          {reviewedCount} of {cards.length} reviewed
        </p>
      </div>

      {/* Flashcard with flip animation */}
      <div
        className="perspective-1000 cursor-pointer"
        onClick={() => !isFlipped && setIsFlipped(true)}
      >
        <div
          className={cn(
            "relative w-full min-h-[300px] transition-transform duration-500 transform-style-3d",
            isFlipped && "rotate-y-180"
          )}
          style={{
            transformStyle: 'preserve-3d',
            transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
          }}
        >
          {/* Front of card */}
          <Card
            className={cn(
              "absolute inset-0 backface-hidden",
              isFlipped && "invisible"
            )}
            style={{ backfaceVisibility: 'hidden' }}
          >
            <CardContent className="flex flex-col items-center justify-center min-h-[300px] p-6 text-center">
              <div className="text-lg font-medium mb-4">
                <LatexRenderer content={sanitizeQuestion(currentCard.front_text)} />
              </div>

              {currentCard.source_reference && (
                <p className="text-xs text-muted-foreground mt-4">
                  {currentCard.source_reference}
                </p>
              )}

              <Button
                className="mt-6"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsFlipped(true);
                }}
              >
                Show Answer
              </Button>
            </CardContent>
          </Card>

          {/* Back of card */}
          <Card
            className={cn(
              "absolute inset-0",
              !isFlipped && "invisible"
            )}
            style={{
              backfaceVisibility: 'hidden',
              transform: 'rotateY(180deg)',
            }}
          >
            <CardContent className="flex flex-col min-h-[300px] p-6">
              <div className="flex-1 text-center">
                <div className="text-lg mb-4">
                  <LatexRenderer content={sanitizeQuestion(currentCard.back_text)} />
                </div>
                
                {visualAid && (
                  <div className="mt-4 animate-in fade-in zoom-in duration-500">
                    <img 
                      src={visualAid} 
                      alt="Visual Aid" 
                      className="rounded-lg shadow-md max-h-[150px] mx-auto object-cover border-2 border-primary/20" 
                    />
                  </div>
                )}
              </div>

              {/* Action buttons */}
              <div className="flex justify-center gap-2 pt-4 border-t">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    speakText(currentCard.back_text);
                  }}
                >
                  <Volume2 className="h-4 w-4 mr-1" />
                  Listen
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={isGeneratingVisual || !!visualAid}
                  onClick={handleIllustrate}
                >
                  {isGeneratingVisual ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <ImageIcon className="h-4 w-4 mr-1" />
                  )}
                  {visualAid ? 'Illustrated' : 'Illustrate'}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowTutor(true);
                  }}
                >
                  <HelpCircle className="h-4 w-4 mr-1" />
                  Need Help?
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Rating buttons - only show when flipped */}
      {isFlipped && (
        <div className="grid grid-cols-3 gap-3">
          {[0, 2, 4].map((rating) => {
            const ratingInfo = RATING_LABELS[rating as keyof typeof RATING_LABELS];
            const intervalPreview = getIntervalPreview(rating, currentCard.interval_days);

            return (
              <Button
                key={rating}
                variant="outline"
                className={cn(
                  "flex flex-col h-auto py-5 px-2 rounded-2xl border-2 transition-all hover:scale-[1.02] active:scale-95",
                  rating === 0 && "border-red-100 hover:border-red-500 hover:bg-red-50 dark:hover:bg-red-950/30",
                  rating === 2 && "border-green-100 hover:border-green-500 hover:bg-green-50 dark:hover:bg-green-950/30",
                  rating === 4 && "border-blue-100 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/30",
                )}
                disabled={isSubmitting}
                onClick={(e) => {
                    e.stopPropagation();
                    handleRate(rating);
                }}
              >
                <span className={cn("text-xs font-black uppercase tracking-widest mb-1", ratingInfo.color.split(' ')[0])}>
                    {ratingInfo.label}
                </span>
                <span className="text-[10px] text-muted-foreground font-mono">Next: {intervalPreview}</span>
              </Button>
            );
          })}
        </div>
      )}

      {/* Navigation arrows */}
      <div className="flex justify-between items-center pt-4">
        <Button
          variant="ghost"
          size="sm"
          disabled={currentIndex === 0}
          onClick={() => setCurrentIndex(prev => prev - 1)}
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Previous
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setIsFlipped(false);
            setReviewStartTime(Date.now());
          }}
        >
          <RotateCcw className="h-4 w-4 mr-1" />
          Flip Back
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={currentIndex === cards.length - 1}
          onClick={() => setCurrentIndex(prev => prev + 1)}
        >
          Skip
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>

      {/* AI Tutor Panel */}
      <AITutorPanel
        subject={currentCard.subject}
        topic={currentCard.topic}
        currentQuestion={currentCard.front_text}
        isOpen={showTutor}
        onClose={() => setShowTutor(false)}
      />
    </div>
  );
}
