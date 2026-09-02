import type { Session } from '@supabase/supabase-js';
import { createContext, type PropsWithChildren, useContext, useEffect, useMemo, useState } from 'react';

import { getEnvironmentState } from '@/config/env';
import { connectPowerSync, disconnectPowerSync } from '@/data/powersync/platform';
import { requireSupabase, supabase } from '@/data/supabase/client';

type SessionContextValue = {
  session: Session | null;
  loading: boolean;
  syncError: string | null;
  signOut: () => Promise<void>;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: PropsWithChildren) {
  const environment = getEnvironmentState();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(environment.configured);
  const [syncError, setSyncError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) return;

    let active = true;
    supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (error) setSyncError(error.message);
      setSession(data.session);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (active) setSession(nextSession);
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session) return;

    let active = true;
    connectPowerSync().catch((error: unknown) => {
      if (active) setSyncError(error instanceof Error ? error.message : 'Synchronization could not start.');
    });

    return () => {
      active = false;
    };
  }, [session]);

  const value = useMemo<SessionContextValue>(
    () => ({
      session,
      loading,
      syncError,
      signOut: async () => {
        await disconnectPowerSync();
        const { error } = await requireSupabase().auth.signOut();
        if (error) throw error;
      },
    }),
    [loading, session, syncError],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession must be used inside SessionProvider.');
  return value;
}
