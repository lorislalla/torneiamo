"use client";

import { LockKeyhole } from "lucide-react";
import type { Match, MatchScoreUpdate, Participant, ScoreDirection } from "@/domain/types";
import { MatchCard } from "./match-card";

export function BracketView({
  matches,
  participants,
  onScore,
  readOnly = false,
  scoreDirection = "higher",
}: {
  matches: Match[];
  participants: Participant[];
  onScore: (matchId: string, score: MatchScoreUpdate) => void;
  readOnly?: boolean;
  scoreDirection?: ScoreDirection;
}) {
  const knockoutMatches = matches.filter((match) => match.phase === "knockout");
  if (knockoutMatches.length === 0) {
    return (
      <div className="grid min-h-72 place-items-center rounded-3xl border border-dashed border-white/10 bg-white/[.02] p-8 text-center">
        <div>
          <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-white/[.05] text-white/45">
            <LockKeyhole className="size-5" />
          </span>
          <h3 className="mt-4 font-medium text-white">Playoff ancora bloccati</h3>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-white/40">
            Completa tutti i risultati dei gironi. Il tabellone verrà generato automaticamente con gli incroci corretti.
          </p>
        </div>
      </div>
    );
  }

  const rounds = Array.from(new Set(knockoutMatches.map((match) => match.round)));
  return (
    <div className="overflow-x-auto pb-4">
      <div className="grid min-w-max grid-flow-col gap-5" style={{ gridAutoColumns: "minmax(260px, 300px)" }}>
        {rounds.map((round) => {
          const roundMatches = knockoutMatches.filter((match) => match.round === round);
          return (
            <section key={round}>
              <div className="mb-3 flex items-center justify-between px-1">
                <h3 className="text-sm font-semibold text-white">{roundMatches[0]?.roundLabel}</h3>
                <span className="font-mono text-[10px] text-white/30">{roundMatches.length} {roundMatches.length === 1 ? "sfida" : "sfide"}</span>
              </div>
              <div className="flex min-h-[420px] flex-col justify-around gap-4">
                {roundMatches.map((match) => (
                  <MatchCard
                    key={match.id}
                    match={match}
                    participants={participants}
                    compact
                    readOnly={readOnly}
                    scoreDirection={scoreDirection}
                    onChange={(score) => onScore(match.id, score)}
                  />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
