"use client";

import { useMemo, useState } from "react";
import {
  CalendarDays,
  ChartNoAxesColumnIncreasing,
  Check,
  CheckCircle2,
  CircleDot,
  Download,
  Gauge,
  GitBranch,
  ListOrdered,
  Pencil,
  Settings2,
  Share2,
  ShieldCheck,
  SquareCheckBig,
  Trash2,
  Trophy,
  Users,
  UsersRound,
  X,
} from "lucide-react";
import type { MatchScoreUpdate, Participant, ScoringRules, Tournament } from "@/domain/types";
import { formatTournamentDate, tournamentCompletedAt } from "@/domain/tournament-catalog";
import { participantLabel } from "@/domain/participant-label";
import {
  addScoreboardRound,
  calculateStandings,
  calculateTeamStandings,
  completeScoreboardTournament,
  getChampionId,
  getMatchWinner,
  getScoreboardLeaderIds,
  isMatchPlayed,
  tournamentProgress,
  rankTournamentScoreboardParticipants,
  setTournamentStatus,
  updateParticipantScore,
  updateScoreboardRoundScore,
  updateMatchScore,
  updateTournamentName,
  updateTournamentScoringRules,
} from "@/domain/tournament-engine";
import { cn } from "@/lib/cn";
import { BracketView } from "./bracket-view";
import { MatchCard } from "./match-card";
import { ScoreboardTable } from "./scoreboard-table";
import { ScoringRulesFields, TIE_BREAKER_LABELS } from "./scoring-rules-fields";
import { StandingsTable } from "./standings-table";
import { TeamScoreboardTable } from "./team-scoreboard-table";
import { Button, Modal, PlayerMark } from "./ui";

type TabId = "overview" | "matches" | "standings" | "bracket" | "settings";

type ParticipantDraft = {
  id: string;
  name: string;
  teamName: string;
};

const FORMAT_LABELS = {
  league: "Campionato",
  duel: "Campionato a 2",
  knockout: "Eliminazione diretta",
  hybrid: "Gironi + playoff",
  scoreboard: "Classifica libera",
  "team-scoreboard": "Classifica a squadre",
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
          ? !getMatchWinner(
              match,
              match.twoLegs,
              tournament.settings.scoring.scoreDirection,
            )
          : !isMatchPlayed(match)),
    )
    .slice(0, 3);
  const openEnded = tournament.format === "duel" || tournament.format === "scoreboard" || tournament.format === "team-scoreboard";
  const completedAt = tournamentCompletedAt(tournament);

  const tabs: Array<{ id: TabId; label: string; icon: typeof Gauge; hidden?: boolean }> = [
    { id: "overview", label: "Panoramica", icon: Gauge },
    { id: "matches", label: "Sfide", icon: CalendarDays, hidden: tournament.format === "scoreboard" || tournament.format === "team-scoreboard" },
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
      hidden: tournament.format !== "knockout" && tournament.format !== "hybrid",
    },
    { id: "settings", label: "Dettagli", icon: Settings2 },
  ];

  function updateScore(matchId: string, score: MatchScoreUpdate) {
    onUpdate(updateMatchScore(tournament, matchId, score));
  }

  function updateScoreboard(participantId: string, score: number) {
    onUpdate(updateParticipantScore(tournament, participantId, score));
  }

  function updateScoreboardRound(roundId: string, participantId: string, score: number) {
    onUpdate(updateScoreboardRoundScore(tournament, roundId, participantId, score));
  }

  function addRound() {
    onUpdate(addScoreboardRound(tournament));
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
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/50">
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays className="size-3.5 text-lime-300/80" />
                Creato <time dateTime={tournament.createdAt}>{formatTournamentDate(tournament.createdAt)}</time>
              </span>
              {completedAt ? (
                <span className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="size-3.5 text-lime-300/80" />
                  Concluso <time dateTime={completedAt}>{formatTournamentDate(completedAt)}</time>
                </span>
              ) : null}
            </div>
            <p className="mt-3 max-w-xl text-sm leading-6 text-white/45">
              {tournament.participants.length} partecipanti · {tournament.format === "scoreboard"
                ? "punteggi liberi"
                : tournament.format === "team-scoreboard"
                  ? "totali condivisi"
                : tournament.format === "duel"
                  ? `${progress.played} sfide registrate`
                  : `${progress.played} di ${progress.total} sfide decise`} · dati salvati su questo dispositivo
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
                <span className="text-white/45">{openEnded ? "Stato" : "Avanzamento torneo"}</span>
                <span className="font-mono font-semibold text-lime-200">
                  {openEnded
                    ? tournament.status === "completed" ? "Concluso" : "In corso"
                    : `${progress.percentage}%`}
                </span>
              </div>
              {!openEnded ? <div className="h-2 overflow-hidden rounded-full bg-white/8">
                <div
                  className="h-full rounded-full bg-lime-300 transition-[width] duration-500"
                  style={{ width: `${progress.percentage}%` }}
                />
              </div> : <p className="text-xs leading-5 text-white/35">{tournament.format === "duel" ? "Continua finché non scegli di concluderlo." : "Aggiorna i punteggi in qualsiasi momento."}</p>}
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
          onParticipantScore={updateScoreboard}
          onScoreboardRoundScore={updateScoreboardRound}
          onAddScoreboardRound={addRound}
          onNavigate={setActiveTab}
          readOnly={!canEdit}
          isSynced={isSynced}
        />
      ) : null}
      {activeTab === "matches" ? (
        <MatchesSection tournament={tournament} onScore={updateScore} readOnly={!canEdit} />
      ) : null}
      {activeTab === "standings" ? (
        <StandingsSection
          tournament={tournament}
          onScore={updateScoreboard}
          onScoreboardRoundScore={updateScoreboardRound}
          onAddScoreboardRound={addRound}
          readOnly={!canEdit}
        />
      ) : null}
      {activeTab === "bracket" ? (
        <BracketView
          matches={tournament.matches}
          participants={tournament.participants}
          onScore={updateScore}
          readOnly={!canEdit}
          scoreDirection={tournament.settings.scoring.scoreDirection}
        />
      ) : null}
      {activeTab === "settings" ? (
        <DetailsSection
          tournament={tournament}
          onUpdate={onUpdate}
          onDelete={onDelete}
          canEdit={canEdit}
          canDelete={canDelete}
          isSynced={isSynced}
          roleLabel={roleLabel}
        />
      ) : null}
    </div>
  );
}

function Overview({
  tournament,
  champion,
  nextMatches,
  onScore,
  onParticipantScore,
  onScoreboardRoundScore,
  onAddScoreboardRound,
  onNavigate,
  readOnly,
  isSynced,
}: {
  tournament: Tournament;
  champion?: Participant;
  nextMatches: Tournament["matches"];
  onScore: (matchId: string, score: MatchScoreUpdate) => void;
  onParticipantScore: (participantId: string, score: number) => void;
  onScoreboardRoundScore: (roundId: string, participantId: string, score: number) => void;
  onAddScoreboardRound: () => void;
  onNavigate: (tab: TabId) => void;
  readOnly: boolean;
  isSynced: boolean;
}) {
  const progress = tournamentProgress(tournament);
  const leagueMatches = tournament.matches.filter((match) => match.phase !== "knockout");
  const standings = tournament.format !== "knockout" && tournament.format !== "scoreboard" && tournament.format !== "team-scoreboard"
    ? calculateStandings(
        tournament.format === "hybrid"
          ? tournament.groups[0]?.participantIds ?? []
          : tournament.participants.map((participant) => participant.id),
        tournament.format === "hybrid"
          ? leagueMatches.filter((match) => match.groupId === tournament.groups[0]?.id)
          : leagueMatches,
        tournament.settings.scoring,
      )
    : [];
  const scoreboardLeader = rankTournamentScoreboardParticipants(tournament)[0];
  const teamLeader = calculateTeamStandings(
    tournament.participants,
    tournament.settings.scoring.scoreDirection,
  )[0];
  const leader = tournament.format === "scoreboard"
    ? champion ?? scoreboardLeader
    : tournament.participants.find(
        (participant) => participant.id === standings[0]?.participantId,
      );

  return (
    <div className="space-y-7">
      {champion || (tournament.format === "team-scoreboard" && tournament.status === "completed" && teamLeader) ? (
        <section className="relative overflow-hidden rounded-3xl border border-lime-300/20 bg-lime-300/[.075] p-6 sm:p-8">
          <div className="absolute -right-8 -top-14 size-44 rounded-full bg-lime-300/10 blur-3xl" />
          <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center">
            <span className="grid size-16 place-items-center rounded-2xl bg-lime-300 text-emerald-950 shadow-[0_14px_40px_rgba(190,255,102,.18)]">
              <Trophy className="size-7" />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[.18em] text-lime-200/65">Vincitore del torneo</p>
              <h2 className="mt-1 text-3xl font-medium tracking-tight text-white">
                {champion?.name ?? teamLeader?.name}
              </h2>
              {champion?.teamName ? (
                <p className="mt-1 text-sm font-medium text-lime-100/65">
                  {champion.teamName}
                </p>
              ) : null}
              {champion && tournament.winnerOverrideNote ? (
                <p className="mt-3 max-w-2xl rounded-xl border border-white/8 bg-black/15 px-3 py-2 text-sm leading-6 text-white/60">
                  {tournament.winnerOverrideNote}
                </p>
              ) : null}
              <p className="mt-1 text-sm text-white/45">Torneo completato. Il titolo è ufficiale.</p>
            </div>
          </div>
        </section>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Users} label="Partecipanti" value={String(tournament.participants.length)} note="Massimo 16" />
        <StatCard
          icon={tournament.format === "scoreboard" ? ChartNoAxesColumnIncreasing : tournament.format === "team-scoreboard" ? UsersRound : CalendarDays}
          label={tournament.format === "scoreboard" ? tournament.settings.scoring.scoreboardAggregation === "roundWins" ? "Round vinti" : "Punteggio migliore" : tournament.format === "team-scoreboard" ? "Totale migliore" : "Sfide decise"}
          value={tournament.format === "scoreboard" ? String(scoreboardLeader?.score ?? 0) : tournament.format === "team-scoreboard" ? String(teamLeader?.total ?? 0) : tournament.format === "duel" ? String(progress.played) : `${progress.played}/${progress.total}`}
          note={tournament.format === "scoreboard" && tournament.settings.scoring.scoreboardAggregation === "roundWins" ? "Conta ogni round vinto" : tournament.format === "scoreboard" || tournament.format === "team-scoreboard" ? `Vince il valore ${tournament.settings.scoring.scoreDirection === "higher" ? "più alto" : "più basso"}` : tournament.format === "duel" ? "Senza limite prestabilito" : `${progress.percentage}% completato`}
        />
        <StatCard
          icon={Trophy}
          label={tournament.format === "knockout" ? "Formato" : "In testa"}
          value={tournament.format === "knockout" ? "KO" : tournament.format === "team-scoreboard" ? teamLeader?.name ?? "—" : leader ? participantLabel(leader) : "—"}
          note={tournament.format === "hybrid" ? "Primo del Girone A" : FORMAT_LABELS[tournament.format]}
        />
        <StatCard icon={ShieldCheck} label="Salvataggio" value={isSynced ? "Cloud" : "Locale"} note={isSynced ? "Supabase + cache offline" : "Solo su questo dispositivo"} />
      </section>

      {tournament.format === "scoreboard" ? (
        <section>
          <div className="mb-4">
            <p className="text-xs uppercase tracking-[.15em] text-white/35">Punteggi</p>
            <h2 className="mt-1 text-xl font-medium tracking-tight text-white">Classifica attuale</h2>
          </div>
          <ScoreboardTable
            tournament={tournament}
            onScore={onScoreboardRoundScore}
            onAddRound={onAddScoreboardRound}
            readOnly={readOnly}
          />
        </section>
      ) : tournament.format === "team-scoreboard" ? (
        <section>
          <div className="mb-4">
            <p className="text-xs uppercase tracking-[.15em] text-white/35">Squadre e coppie</p>
            <h2 className="mt-1 text-xl font-medium tracking-tight text-white">Classifica attuale</h2>
          </div>
          <TeamScoreboardTable
            participants={tournament.participants}
            scoreDirection={tournament.settings.scoring.scoreDirection}
            onScore={onParticipantScore}
            readOnly={readOnly}
          />
        </section>
      ) : <section>
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
                scoreDirection={tournament.settings.scoring.scoreDirection}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-3xl border border-dashed border-white/10 bg-white/[.02] p-8 text-center">
            <CheckCircle2 className="mx-auto size-6 text-lime-300" />
            <p className="mt-3 text-sm font-medium text-white">Nessun risultato in sospeso</p>
            <p className="mt-1 text-xs text-white/35">Hai completato tutte le sfide attualmente disponibili.</p>
          </div>
        )}
      </section>}
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
          <p className="text-xs uppercase tracking-[.15em] text-white/35">{tournament.format === "duel" ? "Serie aperta" : "Calendario"}</p>
          <h2 className="mt-1 text-2xl font-medium tracking-tight text-white">Tutte le sfide</h2>
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
                <span className="font-mono text-[10px] text-white/30">{roundMatches.length} {roundMatches.length === 1 ? "sfida" : "sfide"}</span>
              </div>
              <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
                {roundMatches.map((match) => (
                  <MatchCard key={match.id} match={match} participants={tournament.participants} onChange={(score) => onScore(match.id, score)} readOnly={readOnly} scoreDirection={tournament.settings.scoring.scoreDirection} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function StandingsSection({
  tournament,
  onScore,
  onScoreboardRoundScore,
  onAddScoreboardRound,
  readOnly,
}: {
  tournament: Tournament;
  onScore: (participantId: string, score: number) => void;
  onScoreboardRoundScore: (roundId: string, participantId: string, score: number) => void;
  onAddScoreboardRound: () => void;
  readOnly: boolean;
}) {
  if (tournament.format === "scoreboard") {
    return (
      <ScoreboardTable
        tournament={tournament}
        onScore={onScoreboardRoundScore}
        onAddRound={onAddScoreboardRound}
        readOnly={readOnly}
      />
    );
  }
  if (tournament.format === "team-scoreboard") {
    return (
      <TeamScoreboardTable
        participants={tournament.participants}
        scoreDirection={tournament.settings.scoring.scoreDirection}
        onScore={onScore}
        readOnly={readOnly}
      />
    );
  }
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
              scoring={tournament.settings.scoring}
            />
          </section>
        ))}
      </div>
    );
  }
  return <StandingsTable participants={tournament.participants} matches={tournament.matches} scoring={tournament.settings.scoring} />;
}

function DetailsSection({
  tournament,
  onUpdate,
  onDelete,
  canEdit,
  canDelete,
  isSynced,
  roleLabel,
}: {
  tournament: Tournament;
  onUpdate: (tournament: Tournament) => void;
  onDelete: () => void;
  canEdit: boolean;
  canDelete: boolean;
  isSynced: boolean;
  roleLabel?: string;
}) {
  const [editingParticipants, setEditingParticipants] = useState(false);
  const [participantDrafts, setParticipantDrafts] = useState<ParticipantDraft[]>(() =>
    createParticipantDrafts(tournament.participants),
  );
  const [participantError, setParticipantError] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(tournament.name);
  const [nameError, setNameError] = useState("");
  const [editingRules, setEditingRules] = useState(false);
  const [scoringDraft, setScoringDraft] = useState<ScoringRules>(() => ({
    ...tournament.settings.scoring,
    tieBreakers: [...tournament.settings.scoring.tieBreakers],
  }));
  const [scoringError, setScoringError] = useState("");
  const [winnerDialogOpen, setWinnerDialogOpen] = useState(false);
  const [winnerDraft, setWinnerDraft] = useState("");
  const [winnerNoteDraft, setWinnerNoteDraft] = useState("");
  const scoreboardLeaderIds = getScoreboardLeaderIds(tournament);
  const tiedLeaders = tournament.participants.filter((participant) =>
    scoreboardLeaderIds.includes(participant.id),
  );

  function startEditingName() {
    setNameDraft(tournament.name);
    setNameError("");
    setEditingName(true);
  }

  function cancelEditingName() {
    setNameDraft(tournament.name);
    setNameError("");
    setEditingName(false);
  }

  function saveName() {
    if (!nameDraft.trim()) {
      setNameError("Il nome del torneo è obbligatorio.");
      return;
    }
    const renamedTournament = updateTournamentName(tournament, nameDraft);
    if (renamedTournament !== tournament) onUpdate(renamedTournament);
    setNameError("");
    setEditingName(false);
  }

  function startEditingParticipants() {
    setParticipantDrafts(createParticipantDrafts(tournament.participants));
    setParticipantError("");
    setEditingParticipants(true);
  }

  function cancelEditingParticipants() {
    setParticipantError("");
    setEditingParticipants(false);
  }

  function updateParticipantDraft(
    id: string,
    field: "name" | "teamName",
    value: string,
  ) {
    setParticipantDrafts((current) =>
      current.map((participant) =>
        participant.id === id ? { ...participant, [field]: value } : participant,
      ),
    );
  }

  function saveParticipants() {
    if (participantDrafts.some((participant) => !participant.name.trim())) {
      setParticipantError("Il nome è obbligatorio per tutti i partecipanti.");
      return;
    }

    const uniqueParticipants = new Set(
      participantDrafts.map((participant) =>
        `${participant.name.trim()}\u0000${participant.teamName.trim()}`.toLocaleLowerCase("it"),
      ),
    );
    if (uniqueParticipants.size !== participantDrafts.length) {
      setParticipantError("Ogni combinazione di nome ed etichetta deve essere diversa.");
      return;
    }
    if (tournament.format === "team-scoreboard") {
      const teamCounts = new Map<string, number>();
      for (const participant of participantDrafts) {
        const teamName = participant.teamName.trim();
        if (!teamName) {
          setParticipantError("Ogni persona deve appartenere a una squadra o coppia.");
          return;
        }
        const key = teamName.toLocaleLowerCase("it");
        teamCounts.set(key, (teamCounts.get(key) ?? 0) + 1);
      }
      if (teamCounts.size < 2 || Array.from(teamCounts.values()).some((count) => count < 2)) {
        setParticipantError("Servono almeno due squadre o coppie, con almeno due persone ciascuna.");
        return;
      }
    }

    const draftById = new Map(
      participantDrafts.map((participant) => [participant.id, participant]),
    );
    onUpdate({
      ...tournament,
      participants: tournament.participants.map((participant) => {
        const draft = draftById.get(participant.id);
        if (!draft) return participant;
        return {
          ...participant,
          name: draft.name.trim(),
          teamName: draft.teamName.trim() || undefined,
        };
      }),
      updatedAt: new Date().toISOString(),
    });
    setParticipantError("");
    setEditingParticipants(false);
  }

  function startEditingRules() {
    setScoringDraft({
      ...tournament.settings.scoring,
      tieBreakers: [...tournament.settings.scoring.tieBreakers],
    });
    setScoringError("");
    setEditingRules(true);
  }

  function saveRules() {
    const pointValues = [
      scoringDraft.winPoints,
      scoringDraft.drawPoints,
      scoringDraft.lossPoints,
    ];
    if (pointValues.some((value) => !Number.isFinite(value))) {
      setScoringError("Inserisci valori numerici validi per vittoria, pareggio e sconfitta.");
      return;
    }
    if (new Set(scoringDraft.tieBreakers).size !== scoringDraft.tieBreakers.length) {
      setScoringError("I criteri di spareggio devono essere diversi tra loro.");
      return;
    }
    onUpdate(updateTournamentScoringRules(tournament, scoringDraft));
    setScoringError("");
    setEditingRules(false);
  }

  function toggleTournamentStatus() {
    if (tournament.status === "completed") {
      onUpdate(setTournamentStatus(tournament, "active"));
      return;
    }
    if (tournament.format === "scoreboard" && scoreboardLeaderIds.length > 1) {
      setWinnerDraft("");
      setWinnerNoteDraft("");
      setWinnerDialogOpen(true);
      return;
    }
    onUpdate(setTournamentStatus(tournament, "completed"));
  }

  function confirmScoreboardWinner() {
    if (!winnerDraft) return;
    onUpdate(completeScoreboardTournament(
      tournament,
      winnerDraft,
      winnerNoteDraft,
    ));
    setWinnerDialogOpen(false);
  }

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
    <>
    <div className="grid gap-5 lg:grid-cols-[1.3fr_.7fr]">
      <section className="rounded-3xl border border-white/8 bg-white/[.025] p-5 sm:p-7">
        <h2 className="text-xl font-medium text-white">Dettagli del torneo</h2>
        <div className="mt-6 rounded-2xl border border-lime-300/10 bg-lime-300/[.035] p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-[.14em] text-lime-200/70">Nome del torneo</p>
              {!editingName ? (
                <p className="mt-2 truncate text-lg font-medium text-white">{tournament.name}</p>
              ) : null}
            </div>
            {canEdit && !editingName ? (
              <Button type="button" variant="ghost" size="sm" onClick={startEditingName}>
                <Pencil className="size-3.5" /> Modifica
              </Button>
            ) : null}
          </div>
          {editingName ? (
            <div className="mt-3">
              <label>
                <span className="sr-only">Nuovo nome del torneo</span>
                <input
                  autoFocus
                  className="h-11 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-lime-300/50 focus:ring-2 focus:ring-lime-300/10"
                  value={nameDraft}
                  onChange={(event) => setNameDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") saveName();
                    if (event.key === "Escape") cancelEditingName();
                  }}
                />
              </label>
              {nameError ? <p className="mt-2 text-xs text-red-200" role="alert">{nameError}</p> : null}
              <div className="mt-3 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button type="button" variant="ghost" size="sm" onClick={cancelEditingName}>
                  <X className="size-4" /> Annulla
                </Button>
                <Button type="button" size="sm" onClick={saveName}>
                  <Check className="size-4" /> Salva nome
                </Button>
              </div>
            </div>
          ) : null}
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <Detail label="Formato" value={FORMAT_LABELS[tournament.format]} />
          <Detail label="Partecipanti" value={`${tournament.participants.length} / 16`} />
          {tournament.format === "league" ? <Detail label="Calendario" value={tournament.settings.leagueLegs === 2 ? "Andata e ritorno" : "Sola andata"} /> : null}
          {tournament.format === "duel" ? <Detail label="Durata" value="Serie libera, senza limite di sfide" /> : null}
          {tournament.format === "scoreboard" ? <Detail label="Punteggi" value="Liberi, anche con valori negativi" /> : null}
          {tournament.format === "scoreboard" ? <Detail label="Calcolo classifica" value={tournament.settings.scoring.scoreboardAggregation === "roundWins" ? "Numero di round vinti" : "Somma dei punteggi"} /> : null}
          {tournament.format === "team-scoreboard" ? <Detail label="Punteggi" value="Individuali con totale di squadra" /> : null}
          {tournament.format === "knockout" || tournament.format === "hybrid" ? <Detail label="Turni a eliminazione" value={tournament.settings.knockoutLegs === 2 ? "Andata e ritorno" : "Gara singola"} /> : null}
          {tournament.format === "hybrid" ? <Detail label="Gironi" value={`${tournament.settings.groupCount} · ${tournament.settings.qualifiersPerGroup} qualificati`} /> : null}
          <Detail label="Punteggio migliore" value={tournament.settings.scoring.scoreDirection === "higher" ? "Più alto" : "Più basso"} />
          {tournament.winnerOverrideNote ? <Detail label="Nota sul vincitore" value={tournament.winnerOverrideNote} /> : null}
          {tournament.format === "league" || tournament.format === "duel" || tournament.format === "hybrid" ? <Detail label="Punti V / N / P" value={`${tournament.settings.scoring.winPoints} / ${tournament.settings.scoring.drawPoints} / ${tournament.settings.scoring.lossPoints}`} /> : null}
          {tournament.format === "league" || tournament.format === "duel" || tournament.format === "hybrid" ? <Detail label="Spareggi classifica" value={tournament.settings.scoring.tieBreakers.map((tieBreaker) => TIE_BREAKER_LABELS[tieBreaker]).join(" → ")} /> : null}
        </div>
        <div className="mt-7 rounded-2xl border border-white/8 bg-black/15 p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-medium text-white">Regole di punteggio</h3>
              <p className="mt-1 text-xs leading-5 text-white/35">Le modifiche ricalcolano classifica e passaggi del tabellone.</p>
            </div>
            {canEdit && !editingRules ? (
              <Button type="button" variant="ghost" size="sm" onClick={startEditingRules}>
                <Pencil className="size-3.5" /> Modifica
              </Button>
            ) : null}
          </div>
          {editingRules ? (
            <div className="mt-4">
              <ScoringRulesFields
                format={tournament.format}
                rules={scoringDraft}
                onChange={setScoringDraft}
              />
              {scoringError ? <p className="mt-3 text-xs text-red-200" role="alert">{scoringError}</p> : null}
              <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button type="button" variant="ghost" size="sm" onClick={() => setEditingRules(false)}><X className="size-4" /> Annulla</Button>
                <Button type="button" size="sm" onClick={saveRules}><Check className="size-4" /> Salva regole</Button>
              </div>
            </div>
          ) : null}
        </div>
        <div className="mt-7">
          <div className="flex items-center justify-between gap-4">
            <h3 className="text-sm font-medium text-white">Partecipanti</h3>
            {canEdit && !editingParticipants ? (
              <Button type="button" variant="ghost" size="sm" onClick={startEditingParticipants}>
                <Pencil className="size-3.5" /> Modifica
              </Button>
            ) : null}
          </div>
          {editingParticipants ? (
            <div className="mt-3">
              <div className="overflow-hidden rounded-2xl border border-white/8 bg-black/15">
                <div className="hidden grid-cols-[2rem_1fr_1fr] gap-2 border-b border-white/8 px-3 py-2.5 text-[10px] font-semibold uppercase tracking-[.13em] text-white/30 sm:grid">
                  <span>#</span>
                  <span>Nome o nickname</span>
                  <span>{tournament.format === "team-scoreboard" ? "Squadra o coppia" : "Etichetta (facoltativa)"}</span>
                </div>
                <div className="divide-y divide-white/[.055]">
                  {participantDrafts.map((participant, index) => (
                    <div key={participant.id} className="grid grid-cols-[2rem_1fr] gap-2 p-3 sm:grid-cols-[2rem_1fr_1fr]">
                      <span className="grid h-11 place-items-center font-mono text-xs text-white/25">
                        {index + 1}
                      </span>
                      <label className="min-w-0">
                        <span className="mb-1 block text-[10px] uppercase tracking-[.12em] text-white/30 sm:hidden">
                          Nome o nickname
                        </span>
                        <input
                          className="h-11 w-full rounded-xl border border-white/10 bg-white/[.055] px-3 text-sm text-white outline-none transition placeholder:text-white/22 focus:border-lime-300/50 focus:ring-2 focus:ring-lime-300/10"
                          value={participant.name}
                          onChange={(event) =>
                            updateParticipantDraft(participant.id, "name", event.target.value)
                          }
                          aria-label={`Nome partecipante ${index + 1}`}
                        />
                      </label>
                      <label className="col-start-2 min-w-0 sm:col-start-auto">
                        <span className="mb-1 block text-[10px] uppercase tracking-[.12em] text-white/30 sm:hidden">
                          {tournament.format === "team-scoreboard" ? "Squadra o coppia" : "Etichetta (facoltativa)"}
                        </span>
                        <input
                          className="h-11 w-full rounded-xl border border-white/10 bg-white/[.055] px-3 text-sm text-white outline-none transition placeholder:text-white/22 focus:border-lime-300/50 focus:ring-2 focus:ring-lime-300/10"
                          value={participant.teamName}
                          onChange={(event) =>
                            updateParticipantDraft(participant.id, "teamName", event.target.value)
                          }
                          aria-label={tournament.format === "team-scoreboard" ? `Squadra o coppia del partecipante ${index + 1}` : `Etichetta partecipante ${index + 1}, facoltativa`}
                        />
                      </label>
                    </div>
                  ))}
                </div>
              </div>
              {participantError ? (
                <p className="mt-3 rounded-xl border border-red-400/15 bg-red-400/[.06] px-3 py-2 text-xs text-red-200" role="alert">
                  {participantError}
                </p>
              ) : null}
              <div className="mt-3 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button type="button" variant="ghost" size="sm" onClick={cancelEditingParticipants}>
                  <X className="size-4" /> Annulla
                </Button>
                <Button type="button" size="sm" onClick={saveParticipants}>
                  <Check className="size-4" /> Salva modifiche
                </Button>
              </div>
            </div>
          ) : (
            <div className="mt-3 flex flex-wrap gap-2">
              {tournament.participants.map((participant) => (
                <span key={participant.id} className="inline-flex items-center gap-2 rounded-full border border-white/8 bg-white/[.035] py-1.5 pl-1.5 pr-3 text-xs text-white/65">
                  <PlayerMark name={participant.name} accent={participant.accent} size="sm" />
                  {participantLabel(participant)}
                </span>
              ))}
            </div>
          )}
        </div>
      </section>
      <aside className="space-y-4">
        {(tournament.format === "duel" || tournament.format === "scoreboard" || tournament.format === "team-scoreboard") && canEdit ? (
          <div className="rounded-3xl border border-lime-300/10 bg-lime-300/[.035] p-5">
            <SquareCheckBig className="size-5 text-lime-300" />
            <h3 className="mt-4 font-medium text-white">
              {tournament.status === "completed" ? "Torneo concluso" : "Conclusione manuale"}
            </h3>
            <p className="mt-2 text-sm leading-6 text-white/40">
              {tournament.status === "completed"
                ? "Puoi riaprirlo e continuare ad aggiornare risultati o punteggi."
                : "Decidi tu quando questa modalità aperta è terminata."}
            </p>
            <Button
              className="mt-4 w-full"
              variant={tournament.status === "completed" ? "secondary" : "primary"}
              onClick={toggleTournamentStatus}
            >
              <SquareCheckBig className="size-4" />
              {tournament.status === "completed" ? "Riapri torneo" : "Concludi torneo"}
            </Button>
          </div>
        ) : null}
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
    <Modal
      open={winnerDialogOpen}
      onClose={() => setWinnerDialogOpen(false)}
      title="Scegli il vincitore"
      description="Il primo posto è in parità. Indica chi ha vinto lo spareggio."
    >
      <div className="space-y-5 p-5 sm:p-7">
        <fieldset>
          <legend className="mb-3 text-xs font-medium uppercase tracking-[.16em] text-white/45">
            Vincitore del torneo
          </legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {tiedLeaders.map((participant) => (
              <label
                key={participant.id}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition",
                  winnerDraft === participant.id
                    ? "border-lime-300/45 bg-lime-300/[.08]"
                    : "border-white/10 bg-white/[.025] hover:border-white/20",
                )}
              >
                <input
                  type="radio"
                  name="scoreboard-winner"
                  value={participant.id}
                  checked={winnerDraft === participant.id}
                  onChange={() => setWinnerDraft(participant.id)}
                  className="size-4 accent-lime-300"
                />
                <PlayerMark name={participant.name} accent={participant.accent} size="sm" />
                <span className="min-w-0 truncate text-sm font-medium text-white">
                  {participantLabel(participant)}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <label className="block">
          <span className="mb-2 block text-xs font-medium uppercase tracking-[.16em] text-white/45">
            Nota facoltativa
          </span>
          <textarea
            rows={3}
            value={winnerNoteDraft}
            onChange={(event) => setWinnerNoteDraft(event.target.value)}
            className="w-full resize-y rounded-xl border border-white/10 bg-white/[.055] px-3 py-3 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-lime-300/50 focus:ring-2 focus:ring-lime-300/10"
            placeholder="Es. Vittoria alla buca di spareggio"
          />
        </label>
        <div className="flex flex-col-reverse gap-2 border-t border-white/8 pt-5 sm:flex-row sm:justify-end">
          <Button type="button" variant="ghost" onClick={() => setWinnerDialogOpen(false)}>
            Annulla
          </Button>
          <Button type="button" disabled={!winnerDraft} onClick={confirmScoreboardWinner}>
            <Trophy className="size-4" /> Concludi torneo
          </Button>
        </div>
      </div>
    </Modal>
    </>
  );
}

function createParticipantDrafts(participants: Participant[]): ParticipantDraft[] {
  return participants.map((participant) => ({
    id: participant.id,
    name: participant.name,
    teamName: participant.teamName ?? "",
  }));
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/[.06] bg-black/15 p-4">
      <p className="text-xs text-white/35">{label}</p>
      <p className="mt-1 text-sm font-medium text-white/80">{value}</p>
    </div>
  );
}
