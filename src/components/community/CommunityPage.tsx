import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
    Bell,
    BookOpen,
    ChevronLeft,
    Clock,
    MessageCircle,
    Trophy,
    Users,
} from "lucide-react";

interface CommunityPageProps {
    onBack: () => void;
}

const UPCOMING_FEATURES = [
    {
        icon: Users,
        title: "Subject Study Groups",
        description:
            "Join or create groups with other students taking the same subjects. Share strategies and problem sets.",
        color: "bg-primary/10 text-primary",
    },
    {
        icon: BookOpen,
        title: "Peer Topic Challenges",
        description:
            "Challenge other students to head-to-head quiz battles on specific topics.",
        color: "bg-blue-500/10 text-blue-500",
    },
    {
        icon: MessageCircle,
        title: "Discussion Threads",
        description:
            "Ask questions, share explanations, and discuss difficult UTME topics with your peers.",
        color: "bg-violet-500/10 text-violet-500",
    },
    {
        icon: Trophy,
        title: "Subject Leaderboards",
        description:
            "See how you rank against other students in each subject, not just overall.",
        color: "bg-yellow-500/10 text-yellow-500",
    },
];

export function CommunityPage({ onBack }: CommunityPageProps) {
    return (
        <div className="mx-auto max-w-2xl px-4 py-6 space-y-8">
            {/* Back */}
            <button
                onClick={onBack}
                className="flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
                <ChevronLeft className="h-4 w-4" />
                Dashboard
            </button>

            {/* Hero */}
            <div className="rounded-2xl border bg-primary/5 p-6 sm:p-8 text-center space-y-4">
                <div className="flex justify-center">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
                        <Users className="h-7 w-7 text-primary" />
                    </div>
                </div>
                <div className="space-y-2">
                    <div className="flex items-center justify-center gap-2">
                        <h1 className="text-2xl font-bold tracking-tight">Community</h1>
                        <Badge className="bg-primary/15 text-primary border-primary/25 text-xs font-semibold tracking-wide">
                            Coming Soon
                        </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
                        Learn better together. The Community hub will connect you with other
                        UTME candidates to study, compete, and grow as a group.
                    </p>
                </div>

                {/* Notify CTA */}
                <Button variant="outline" className="gap-2 mt-2" disabled>
                    <Bell className="h-4 w-4" />
                    Notify me when it launches
                </Button>
                <p className="text-xs text-muted-foreground">
                    <Clock className="inline h-3 w-3 mr-1" />
                    Estimated: mid-2026
                </p>
            </div>

            {/* Feature preview cards */}
            <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground px-1">
                    What's coming
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {UPCOMING_FEATURES.map((feat) => (
                        <Card key={feat.title} className="opacity-75">
                            <CardContent className="p-4 flex items-start gap-3">
                                <div
                                    className={cn(
                                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                                        feat.color
                                    )}
                                >
                                    <feat.icon className="h-4 w-4" />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-sm font-semibold leading-tight mb-0.5">
                                        {feat.title}
                                    </p>
                                    <p className="text-xs text-muted-foreground leading-snug">
                                        {feat.description}
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>

            <p className="text-center text-xs text-muted-foreground pb-4">
                Have ideas for the Community hub?{" "}
                <a
                    href="mailto:hello@quizant.com"
                    className="text-primary underline-offset-2 hover:underline"
                >
                    Let us know
                </a>
            </p>
        </div>
    );
}
