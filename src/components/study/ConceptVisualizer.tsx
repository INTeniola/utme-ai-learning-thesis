import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { TTSPlayer } from '@/components/ui/TTSPlayer';
import { useConceptGenerator } from '@/hooks/useConceptGenerator';
import { useHybridTTS } from '@/hooks/useHybridTTS';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import html2canvas from 'html2canvas';
import { TreeStructure } from '@phosphor-icons/react';
import {
    ChevronLeft,
    Image as ImageIcon,
    Maximize2,
    Minimize2,
    Pause,
    Play,
    SkipBack,
    SkipForward,
    Volume2,
    VolumeX,
    Layout,
    GitBranch,
    Brain
} from 'lucide-react';
import { Lightning, Cards, GitBranch as GitBranchIcon, ClipboardText, Books } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { ConceptMapLanding } from './ConceptMapLanding';
import { MathVisualizer } from './MathVisualizer';
import MermaidRenderer from './MermaidRenderer';

interface ConceptVisualizerProps {
    subject?: string;
    onBack: () => void;
    activeFocusId?: string | null;
}

export function ConceptVisualizer({ subject = 'General', onBack, activeFocusId }: ConceptVisualizerProps) {
    const [topic, setTopic] = useState('');
    const [currentStepIndex, setCurrentStepIndex] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [autoNarrate, setAutoNarrate] = useState(true);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const visualPanelRef = useRef<HTMLDivElement>(null);

    const { generating, lesson, generateLesson, reset } = useConceptGenerator();
    const tts = useHybridTTS({ provider: 'auto' });

    // Auto-narrate when step changes
    useEffect(() => {
        if (lesson && autoNarrate && isPlaying) {
            const currentStep = lesson.steps[currentStepIndex];
            if (currentStep) {
                tts.speak(currentStep.narration);
            }
        }
    }, [currentStepIndex, lesson, autoNarrate, isPlaying]);

    const handleGenerate = async () => {
        if (!topic.trim()) return;
        await generateLesson(topic, subject);
        setCurrentStepIndex(0);
        setIsPlaying(false);
    };

    const handlePlayPause = () => {
        if (isPlaying) {
            tts.stop();
            setIsPlaying(false);
        } else {
            setIsPlaying(true);
            if (lesson && autoNarrate) {
                tts.speak(lesson.steps[currentStepIndex].narration);
            }
        }
    };

    const handleNext = () => {
        if (lesson && currentStepIndex < lesson.steps.length - 1) {
            tts.stop();
            setCurrentStepIndex(prev => prev + 1);
        }
    };

    const handlePrevious = () => {
        if (currentStepIndex > 0) {
            tts.stop();
            setCurrentStepIndex(prev => prev - 1);
        }
    };

    const handleReset = () => {
        tts.stop();
        setIsPlaying(false);
        setCurrentStepIndex(0);
        reset();
        setTopic('');
    };

    const toggleFullscreen = () => {
        setIsFullscreen(!isFullscreen);
    };

    const handleDownloadImage = async () => {
        if (!visualPanelRef.current) return;
        try {
            const canvas = await html2canvas(visualPanelRef.current, {
                backgroundColor: '#0f172a', // match dark theme slate 900
                scale: 2,
            });
            const link = document.createElement('a');
            link.download = `${topic || 'lesson'}-step-${currentStepIndex + 1}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
            toast.success("Graphic locked into your local storage. Time to study!");
        } catch (err) {
            console.error("Failed to save image:", err);
            toast.error("I couldn't capture that visual just now. Let's try that again.");
        }
    };

    const currentStep = lesson?.steps[currentStepIndex];
    const progress = lesson ? ((currentStepIndex + 1) / lesson.steps.length) * 100 : 0;

    return (
        <div className={cn(
            "flex flex-col h-full p-4 space-y-4 transition-all duration-300 w-full",
            isFullscreen ? "fixed inset-0 z-50 bg-background h-screen p-6" : "mx-auto"
        )}>
            {/* Header */}
            <div className="flex items-center justify-between border-b pb-4">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={isFullscreen ? toggleFullscreen : onBack}>
                        {isFullscreen ? <Minimize2 className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
                    </Button>
                    <h2 className="text-xl md:text-2xl font-display font-semibold text-primary flex items-center gap-2">
                        <Brain className="h-5 w-5 md:h-6 md:w-6" />
                        <span className="truncate">Concept Map</span>
                    </h2>
                </div>
                <div className="flex items-center gap-2">
                    {generating && (
                        <Badge variant="outline" className="animate-pulse bg-primary/5 text-primary border-primary/20">
                            Analyzing...
                        </Badge>
                    )}
                    {lesson && (
                        <>
                            <Button variant="ghost" size="icon" onClick={toggleFullscreen} className="hidden md:flex">
                                {isFullscreen ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
                            </Button>
                            <Button variant="outline" size="sm" onClick={handleReset}>
                                New Topic
                            </Button>
                        </>
                    )}
                </div>
            </div>

            {/* Topic Input - Render the new Landing Component */}
            {!lesson && !generating && (
                <div className="flex-1 w-full h-full flex items-center justify-center p-0 md:p-4">
                    <ConceptMapLanding
                        onBack={onBack}
                        onGenerateMap={async (selectedTopic) => {
                            setTopic(selectedTopic);
                            await generateLesson(selectedTopic, subject);
                            setCurrentStepIndex(0);
                            setIsPlaying(false);
                        }}
                    />
                </div>
            )}

            {/* Academic Loader */}
            {generating && (
                <div className="flex-1 flex flex-col items-center justify-center space-y-8 animate-in fade-in duration-500">
                    <div className="relative">
                        <div className="h-24 w-24 rounded-3xl bg-primary/10 border-2 border-primary/20 flex items-center justify-center animate-pulse">
                            <GitBranchIcon weight="duotone" className="h-10 w-10 text-primary" />
                        </div>
                        <div className="absolute inset-0 h-24 w-24 rounded-3xl border-2 border-primary animate-ping opacity-20" />
                    </div>
                    <div className="text-center space-y-4 max-w-md">
                        <h3 className="text-xl font-bold tracking-tight">Synthesizing Concept Map</h3>
                        <p className="text-sm text-muted-foreground leading-relaxed px-6">
                            Mentat is weaving complex logic structures and cross-referencing syllabus nodes for an optimal visual breakdown.
                        </p>
                        <div className="pt-4 px-12">
                           <Progress value={45} className="h-1.5 animate-pulse" />
                           <p className="text-[10px] uppercase font-black tracking-widest text-primary/60 mt-4">Optimizing Diagram...</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Lesson Player */}
            {lesson && currentStep && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex-1 flex flex-col gap-4 overflow-hidden"
                >
                    {/* Prompt Header */}
                    <div className="flex items-center justify-between pb-2 border-b border-white/10 shrink-0">
                        <h3 className="text-lg md:text-xl font-medium text-foreground flex items-center gap-2">
                            <span className="text-muted-foreground text-sm font-normal">Visualizing:</span>
                            {topic}
                        </h3>
                        <Button variant="outline" size="sm" onClick={handleDownloadImage} className="gap-2 bg-background/50 backdrop-blur-sm hover:bg-primary/20 hover:text-primary">
                            <ImageIcon className="h-4 w-4" />
                            <span className="hidden sm:inline">Save Graphic</span>
                        </Button>
                    </div>

                    {/* Progress Bar */}
                    <div className="space-y-2 shrink-0">
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground font-medium">
                                Step {currentStepIndex + 1} of {lesson.steps.length}
                            </span>
                            <span className="text-muted-foreground">
                                ~{Math.ceil(lesson.totalDuration / 60)} min lesson
                            </span>
                        </div>
                        <Progress value={progress} className="h-2" />
                    </div>

                    {/* Main Content */}
                    <div className="flex-1 grid lg:grid-cols-2 gap-4 min-h-0">
                        {/* Visual Panel */}
                        <Card ref={visualPanelRef} className="flex flex-col bg-card/40 backdrop-blur-sm border-white/10 overflow-hidden">
                            <CardHeader className="bg-black/20 pb-3">
                                <Badge variant="outline" className="w-fit bg-primary/10 text-primary border-primary/20">
                                    {currentStep.title}
                                </Badge>
                            </CardHeader>
                            <CardContent className="flex-1 flex flex-col items-center justify-center p-0 overflow-hidden bg-white/5 relative group">
                                <AnimatePresence mode="wait">
                                    <motion.div
                                        key={currentStepIndex}
                                        initial={{ opacity: 0, scale: 0.98 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.98 }}
                                        transition={{ duration: 0.4, ease: "easeOut" }}
                                        className="w-full h-full flex items-center justify-center p-4"
                                    >
                                        {currentStep.motionData && currentStep.motionData.length > 0 ? (
                                            <MathVisualizer data={currentStep.motionData} />
                                        ) : currentStep.mermaidDiagram ? (
                                            <MermaidRenderer 
                                                id={`step-${currentStepIndex}`}
                                                chart={currentStep.mermaidDiagram}
                                                highlightedId={activeFocusId}
                                                className="w-full h-full"
                                            />
                                        ) : (
                                            <div className="text-center space-y-4 p-8 border-2 border-dashed border-primary/20 rounded-lg m-8">
                                                <TreeStructure weight="duotone" className="h-12 w-12 mx-auto text-primary/50" />
                                                <p className="text-muted-foreground">{currentStep.visualDescription}</p>
                                            </div>
                                        )}
                                    </motion.div>
                                </AnimatePresence>

                                <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />
                            </CardContent>
                        </Card>

                        {/* Explanation Panel */}
                        <Card className="flex flex-col bg-card/40 backdrop-blur-sm border-white/10 overflow-hidden">
                            <CardHeader className="bg-black/20 pb-3">
                                <CardTitle className="text-lg flex items-center gap-2">
                                    <Volume2 className={cn("h-5 w-5", isPlaying && "text-primary animate-pulse")} />
                                    Explanation
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="flex-1 overflow-auto p-6 space-y-6">
                                <div className="prose prose-invert max-w-none">
                                    <p className="text-base leading-relaxed text-foreground/90">{currentStep.explanation}</p>
                                </div>

                                <div className="p-4 bg-primary/5 rounded-xl border border-primary/10 backdrop-blur-sm">
                                    <div className="flex items-start gap-3">
                                        <Volume2 className="h-4 w-4 text-primary mt-1 shrink-0" />
                                        <div className="flex-1">
                                            <p className="text-sm leading-relaxed text-muted-foreground italic mb-2">
                                                "{currentStep.narration}"
                                            </p>
                                            <div className="mt-2 -mx-2">
                                                <TTSPlayer tts={tts} autoHide={false} />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Controls */}
                    <Card className="bg-card/40 backdrop-blur-sm border-white/10 shrink-0">
                        <CardContent className="p-4">
                            <div className="flex items-center justify-center gap-4 md:gap-8">
                                <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={handlePrevious}
                                    disabled={currentStepIndex === 0}
                                    className="h-10 w-10 rounded-full"
                                >
                                    <SkipBack className="h-4 w-4" />
                                </Button>

                                <Button
                                    size="lg"
                                    onClick={handlePlayPause}
                                    className={cn(
                                        "h-14 w-14 rounded-full shadow-lg transition-transform hover:scale-105 active:scale-95",
                                        isPlaying ? "bg-amber-500 hover:bg-amber-600" : "bg-primary hover:bg-primary/90"
                                    )}
                                >
                                    {isPlaying ? (
                                        <Pause className="h-6 w-6 fill-current" />
                                    ) : (
                                        <Play className="h-6 w-6 fill-current ml-1" />
                                    )}
                                </Button>

                                <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={handleNext}
                                    disabled={currentStepIndex === lesson.steps.length - 1}
                                    className="h-10 w-10 rounded-full"
                                >
                                    <SkipForward className="h-4 w-4" />
                                </Button>

                                <div className="absolute right-4 hidden md:block">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setAutoNarrate(!autoNarrate)}
                                        className={cn("gap-2", autoNarrate ? "text-primary" : "text-muted-foreground")}
                                    >
                                        {autoNarrate ? (
                                            <>
                                                <Volume2 className="h-4 w-4" />
                                                Auto-Play
                                            </>
                                        ) : (
                                            <>
                                                <VolumeX className="h-4 w-4" />
                                                Muted
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>
            )}
        </div>
    );
}
