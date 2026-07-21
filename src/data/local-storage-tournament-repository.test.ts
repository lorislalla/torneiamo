// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from "vitest";
import {
  createTournament,
  setTournamentStatus,
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
});
