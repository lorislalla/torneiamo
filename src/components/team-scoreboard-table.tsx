"use client";

import { Trophy, UsersRound } from "lucide-react";
import type { Participant, ScoreDirection } from "@/domain/types";
import { calculateTeamStandings } from "@/domain/tournament-engine";
import { cn } from "@/lib/cn";
import { ScoreInput } from "./score-input";
import { PlayerMark } from "./ui";

export function TeamScoreboardTable({
  participants,
  scoreDirection,
  onScore,
  readOnly = false,
  completed = false,
}: {
  participants: Participant[];
  scoreDirection: ScoreDirection;
  onScore: (participantId: string, score: number) => void;
  readOnly?: boolean;
  completed?: boolean;
}) {
  const teams = calculateTeamStandings(participants, scoreDirection);

  return (
    <div className="space-y-4">
      {teams.map((team, index) => (
        <section
          key={team.name}
          className={cn(
            "overflow-hidden rounded-2xl border",
            completed && index === 0 ? "border-lime-300/35 bg-lime-300/[.08]" : "border-white/8 bg-white/[.025]",
          )}
        >
          <div className="flex items-center gap-4 border-b border-white/8 px-4 py-4 sm:px-5">
            <span className="grid size-9 place-items-center rounded-xl bg-lime-300/[.09] font-mono text-sm font-semibold text-lime-200">
              {index + 1}
            </span>
            <span className="grid size-9 place-items-center rounded-xl bg-white/[.055] text-lime-300">
              <UsersRound className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="truncate font-medium text-white">{team.name}</h3>
              {completed && index === 0 ? (
                <span className="mt-0.5 flex items-center gap-1 text-[11px] font-medium text-lime-200">
                  <Trophy className="size-3" aria-hidden="true" /> Squadra vincitrice
                </span>
              ) : null}
              <p className="mt-0.5 text-xs text-white/35">
                {team.participants.length} {team.participants.length === 2 ? "persone · coppia" : "persone"}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-[.12em] text-white/30">Totale</p>
              <p className="font-mono text-2xl font-semibold text-lime-200">{team.total}</p>
            </div>
          </div>
          <div className="divide-y divide-white/[.055]">
            {team.participants.map((participant) => (
              <div key={participant.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                <PlayerMark name={participant.name} accent={participant.accent} size="sm" />
                <span className="min-w-0 flex-1 truncate text-sm text-white/75">
                  {participant.name}
                </span>
                <ScoreInput
                  score={participant.score ?? 0}
                  participantName={participant.name}
                  readOnly={readOnly}
                  onCommit={(score) => onScore(participant.id, score)}
                />
              </div>
            ))}
          </div>
        </section>
      ))}
      <p className="px-1 text-xs leading-5 text-white/35">
        Il totale di ogni squadra o coppia è la somma dei punteggi individuali. Vince il totale {scoreDirection === "higher" ? "più alto" : "più basso"}.
      </p>
    </div>
  );
}
