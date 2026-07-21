import { describe, expect, it } from "vitest";
import { createTournament } from "./tournament-engine";
import {
  searchAndSortTournaments,
  tournamentCompletedAt,
} from "./tournament-catalog";
import type { Tournament } from "./types";

function tournament(
  id: string,
  name: string,
  createdAt: string,
  updatedAt: string,
  overrides: Partial<Tournament> = {},
): Tournament {
  return {
    ...createTournament({
      name,
      format: "scoreboard",
      participants: [
        { name: "Loris", teamName: "Rosso" },
        { name: "Marta", teamName: "Blu" },
      ],
      settings: { shuffleParticipants: false },
    }),
    id,
    createdAt,
    updatedAt,
    ...overrides,
  };
}

describe("catalogo tornei", () => {
  const oldest = tournament(
    "oldest",
    "Fifa 26",
    "2026-01-10T10:00:00.000Z",
    "2026-03-01T10:00:00.000Z",
    { status: "completed", completedAt: "2026-02-10T10:00:00.000Z" },
  );
  const newest = tournament(
    "newest",
    "Serata carte",
    "2026-07-20T10:00:00.000Z",
    "2026-07-20T10:00:00.000Z",
  );
  const middle = tournament(
    "middle",
    "Fifa 26",
    "2026-05-10T10:00:00.000Z",
    "2026-06-01T10:00:00.000Z",
    { status: "completed", completedAt: "2026-06-01T10:00:00.000Z" },
  );

  it("cerca per nome torneo, partecipante ed etichetta ignorando accenti e maiuscole", () => {
    const tournaments = [oldest, newest];

    expect(searchAndSortTournaments(tournaments, "fìfa LORIS", "updated-desc"))
      .toEqual([oldest]);
    expect(searchAndSortTournaments(tournaments, "marta blu", "updated-desc"))
      .toEqual([newest, oldest]);
    expect(searchAndSortTournaments(tournaments, "verde", "updated-desc"))
      .toEqual([]);
  });

  it("ordina per creazione, modifica e conclusione senza mutare la sorgente", () => {
    const tournaments = [middle, oldest, newest];

    expect(searchAndSortTournaments(tournaments, "", "created-desc").map(({ id }) => id))
      .toEqual(["newest", "middle", "oldest"]);
    expect(searchAndSortTournaments(tournaments, "", "created-asc").map(({ id }) => id))
      .toEqual(["oldest", "middle", "newest"]);
    expect(searchAndSortTournaments(tournaments, "", "updated-desc").map(({ id }) => id))
      .toEqual(["newest", "middle", "oldest"]);
    expect(searchAndSortTournaments(tournaments, "", "completed-desc").map(({ id }) => id))
      .toEqual(["middle", "oldest", "newest"]);
    expect(tournaments.map(({ id }) => id)).toEqual(["middle", "oldest", "newest"]);
  });

  it("usa l'ultima modifica come fine per i tornei storici conclusi", () => {
    const legacy = { ...oldest, completedAt: undefined };
    expect(tournamentCompletedAt(legacy)).toBe(legacy.updatedAt);
    expect(tournamentCompletedAt(newest)).toBeUndefined();
  });
});
