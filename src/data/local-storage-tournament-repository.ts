import type { Tournament } from "@/domain/types";
import type { TournamentRepository } from "./tournament-repository";

const STORAGE_KEY = "torneiamo:tournaments:v1";

export class LocalStorageTournamentRepository
  implements TournamentRepository
{
  async list(): Promise<Tournament[]> {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw) as unknown;
      return Array.isArray(parsed) ? (parsed as Tournament[]) : [];
    } catch {
      return [];
    }
  }

  async save(tournament: Tournament) {
    const tournaments = await this.list();
    const next = tournaments.some((item) => item.id === tournament.id)
      ? tournaments.map((item) =>
          item.id === tournament.id ? tournament : item,
        )
      : [tournament, ...tournaments];
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }

  async remove(tournamentId: string) {
    const tournaments = await this.list();
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(tournaments.filter((item) => item.id !== tournamentId)),
    );
  }
}

let repository: TournamentRepository | null = null;

export function getTournamentRepository(): TournamentRepository {
  if (!repository) repository = new LocalStorageTournamentRepository();
  return repository;
}

