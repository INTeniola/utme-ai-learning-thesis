import { User } from "@supabase/supabase-js";
import { useEffect, useState } from "react";

// Simple deterministic UUID generator for research participants
// STUDY-P01 -> 00000000-0000-0000-0000-000000000P01 (Simplified for demo)
function getUuidFromParticipantId(pid: string): string {
  // Hash the PID to valid UUID format or use a fixed prefix
  // For the thesis, a simple prefix + padded number is often enough if internal tracking is consistent
  const cleanId = pid.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  // Return a "Research Namespace" UUID
  return `00000000-0000-4000-a000-${cleanId.padStart(12, "0").slice(-12)}`;
}

export function useAuth() {
  const [participantId, setParticipantIdState] = useState<string | null>(localStorage.getItem("thesis_participant_id"));
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (participantId) {
      const mockId = getUuidFromParticipantId(participantId);
      setUser({
        id: mockId,
        aud: 'authenticated',
        role: 'authenticated',
        email: `${participantId.toLowerCase()}@thesis.edu`,
        email_confirmed_at: new Date().toISOString(),
        user_metadata: { full_name: `Participant ${participantId}` },
        app_metadata: { provider: 'thesis' },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as User);
    } else {
      setUser(null);
    }
  }, [participantId]);

  const setParticipantId = (id: string) => {
    localStorage.setItem("thesis_participant_id", id);
    setParticipantIdState(id);
  };

  const signOut = async () => {
    localStorage.removeItem("thesis_participant_id");
    setParticipantIdState(null);
  };

  return { user, loading, signOut, isEmailVerified: true, setParticipantId, participantId };
}


