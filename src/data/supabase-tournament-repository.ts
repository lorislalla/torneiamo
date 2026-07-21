import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import type { Tournament } from "@/domain/types";
import { normalizeTournament } from "@/domain/tournament-engine";
import type { Database, Json } from "@/lib/supabase/database.types";
import { getLocalTournamentRepository } from "./local-storage-tournament-repository";
import type {
  RepositoryChange,
  TournamentRepository,
  TournamentRole,
} from "./tournament-repository";

type TournamentRow = Database["public"]["Tables"]["tournaments"]["Row"];

type RemoteMeta = {
  ownerId: string;
  revision: number;
  role: TournamentRole;
};

export class SyncConflictError extends Error {
  constructor(public readonly latest: Tournament) {
    super("Il torneo è stato modificato da un altro collaboratore.");
  }
}

export class SupabaseTournamentRepository implements TournamentRepository {
  private readonly local = getLocalTournamentRepository();
  private readonly remote = new Map<string, RemoteMeta>();
  private channel: RealtimeChannel | null = null;

  constructor(
    private readonly supabase: SupabaseClient<Database>,
    private readonly userId: string,
  ) {}

  async list(): Promise<Tournament[]> {
    const cached = await this.local.list();
    const { data: rows, error } = await this.supabase
      .from("tournaments")
      .select("*")
      .order("updated_at", { ascending: false });

    if (error) return cached;

    const { data: memberships, error: membershipError } = await this.supabase
      .from("tournament_members")
      .select("tournament_id, role");

    if (membershipError) return cached;

    const roleByTournament = new Map(
      memberships.map((membership) => [
        membership.tournament_id,
        membership.role as TournamentRole,
      ]),
    );
    const remoteRows = [...rows];
    const remoteIds = new Set(rows.map((row) => row.id));
    const importKey = `torneiamo:supabase-imported:${this.userId}`;

    if (window.localStorage.getItem(importKey) !== "true") {
      let importSucceeded = true;
      for (const tournament of cached.filter((item) => !remoteIds.has(item.id))) {
        const { data: imported, error: importError } = await this.supabase
          .from("tournaments")
          .insert(this.toInsert(tournament))
          .select()
          .single();

        if (importError) {
          importSucceeded = false;
          continue;
        }

        remoteRows.push(imported);
        remoteIds.add(imported.id);
        roleByTournament.set(imported.id, "owner");
      }
      if (importSucceeded) window.localStorage.setItem(importKey, "true");
    }

    const tournaments = remoteRows
      .map((row) => this.remember(row, roleByTournament.get(row.id)))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

    await this.local.replace(tournaments);
    return tournaments;
  }

  async save(tournament: Tournament): Promise<void> {
    await this.local.save(tournament);
    const meta = this.remote.get(tournament.id);

    if (!meta) {
      const { data, error } = await this.supabase
        .from("tournaments")
        .insert(this.toInsert(tournament))
        .select()
        .single();
      if (error) throw error;
      this.remember(data, "owner");
      return;
    }

    if (meta.role === "viewer") {
      throw new Error("Hai accesso in sola lettura a questo torneo.");
    }

    const { data, error } = await this.supabase
      .from("tournaments")
      .update(this.toUpdate(tournament))
      .eq("id", tournament.id)
      .eq("revision", meta.revision)
      .select()
      .maybeSingle();

    if (error) throw error;
    if (data) {
      this.remember(data, meta.role);
      return;
    }

    const { data: latest, error: latestError } = await this.supabase
      .from("tournaments")
      .select("*")
      .eq("id", tournament.id)
      .single();
    if (latestError) throw latestError;

    const latestTournament = this.remember(latest, meta.role);
    await this.local.save(latestTournament);
    throw new SyncConflictError(latestTournament);
  }

  async remove(tournamentId: string): Promise<void> {
    const meta = this.remote.get(tournamentId);
    if (meta) {
      if (meta.role !== "owner") {
        throw new Error("Solo il proprietario può eliminare il torneo.");
      }
      const { error } = await this.supabase
        .from("tournaments")
        .delete()
        .eq("id", tournamentId);
      if (error) throw error;
      this.remote.delete(tournamentId);
    }
    await this.local.remove(tournamentId);
  }

  roleFor(tournamentId: string): TournamentRole {
    return this.remote.get(tournamentId)?.role ?? "owner";
  }

  subscribe(onChange: (change: RepositoryChange) => void) {
    this.channel?.unsubscribe();
    this.channel = this.supabase
      .channel(`tournaments:${this.userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tournaments" },
        async (payload) => {
          if (payload.eventType === "DELETE") {
            const tournamentId = String((payload.old as { id?: string }).id ?? "");
            if (!tournamentId) return;
            this.remote.delete(tournamentId);
            await this.local.remove(tournamentId);
            onChange({ type: "remove", tournamentId });
            return;
          }

          const row = payload.new as TournamentRow;
          const tournament = this.remember(row, this.remote.get(row.id)?.role);
          await this.local.save(tournament);
          onChange({ type: "upsert", tournament });
        },
      )
      .subscribe();

    return () => {
      if (this.channel) void this.supabase.removeChannel(this.channel);
      this.channel = null;
    };
  }

  private remember(row: TournamentRow, role?: TournamentRole) {
    this.remote.set(row.id, {
      ownerId: row.owner_id,
      revision: row.revision,
      role: role ?? (row.owner_id === this.userId ? "owner" : "viewer"),
    });
    return normalizeTournament(row.data as unknown as Tournament);
  }

  private toInsert(tournament: Tournament) {
    return {
      id: tournament.id,
      owner_id: this.userId,
      name: tournament.name,
      format: tournament.format,
      status: tournament.status,
      data: tournament as unknown as Json,
    };
  }

  private toUpdate(tournament: Tournament) {
    return {
      name: tournament.name,
      format: tournament.format,
      status: tournament.status,
      updated_at: tournament.updatedAt,
      data: tournament as unknown as Json,
    };
  }
}
