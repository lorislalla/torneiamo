"use client";

import { useState } from "react";
import { Plus, Trash2, Trophy } from "lucide-react";
import type { Tournament } from "@/domain/types";
import {
  getChampionId,
  rankTournamentScoreboardParticipants,
} from "@/domain/tournament-engine";
import { cn } from "@/lib/cn";
import { ScoreInput } from "./score-input";
import { Button, PlayerMark } from "./ui";

export function ScoreboardTable({
  tournament,
  onScore,
  onAddRound,
  onRemoveRound,
  readOnly = false,
}: {
  tournament: Tournament;
  onScore: (roundId: string, participantId: string, score: number) => void;
  onAddRound: () => void;
  onRemoveRound: (roundId: string) => void;
  readOnly?: boolean;
}) {
  const aggregation = tournament.settings.scoring.scoreboardAggregation;
  const sortedParticipants = rankTournamentScoreboardParticipants(tournament);
  const championId = tournament.status === "completed" ? getChampionId(tournament) : null;
  const [selectedParticipantId, setSelectedParticipantId] = useState<string | null>(null);
  const selectedParticipant = tournament.participants.find((participant) => participant.id === selectedParticipantId);

  return (
    <div className="overflow-hidden rounded-2xl border border-white/8 bg-white/[.025]">
      <div className="flex flex-col items-stretch gap-3 border-b border-white/8 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-white">Punteggi per round</p>
          <p className="mt-0.5 text-xs text-white/35">
            {aggregation === "roundWins"
              ? "La classifica conta i round vinti senza assegnare quelli in parità."
              : "La classifica somma i punteggi di tutti i round."}
          </p>
        </div>
        {!readOnly ? (
          <Button className="w-full sm:w-auto" type="button" variant="secondary" size="sm" onClick={onAddRound}>
            <Plus className="size-4" /> Aggiungi round
          </Button>
        ) : null}
      </div>
      <p className="border-b border-white/[.055] px-3 py-2 text-[11px] text-white/45 sm:hidden">
        Tocca le iniziali per leggere il nome · scorri i round lateralmente
      </p>
      <div
        className="max-w-full overscroll-x-contain overflow-x-auto"
        role="region"
        aria-label="Punteggi dei partecipanti per round"
        tabIndex={0}
      >
        <table className="w-full min-w-max border-collapse">
          <thead>
            <tr className="border-b border-white/8 text-[10px] font-semibold uppercase tracking-[.13em] text-white/30">
              <th scope="col" className="sticky left-0 z-[2] w-14 min-w-14 max-w-14 bg-[#0f1d17] px-2 py-2.5 text-left shadow-[12px_0_22px_-22px_rgba(0,0,0,.9)] sm:w-auto sm:min-w-48 sm:max-w-none sm:px-3">
                <span className="sr-only sm:not-sr-only">Partecipante</span>
              </th>
              {tournament.scoreboardRounds.map((round) => (
                <th key={round.id} className="min-w-[5.5rem] px-1.5 py-2.5 text-center sm:min-w-28 sm:px-3">
                  <div className="flex items-center justify-center gap-1">
                    {round.label}
                    {!readOnly ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Elimina ${round.label}`}
                        onClick={() => {
                          if (Object.values(round.scores).some((score) => score !== 0) &&
                            !window.confirm(`Eliminare ${round.label}? I punteggi inseriti saranno persi e la classifica verrà ricalcolata.`)) return;
                          onRemoveRound(round.id);
                        }}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    ) : null}
                  </div>
                </th>
              ))}
              <th className="sticky right-0 z-[2] min-w-[4.5rem] border-l border-white/8 bg-[#101e18] px-2 py-2.5 text-center shadow-[-12px_0_22px_-22px_rgba(0,0,0,.9)] sm:min-w-24 sm:px-3">
                {aggregation === "roundWins" ? "Vittorie" : "Totale"}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[.055]">
            {sortedParticipants.map((participant, index) => (
              <tr key={participant.id} className={participant.id === championId ? "bg-lime-300/[.08]" : undefined}>
                <th
                  scope="row"
                  aria-label={`${index + 1}. ${participant.name}${participant.id === championId ? ", Vincitore del torneo" : ""}`}
                  className={cn(
                    "sticky left-0 z-[1] w-14 min-w-14 max-w-14 px-2 py-3 text-left shadow-[12px_0_22px_-22px_rgba(0,0,0,.9)] sm:w-auto sm:min-w-48 sm:max-w-none sm:px-3",
                    participant.id === championId ? "bg-[#1b2e1c]" : "bg-[#0f1d17]",
                  )}
                >
                  <div className="flex min-w-0 items-center gap-2 sm:gap-3">
                    <span className="hidden w-4 shrink-0 text-center font-mono text-xs font-normal text-white/45 sm:block">
                      {index + 1}
                    </span>
                    <button
                      type="button"
                      className="relative grid size-10 shrink-0 place-items-center rounded-full focus-visible:outline-2 focus-visible:outline-lime-300 sm:hidden"
                      aria-label={`Mostra nome di ${participant.name}`}
                      aria-pressed={selectedParticipantId === participant.id}
                      onClick={() => setSelectedParticipantId((current) => current === participant.id ? null : participant.id)}
                    >
                      <PlayerMark name={participant.name} accent={participant.accent} size="sm" />
                      {participant.id === championId ? <Trophy className="absolute right-0 top-0 size-3.5 rounded bg-[#1b2e1c] text-lime-300" aria-hidden="true" /> : null}
                    </button>
                    <span className="hidden sm:contents"><PlayerMark name={participant.name} accent={participant.accent} size="sm" /></span>
                    <span className="hidden min-w-0 sm:block">
                      <span className="block truncate text-sm font-medium text-white">
                        {participant.name}
                      </span>
                      {participant.id === championId ? (
                        <span className="mt-0.5 flex items-center gap-1 text-[11px] font-medium text-lime-200">
                          <Trophy className="size-3" aria-hidden="true" /> Vincitore
                        </span>
                      ) : null}
                      {participant.teamName ? (
                        <span className="block truncate text-[11px] font-normal text-white/35">
                          {participant.teamName}
                        </span>
                      ) : null}
                    </span>
                  </div>
                </th>
                {tournament.scoreboardRounds.map((round) => (
                  <td key={round.id} className="px-1.5 py-3 text-center sm:px-3">
                    <ScoreInput
                      compact
                      score={round.scores[participant.id] ?? 0}
                      participantName={`${participant.name}, ${round.label}`}
                      readOnly={readOnly}
                      onCommit={(score) => onScore(round.id, participant.id, score)}
                    />
                  </td>
                ))}
                <td className={cn(
                  "sticky right-0 z-[1] border-l border-white/8 px-2 py-3 text-center font-mono text-lg font-semibold text-lime-200 shadow-[-12px_0_22px_-22px_rgba(0,0,0,.9)] sm:px-3",
                  participant.id === championId ? "bg-[#1b2e1c]" : "bg-[#101e18]",
                )}>
                  {participant.score ?? 0}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {selectedParticipant ? (
        <p role="status" className="border-t border-white/8 px-4 py-3 text-sm text-white sm:hidden">
          {selectedParticipant.name}{selectedParticipant.teamName ? ` · ${selectedParticipant.teamName}` : ""}
        </p>
      ) : null}
      <p className="border-t border-white/8 px-4 py-3 text-xs text-white/35">
        Sono ammessi numeri positivi, zero e punteggi negativi. In ogni round vince il punteggio {tournament.settings.scoring.scoreDirection === "higher" ? "più alto" : "più basso"}.
      </p>
    </div>
  );
}
