"use client";

import { useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ChevronsUpDown,
  Minus,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { participantLabel } from "@/domain/participant-label";
import type { Match, Participant, StandingRow } from "@/domain/types";
import { calculateStandings } from "@/domain/tournament-engine";
import { cn } from "@/lib/cn";
import { PlayerMark } from "./ui";

type SortKey =
  | "position"
  | "participant"
  | "points"
  | "played"
  | "won"
  | "drawn"
  | "lost"
  | "goalsFor"
  | "goalsAgainst"
  | "goalDifference";

type SortDirection = "asc" | "desc";

export function StandingsTable({
  participants,
  matches,
  qualifiedCount = 0,
}: {
  participants: Participant[];
  matches: Match[];
  qualifiedCount?: number;
}) {
  const [sort, setSort] = useState<{ key: SortKey; direction: SortDirection }>({
    key: "points",
    direction: "desc",
  });
  const participantById = new Map(
    participants.map((participant) => [participant.id, participant]),
  );
  const rows = calculateStandings(
    participants.map((participant) => participant.id),
    matches,
  );
  const sortedRows = [...rows].sort((first, second) => {
    const comparison = compareRows(first, second, sort.key, participantById);
    if (comparison === 0) return first.position - second.position;
    return sort.direction === "asc" ? comparison : -comparison;
  });

  function changeSort(key: SortKey) {
    setSort((current) => {
      if (current.key === key) {
        return {
          key,
          direction: current.direction === "asc" ? "desc" : "asc",
        };
      }
      return {
        key,
        direction: key === "participant" || key === "position" ? "asc" : "desc",
      };
    });
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-white/8 bg-white/[.025]">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[590px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-white/8 text-left text-[11px] uppercase tracking-[0.12em] text-white/35">
              <SortableHeader label="#" sortKey="position" sort={sort} onSort={changeSort} className="w-14 px-3" />
              <SortableHeader label="Persona / squadra" sortKey="participant" sort={sort} onSort={changeSort} align="left" className="px-2" />
              <SortableHeader label="Pt" sortKey="points" sort={sort} onSort={changeSort} className="px-3" />
              <SortableHeader label="G" sortKey="played" sort={sort} onSort={changeSort} />
              <SortableHeader label="V" sortKey="won" sort={sort} onSort={changeSort} />
              <SortableHeader label="N" sortKey="drawn" sort={sort} onSort={changeSort} />
              <SortableHeader label="P" sortKey="lost" sort={sort} onSort={changeSort} />
              <SortableHeader label="GF" sortKey="goalsFor" sort={sort} onSort={changeSort} />
              <SortableHeader label="GS" sortKey="goalsAgainst" sort={sort} onSort={changeSort} />
              <SortableHeader label="DR" sortKey="goalDifference" sort={sort} onSort={changeSort} className="px-3" />
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((row) => {
              const participant = participantById.get(row.participantId);
              if (!participant) return null;
              return (
                <tr key={row.participantId} className="border-b border-white/[.055] last:border-0">
                  <td className="px-4 py-3 text-center">
                    <span className="inline-flex items-center gap-1 font-mono text-xs text-white/50">
                      {row.position <= qualifiedCount ? (
                        <span className="size-1.5 rounded-full bg-lime-300" aria-label="Qualificato" />
                      ) : null}
                      {row.position}
                    </span>
                  </td>
                  <td className="px-2 py-3">
                    <div className="flex items-center gap-3">
                      <PlayerMark name={participant.name} accent={participant.accent} size="sm" />
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-white">
                          {participant.name}
                        </span>
                        {participant.teamName ? (
                          <span className="block truncate text-[11px] text-white/35">
                            {participant.teamName}
                          </span>
                        ) : null}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-center font-mono font-semibold text-lime-200">
                    {row.points}
                  </td>
                  <Cell>{row.played}</Cell>
                  <Cell>{row.won}</Cell>
                  <Cell>{row.drawn}</Cell>
                  <Cell>{row.lost}</Cell>
                  <Cell>{row.goalsFor}</Cell>
                  <Cell>{row.goalsAgainst}</Cell>
                  <td className="px-2 py-3 text-center font-mono text-xs text-white/60">
                    <span className="inline-flex items-center gap-1">
                      {row.goalDifference > 0 ? <TrendingUp className="size-3 text-lime-300" /> : null}
                      {row.goalDifference < 0 ? <TrendingDown className="size-3 text-red-300" /> : null}
                      {row.goalDifference === 0 ? <Minus className="size-3 text-white/25" /> : null}
                      {row.goalDifference > 0 ? "+" : ""}{row.goalDifference}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="border-t border-white/8 px-4 py-3 text-xs text-white/35">
        Tocca una colonna per ordinarla · 3 punti per vittoria · 1 per pareggio · spareggio ufficiale: scontri diretti, differenza reti, gol fatti
      </div>
    </div>
  );
}

function compareRows(
  first: StandingRow,
  second: StandingRow,
  key: SortKey,
  participantById: Map<string, Participant>,
) {
  if (key === "participant") {
    const firstParticipant = participantById.get(first.participantId);
    const secondParticipant = participantById.get(second.participantId);
    const firstLabel = firstParticipant ? participantLabel(firstParticipant) : "";
    const secondLabel = secondParticipant ? participantLabel(secondParticipant) : "";
    return firstLabel.localeCompare(secondLabel, "it", { sensitivity: "base" });
  }
  return first[key] - second[key];
}

function SortableHeader({
  label,
  sortKey,
  sort,
  onSort,
  align = "center",
  className,
}: {
  label: string;
  sortKey: SortKey;
  sort: { key: SortKey; direction: SortDirection };
  onSort: (key: SortKey) => void;
  align?: "left" | "center";
  className?: string;
}) {
  const active = sort.key === sortKey;
  const SortIcon = active
    ? sort.direction === "asc"
      ? ArrowUp
      : ArrowDown
    : ChevronsUpDown;

  return (
    <th
      className={cn("py-1 font-medium", className ?? "px-2")}
      scope="col"
      aria-sort={active ? (sort.direction === "asc" ? "ascending" : "descending") : undefined}
    >
      <button
        type="button"
        className={cn(
          "flex min-h-10 w-full items-center gap-1 rounded-lg transition hover:bg-white/[.045] hover:text-white/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-300/40",
          align === "left" ? "justify-start" : "justify-center",
          active && "text-lime-200",
        )}
        onClick={() => onSort(sortKey)}
        title={`Ordina per ${label}`}
      >
        <span>{label}</span>
        <SortIcon className={cn("size-3", active ? "opacity-90" : "opacity-35")} aria-hidden="true" />
      </button>
    </th>
  );
}

function Cell({ children }: { children: React.ReactNode }) {
  return <td className="px-2 py-3 text-center font-mono text-xs text-white/55">{children}</td>;
}
