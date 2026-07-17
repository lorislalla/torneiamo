"use client";

import { useMemo, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  CircleDot,
  Download,
  Gauge,
  GitBranch,
  ListOrdered,
  Settings2,
  Share2,
  ShieldCheck,
  Trash2,
  Trophy,
  Users,
} from "lucide-react";
import type { MatchScoreUpdate, Participant, Tournament } from "@/domain/types";
import { participantLabel } from "@/domain/participant-label";
import {
  calculateStandings,
  getChampionId,
  getMatchWinner,
  isMatchPlayed,
  tournamentProgress,
  updateMatchScore,
} from "@/domain/tournament-engine";
import { cn } from "@/lib/cn";
import { BracketView } from "./bracket-view";
import { MatchCard } from "./match-card";
import { StandingsTable } from "./standings-table";
import { Button, PlayerMark } from "./ui";

type TabId = "overview" | "matches" | "standings" | "bracket" | "settings";

const FORMAT_LABELS = {
  league: "Campionato",
  knockout: "Eliminazione diretta",
  hybrid: "Gironi + playoff",
};

export function TournamentView({
  tournament,
  onUpdate,
  onDelete,
  canEdit = true,
  canDelete = true,
  isSynced = false,
  roleLabel,
  onManageAccess,
}: {
  tournament: Tournament;
  onUpdate: (tournament: Tournament) => void;
  onDelete: () => void;
  canEdit?: boolean;
  canDelete?: boolean;
  isSynced?: boolean;
  roleLabel?: string;
  onManageAccess?: () => void;
}) {
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const progress = tournamentProgress(tournament);
  const participantById = useMemo(
    () => new Map(tournament.participants.map((participant) => [participant.id, participant])),
    [tournament.participants],
  );
  const championId = getChampionId(tournament);
  const champion = championId ? participantById.get(championId) : null;
  const nextMatches = tournament.matches
    .filter(
      (match) =>
        match.homeId &&
        match.awayId &&
        (match.phase === "knockout"
          ? !getMatchWinner(match, match.twoLegs)
          : !isMatchPlayed(match)),
    )
    .slice(0, 3);

  const tabs: Array<{ id: TabId; label: string; icon: typeof Gauge; hidden?: boolean }> = [
    { id: "overview", label: "Panoramica", icon: Gauge },
    { id: "matches", label: "Partite", icon: CalendarDays },
    {
      id: "standings",
      label: tournament.format === "hybrid" ? "Gironi" : "Classifica",
      icon: ListOrdered,
      hidden: tournament.format === "knockout",
    },
    {
      id: "bracket",
      label: "Tabellone",
      icon: GitBranch,
      hidden: tournament.format === "league",
    },
    { id: "settings", label: "Dettagli", icon: Settings2 },
  ];

  function updateScore(matchId: string, score: MatchScoreUpdate) {
    onUpdate(updateMatchScore(tournament, matchId, score));
  }

  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 pb-16 pt-6 sm:px-7 lg:px-10 lg:pt-9">
      <header className="mb-7">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-lime-300/15 bg-lime-300/[.065] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[.14em] text-lime-200">
                {FORMAT_LABELS[tournament.format]}
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs text-white/40">
                {tournament.status === "completed" ? (
                  <CheckCircle2 className="size-3.5 text-lime-300" />
                ) : (
                  <CircleDot className="size-3.5 text-amber-300" />
                )}
                {tournament.status === "completed" ? "Completato" : "In corso"}
              </span>
            </div>
            <h1 className="text-3xl font-medium tracking-[-.04em] text-white sm:text-5xl">
              {tournament.name}
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-white/45">
              {tournament.participants.length} partecipanti · {progress.played} di {progress.total} sfide decise · dati salvati su questo dispositivo
            </p>
          </div>
          <div className="flex w-full max-w-md flex-col gap-3">
            {onManageAccess ? (
              <Button variant="secondary" onClick={onManageAccess}>
                <Share2 className="size-4" /> Persone e inviti
              </Button>
            ) : null}
            <div className="rounded-2xl border border-white/8 bg-white/[.025] p-4">
              <div className="mb-2 flex items-center justify-between text-xs">
                <span className="text-white/45">Avanzamento torneo</span>
                <span className="font-mono font-semibold text-lime-200">{progress.percentage}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-white/8">
                <div
                  className="h-full rounded-full bg-lime-300 transition-[width] duration-500"
                  style={{ width: `${progress.percentage}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </header>

      <nav className="mb-7 flex gap-1 overflow-x-auto rounded-2xl border border-white/8 bg-black/15 p-1.5" aria-label="Sezioni del torneo">
        {tabs.filter((tab) => !tab.hidden).map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              className={cn(
                "flex h-10 shrink-0 items-center gap-2 rounded-xl px-3.5 text-sm transition sm:px-4",
                activeTab === tab.id
                  ? "bg-white/[.09] font-medium text-white shadow-sm"
                  : "text-white/45 hover:text-white/75",
              )}
              onClick={() => setActiveTab(tab.id)}
            >
              <Icon className="size-4" /> {tab.label}
            </button>
          );
        })}
      </nav>

      {activeTab === "overview" ? (
        <Overview
          tournament={tournament}
          champion={champion ?? undefined}
          nextMatches={nextMatches}
          onScore={updateScore}
          onNavigate={setActiveTab}
          readOnly={!canEdit}
          isSynced={isSynced}
        />
      ) : null}
      {activeTab === "matches" ? (
        <MatchesSection tournament={tournament} onScore={updateScore} readOnly={!canEdit} />
      ) : null}
      {activeTab === "standings" ? (
        <StandingsSection tournament={tournament} />
      ) : null}
      {activeTab === "bracket" ? (
        <BracketView
          matches={tournament.matches}
          participants={tournament.participants}
          onScore={updateScore}
          readOnly={!canEdit}
        />
      ) : null}
      {activeTab === "settings" ? (
        <DetailsSection tournament={tournament} onDelete={onDelete} canDelete={canDelete} isSynced={isSynced} roleLabel={roleLabel} />
      ) : null}
    </div>
  );
}

function Overview({
  tournament,
  champion,
  nextMatches,
  onScore,
  onNavigate,
  readOnly,
  isSynced,
}: {
  tournament: Tournament;
  champion?: Participant;
  nextMatches: Tournament["matches"];
  onScore: (matchId: string, score: MatchScoreUpdate) => void;
  onNavigate: (tab: TabId) => void;
  readOnly: boolean;
  isSynced: boolean;
}) {
  const progress = tournamentProgress(tournament);
  const leagueMatches = tournament.matches.filter((match) => match.phase !== "knockout");
  const standings = tournament.format !== "knockout"
    ? calculateStandings(
        tournament.format === "hybrid"
          ? tournament.groups[0]?.participantIds ?? []
          : tournament.participants.map((participant) => participant.id),
        tournament.format === "hybrid"
          ? leagueMatches.filter((match) => match.groupId === tournament.groups[0]?.id)
          : leagueMatches,
      )
    : [];
  const leader = tournament.participants.find(
    (participant) => participant.id === standings[0]?.participantId,
  );

  return (
    <div className="space-y-7">
      {champion ? (
        <section className="relative overflow-hidden rounded-3xl border border-lime-300/20 bg-lime-300/[.075] p-6 sm:p-8">
          <div className="absolute -right-8 -top-14 size-44 rounded-full bg-lime-300/10 blur-3xl" />
          <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center">
            <span className="grid size-16 place-items-center rounded-2xl bg-lime-300 text-emerald-950 shadow-[0_14px_40px_rgba(190,255,102,.18)]">
              <Trophy className="size-7" />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[.18em] text-lime-200/65">Campione del torneo</p>
              <h2 className="mt-1 text-3xl font-medium tracking-tight text-white">
                {champion.name}
              </h2>
              {champion.teamName ? (
                <p className="mt-1 text-sm font-medium text-lime-100/65">
                  {champion.teamName}
                </p>
              ) : null}
              <p className="mt-1 text-sm text-white/45">Torneo completato. Il titolo è ufficiale.</p>
            </div>
          </div>
        </section>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Users} label="Partecipanti" value={String(tournament.participants.length)} note="Massimo 16" />
        <StatCard icon={CalendarDays} label="Sfide decise" value={`${progress.played}/${progress.total}`} note={`${progress.percentage}% completato`} />
        <StatCard
          icon={Trophy}
          label={tournament.format === "knockout" ? "Formato" : "In testa"}
          value={tournament.format === "knockout" ? "KO" : leader ? participantLabel(leader) : "—"}
          note={tournament.format === "hybrid" ? "Primo del Girone A" : FORMAT_LABELS[tournament.format]}
        />
        <StatCard icon={ShieldCheck} label="Salvataggio" value={isSynced ? "Cloud" : "Locale"} note={isSynced ? "Supabase + cache offline" : "Solo su questo dispositivo"} />
      </section>

      <section>
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[.15em] text-white/35">Prossimo passo</p>
            <h2 className="mt-1 text-xl font-medium tracking-tight text-white">Risultati da inserire</h2>
          </div>
          {nextMatches.length > 0 ? (
            <Button variant="ghost" size="sm" onClick={() => onNavigate("matches")}>Vedi tutte</Button>
          ) : null}
        </div>
        {nextMatches.length > 0 ? (
          <div className="grid gap-3 lg:grid-cols-3">
            {nextMatches.map((match) => (
              <MatchCard
                key={match.id}
                match={match}
                participants={tournament.participants}
                onChange={(score) => onScore(match.id, score)}
                readOnly={readOnly}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-3xl border border-dashed border-white/10 bg-white/[.02] p-8 text-center">
            <CheckCircle2 className="mx-auto size-6 text-lime-300" />
            <p className="mt-3 text-sm font-medium text-white">Nessun risultato in sospeso</p>
            <p className="mt-1 text-xs text-white/35">Hai completato tutte le partite attualmente disponibili.</p>
          </div>
        )}
      </section>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  note,
}: {
  icon: typeof Users;
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/[.028] p-4 sm:p-5">
      <div className="flex items-center justify-between">
        <span className="text-xs text-white/40">{label}</span>
        <Icon className="size-4 text-lime-300/70" />
      </div>
      <p className="mt-5 truncate text-2xl font-medium tracking-tight text-white">{value}</p>
      <p className="mt-1 text-xs text-white/30">{note}</p>
    </div>
  );
}

function MatchesSection({
  tournament,
  onScore,
  readOnly,
}: {
  tournament: Tournament;
  onScore: (matchId: string, score: MatchScoreUpdate) => void;
  readOnly: boolean;
}) {
  const [phase, setPhase] = useState<"all" | "group" | "knockout">("all");
  const visibleMatches = tournament.matches.filter(
    (match) => phase === "all" || match.phase === phase,
  );
  const roundKeys = Array.from(
    new Set(visibleMatches.map((match) => `${match.phase}:${match.groupId ?? ""}:${match.round}`)),
  );
  return (
    <section>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[.15em] text-white/35">Calendario</p>
          <h2 className="mt-1 text-2xl font-medium tracking-tight text-white">Tutte le partite</h2>
        </div>
        {tournament.format === "hybrid" ? (
          <div className="flex rounded-xl border border-white/8 bg-black/15 p-1">
            {(["all", "group", "knockout"] as const).map((value) => (
              <button
                key={value}
                type="button"
                className={cn("rounded-lg px-3 py-2 text-xs transition", phase === value ? "bg-white/10 text-white" : "text-white/35")}
                onClick={() => setPhase(value)}
              >
                {value === "all" ? "Tutte" : value === "group" ? "Gironi" : "Playoff"}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <div className="space-y-8">
        {roundKeys.map((key) => {
          const [matchPhase, groupId, round] = key.split(":");
          const roundMatches = visibleMatches.filter(
            (match) =>
              match.phase === matchPhase &&
              (match.groupId ?? "") === groupId &&
              match.round === Number(round),
          );
          const group = tournament.groups.find((item) => item.id === groupId);
          return (
            <div key={key}>
              <div className="mb-3 flex items-center gap-3">
                <h3 className="text-sm font-semibold text-white">{group ? `${group.name} · ` : ""}{roundMatches[0]?.roundLabel}</h3>
                <span className="h-px flex-1 bg-white/[.06]" />
                <span className="font-mono text-[10px] text-white/30">{roundMatches.length} partite</span>
              </div>
              <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
                {roundMatches.map((match) => (
                  <MatchCard key={match.id} match={match} participants={tournament.participants} onChange={(score) => onScore(match.id, score)} readOnly={readOnly} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function StandingsSection({ tournament }: { tournament: Tournament }) {
  if (tournament.format === "hybrid") {
    return (
      <div className="grid gap-6 xl:grid-cols-2">
        {tournament.groups.map((group) => (
          <section key={group.id}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-medium text-white">{group.name}</h2>
              <span className="font-mono text-[10px] uppercase tracking-[.12em] text-white/30">Primi {tournament.settings.qualifiersPerGroup} ai playoff</span>
            </div>
            <StandingsTable
              participants={tournament.participants.filter((participant) => group.participantIds.includes(participant.id))}
              matches={tournament.matches.filter((match) => match.groupId === group.id)}
              qualifiedCount={tournament.settings.qualifiersPerGroup}
            />
          </section>
        ))}
      </div>
    );
  }
  return <StandingsTable participants={tournament.participants} matches={tournament.matches} />;
}

function DetailsSection({ tournament, onDelete, canDelete, isSynced, roleLabel }: { tournament: Tournament; onDelete: () => void; canDelete: boolean; isSynced: boolean; roleLabel?: string }) {
  function downloadBackup() {
    const blob = new Blob([JSON.stringify(tournament, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${tournament.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-backup.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }
  return (
    <div className="grid gap-5 lg:grid-cols-[1.3fr_.7fr]">
      <section className="rounded-3xl border border-white/8 bg-white/[.025] p-5 sm:p-7">
        <h2 className="text-xl font-medium text-white">Regole del torneo</h2>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <Detail label="Formato" value={FORMAT_LABELS[tournament.format]} />
          <Detail label="Partecipanti" value={`${tournament.participants.length} / 16`} />
          {tournament.format !== "knockout" ? <Detail label="Calendario" value={tournament.settings.leagueLegs === 2 ? "Andata e ritorno" : "Sola andata"} /> : null}
          {tournament.format !== "league" ? <Detail label="Turni a eliminazione" value={tournament.settings.knockoutLegs === 2 ? "Andata e ritorno" : "Gara singola"} /> : null}
          {tournament.format === "hybrid" ? <Detail label="Gironi" value={`${tournament.settings.groupCount} · ${tournament.settings.qualifiersPerGroup} qualificati`} /> : null}
          <Detail label="Spareggi classifica" value="Scontri diretti → DR → GF" />
        </div>
        <div className="mt-7">
          <h3 className="text-sm font-medium text-white">Partecipanti</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {tournament.participants.map((participant) => (
              <span key={participant.id} className="inline-flex items-center gap-2 rounded-full border border-white/8 bg-white/[.035] py-1.5 pl-1.5 pr-3 text-xs text-white/65">
                <PlayerMark name={participant.name} accent={participant.accent} size="sm" />
                {participantLabel(participant)}
              </span>
            ))}
          </div>
        </div>
      </section>
      <aside className="space-y-4">
        <div className="rounded-3xl border border-white/8 bg-white/[.025] p-5">
          <Download className="size-5 text-lime-300" />
          <h3 className="mt-4 font-medium text-white">{isSynced ? "Cloud + backup" : "Backup locale"}</h3>
          <p className="mt-2 text-sm leading-6 text-white/40">{isSynced ? `Sincronizzato con Supabase${roleLabel ? ` · ${roleLabel}` : ""}. Puoi anche scaricare una copia JSON.` : "Scarica una copia JSON dei dati del torneo prima di cambiare dispositivo."}</p>
          <Button className="mt-4 w-full" variant="secondary" onClick={downloadBackup}><Download className="size-4" /> Esporta dati</Button>
        </div>
        {canDelete ? <div className="rounded-3xl border border-red-400/10 bg-red-400/[.035] p-5">
          <Trash2 className="size-5 text-red-300" />
          <h3 className="mt-4 font-medium text-white">Elimina torneo</h3>
          <p className="mt-2 text-sm leading-6 text-white/40">Questa azione rimuove definitivamente i dati salvati sul dispositivo.</p>
          <Button className="mt-4 w-full" variant="danger" onClick={onDelete}><Trash2 className="size-4" /> Elimina</Button>
        </div> : null}
      </aside>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/[.06] bg-black/15 p-4">
      <p className="text-xs text-white/35">{label}</p>
      <p className="mt-1 text-sm font-medium text-white/80">{value}</p>
    </div>
  );
}
