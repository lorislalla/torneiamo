import { Minus, TrendingDown, TrendingUp } from "lucide-react";
import type { Match, Participant } from "@/domain/types";
import { calculateStandings } from "@/domain/tournament-engine";
import { PlayerMark } from "./ui";

export function StandingsTable({
  participants,
  matches,
  qualifiedCount = 0,
}: {
  participants: Participant[];
  matches: Match[];
  qualifiedCount?: number;
}) {
  const participantById = new Map(
    participants.map((participant) => [participant.id, participant]),
  );
  const rows = calculateStandings(
    participants.map((participant) => participant.id),
    matches,
  );

  return (
    <div className="overflow-hidden rounded-2xl border border-white/8 bg-white/[.025]">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[590px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-white/8 text-left text-[11px] uppercase tracking-[0.12em] text-white/35">
              <th className="w-12 px-4 py-3 text-center">#</th>
              <th className="px-2 py-3 font-medium">Partecipante</th>
              <th className="px-2 py-3 text-center font-medium">G</th>
              <th className="px-2 py-3 text-center font-medium">V</th>
              <th className="px-2 py-3 text-center font-medium">N</th>
              <th className="px-2 py-3 text-center font-medium">P</th>
              <th className="px-2 py-3 text-center font-medium">GF</th>
              <th className="px-2 py-3 text-center font-medium">GS</th>
              <th className="px-2 py-3 text-center font-medium">DR</th>
              <th className="px-4 py-3 text-center font-medium">Pt</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
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
                      <span className="font-medium text-white">{participant.name}</span>
                    </div>
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
                  <td className="px-4 py-3 text-center font-mono font-semibold text-lime-200">
                    {row.points}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="border-t border-white/8 px-4 py-3 text-xs text-white/35">
        3 punti per vittoria · 1 per pareggio · spareggio: scontri diretti, differenza reti, gol fatti
      </div>
    </div>
  );
}

function Cell({ children }: { children: React.ReactNode }) {
  return <td className="px-2 py-3 text-center font-mono text-xs text-white/55">{children}</td>;
}

