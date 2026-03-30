import { cn } from "@/lib/utils";
import { Database, Home, TrendingUp, Trophy, User, Users } from "lucide-react";
import { DashboardView } from "./DashboardSidebar";

interface MobileNavProps {
    currentView: DashboardView;
    onViewChange: (view: DashboardView) => void;
    isAdmin?: boolean;
}

export function MobileNav({ currentView, onViewChange, isAdmin }: MobileNavProps) {
    const navItems = [
        { id: "home" as DashboardView, label: "Home", icon: Home },
        { id: "performance-hub" as DashboardView, label: "Performance", icon: TrendingUp },
        { id: "community" as DashboardView, label: "Hub", icon: Users },
        { id: "profile" as DashboardView, label: "Profile", icon: User },
    ];

    if (isAdmin) {
        navItems.push({ id: "research" as DashboardView, label: "Admin", icon: Database });
    }

    return (
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-background/90 backdrop-blur-md border-t border-border/50 pb-[env(safe-area-inset-bottom)]">
            <div className="flex items-center justify-around px-2 h-16">
                {navItems.map((item) => {
                    const isActive = currentView === item.id;
                    return (
                        <button
                            key={item.id}
                            onClick={() => onViewChange(item.id)}
                            className={cn(
                                "flex flex-col items-center justify-center flex-1 h-full space-y-1 transition-colors",
                                isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
                            )}
                            aria-label={item.label}
                        >
                            <div className={cn(
                                "flex items-center justify-center p-1.5 rounded-full transition-all duration-200",
                                isActive ? "bg-primary/10" : "bg-transparent"
                            )}>
                                <item.icon className={cn("h-5 w-5", isActive ? "text-primary" : "text-muted-foreground")} />
                            </div>
                            <span className="text-[10px] font-medium tracking-tight">{item.label}</span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
