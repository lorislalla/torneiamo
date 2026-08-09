"use client";

import { Plus } from "lucide-react";
import type { Tournament } from "@/domain/types";
import {
  rankTournamentScoreboardParticipants,
} from "@/domain/tournament-engine";
import { ScoreInput } from "./score-input";
import { Button, PlayerMark } from "./ui";

export function ScoreboardTable({
  tournament,
  onScore,
  onAddRound,
  readOnly = false,
}: {
  tournament: Tournament;
  onScore: (roundId: string, participantId: string, score: number) => void;
  onAddRound: () => void;
  readOnly?: boolean;
}) {
  const aggregation = tournament.settings.scoring.scoreboardAggregation;
  const sortedParticipants = rankTournamentScoreboardParticipants(tournament);

  return (
    <div className="overflow-hidden rounded-2xl border border-white/8 bg-white/[.025]">
      <div className="flex items-center justify-between gap-4 border-b border-white/8 px-4 py-3">
        <div>
          <p className="text-sm font-medium text-white">Punteggi per round</p>
          <p className="mt-0.5 text-xs text-white/35">
            {aggregation === "roundWins"
              ? "La classifica conta i round vinti senza assegnare quelli in parità."
              : "La classifica somma i punteggi di tutti i round."}
          </p>
        </div>
        {!readOnly ? (
          <Button type="button" variant="secondary" size="sm" onClick={onAddRound}>
            <Plus className="size-4" /> Aggiungi round
          </Button>
        ) : null}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-max border-collapse">
          <thead>
            <tr className="border-b border-white/8 text-[10px] font-semibold uppercase tracking-[.13em] text-white/30">
              <th className="w-14 px-3 py-2.5 text-center">#</th>
              <th className="sticky left-0 z-[1] min-w-48 bg-[#0f1d17] px-3 py-2.5 text-left">Partecipante</th>
              {tournament.scoreboardRounds.map((round) => (
                <th key={round.id} className="min-w-28 px-3 py-2.5 text-center">
                  {round.label}
                </th>
              ))}
              <th className="min-w-24 border-l border-white/8 px-3 py-2.5 text-center">
                {aggregation === "roundWins" ? "Vittorie" : "Totale"}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[.055]">
            {sortedParticipants.map((participant, index) => (
              <tr key={participant.id}>
                <td className="px-3 py-3 text-center font-mono text-sm text-white/50">
                  {index + 1}
                </td>
                <td className="sticky left-0 z-[1] bg-[#0f1d17] px-3 py-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <PlayerMark name={participant.name} accent={participant.accent} size="sm" />
                    <span className="min-w-0">
                      <span className="block max-w-40 truncate text-sm font-medium text-white">
                        {participant.name}
                      </span>
                      {participant.teamName ? (
                        <span className="block max-w-40 truncate text-[11px] text-white/35">
                          {participant.teamName}
                        </span>
                      ) : null}
                    </span>
                  </div>
                </td>
                {tournament.scoreboardRounds.map((round) => (
                  <td key={round.id} className="px-3 py-3 text-center">
                    <ScoreInput
                      compact
                      score={round.scores[participant.id] ?? 0}
                      participantName={`${participant.name}, ${round.label}`}
                      readOnly={readOnly}
                      onCommit={(score) => onScore(round.id, participant.id, score)}
                    />
                  </td>
                ))}
                <td className="border-l border-white/8 px-3 py-3 text-center font-mono text-lg font-semibold text-lime-200">
                  {participant.score ?? 0}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="border-t border-white/8 px-4 py-3 text-xs text-white/35">
        Sono ammessi numeri positivi, zero e punteggi negativi. In ogni round vince il punteggio {tournament.settings.scoring.scoreDirection === "higher" ? "più alto" : "più basso"}.
      </p>
    </div>
  );
}
