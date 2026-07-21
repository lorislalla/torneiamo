// @vitest-environment jsdom

import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Tournament } from "@/domain/types";
import type { Database, Json } from "@/lib/supabase/database.types";
import { getLocalTournamentRepository } from "./local-storage-tournament-repository";
import { SupabaseTournamentRepository } from "./supabase-tournament-repository";

const tournament: Tournament = {
  id: "tournament-test",
  name: "Torneo test",
  format: "scoreboard",
  status: "active",
  createdAt: "2026-07-21T12:00:00.000Z",
  updatedAt: "2026-07-21T12:00:00.000Z",
  participants: [],
  settings: {
    leagueLegs: 1,
    knockoutLegs: 1,
    groupCount: 2,
    qualifiersPerGroup: 2,
    shuffleParticipants: false,
    scoring: {
      winPoints: 3,
      drawPoints: 1,
      lossPoints: 0,
      scoreDirection: "higher",
      tieBreakers: ["headToHead", "scoreDifference", "scoreFor"],
    },
  },
  groups: [],
  bracketSeedIds: [],
  matches: [],
};

const row: Database["public"]["Tables"]["tournaments"]["Row"] = {
  id: tournament.id,
  owner_id: "user-test",
  name: tournament.name,
  format: tournament.format,
  status: tournament.status,
  data: tournament as unknown as Json,
  revision: 0,
  created_at: tournament.createdAt,
  updated_at: tournament.updatedAt,
};

beforeEach(() => {
  const values = new Map<string, string>();
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: {
      clear: () => values.clear(),
      getItem: (key: string) => values.get(key) ?? null,
      removeItem: (key: string) => values.delete(key),
      setItem: (key: string, value: string) => values.set(key, value),
    },
  });
  window.localStorage.clear();
});

describe("SupabaseTournamentRepository", () => {
  it("inserisce il torneo prima di leggerlo con la policy RLS", async () => {
    const calls: string[] = [];
    const insert = vi.fn(async () => {
      calls.push("insert");
      return { error: null };
    });
    const single = vi.fn(async () => {
      calls.push("select");
      return { data: row, error: null };
    });
    const from = vi.fn()
      .mockReturnValueOnce({ insert })
      .mockReturnValueOnce({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({ single })),
        })),
      });
    const repository = new SupabaseTournamentRepository(
      { from } as unknown as SupabaseClient<Database>,
      "user-test",
    );

    await repository.save(tournament);

    expect(calls).toEqual(["insert", "select"]);
    expect(repository.roleFor(tournament.id)).toBe("owner");
  });

  it("include la data di conclusione nel documento cloud", async () => {
    const completedAt = "2026-07-21T14:00:00.000Z";
    const completed = { ...tournament, status: "completed", completedAt } as Tournament;
    const completedRow = {
      ...row,
      status: "completed",
      data: completed as unknown as Json,
    };
    const insert = vi.fn(async () => ({ error: null }));
    const from = vi.fn()
      .mockReturnValueOnce({ insert })
      .mockReturnValueOnce({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(async () => ({ data: completedRow, error: null })),
          })),
        })),
      });
    const repository = new SupabaseTournamentRepository(
      { from } as unknown as SupabaseClient<Database>,
      "user-test",
    );

    await repository.save(completed);

    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ completedAt }),
    }));
  });

  it("non cancella la copia locale quando l'import cloud fallisce", async () => {
    await getLocalTournamentRepository().save(tournament);
    let tournamentQuery = 0;
    const from = vi.fn((table: string) => {
      if (table === "tournament_members") {
        return { select: vi.fn(async () => ({ data: [], error: null })) };
      }

      tournamentQuery += 1;
      if (tournamentQuery === 1) {
        return {
          select: vi.fn(() => ({
            order: vi.fn(async () => ({ data: [], error: null })),
          })),
        };
      }

      return {
        insert: vi.fn(async () => ({
          error: new Error("Sincronizzazione non disponibile"),
        })),
      };
    });
    const repository = new SupabaseTournamentRepository(
      { from } as unknown as SupabaseClient<Database>,
      "user-test",
    );

    await expect(repository.list()).resolves.toEqual([tournament]);
    await expect(getLocalTournamentRepository().list()).resolves.toEqual([tournament]);
    expect(window.localStorage.getItem("torneiamo:supabase-imported:user-test")).toBeNull();
  });
});
