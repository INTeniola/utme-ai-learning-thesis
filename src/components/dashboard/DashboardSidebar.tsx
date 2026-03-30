import { ChartBar, MessageSquare, BookOpen, Brain, LogOut, Home } from "lucide-react";
import { Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarTrigger } from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/useAuth";

export type DashboardView = 'home' | 'ai-tutor' | 'quiz' | 'flashcards' | 'analytics' | 'profile' | 'settings';

interface DashboardSidebarProps {
  currentView: DashboardView;
  onViewChange: (view: DashboardView) => void;
}

/**
 * THESIS EDITION: Minimal Research Sidebar
 */
export function DashboardSidebar({ currentView, onViewChange }: DashboardSidebarProps) {
  const { signOut, participantId } = useAuth();

  const mainMenuItems = [
    { id: 'ai-tutor', title: 'AI Tutor', icon: MessageSquare },
    { id: 'quiz', title: 'Adaptive Quiz', icon: BookOpen },
    { id: 'flashcards', title: 'Flashcards', icon: Brain },
    { id: 'analytics', title: 'Analytics', icon: ChartBar },
  ] as const;

  return (
    <Sidebar collapsible="icon" className="border-r-2">
      <SidebarHeader className="p-4 flex flex-row items-center justify-between">
        <div className="flex items-center gap-3 px-2 group-data-[collapsible=icon]:hidden">
          <div className="h-8 w-8 rounded-xl bg-primary flex items-center justify-center text-primary-foreground font-black text-xl">
            T
          </div>
          <span className="font-bold text-lg tracking-tight">Thesis Edition</span>
        </div>
        <SidebarTrigger className="h-8 w-8" />
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <div className="px-4 py-2 group-data-[collapsible=icon]:hidden">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">
              Core Pillars
            </p>
          </div>
          <SidebarGroupContent>
            <SidebarMenu className="px-2 gap-1">
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={currentView === 'home'}
                  onClick={() => onViewChange('home')}
                  tooltip="Hub"
                  className="rounded-xl h-11"
                >
                  <Home className="h-5 w-5" />
                  <span className="font-bold">Research Hub</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              
              {mainMenuItems.map((item) => (
                <SidebarMenuItem key={item.id}>
                  <SidebarMenuButton
                    isActive={currentView === item.id}
                    onClick={() => onViewChange(item.id as DashboardView)}
                    tooltip={item.title}
                    className="rounded-xl h-11"
                  >
                    <item.icon className="h-5 w-5" />
                    <span className="font-medium">{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4 border-t">
        <div className="group-data-[collapsible=icon]:hidden mb-4 p-3 rounded-xl bg-accent/50 border border-border/50">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Active Participant</p>
          <p className="text-xs font-mono font-bold truncate">{participantId}</p>
        </div>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={signOut} className="text-destructive hover:text-destructive hover:bg-destructive/10 rounded-xl h-11">
              <LogOut className="h-5 w-5" />
              <span className="font-bold">End Session</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
