// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from "vitest";
import {
  addScoreboardRound,
  completeScoreboardTournament,
  createTournament,
  setTournamentStatus,
  updateScoreboardRoundScore,
  updateTournamentName,
} from "@/domain/tournament-engine";
import { getLocalTournamentRepository } from "./local-storage-tournament-repository";

beforeEach(() => {
  const values = new Map<string, string>();
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => values.get(key) ?? null,
      removeItem: (key: string) => values.delete(key),
      setItem: (key: string, value: string) => values.set(key, value),
    },
  });
});

describe("LocalStorageTournamentRepository", () => {
  it("mantiene le date di creazione e conclusione dopo scrittura e lettura", async () => {
    const created = createTournament({
      name: "Fifa 26",
      format: "scoreboard",
      participants: [{ name: "Loris" }, { name: "Marta" }],
    });
    const completed = setTournamentStatus(created, "completed");
    const renamed = updateTournamentName(completed, "Fifa 27");
    const repository = getLocalTournamentRepository();

    await repository.save(renamed);
    const [restored] = await repository.list();

    expect(restored.name).toBe("Fifa 27");
    expect(restored.createdAt).toBe(created.createdAt);
    expect(restored.completedAt).toBe(completed.completedAt);
  });

  it("ripristina round, punteggi e spareggio manuale", async () => {
    let tournament = createTournament({
      name: "Minigolf",
      format: "scoreboard",
      participants: [{ name: "Loris" }, { name: "Marta" }],
      settings: {
        scoring: {
          winPoints: 3,
          drawPoints: 1,
          lossPoints: 0,
          scoreDirection: "lower",
          scoreboardAggregation: "totalScore",
          tieBreakers: ["headToHead", "scoreDifference", "scoreFor"],
        },
      },
    });
    tournament = addScoreboardRound(tournament);
    for (const round of tournament.scoreboardRounds) {
      for (const participant of tournament.participants) {
        tournament = updateScoreboardRoundScore(
          tournament,
          round.id,
          participant.id,
          4,
        );
      }
    }
    tournament = completeScoreboardTournament(
      tournament,
      tournament.participants[1].id,
      "Spareggio alla buca 19",
    );
    const repository = getLocalTournamentRepository();

    await repository.save(tournament);
    const [restored] = await repository.list();

    expect(restored.scoreboardRounds).toEqual(tournament.scoreboardRounds);
    expect(restored.winnerOverrideId).toBe(tournament.participants[1].id);
    expect(restored.winnerOverrideNote).toBe("Spareggio alla buca 19");
    expect(restored.status).toBe("completed");
  });
});
