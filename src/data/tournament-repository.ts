import type { Tournament } from "@/domain/types";

export interface TournamentRepository {
  list(): Promise<Tournament[]>;
  save(tournament: Tournament): Promise<void>;
  remove(tournamentId: string): Promise<void>;
  roleFor(tournamentId: string): TournamentRole;
  subscribe?(onChange: (change: RepositoryChange) => void): () => void;
}

export type TournamentRole = "owner" | "editor" | "viewer";

export type RepositoryChange =
  | { type: "upsert"; tournament: Tournament }
  | { type: "remove"; tournamentId: string };
