import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { ChevronLeft, Brain as BrainIcon, Search, Layout, Brain } from 'lucide-react';
import { useState } from 'react';

interface ConceptMapLandingProps {
    onBack: () => void;
    onGenerateMap: (topic: string) => void;
}

// Reusable micro-component for the Ghost Clusters to make the background feel alive
const GhostCluster = ({
    className,
    nodes = 5
}: {
    className?: string;
    nodes?: number;
}) => {
    // Generate random positions around a central hub
    const generateNodes = () => {
        return Array.from({ length: nodes }).map((_, i) => {
            const angle = (i * 2 * Math.PI) / nodes;
            const radius = 30 + Math.random() * 20;
            return {
                x: 50 + radius * Math.cos(angle),
                y: 50 + radius * Math.sin(angle),
            };
        });
    };

    const childNodes = generateNodes();

    return (
        <div className={cn("absolute opacity-20 pointer-events-none transition-opacity duration-1000", className)}>
            <svg width="120" height="120" viewBox="0 0 100 100" className="overflow-visible">
                {/* Connection Lines */}
                {childNodes.map((pos, i) => (
                    <line
                        key={`line-${i}`}
                        x1="50"
                        y1="50"
                        x2={pos.x}
                        y2={pos.y}
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeOpacity="0.4"
                    />
                ))}
                {/* Central Hub */}
                <circle cx="50" cy="50" r="4" fill="currentColor" />
                {/* Child Nodes */}
                {childNodes.map((pos, i) => (
                    <circle key={`node-${i}`} cx={pos.x} cy={pos.y} r="3" fill="currentColor" opacity="0.8" />
                ))}
            </svg>
        </div>
    );
};

export function ConceptMapLanding({ onBack, onGenerateMap }: ConceptMapLandingProps) {
    const [topic, setTopic] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (topic.trim()) {
            onGenerateMap(topic.trim());
        }
    };

    return (
        <div className="relative min-h-[calc(100vh-80px)] w-full flex flex-col bg-background text-foreground overflow-hidden rounded-2xl border border-border">

            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                {/* Ambient Gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent" />

                {/* Faded Example Clusters */}
                <GhostCluster className="top-[15%] left-[15%] text-primary/40 animate-pulse" nodes={6} />
                <GhostCluster className="bottom-[20%] left-[25%] text-muted-foreground/20 scale-75 blur-[1px]" nodes={4} />
                <GhostCluster className="top-[25%] right-[20%] text-primary/30 scale-125 opacity-10" nodes={8} />
                <GhostCluster className="bottom-[15%] right-[15%] text-muted-foreground/20 blur-[2px]" nodes={5} />
            </div>

            {/* Header/Nav - Removed redundant back button to center focus */}
            <div className="relative z-10 w-full p-6 flex justify-between items-center bg-transparent h-16">
                {/* Empty spacer to balance layout */}
            </div>

            {/* Central Prompt Area */}
            <div className="relative z-10 flex-1 flex flex-col items-center justify-center p-6 sm:p-12">
                <div className="w-full max-w-2xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700">

                    <div className="text-center space-y-3">
                        <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-primary/10 mb-4 ring-1 ring-primary/20 shadow-xl shadow-primary/10">
                            <Brain className="h-8 w-8 text-primary" />
                        </div>
                        <h1 className="text-3xl sm:text-4xl font-display font-medium tracking-tight">
                            Concept Map Analysis.
                        </h1>
                        <p className="text-muted-foreground text-lg max-w-lg mx-auto font-sans">
                            Enter any topic to generate a visual concept map and adaptive breakdown.
                        </p>
                    </div>

                    <Card className="bg-card/80 backdrop-blur-xl border-primary/20 shadow-2xl p-2 rounded-2xl">
                        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2">
                            <div className="relative flex-1 flex items-center">
                                <Search className="absolute left-4 h-5 w-5 text-muted-foreground" />
                                <Input
                                    value={topic}
                                    onChange={(e) => setTopic(e.target.value)}
                                    placeholder="E.g. Cell Division, Nigerian History, Thermodynamics..."
                                    className="h-14 pl-12 pr-4 bg-transparent border-0 focus-visible:ring-0 text-lg placeholder:text-muted-foreground/50 rounded-xl"
                                    autoFocus
                                />
                            </div>
                            <Button
                                type="submit"
                                size="lg"
                                disabled={!topic.trim()}
                                className="h-14 px-8 rounded-xl font-semibold text-base transition-all disabled:opacity-50"
                            >
                                Start Analysis
                            </Button>
                        </form>
                    </Card>

                    <div className="text-center pt-8">
                        {/* Examples removed to reduce clutter as requested */}
                    </div>
                </div>
            </div>
        </div>
    );
}
