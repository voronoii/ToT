"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "@/lib/client";
import type { Me } from "@/lib/types";

/** nickname은 직접 정한 닉네임. 아직 안 정했으면 null이고, 그때 user.name은 카카오 닉네임입니다. */
type MeState = { ready: boolean; user: Me | null; nickname: string | null; demo: boolean };

const MeContext = createContext<MeState>({ ready: false, user: null, nickname: null, demo: false });

export const useMe = () => useContext(MeContext);

export function MeProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<MeState>({ ready: false, user: null, nickname: null, demo: false });

  useEffect(() => {
    let alive = true;
    api<{ user: Me | null; nickname: string | null; demo: boolean }>("/api/me")
      .then((data) => alive && setState({ ready: true, user: data.user, nickname: data.nickname, demo: data.demo }))
      .catch(() => alive && setState({ ready: true, user: null, nickname: null, demo: false }));
    return () => {
      alive = false;
    };
  }, []);

  return <MeContext.Provider value={state}>{children}</MeContext.Provider>;
}
