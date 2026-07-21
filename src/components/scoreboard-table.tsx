"use client";

import { Minus, TrendingDown, TrendingUp } from "lucide-react";
import type { Participant, ScoreDirection } from "@/domain/types";
import { compareRankedScores } from "@/domain/tournament-engine";
import { ScoreInput } from "./score-input";
import { PlayerMark } from "./ui";

export function ScoreboardTable({
  participants,
  onScore,
  scoreDirection = "higher",
  readOnly = false,
}: {
  participants: Participant[];
  onScore: (participantId: string, score: number) => void;
  scoreDirection?: ScoreDirection;
  readOnly?: boolean;
}) {
  const sortedParticipants = [...participants].sort(
    (first, second) =>
      compareRankedScores(first.score ?? 0, second.score ?? 0, scoreDirection) ||
      first.name.localeCompare(second.name, "it", { sensitivity: "base" }),
  );

  return (
    <div className="overflow-hidden rounded-2xl border border-white/8 bg-white/[.025]">
      <div className="grid grid-cols-[3.5rem_1fr_7rem] border-b border-white/8 px-3 py-2.5 text-[10px] font-semibold uppercase tracking-[.13em] text-white/30 sm:grid-cols-[4rem_1fr_9rem]">
        <span className="text-center">#</span>
        <span>Partecipante</span>
        <span className="text-center">Punteggio</span>
      </div>
      <div className="divide-y divide-white/[.055]">
        {sortedParticipants.map((participant, index) => {
          const score = participant.score ?? 0;
          return (
            <div
              key={participant.id}
              className="grid grid-cols-[3.5rem_1fr_7rem] items-center px-3 py-3 sm:grid-cols-[4rem_1fr_9rem]"
            >
              <span className="text-center font-mono text-sm text-white/50">
                {index + 1}
              </span>
              <div className="flex min-w-0 items-center gap-3">
                <PlayerMark name={participant.name} accent={participant.accent} size="sm" />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-white">
                    {participant.name}
                  </span>
                  {participant.teamName ? (
                    <span className="block truncate text-[11px] text-white/35">
                      {participant.teamName}
                    </span>
                  ) : null}
                </span>
              </div>
              <div className="flex items-center justify-end gap-2">
                {score > 0 ? <TrendingUp className="hidden size-3.5 text-lime-300 sm:block" /> : null}
                {score < 0 ? <TrendingDown className="hidden size-3.5 text-red-300 sm:block" /> : null}
                {score === 0 ? <Minus className="hidden size-3.5 text-white/25 sm:block" /> : null}
                <ScoreInput
                  score={score}
                  participantName={participant.name}
                  readOnly={readOnly}
                  onCommit={(value) => onScore(participant.id, value)}
                />
              </div>
            </div>
          );
        })}
      </div>
      <p className="border-t border-white/8 px-4 py-3 text-xs text-white/35">
        Sono ammessi numeri positivi, zero e punteggi negativi. Vince il punteggio {scoreDirection === "higher" ? "più alto" : "più basso"}.
      </p>
    </div>
  );
}
