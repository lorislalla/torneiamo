import type { Tournament } from "@/domain/types";

export interface TournamentRepository {
  list(): Promise<Tournament[]>;
  save(tournament: Tournament): Promise<void>;
  remove(tournamentId: string): Promise<void>;
}

