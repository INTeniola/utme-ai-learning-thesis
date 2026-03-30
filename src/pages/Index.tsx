import { QuizantLogo } from "@/components/ui/QuizantLogo";
import { lazy, Suspense, useState } from "react";
import { DynamicLoadingText } from "@/components/ui/DynamicLoadingText";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

// Lazy-load the dashboard
const Dashboard = lazy(() => import("@/components/dashboard/Dashboard").then(m => ({ default: m.Dashboard })));

const LoadingSpinner = () => (
  <div className="flex min-h-screen items-center justify-center bg-background">
    <div className="flex flex-col items-center gap-4">
      <QuizantLogo animated loop className="h-16 w-16 text-primary" />
      <DynamicLoadingText />
    </div>
  </div>
);

/**
 * THESIS EDITION: Index Page
 * This version uses a Participant ID instead of traditional Auth.
 */
const Index = () => {
  const { user, setParticipantId } = useAuth();
  const [tempId, setTempId] = useState("");

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-accent/20 p-4">
        <Card className="w-full max-w-md shadow-xl border-2">
          <CardHeader className="text-center space-y-4">
            <div className="flex justify-center">
              <QuizantLogo className="h-12 w-12 text-primary" />
            </div>
            <CardTitle className="text-2xl">Thesis Study Artifact</CardTitle>
            <CardDescription>
              Please enter your assigned Participant ID to begin.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={(e) => { e.preventDefault(); if (tempId) setParticipantId(tempId); }} className="space-y-4">
              <Input 
                placeholder="e.g. STUDY-P01" 
                value={tempId}
                onChange={(e) => setTempId(e.target.value)}
                className="text-center font-mono text-lg uppercase tracking-widest h-12"
                autoFocus
              />
              <Button type="submit" className="w-full h-12 text-lg font-bold" disabled={!tempId}>
                Enter Platform
              </Button>
            </form>
          </CardContent>
          <CardFooter className="justify-center">
            <p className="text-xs text-muted-foreground text-center">
              Research Data Segregation Active • No Personal Info Required
            </p>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <Suspense fallback={<LoadingSpinner />}>
      <Dashboard />
    </Suspense>
  );
};

export default Index;


