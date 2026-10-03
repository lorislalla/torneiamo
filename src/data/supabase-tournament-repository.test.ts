// @vitest-environment jsdom

import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { addScoreboardRound, createTournament, removeScoreboardRound, updateScoreboardRoundScore } from "@/domain/tournament-engine";
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
      scoreboardAggregation: "totalScore",
      tieBreakers: ["headToHead", "scoreDifference", "scoreFor"],
    },
  },
  scoreboardRounds: [{ id: "scoreboard-round-1", label: "Round 1", scores: {} }],
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
  it("scrive e rilegge round eliminati e totali ricalcolati", async () => {
    let created = createTournament({ name: "Golf", format: "scoreboard", participants: [{ name: "Ada" }, { name: "Bea" }] });
    created = addScoreboardRound(created);
    created = updateScoreboardRoundScore(created, created.scoreboardRounds[0].id, created.participants[0].id, 15);
    created = updateScoreboardRoundScore(created, created.scoreboardRounds[1].id, created.participants[1].id, -4);
    const removed = removeScoreboardRound(created, created.scoreboardRounds[0].id);
    let storedRow = { ...row, id: created.id, name: created.name, data: created as unknown as Json };
    const insert = vi.fn(async (payload: { data: Json }) => {
      storedRow = { ...storedRow, data: payload.data };
      return { error: null };
    });
    const from = vi.fn((table: string) => table === "tournament_members"
      ? { select: async () => ({ data: [], error: null }) }
      : {
        insert,
        select: () => ({
          eq: () => ({ single: async () => ({ data: storedRow, error: null }) }),
          order: async () => ({ data: [storedRow], error: null }),
        }),
      });
    const client = { from } as unknown as SupabaseClient<Database>;
    await new SupabaseTournamentRepository(client, "user-test").save(removed);
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ scoreboardRounds: removed.scoreboardRounds }) }));
    const [restored] = await new SupabaseTournamentRepository(client, "user-test").list();
    expect(restored.scoreboardRounds).toEqual(removed.scoreboardRounds);
    expect(restored.participants.map((participant) => participant.score)).toEqual([0, -4]);
  });
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
    const completed = {
      ...tournament,
      status: "completed",
      completedAt,
      scoreboardRounds: [{ id: "scoreboard-round-1", label: "Round 1", scores: {} }],
      winnerOverrideId: "player-2",
      winnerOverrideNote: "Vittoria allo spareggio",
    } as Tournament;
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
      data: expect.objectContaining({
        completedAt,
        scoreboardRounds: completed.scoreboardRounds,
        winnerOverrideId: "player-2",
        winnerOverrideNote: "Vittoria allo spareggio",
      }),
    }));
  });

  it("aggiorna il nome nella colonna e nel documento cloud", async () => {
    const renamed = {
      ...tournament,
      name: "Fifa 27",
      updatedAt: "2026-07-22T09:30:00.000Z",
    };
    const insert = vi.fn(async () => ({ error: null }));
    const maybeSingle = vi.fn(async () => ({
      data: { ...row, name: renamed.name, data: renamed as unknown as Json },
      error: null,
    }));
    const update = vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(() => ({
          select: vi.fn(() => ({ maybeSingle })),
        })),
      })),
    }));
    const from = vi.fn()
      .mockReturnValueOnce({ insert })
      .mockReturnValueOnce({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({ single: vi.fn(async () => ({ data: row, error: null })) })),
        })),
      })
      .mockReturnValueOnce({ update });
    const repository = new SupabaseTournamentRepository(
      { from } as unknown as SupabaseClient<Database>,
      "user-test",
    );

    await repository.save(tournament);
    await repository.save(renamed);

    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      name: "Fifa 27",
      data: expect.objectContaining({ name: "Fifa 27" }),
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
