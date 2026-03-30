import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { 
  ChevronLeft, 
  User, 
  BookOpen, 
  Trophy, 
  LayoutDashboard,
  Menu,
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  Sidebar, 
  SidebarContent, 
  SidebarGroup, 
  SidebarGroupContent, 
  SidebarMenu, 
  SidebarMenuButton, 
  SidebarMenuItem, 
  SidebarProvider,
  SidebarHeader,
  SidebarRail,
  useSidebar,
  SidebarInset,
  SidebarTrigger
} from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Achievement, DEFAULT_ACHIEVEMENTS } from "@/components/dashboard/AchievementsBadges";

// Section Components
import { AccountSettings } from "./sections/AccountSettings";
import { SubjectManagement } from "./sections/SubjectManagement";
import { AchievementsView } from "./sections/AchievementsView";

interface ProfilePageProps {
  onBack: () => void;
  defaultView?: string;
}

type ProfileView = "account" | "curriculum" | "achievements";

export function ProfilePage({ onBack, defaultView = "account" }: ProfilePageProps) {
  const { user } = useAuth();
  const [activeView, setActiveView] = useState<ProfileView>(defaultView as ProfileView);
  const [loading, setLoading] = useState(true);
  const [profileData, setProfileData] = useState<any>(null);
  const [achievements, setAchievements] = useState<Achievement[]>([]);

  const loadData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [profileRes, achievementsRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", user.id).single(),
        supabase.from("user_achievements").select("achievement_id, earned_at").eq("user_id", user.id),
      ]);

      const profile = profileRes.data;
      if (profile) {
        const academicGoals = profile.academic_goals as any;
        const subjectsMeta = profile.subjects_meta as any;

        setProfileData({
          fullName: profile.full_name || user.user_metadata?.full_name || "Student",
          email: user.email || "",
          username: profile.username || null,
          avatarUrl: user.user_metadata?.avatar_url || null,
          examDate: academicGoals?.examDate ? new Date(academicGoals.examDate) : null,
          targetScore: academicGoals?.targetScore || 300,
          currentStreak: profile.current_streak || 0,
          totalStudyHours: Math.round((profile.total_study_minutes || 0) / 60),
          xpPoints: profile.xp_points || 0,
          selectedSubjects: subjectsMeta?.selectedSubjects || [],
        });
      }

      const earnedMap = new Map((achievementsRes.data || []).map((a) => [a.achievement_id, a.earned_at]));
      setAchievements(DEFAULT_ACHIEVEMENTS.map((a) => ({
        ...a,
        earned: earnedMap.has(a.id),
        earnedAt: earnedMap.get(a.id) || undefined,
        progress: 0, // In real app, would fetch progress from another table
      })));
    } catch (error) {
      console.error("Error loading profile data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user]);

  const navItems = [
    { id: "account", label: "Account Settings", icon: User },
    { id: "curriculum", label: "Curriculum", icon: BookOpen },
    { id: "achievements", label: "Achievements", icon: Trophy },
  ];

  const renderContent = () => {
    if (loading) return <div className="flex h-full items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;
    
    switch (activeView) {
      case "account": return <AccountSettings user={user} profile={profileData} onUpdate={loadData} />;
      case "curriculum": return <SubjectManagement user={user} selectedSubjects={profileData?.selectedSubjects || []} onUpdate={(s) => setProfileData({...profileData, selectedSubjects: s})} />;
      case "achievements": return <AchievementsView achievements={achievements} />;
      default: return null;
    }
  };

  const initials = profileData?.fullName?.split(" ").map((n: string) => n[0]).join("").toUpperCase() || "U";

  return (
    <TooltipProvider delayDuration={0}>
      <SidebarProvider defaultOpen={true}>
        <div className="flex min-h-screen w-full bg-background">
          {/* Internal Profile Sidebar */}
          <Sidebar collapsible="icon" className="border-r border-border/50">
            <SidebarHeader className="p-4">
              <div className="flex items-center gap-3">
                <Button variant="ghost" size="icon" onClick={onBack} className="h-8 w-8 rounded-full">
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-xs font-black uppercase tracking-widest text-muted-foreground group-data-[collapsible=icon]:hidden">
                  Back to Dashboard
                </span>
              </div>
            </SidebarHeader>
            <SidebarContent>
              <SidebarGroup>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {navItems.map((item) => (
                      <SidebarMenuItem key={item.id}>
                        <SidebarMenuButton 
                          isActive={activeView === item.id} 
                          onClick={() => setActiveView(item.id as ProfileView)}
                          className={cn(
                            "h-12 rounded-xl transition-all font-black text-xs uppercase tracking-widest",
                            activeView === item.id 
                              ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" 
                              : "hover:bg-primary/10 hover:text-primary"
                          )}
                          tooltip={item.label}
                        >
                          <item.icon className="h-5 w-5" />
                          <span>{item.label}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            </SidebarContent>
            <SidebarRail />
          </Sidebar>

          {/* Main Content Area */}
          <SidebarInset className="bg-muted/30">
            <header className="sticky top-0 z-30 flex h-16 items-center border-b border-border/40 bg-background/80 px-8 backdrop-blur-xl">
              <div className="flex grow items-center gap-4">
                <SidebarTrigger className="md:hidden" />
                <h1 className="text-xl font-black tracking-tighter uppercase">{activeView}</h1>
              </div>
              <div className="flex items-center gap-4">
                 <div className="text-right hidden sm:block">
                    <p className="text-xs font-black leading-none">{profileData?.fullName}</p>
                    <p className="text-[10px] font-bold text-primary">JAMB Candidate</p>
                 </div>
                 <Avatar className="h-10 w-10 border-2 border-primary shadow-sm hover:scale-105 transition-transform cursor-pointer">
                    <AvatarImage src={profileData?.avatarUrl} />
                    <AvatarFallback className="bg-primary text-primary-foreground font-black text-xs">{initials}</AvatarFallback>
                 </Avatar>
              </div>
            </header>
            
            <main className="p-8 max-w-5xl mx-auto w-full">
               <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 fill-mode-both">
                 {renderContent()}
               </div>
            </main>
          </SidebarInset>
        </div>
      </SidebarProvider>
    </TooltipProvider>
  );
}
