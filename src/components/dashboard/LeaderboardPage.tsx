import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ChevronLeft, MapPin, Medal, Trophy } from "lucide-react";

interface LeaderboardPageProps {
    onBack: () => void;
}

const leaderboardData = [
    { id: 1, name: "David O.", state: "Lagos", score: 384, rank: 1, diff: "+12", isCurrentUser: false },
    { id: 2, name: "Teniola A.", state: "Oyo", score: 375, rank: 2, diff: "+5", isCurrentUser: true }, // Highlighted User
    { id: 3, name: "Chioma E.", state: "Enugu", score: 372, rank: 3, diff: "+8", isCurrentUser: false },
    { id: 4, name: "Emmanuel S.", state: "Abuja", score: 368, rank: 4, diff: "-2", isCurrentUser: false },
    { id: 5, name: "Fatima M.", state: "Kano", score: 351, rank: 5, diff: "+15", isCurrentUser: false },
    { id: 6, name: "Olamide B.", state: "Ogun", score: 349, rank: 6, diff: "+1", isCurrentUser: false },
    { id: 7, name: "Grace U.", state: "Rivers", score: 345, rank: 7, diff: "0", isCurrentUser: false },
    { id: 8, name: "Ibrahim K.", state: "Kaduna", score: 338, rank: 8, diff: "-4", isCurrentUser: false },
    { id: 9, name: "Zainab A.", state: "Kwara", score: 330, rank: 9, diff: "+2", isCurrentUser: false },
    { id: 10, name: "Victoria N.", state: "Edo", score: 325, rank: 10, diff: "-1", isCurrentUser: false },
];

export function LeaderboardPage({ onBack }: LeaderboardPageProps) {
    return (
        <div className="bg-background overflow-y-auto w-full h-full">
            <main className="mx-auto max-w-4xl p-4 sm:p-6 space-y-6 pb-16">
                {/* Header */}
                <div className="space-y-1">
                    <button
                        onClick={onBack}
                        className="flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                    >
                        <ChevronLeft className="h-4 w-4" />
                        Dashboard
                    </button>
                    <div className="flex items-center gap-2">
                        <Trophy className="h-6 w-6 text-primary" />
                        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">National Leaderboard</h1>
                    </div>
                    <p className="text-sm text-muted-foreground">
                        See how you rank against thousands of other UTME candidates nationwide.
                    </p>
                </div>

                <div className="grid gap-6 md:grid-cols-3">
                    {/* Top 3 Podium (Desktop) */}
                    <div className="md:col-span-3 lg:col-span-1 space-y-4">
                        <Card className="bg-primary/5 border-primary/20">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-base flex items-center gap-2">
                                    <Medal className="h-4 w-4 text-primary" />
                                    Your Current Status
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-3xl font-bold font-display text-primary">#2</p>
                                        <p className="text-sm text-muted-foreground mt-1">Top 1% Nationwide</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-2xl font-bold font-display">375</p>
                                        <p className="text-sm text-muted-foreground mt-1">Mastery Score</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                                    Rank Criteria
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2 text-sm">
                                <p className="flex justify-between">
                                    <span className="text-muted-foreground">Mock Exams</span>
                                    <span className="font-medium">40%</span>
                                </p>
                                <p className="flex justify-between">
                                    <span className="text-muted-foreground">Daily Quizzes</span>
                                    <span className="font-medium">35%</span>
                                </p>
                                <p className="flex justify-between">
                                    <span className="text-muted-foreground">Consistency</span>
                                    <span className="font-medium">25%</span>
                                </p>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Main Table List */}
                    <Card className="md:col-span-3 lg:col-span-2 overflow-hidden shadow-sm">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs text-muted-foreground uppercase bg-muted/50">
                                    <tr>
                                        <th className="px-6 py-4 font-medium">Rank</th>
                                        <th className="px-6 py-4 font-medium">Candidate</th>
                                        <th className="px-6 py-4 font-medium hidden sm:table-cell">Region</th>
                                        <th className="px-6 py-4 font-medium text-right">Score</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border/50">
                                    {leaderboardData.map((user) => (
                                        <tr
                                            key={user.id}
                                            className={cn(
                                                "hover:bg-muted/30 transition-colors",
                                                user.isCurrentUser ? "bg-primary/10 hover:bg-primary/15" : "bg-card"
                                            )}
                                        >
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <span className={cn(
                                                        "flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold",
                                                        user.rank === 1 ? "bg-yellow-500/20 text-yellow-600 dark:text-yellow-500" :
                                                            user.rank === 2 ? "bg-slate-300/30 text-slate-600 dark:text-slate-400" :
                                                                user.rank === 3 ? "bg-amber-700/20 text-amber-700 dark:text-amber-600" :
                                                                    "bg-muted text-muted-foreground"
                                                    )}>
                                                        {user.rank}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <Avatar className="h-8 w-8 border border-background shadow-xs">
                                                        <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${user.name}`} />
                                                        <AvatarFallback className="text-[10px]">{user.name.charAt(0)}</AvatarFallback>
                                                    </Avatar>
                                                    <div>
                                                        <p className={cn(
                                                            "font-medium",
                                                            user.isCurrentUser ? "text-primary font-bold" : "text-foreground"
                                                        )}>
                                                            {user.name} {user.isCurrentUser && "(You)"}
                                                        </p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 hidden sm:table-cell">
                                                <div className="flex items-center gap-1.5 text-muted-foreground">
                                                    <MapPin className="h-3 w-3" />
                                                    <span>{user.state}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex flex-col items-end">
                                                    <span className="font-bold">{user.score}</span>
                                                    <span className={cn(
                                                        "text-[10px] font-medium",
                                                        user.diff.startsWith('+') ? "text-green-500" :
                                                            user.diff.startsWith('-') ? "text-red-500" : "text-muted-foreground"
                                                    )}>
                                                        {user.diff} pts
                                                    </span>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                </div>
            </main>
        </div>
    );
}
