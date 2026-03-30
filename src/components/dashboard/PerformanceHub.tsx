import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { useProgressDashboard } from "@/hooks/useProgressDashboard";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ActivityHeatmap } from "./ActivityHeatmap";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis
} from "recharts";
import {
  ChevronLeft,
  MapPin,
  RefreshCw,
  Trophy,
  ArrowUpRight,
  Target,
  Calendar,
  BookOpen
} from "lucide-react";

interface PerformanceHubProps {
  onBack?: () => void;
  onNavigateToSubject?: (subject: string) => void;
}

export function PerformanceHub({ onBack, onNavigateToSubject }: PerformanceHubProps) {
  const { user } = useAuth();
  const { loading, data, error, refresh } = useProgressDashboard(user?.id);
  const [leaderboardData, setLeaderboardData] = useState<any[]>([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(true);

  useEffect(() => {
    async function fetchLeaderboard() {
      if (!user?.id) return;
      setLeaderboardLoading(true);
      try {
        // Fetch top scores from exam_sessions first
        const { data: lbData, error: lbError } = await supabase
          .from('exam_sessions')
          .select('user_id, score')
          .eq('status', 'completed')
          .order('score', { ascending: false })
          .limit(50);
          
        if (!lbError && lbData) {
          const uniqueUserIds = Array.from(new Set(lbData.map(d => d.user_id)));
          
          // Fetch profiles for these users to avoid the join error
          const { data: profiles, error: pError } = await supabase
            .from('profiles')
            .select('id, full_name')
            .in('id', uniqueUserIds);
            
          if (!pError && profiles) {
            const profileMap = new Map(profiles.map(p => [p.id, p]));
            const uniqueUsers = new Map();
            
            lbData.forEach(row => {
              if (!uniqueUsers.has(row.user_id)) {
                const profile = profileMap.get(row.user_id);
                uniqueUsers.set(row.user_id, {
                  id: row.user_id,
                  name: profile?.full_name || 'Anonymous candidate',
                  state: 'National',
                  score: row.score,
                  diff: '+0', 
                  isCurrentUser: row.user_id === user.id
                });
              }
            });
            
            const board = Array.from(uniqueUsers.values())
               .sort((a, b) => b.score - a.score)
               .slice(0, 10) // Only top 10
               .map((u, i) => ({ ...u, rank: i + 1 }));
               
            setLeaderboardData(board);
          }
        }
      } catch (err) {
        console.error("Leaderboard fetch error:", err);
      } finally {
        setLeaderboardLoading(true); // Wait, should be false
        setLeaderboardLoading(false);
      }
    }
    fetchLeaderboard();
  }, [user?.id]);

  if (loading || !user) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 space-y-8 animate-fade-in">
        <div className="flex items-center justify-between">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-10 w-24" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Skeleton className="h-40 w-full rounded-3xl" />
          <Skeleton className="h-40 w-full rounded-3xl" />
          <Skeleton className="h-40 w-full rounded-3xl" />
        </div>
        <Skeleton className="h-[400px] w-full rounded-3xl" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 text-center px-4">
        <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center">
          <Target className="h-8 w-8 text-destructive" />
        </div>
        <div>
          <h3 className="text-xl font-black tracking-tight">Data Sync Interrupted</h3>
          <p className="text-muted-foreground mt-2 max-w-xs">{error}</p>
        </div>
        <Button onClick={refresh} variant="outline" className="rounded-full px-8 h-12 font-black uppercase tracking-widest text-[10px]">
          <RefreshCw className="h-4 w-4 mr-2" /> Retry Sync
        </Button>
      </div>
    );
  }

  const subjects = data.subjects || [];
  
  // Transform subject data for Radar Chart
  const radarData = subjects.map(s => ({
    subject: s.name.substring(0, 3),
    full: s.name,
    mastery: s.mastery,
    fullMark: 100
  }));

  // Dynamic Mentat insight — derive from actual weak topics
  const weakestSubject = subjects.length > 0
    ? subjects.reduce((a, b) => a.mastery < b.mastery ? a : b)
    : null;
  const weakestTopic = weakestSubject?.topics
    ?.filter(t => t.attempts > 0)
    ?.sort((a, b) => a.accuracy - b.accuracy)?.[0];
  const mentatInsight = !weakestSubject || subjects.every(s => s.mastery === 0)
    ? 'Complete your first quiz to unlock a personalized insight from Mentat.'
    : weakestTopic
      ? `Focus on ${weakestSubject.name} — specifically "${weakestTopic.topic}" where your accuracy is ${weakestTopic.accuracy}%. Targeted practice here will yield the most rapid improvement.`
      : `Your ${weakestSubject.name} score is your lowest at ${weakestSubject.mastery}%. Spend extra time here before your exam.`;

  // Dynamic leaderboard batch label
  const batchLabel = new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' }) + ' Batch';

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 space-y-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          {onBack && (
            <button
              onClick={onBack}
              className="group flex items-center gap-1 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground hover:text-primary transition-colors"
            >
              <ChevronLeft className="h-3 w-3 transition-transform group-hover:-translate-x-0.5" />
              Back
            </button>
          )}
          <h1 className="text-3xl font-black tracking-tighter sm:text-4xl">Performance Hub</h1>
          <p className="text-muted-foreground font-medium max-w-lg">
            A specialized view of your academic trajectory, predictive scores, and regional competency.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">National Rank</p>
            <p className="text-2xl font-black tracking-tighter">#{leaderboardData.find(u => u.isCurrentUser)?.rank || '---'}</p>
          </div>
          <Button onClick={refresh} variant="outline" size="icon" className="h-12 w-12 rounded-2xl border-2">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Primary Metrics Layer */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="rounded-[2.5rem] border-2 border-primary/10 bg-primary/5 hover:border-primary/20 transition-all">
          <CardContent className="p-8">
            <div className="flex justify-between items-start mb-6">
              <div className="h-10 w-10 rounded-2xl bg-primary/10 flex items-center justify-center">
                <BookOpen className="h-5 w-5 text-primary" />
              </div>
              <span className="text-[10px] font-black uppercase tracking-widest text-primary/60">Syllabus Overview</span>
            </div>
            <div className="space-y-1">
              <h3 className="text-4xl font-black tracking-tighter">{data.syllabusExposure}%</h3>
              <p className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Syllabus Exposure</p>
            </div>
            <p className="mt-6 text-xs font-medium text-muted-foreground leading-relaxed">
              You have interacted with {data.syllabusExposure}% of the total topics in your assigned curriculum. Aim for 80%+ covering core areas.
            </p>
          </CardContent>
        </Card>

        <Card className="rounded-[2.5rem] border-2 border-orange-500/10 bg-orange-500/5 hover:border-orange-500/20 transition-all">
          <CardContent className="p-8">
            <div className="flex justify-between items-start mb-6">
              <div className="h-10 w-10 rounded-2xl bg-orange-500/10 flex items-center justify-center">
                <ArrowUpRight className="h-5 w-5 text-orange-600" />
              </div>
              <span className="text-[10px] font-black uppercase tracking-widest text-orange-600/60">Study Momentum</span>
            </div>
            <div className="space-y-1">
              <h3 className="text-4xl font-black tracking-tighter">{data.studyStreak} <span className="text-sm uppercase text-orange-600">Days</span></h3>
              <p className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Current Streak</p>
            </div>
            <p className="mt-6 text-xs font-medium text-muted-foreground leading-relaxed mb-4">
              Consistency is the highest predictor of success. 15 mins daily beats 4 hours weekly.
            </p>
            <ActivityHeatmap days={28} />
          </CardContent>
        </Card>

        <Card className="rounded-[2.5rem] border-2 border-purple-500/10 bg-purple-500/5 hover:border-purple-500/20 transition-all">
          <CardContent className="p-8">
            <div className="flex justify-between items-start mb-6">
              <div className="h-10 w-10 rounded-2xl bg-purple-500/10 flex items-center justify-center">
                <Trophy className="h-5 w-5 text-purple-600" />
              </div>
              <span className="text-[10px] font-black uppercase tracking-widest text-purple-600/60">Predictive Score</span>
            </div>
            <div className="space-y-1">
              <h3 className="text-4xl font-black tracking-tighter">{data.quizAverage}%</h3>
              <p className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Accuracy Average</p>
            </div>
            <p className="mt-6 text-xs font-medium text-muted-foreground leading-relaxed italic">
              "{mentatInsight}" — Mentat
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Analytics Layer */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card className="rounded-[2.5rem] border-2 border-border overflow-hidden">
          <CardHeader className="p-8 pb-0">
            <CardTitle className="text-xl font-black tracking-tight">Competency Radar</CardTitle>
            <p className="text-sm text-muted-foreground font-medium">Subject-wise mastery balance across your curriculum</p>
          </CardHeader>
          <CardContent className="p-8 pt-0 h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                <PolarGrid stroke="#e2e8f0" />
                <PolarAngleAxis 
                  dataKey="subject" 
                  tick={{ fill: '#64748b', fontSize: 10, fontWeight: 900 }} 
                />
                <Radar
                  name="Mastery"
                  dataKey="mastery"
                  stroke="var(--primary)"
                  fill="var(--primary)"
                  fillOpacity={0.15}
                  strokeWidth={3}
                />
                <Tooltip 
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  labelStyle={{ fontWeight: 800 }}
                />
              </RadarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="rounded-[2.5rem] border-2 border-border overflow-hidden">
          <CardHeader className="p-8 pb-0">
            <CardTitle className="text-xl font-black tracking-tight">Score Trajectory</CardTitle>
            <p className="text-sm text-muted-foreground font-medium">Weekly performance trends based on simulation results</p>
          </CardHeader>
          <CardContent className="p-8 pt-0 h-[400px]">
            {data.scoreTrajectory.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center gap-3 text-center">
                <div className="h-12 w-12 rounded-2xl bg-muted flex items-center justify-center">
                  <Target className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="text-sm font-bold text-muted-foreground">No exam data yet</p>
                <p className="text-xs text-muted-foreground max-w-xs">Complete a Quick Quiz or Mock Exam to start tracking your score trajectory over time.</p>
              </div>
            ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.scoreTrajectory}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="date" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }}
                  dy={10}
                />
                <YAxis 
                  domain={[0, 100]} 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }}
                />
                <Tooltip 
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                />
                <Line 
                  type="monotone" 
                  dataKey="score" 
                  stroke="var(--primary)" 
                  strokeWidth={4} 
                  dot={{ r: 6, fill: 'var(--primary)', strokeWidth: 3, stroke: '#fff' }}
                  activeDot={{ r: 8, strokeWidth: 0 }}
                  animationDuration={1500}
                />
              </LineChart>
            </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Subject Drilldown Grid */}
      <h2 className="text-xl font-black tracking-tight flex items-center gap-2 pt-4">
        Detailed Mastery Drilldown
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {subjects.map((subject) => (
          <Card 
            key={subject.name} 
            className="group rounded-3xl border-2 border-border hover:border-primary/40 transition-all cursor-pointer overflow-hidden"
            onClick={() => onNavigateToSubject?.(subject.name)}
          >
            <div className="bg-muted/30 p-6 border-b border-border group-hover:bg-primary/5 transition-colors">
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">{subject.name}</span>
                <span className="text-lg font-black tracking-tighter">{subject.mastery}%</span>
              </div>
              <Progress value={subject.mastery} className="h-1 bg-border/50" />
            </div>
            <CardContent className="p-6">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-4">Focus Topics</p>
              <div className="space-y-2">
                {subject.topics.slice(0, 3).map(t => (
                  <div key={t.topic} className="flex justify-between items-center text-xs">
                    <span className="font-medium text-muted-foreground truncate mr-2">{t.topic}</span>
                    <span className={cn(
                      "font-black tracking-tight",
                      t.accuracy >= 70 ? "text-emerald-600" : t.accuracy >= 50 ? "text-amber-600" : "text-rose-600"
                    )}>{t.accuracy}%</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Leaderboard Layer */}
      <Card className="rounded-[2.5rem] border-2 border-border overflow-hidden bg-card/50 backdrop-blur-sm">
        <CardHeader className="p-8 border-b border-border">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-xl font-black tracking-tight flex items-center gap-2">
                National Leaderboard
              </CardTitle>
              <p className="text-sm text-muted-foreground font-medium">Live ranking across all active UTME candidates</p>
            </div>
            <div className="px-4 py-2 bg-muted/50 rounded-2xl flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-[10px] font-black uppercase tracking-widest">{batchLabel}</span>
            </div>
          </div>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-[10px] text-muted-foreground uppercase font-black tracking-[0.2em] bg-muted/30">
              <tr>
                <th className="px-8 py-5">Rank</th>
                <th className="px-8 py-5">Candidate</th>
                <th className="px-8 py-5 hidden sm:table-cell">Region</th>
                <th className="px-8 py-5 text-right">Mastery Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {leaderboardLoading ? (
                <tr>
                  <td colSpan={4} className="px-8 py-20 text-center">
                    <RefreshCw className="h-6 w-6 animate-spin text-primary/40 mx-auto" />
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mt-4">Synchronizing regional data...</p>
                  </td>
                </tr>
              ) : leaderboardData.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-8 py-20 text-center text-muted-foreground italic font-medium">
                    No session data synchronized yet. Complete your first CBT to rank.
                  </td>
                </tr>
              ) : (
                leaderboardData.map((user) => (
                  <tr
                    key={user.id}
                    className={cn(
                      "transition-colors",
                      user.isCurrentUser ? "bg-primary/[0.03]" : "hover:bg-muted/20"
                    )}
                  >
                    <td className="px-8 py-6">
                      <div className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-xl text-xs font-black tracking-tighter",
                        user.rank === 1 ? "bg-amber-500/10 text-amber-600 border border-amber-500/20" :
                          user.rank === 2 ? "bg-slate-400/10 text-slate-500 border border-slate-400/20" :
                            user.rank === 3 ? "bg-orange-800/10 text-orange-800 border border-orange-800/20" :
                              "bg-muted/50 text-muted-foreground"
                      )}>
                        #{user.rank}
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-4">
                        <Avatar className="h-10 w-10 border-2 border-background shadow-sm">
                          <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${user.name}`} />
                          <AvatarFallback className="text-xs font-black">{user.name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className={cn("font-bold tracking-tight", user.isCurrentUser ? "text-primary" : "text-foreground")}>
                            {user.name} {user.isCurrentUser && "(You)"}
                          </p>
                          <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">UTME Candidate</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6 hidden sm:table-cell">
                      <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
                        <MapPin className="h-3.5 w-3.5" />
                        <span>{user.state}</span>
                      </div>
                    </td>
                    <td className="px-8 py-6 text-right">
                      <span className="text-lg font-black tracking-tighter">{user.score}</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
