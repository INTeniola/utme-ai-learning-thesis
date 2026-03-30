import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/useAuth';
import { LeaderboardEntry, useLeaderboard } from '@/hooks/useLeaderboard';
import { cn } from '@/lib/utils';
import { AlertCircle, ChevronLeft, Medal, RefreshCw, Trophy } from 'lucide-react';

interface LeaderboardPageProps {
    onBack?: () => void;
}

const RANK_ICONS: Record<number, React.ReactNode> = {
    1: <Trophy className="h-4 w-4 text-yellow-500" />,
    2: <Medal className="h-4 w-4 text-muted-foreground" />,
    3: <Medal className="h-4 w-4 text-amber-600" />,
};

function RankCell({ rank }: { rank: number }) {
    return (
        <div className="flex w-6 items-center justify-center shrink-0">
            {RANK_ICONS[rank] ?? (
                <span className="text-sm font-semibold text-muted-foreground tabular-nums">
                    {rank}
                </span>
            )}
        </div>
    );
}

function EntryRow({ entry, dimmed = false }: { entry: LeaderboardEntry; dimmed?: boolean }) {
    const pct = entry.totalQuestions > 0
        ? Math.round((entry.score / entry.totalQuestions) * 100)
        : 0;

    return (
        <li
            className={cn(
                'flex items-center gap-3 px-4 py-3 transition-colors',
                entry.isCurrentUser
                    ? 'bg-primary/8 border-l-2 border-primary'
                    : dimmed
                        ? 'opacity-60'
                        : 'hover:bg-muted/40'
            )}
        >
            <RankCell rank={entry.rank} />

            <Avatar className="h-8 w-8 shrink-0">
                <AvatarFallback className="text-xs bg-primary/10 text-primary font-semibold">
                    {entry.username.slice(0, 2).toUpperCase()}
                </AvatarFallback>
            </Avatar>

            <div className="flex-1 min-w-0">
                <p className={cn(
                    'text-sm font-medium truncate',
                    entry.isCurrentUser && 'text-primary'
                )}>
                    {entry.username}
                    {entry.isCurrentUser && (
                        <Badge
                            variant="outline"
                            className="ml-2 text-[10px] py-0 px-1.5 border-primary/40 text-primary"
                        >
                            You
                        </Badge>
                    )}
                </p>
            </div>

            <div className="text-right shrink-0">
                <p className={cn(
                    'text-sm font-bold tabular-nums',
                    entry.isCurrentUser ? 'text-primary' : 'text-foreground'
                )}>
                    {entry.score}
                    <span className="text-[10px] font-normal text-muted-foreground ml-0.5">
                        /{entry.totalQuestions} ({pct}%)
                    </span>
                </p>
            </div>
        </li>
    );
}

export function LeaderboardPage({ onBack }: LeaderboardPageProps) {
    const { user } = useAuth();
    const { loading, data, error, refresh } = useLeaderboard(user?.id);

    return (
        <div className="mx-auto max-w-2xl px-4 py-6 space-y-6 animate-fade-in">
            {/* Back */}
            {onBack && (
                <button
                    onClick={onBack}
                    className="flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                    <ChevronLeft className="h-4 w-4" />
                    Dashboard
                </button>
            )}

            {/* Header */}
            <div className="text-center space-y-1">
                <div className="flex items-center justify-center gap-2 mb-2">
                    <Trophy className="h-7 w-7 text-yellow-500" />
                    <h1 className="text-2xl font-bold tracking-tight">Leaderboard</h1>
                </div>
                <p className="text-sm text-muted-foreground">
                    Top students ranked by best mock exam score (out of total questions)
                </p>
                <Badge variant="secondary" className="text-xs">UTME 2026</Badge>
            </div>

            {/* Loading */}
            {loading && (
                <Card>
                    <CardHeader className="pb-3">
                        <Skeleton className="h-5 w-32" />
                        <Skeleton className="h-4 w-48 mt-1" />
                    </CardHeader>
                    <CardContent className="p-0">
                        <ul className="divide-y divide-border">
                            {[...Array(5)].map((_, i) => (
                                <li key={i} className="flex items-center gap-3 px-4 py-3">
                                    <Skeleton className="h-4 w-6" />
                                    <Skeleton className="h-8 w-8 rounded-full" />
                                    <Skeleton className="h-4 flex-1" />
                                    <Skeleton className="h-4 w-16" />
                                </li>
                            ))}
                        </ul>
                    </CardContent>
                </Card>
            )}

            {/* Error */}
            {!loading && error && (
                <Card>
                    <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
                        <AlertCircle className="h-8 w-8 text-destructive" />
                        <p className="text-sm text-muted-foreground">{error}</p>
                        <Button onClick={refresh} variant="outline" size="sm" className="gap-2">
                            <RefreshCw className="h-4 w-4" />
                            Retry
                        </Button>
                    </CardContent>
                </Card>
            )}

            {/* Empty state */}
            {!loading && !error && data?.totalUsers === 0 && (
                <Card>
                    <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
                        <Trophy className="h-12 w-12 text-muted-foreground/30" />
                        <h3 className="font-semibold text-base">No scores yet</h3>
                        <p className="text-sm text-muted-foreground max-w-xs">
                            Be the first to claim the top spot — complete a CBT mock exam to appear here.
                        </p>
                    </CardContent>
                </Card>
            )}

            {/* Leaderboard list */}
            {!loading && !error && data && data.totalUsers > 0 && (
                <>
                    <Card>
                        <CardHeader className="pb-3 flex-row items-center justify-between">
                            <div>
                                <CardTitle className="text-base">Top Performers</CardTitle>
                                <CardDescription>
                                    {data.totalUsers} student{data.totalUsers !== 1 ? 's' : ''} ranked ·
                                    best single mock exam score
                                </CardDescription>
                            </div>
                            <Button
                                onClick={refresh}
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground"
                                title="Refresh"
                            >
                                <RefreshCw className="h-3.5 w-3.5" />
                            </Button>
                        </CardHeader>

                        <CardContent className="p-0">
                            <ul className="divide-y divide-border">
                                {data.top20.map(entry => (
                                    <EntryRow key={entry.userId} entry={entry} />
                                ))}
                            </ul>

                            {/* Separator + user row when outside top 20 */}
                            {!data.currentUserInTop20 && data.currentUserRank && (
                                <>
                                    {/* Visual separator */}
                                    <div className="flex items-center gap-3 px-4 py-1.5 border-t border-dashed border-border">
                                        <div className="flex-1 border-t border-dashed border-border/60" />
                                        <span className="text-[10px] text-muted-foreground shrink-0">
                                            your position
                                        </span>
                                        <div className="flex-1 border-t border-dashed border-border/60" />
                                    </div>

                                    {/* Current user's row */}
                                    <EntryRow
                                        entry={{
                                            rank: data.currentUserRank.rank,
                                            userId: user!.id,
                                            username: (user?.user_metadata?.username as string) ||
                                                `user_${user!.id.slice(0, 6)}`,
                                            score: data.currentUserRank.score,
                                            totalQuestions: data.currentUserRank.totalQuestions,
                                            isCurrentUser: true,
                                        }}
                                    />

                                    {/* Percentile badge */}
                                    <div className="px-4 py-2 border-t border-border bg-muted/30">
                                        <p className="text-xs text-muted-foreground text-center">
                                            You&apos;re in the{' '}
                                            <span className="font-semibold text-foreground">
                                                top {100 - data.currentUserRank.percentile + 1}%
                                            </span>{' '}
                                            — keep going to crack the top 20
                                        </p>
                                    </div>
                                </>
                            )}

                            {/* User is in top 20 but we still show their percentile */}
                            {data.currentUserInTop20 && data.currentUserRank && (
                                <div className="px-4 py-2 border-t border-border bg-muted/30">
                                    <p className="text-xs text-muted-foreground text-center">
                                        You&apos;re ranked{' '}
                                        <span className="font-semibold text-foreground">
                                            #{data.currentUserRank.rank}
                                        </span>{' '}
                                        — top{' '}
                                        <span className="font-semibold text-foreground">
                                            {100 - data.currentUserRank.percentile + 1}%
                                        </span>{' '}
                                        of all students
                                    </p>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* User has no score yet */}
                    {!data.currentUserRank && (
                        <p className="text-center text-xs text-muted-foreground pb-2">
                            Complete a CBT mock exam to claim your spot on the leaderboard
                        </p>
                    )}
                </>
            )}
        </div>
    );
}
