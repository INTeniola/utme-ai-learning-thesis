import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "date-fns";
import { Calendar, Target, Flame, Trophy } from "lucide-react";

interface OverviewProps {
  profileData: any;
}

export function Overview({ profileData }: OverviewProps) {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-black tracking-tighter capitalize">Hello, {profileData?.fullName?.split(' ')[0]}</h2>
        <p className="text-sm text-muted-foreground">Here is a quick glance at your academic standing</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card className="rounded-[2.5rem] border-2 border-primary/10 bg-primary/5">
          <CardContent className="p-8">
            <div className="flex justify-between items-start mb-6">
              <div className="h-10 w-10 rounded-2xl bg-primary/10 flex items-center justify-center">
                <Calendar className="h-5 w-5 text-primary" />
              </div>
              <span className="text-[10px] font-black uppercase tracking-widest text-primary/60">Exam Readiness</span>
            </div>
            <div className="space-y-1">
              <h3 className="text-3xl font-black tracking-tighter">
                {profileData?.examDate ? format(profileData.examDate, "MMM d") : "Not set"}
              </h3>
              <p className="text-sm font-bold text-muted-foreground uppercase tracking-wider">UTME 2026</p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[2.5rem] border-2 border-orange-500/10 bg-orange-500/5">
          <CardContent className="p-8">
            <div className="flex justify-between items-start mb-6">
              <div className="h-10 w-10 rounded-2xl bg-orange-500/10 flex items-center justify-center">
                <Flame className="h-5 w-5 text-orange-600" />
              </div>
              <span className="text-[10px] font-black uppercase tracking-widest text-orange-600/60">Study Streak</span>
            </div>
            <div className="space-y-1">
              <h3 className="text-3xl font-black tracking-tighter">{profileData?.currentStreak} Days</h3>
              <p className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Consistency</p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[2.5rem] border-2 border-purple-500/10 bg-purple-500/5">
          <CardContent className="p-8">
            <div className="flex justify-between items-start mb-6">
              <div className="h-10 w-10 rounded-2xl bg-purple-500/10 flex items-center justify-center">
                <Target className="h-5 w-5 text-purple-600" />
              </div>
              <span className="text-[10px] font-black uppercase tracking-widest text-purple-600/60">Score Target</span>
            </div>
            <div className="space-y-1">
              <h3 className="text-3xl font-black tracking-tighter">{profileData?.targetScore}</h3>
              <p className="text-sm font-bold text-muted-foreground uppercase tracking-wider">UTME Target</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-[2.5rem] border-2 border-border overflow-hidden">
        <CardHeader className="p-8 bg-muted/30 border-b border-border">
          <CardTitle className="text-xl font-black tracking-tighter flex items-center gap-2">
            <Trophy className="h-5 w-5 text-amber-500" />
             Study Progress
          </CardTitle>
        </CardHeader>
        <CardContent className="p-8 space-y-4">
           <div className="flex justify-between items-center text-sm">
             <span className="font-bold text-muted-foreground uppercase tracking-widest text-[10px]">Total Study Hours</span>
             <span className="font-black text-lg tracking-tighter">{profileData?.totalStudyHours}h</span>
           </div>
           <div className="flex justify-between items-center text-sm">
             <span className="font-bold text-muted-foreground uppercase tracking-widest text-[10px]">XP Earned</span>
             <span className="font-black text-lg tracking-tighter">{profileData?.xpPoints} XP</span>
           </div>
        </CardContent>
      </Card>
    </div>
  );
}
