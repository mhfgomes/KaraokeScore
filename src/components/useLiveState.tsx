"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { PublicState } from "@/lib/types";

type LiveState = {
  state: PublicState | null;
  refresh: () => Promise<void>;
  /** Diferença (ms) entre o relógio do servidor e o deste dispositivo */
  clockOffset: number;
};

const LiveStateContext = createContext<LiveState | null>(null);

const RETRY_MS = 3000;

/** Estado público + atualizações em tempo real via SSE (uma ligação partilhada por toda a app). */
export function LiveStateProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<PublicState | null>(null);
  const [offline, setOffline] = useState(false);
  const [clockOffset, setClockOffset] = useState(0);
  const loadRef = useRef<() => Promise<void>>(async () => {});

  useEffect(() => {
    let alive = true;
    let seq = 0;
    let retry: ReturnType<typeof setTimeout> | undefined;

    // Só a resposta do pedido mais recente é aplicada; se falhar, tenta de novo
    const load = async () => {
      const id = ++seq;
      clearTimeout(retry);
      try {
        const res = await fetch("/api/state", { cache: "no-store" });
        if (!res.ok) throw new Error(String(res.status));
        const data = await res.json();
        if (alive && id === seq) {
          setState(data);
          setClockOffset(data.serverTime - Date.now());
          setOffline(false);
        }
      } catch {
        if (alive && id === seq) {
          setOffline(true);
          retry = setTimeout(load, RETRY_MS);
        }
      }
    };
    loadRef.current = load;

    // O SSE envia "hello" ao ligar (e ao religar), o que faz a carga
    const source = new EventSource("/api/events");
    source.onmessage = load;
    source.onerror = () => setOffline(true);
    return () => {
      alive = false;
      clearTimeout(retry);
      source.close();
    };
  }, []);

  const refresh = useCallback(() => loadRef.current(), []);

  return (
    <LiveStateContext.Provider value={{ state, refresh, clockOffset }}>
      {children}
      {offline && (
        <div role="status" className="fixed inset-x-0 bottom-0 z-50 bg-destructive px-4 py-2 text-center text-sm font-semibold text-white">
          Sem ligação ao servidor. A tentar novamente…
        </div>
      )}
    </LiveStateContext.Provider>
  );
}

/** Devolve uma função que corre um pedido e só aplica a resposta do mais recente. */
export function useLatest() {
  const seq = useRef(0);
  return useCallback(<T,>(request: Promise<T>, apply: (value: T) => void) => {
    const id = ++seq.current;
    return request.then((value) => {
      if (id === seq.current) apply(value);
    });
  }, []);
}

export function useLiveState() {
  const ctx = useContext(LiveStateContext);
  if (!ctx) throw new Error("useLiveState fora do LiveStateProvider");
  return ctx;
}

export async function postJson(url: string, body?: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Erro inesperado.");
  return data;
}
