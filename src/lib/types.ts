export type PublicState = {
  /** Hora do servidor (ms), para acertar contagens decrescentes */
  serverTime: number;
  baseUrl: string;
  brand: { name: string; logoUrl: string | null; menuEnabled: boolean };
  night: { id: number; date: string; status: "REGISTRATION" | "VOTING" | "CLOSED"; currentId: number | null;
    /** ISO; fecho automático da votação, se temporizada */
    votingEndsAt: string | null;
  } | null;
  queue: { id: number; position: number; name: string; song: string; status: string }[];
  voting: {
    total: number;
    bars: number[];
    candidates: { id: number; name: string; song: string }[];
  } | null;
  results: { id: number; name: string; song: string; rank: number | null; votes: number; points: number }[] | null;
  hasVoted: boolean;
};

/** Durações possíveis da votação temporizada (minutos). */
export const VOTING_DURATIONS = [5, 10, 15, 20, 30] as const;

export const STATUS_LABEL = {
  REGISTRATION: "Inscrições abertas",
  VOTING: "Votação aberta",
  CLOSED: "Noite terminada",
} as const;
