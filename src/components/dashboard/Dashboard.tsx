import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PageTransition } from '@/components/layout/PageTransition';
import { SidebarProvider } from '@/components/ui/sidebar';
import { Skeleton } from '@/components/ui/skeleton';
import { useSubject } from '@/contexts/SubjectContext';
import { AnimatePresence } from 'framer-motion';
import { lazy, Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { DashboardHome } from './DashboardHome';
import { DashboardSidebar, DashboardView } from './DashboardSidebar';
import { DashboardTopBar } from './DashboardTopBar';
import { MobileNav } from './MobileNav';
import { SavantTutor } from '@/components/study/SavantTutor';

// Lazy-loaded pillar views
const QuizController = lazy(() => import('@/components/quiz/QuizController').then(m => ({ default: m.QuizController })));
const FlashcardController = lazy(() => import('@/components/flashcards/FlashcardController').then(m => ({ default: m.FlashcardController })));
const AnalyticsDashboard = lazy(() => import('@/components/analytics/AnalyticsDashboard').then(m => ({ default: m.AnalyticsDashboard })));
const ProfilePage = lazy(() => import('@/components/profile/ProfilePage').then(m => ({ default: m.ProfilePage })));

const ViewShell = ({ children }: { children: React.ReactNode }) => (
  <Suspense fallback={
    <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-4 animate-pulse">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-64 w-full rounded-xl" />
      <Skeleton className="h-48 w-full rounded-xl" />
    </div>
  }>
    {children}
  </Suspense>
);

/**
 * THESIS EDITION: Simplified Dashboard
 * Focuses strictly on the 4 core pillars: Tutor, Quiz, Flashcards, Analytics.
 */
export function Dashboard() {
  const { subject: selectedSubject, setSubject: setSelectedSubject } = useSubject();
  const [searchParams, setSearchParams] = useSearchParams();

  const initialView = (searchParams.get('view') as DashboardView) || 'home';
  const [view, setViewState] = useState<DashboardView>(initialView);

  const setView = (newView: DashboardView) => {
    setViewState(newView);
    if (searchParams.get('view') !== newView) {
      setSearchParams(prev => {
        const next = new URLSearchParams(prev);
        next.set('view', newView);
        return next;
      });
    }
  };

  const handleBack = () => {
    setView('home');
    setSelectedSubject(undefined);
  };

  const renderMainContent = () => {
    switch (view) {
      case 'home':
        return (
          <DashboardHome
            onNavigate={setView}
            onNavigateWithContext={(v, s) => {
              setSelectedSubject(s);
              setView(v);
            }}
            onManageSubjects={() => setView('profile')}
          />
        );
      case 'ai-tutor':
        return (
          <SidebarProvider>
            <SavantTutor
              subject={selectedSubject || 'General'}
              onBack={handleBack}
              onNavigate={setView}
            />
          </SidebarProvider>
        );
      case 'quiz':
        return <ViewShell><QuizController onBack={handleBack} initialSubject={selectedSubject} /></ViewShell>;
      case 'flashcards':
        return <ViewShell><FlashcardController onBack={handleBack} initialSubject={selectedSubject} /></ViewShell>;
      case 'analytics':
        return <ViewShell><AnalyticsDashboard onBack={handleBack} /></ViewShell>;
      case 'profile':
      case 'settings':
        return <ViewShell><ProfilePage onBack={handleBack} /></ViewShell>;
      default:
        return <DashboardHome onNavigate={setView} onNavigateWithContext={(v, s) => { setSelectedSubject(s); setView(v); }} onManageSubjects={() => setView('profile')} />;
    }
  };

  const isFullScreenPillar = ['ai-tutor', 'quiz', 'flashcards', 'profile', 'settings'].includes(view);

  return (
    <DashboardLayout
      sidebar={view === 'home' ? (
        <DashboardSidebar
          currentView={view}
          onViewChange={setView}
        />
      ) : null}
      topBar={view === 'home' ? (
        <DashboardTopBar
          examDate={new Date("2026-03-15")}
          onNavigateToProfile={() => setView('profile')}
          onNavigateToSettings={() => setView('settings')}
          onNavigateToCbt={() => {}}
          mobileSidebarContent={
            <DashboardSidebar
              currentView={view}
              onViewChange={setView}
            />
          }
        />
      ) : null}
      bottomNav={isFullScreenPillar ? null : (
        <MobileNav
          currentView={view}
          onViewChange={setView}
        />
      )}
      fullWidth={isFullScreenPillar}
    >
      <AnimatePresence mode="wait">
        <PageTransition key={view} className="h-full">
          {renderMainContent()}
        </PageTransition>
      </AnimatePresence>
    </DashboardLayout>
  );
}

