"use client";

import { Check, Clock3, CornerDownRight } from "lucide-react";
import type { Match, MatchScoreUpdate, Participant } from "@/domain/types";
import { getMatchWinner, isMatchPlayed } from "@/domain/tournament-engine";
import { cn } from "@/lib/cn";
import { PlayerMark } from "./ui";

export function MatchCard({
  match,
  participants,
  onChange,
  compact = false,
  readOnly = false,
}: {
  match: Match;
  participants: Participant[];
  onChange: (score: MatchScoreUpdate) => void;
  compact?: boolean;
  readOnly?: boolean;
}) {
  const participantById = new Map(
    participants.map((participant) => [participant.id, participant]),
  );
  const home = match.homeId ? (participantById.get(match.homeId) ?? null) : null;
  const away = match.awayId ? (participantById.get(match.awayId) ?? null) : null;
  const winnerId = getMatchWinner(match, match.twoLegs);
  const playable = Boolean(home && away);
  const firstLegComplete = isMatchPlayed(match);
  const returnLegComplete =
    match.returnHomeScore !== null && match.returnAwayScore !== null;
  const fullScoreComplete = firstLegComplete && (!match.twoLegs || returnLegComplete);
  const homeTotal =
    (match.homeScore ?? 0) + (match.twoLegs ? (match.returnAwayScore ?? 0) : 0);
  const awayTotal =
    (match.awayScore ?? 0) + (match.twoLegs ? (match.returnHomeScore ?? 0) : 0);
  const needsWinner =
    match.phase === "knockout" &&
    playable &&
    fullScoreComplete &&
    homeTotal === awayTotal;
  const decided =
    match.phase === "knockout" ? Boolean(winnerId) : firstLegComplete;

  function update(field: keyof MatchScoreUpdate, value: string) {
    const parsed = value === "" ? null : Math.max(0, Number.parseInt(value, 10));
    onChange({
      homeScore: match.homeScore,
      awayScore: match.awayScore,
      returnHomeScore: match.returnHomeScore,
      returnAwayScore: match.returnAwayScore,
      winnerOverrideId: match.winnerOverrideId,
      [field]: Number.isNaN(parsed) ? null : parsed,
    });
  }

  return (
    <article
      className={cn(
        "rounded-2xl border border-white/8 bg-[#101e18] shadow-[0_18px_50px_rgba(0,0,0,.16)]",
        compact ? "p-3" : "p-4 sm:p-5",
      )}
    >
      <div className="mb-3 flex items-center justify-between gap-3 text-[10px] uppercase tracking-[0.14em] text-white/35">
        <span>{match.roundLabel}</span>
        <span className="inline-flex items-center gap-1.5">
          {decided ? <Check className="size-3 text-lime-300" /> : <Clock3 className="size-3" />}
          {decided ? "Decisa" : playable ? "Da giocare" : "In attesa"}
        </span>
      </div>

      {!home || !away ? (
        <div className="space-y-2">
          <PlaceholderPlayer participant={home ?? away ?? null} />
          <div className="flex items-center gap-2 px-2 text-xs text-white/30">
            <CornerDownRight className="size-3.5" />
            {home || away
              ? match.round === 1
                ? "Bye — passa al turno successivo"
                : "In attesa dell’avversario"
              : "Vincente del turno precedente"}
          </div>
        </div>
      ) : (
        <>
          {match.twoLegs ? (
            <div className="space-y-3">
              <ScoreLeg
                label="Andata"
                first={home}
                second={away}
                firstScore={match.homeScore}
                secondScore={match.awayScore}
                onFirst={(value) => update("homeScore", value)}
                onSecond={(value) => update("awayScore", value)}
                winnerId={winnerId}
                readOnly={readOnly}
              />
              <div className="border-t border-dashed border-white/10" />
              <ScoreLeg
                label="Ritorno"
                first={away}
                second={home}
                firstScore={match.returnHomeScore}
                secondScore={match.returnAwayScore}
                onFirst={(value) => update("returnHomeScore", value)}
                onSecond={(value) => update("returnAwayScore", value)}
                winnerId={winnerId}
                readOnly={readOnly}
              />
              {fullScoreComplete ? (
                <div className="flex items-center justify-between rounded-xl bg-black/20 px-3 py-2 text-xs">
                  <span className="text-white/40">Aggregato</span>
                  <span className="font-mono font-semibold text-white">{homeTotal} — {awayTotal}</span>
                </div>
              ) : null}
            </div>
          ) : (
            <ScoreLeg
              first={home}
              second={away}
              firstScore={match.homeScore}
              secondScore={match.awayScore}
              onFirst={(value) => update("homeScore", value)}
              onSecond={(value) => update("awayScore", value)}
              winnerId={winnerId}
              readOnly={readOnly}
            />
          )}

          {needsWinner ? (
            <div className="mt-3 rounded-xl border border-amber-300/15 bg-amber-300/[.06] p-3">
              <p className="text-xs text-amber-100/75">Parità: indica chi passa dopo supplementari o rigori.</p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {[home, away].map((participant) => (
                  <button
                    type="button"
                    key={participant.id}
                    disabled={readOnly}
                    className={cn(
                      "rounded-lg border px-2 py-2 text-xs font-medium transition",
                      match.winnerOverrideId === participant.id
                        ? "border-lime-300/45 bg-lime-300/10 text-lime-200"
                        : "border-white/10 text-white/60 hover:bg-white/5",
                    )}
                    onClick={() =>
                      onChange({
                        homeScore: match.homeScore,
                        awayScore: match.awayScore,
                        returnHomeScore: match.returnHomeScore,
                        returnAwayScore: match.returnAwayScore,
                        winnerOverrideId: participant.id,
                      })
                    }
                  >
                    {participant.name}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </>
      )}
    </article>
  );
}

function ScoreLeg({
  label,
  first,
  second,
  firstScore,
  secondScore,
  onFirst,
  onSecond,
  winnerId,
  readOnly,
}: {
  label?: string;
  first: Participant;
  second: Participant;
  firstScore: number | null;
  secondScore: number | null;
  onFirst: (value: string) => void;
  onSecond: (value: string) => void;
  winnerId: string | null;
  readOnly: boolean;
}) {
  return (
    <div>
      {label ? <p className="mb-2 font-mono text-[10px] uppercase tracking-[.13em] text-white/30">{label}</p> : null}
      <div className="space-y-2">
        <PlayerScoreRow participant={first} score={firstScore} onChange={onFirst} isWinner={winnerId === first.id} readOnly={readOnly} />
        <PlayerScoreRow participant={second} score={secondScore} onChange={onSecond} isWinner={winnerId === second.id} readOnly={readOnly} />
      </div>
    </div>
  );
}

function PlayerScoreRow({
  participant,
  score,
  onChange,
  isWinner,
  readOnly,
}: {
  participant: Participant;
  score: number | null;
  onChange: (value: string) => void;
  isWinner: boolean;
  readOnly: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <PlayerMark name={participant.name} accent={participant.accent} size="sm" />
      <span className={cn("min-w-0 flex-1 truncate text-sm", isWinner ? "font-semibold text-white" : "text-white/72")}>
        {participant.name}
      </span>
      {isWinner ? <Check className="size-3.5 text-lime-300" /> : null}
      <input
        type="number"
        disabled={readOnly}
        min={0}
        inputMode="numeric"
        aria-label={`Gol ${participant.name}`}
        className="size-10 rounded-lg border border-white/10 bg-black/25 text-center font-mono text-base font-semibold text-white outline-none transition focus:border-lime-300/55 focus:ring-2 focus:ring-lime-300/10"
        value={score ?? ""}
        onChange={(event) => onChange(event.target.value)}
        placeholder="–"
      />
    </div>
  );
}

function PlaceholderPlayer({ participant }: { participant: Participant | null }) {
  if (!participant) {
    return <div className="rounded-xl border border-dashed border-white/8 px-3 py-4 text-sm text-white/25">Da definire</div>;
  }
  return (
    <div className="flex items-center gap-3 rounded-xl border border-lime-300/10 bg-lime-300/[.035] px-3 py-3">
      <PlayerMark name={participant.name} accent={participant.accent} size="sm" />
      <span className="text-sm font-medium text-white">{participant.name}</span>
    </div>
  );
}
