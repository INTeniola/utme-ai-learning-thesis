import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface DashboardLayoutProps {
    sidebar?: ReactNode | null;
    topBar: ReactNode;
    bottomNav?: ReactNode;
    children: ReactNode;
    fullWidth?: boolean;
}

/**
 * DashboardLayout using a simple, reliable sticky-sidebar pattern.
 *
 * Structure:
 *   <div flex-row h-screen>
 *     ├── Sidebar (sticky top-0 h-screen, shrinks to fit content on desktop)
 *     └── Content column (flex-1 flex-col overflow-y-auto)
 *         ├── TopBar (not sticky here — the whole column scrolls or not)
 *         └── main (scrollable content)
 *
 * This avoids the Shadcn Sidebar's `fixed inset-y-0` which creates
 * positioning conflicts when the parent has overflow, transform, or
 * contains a SidebarProvider flex wrapper with min-h-svh.
 */
export function DashboardLayout({ sidebar, topBar, bottomNav, children, fullWidth = false }: DashboardLayoutProps) {
    return (
        <div className="flex h-screen w-full overflow-hidden bg-background">
            {/* Sidebar column — sticky, full height, hidden on mobile */}
            {sidebar != null && (
                <aside className="hidden md:flex flex-col h-screen shrink-0 sticky top-0 z-40">
                    {sidebar}
                </aside>
            )}

            {/* Main content column */}
            <div className="flex flex-1 flex-col min-w-0 overflow-y-auto">
                {/* Top bar sticks to top of this scrollable column */}
                <div className="sticky top-0 z-50">
                    {topBar}
                </div>

                <main className={cn(
                    "flex-1 bg-risograph",
                    fullWidth ? "overflow-y-auto" : "p-4 pb-24 sm:p-6 md:p-8"
                )}>
                    <div className={cn("animate-fade-in", fullWidth && "h-full")}>
                        {children}
                    </div>
                </main>

                {/* Mobile bottom nav sits at bottom of scroll column */}
                {bottomNav}
            </div>
        </div>
    );
}
