"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "@/lib/client";
import type { Me } from "@/lib/types";

type MeState = { ready: boolean; user: Me | null; demo: boolean };

const MeContext = createContext<MeState>({ ready: false, user: null, demo: false });

export const useMe = () => useContext(MeContext);

export function MeProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<MeState>({ ready: false, user: null, demo: false });

  useEffect(() => {
    let alive = true;
    api<{ user: Me | null; demo: boolean }>("/api/me")
      .then((data) => alive && setState({ ready: true, user: data.user, demo: data.demo }))
      .catch(() => alive && setState({ ready: true, user: null, demo: false }));
    return () => {
      alive = false;
    };
  }, []);

  return <MeContext.Provider value={state}>{children}</MeContext.Provider>;
}
