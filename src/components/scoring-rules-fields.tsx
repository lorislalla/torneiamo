import type {
  ScoringRules,
  TieBreaker,
  TournamentFormat,
} from "@/domain/types";
import { FieldLabel } from "./ui";

export const TIE_BREAKER_LABELS: Record<TieBreaker, string> = {
  headToHead: "Scontri diretti",
  scoreDifference: "Differenza punti",
  scoreFor: "Punti fatti",
  wins: "Numero di vittorie",
  participantOrder: "Ordine di inserimento",
};

const TIE_BREAKERS = Object.keys(TIE_BREAKER_LABELS) as TieBreaker[];

export function ScoringRulesFields({
  format,
  rules,
  onChange,
}: {
  format: TournamentFormat;
  rules: ScoringRules;
  onChange: (rules: ScoringRules) => void;
}) {
  const usesStandings = format === "league" || format === "duel" || format === "hybrid";

  function updateTieBreaker(index: number, tieBreaker: TieBreaker) {
    const tieBreakers = [...rules.tieBreakers];
    tieBreakers[index] = tieBreaker;
    onChange({ ...rules, tieBreakers });
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <label className={usesStandings ? "sm:col-span-2" : undefined}>
        <FieldLabel>Vince il punteggio</FieldLabel>
        <select
          className="h-11 w-full rounded-xl border border-white/10 bg-[#14231c] px-3 text-sm text-white outline-none focus:border-lime-300/50"
          value={rules.scoreDirection}
          onChange={(event) => onChange({
            ...rules,
            scoreDirection: event.target.value as ScoringRules["scoreDirection"],
          })}
        >
          <option value="higher">Più alto</option>
          <option value="lower">Più basso</option>
        </select>
      </label>

      {usesStandings ? (
        <>
          <div className="grid grid-cols-3 gap-2 sm:col-span-2">
            {([
              ["Vittoria", "winPoints"],
              ["Pareggio", "drawPoints"],
              ["Sconfitta", "lossPoints"],
            ] as const).map(([label, key]) => (
              <label key={key}>
                <FieldLabel>{label}</FieldLabel>
                <input
                  type="number"
                  step="0.5"
                  className="h-11 w-full rounded-xl border border-white/10 bg-white/[.055] px-3 text-center font-mono text-sm text-white outline-none focus:border-lime-300/50"
                  value={rules[key]}
                  onChange={(event) => onChange({
                    ...rules,
                    [key]: Number(event.target.value),
                  })}
                  aria-label={`Punti per ${label.toLocaleLowerCase("it")}`}
                />
              </label>
            ))}
          </div>

          <div className="sm:col-span-2">
            <FieldLabel>Criteri di spareggio, in ordine</FieldLabel>
            <div className="grid gap-2 sm:grid-cols-3">
              {[0, 1, 2].map((index) => (
                <label key={index}>
                  <span className="sr-only">Criterio {index + 1}</span>
                  <select
                    className="h-11 w-full rounded-xl border border-white/10 bg-[#14231c] px-3 text-xs text-white outline-none focus:border-lime-300/50"
                    value={rules.tieBreakers[index]}
                    onChange={(event) => updateTieBreaker(index, event.target.value as TieBreaker)}
                  >
                    {TIE_BREAKERS.map((tieBreaker) => (
                      <option
                        key={tieBreaker}
                        value={tieBreaker}
                        disabled={rules.tieBreakers.some(
                          (selected, selectedIndex) => selectedIndex !== index && selected === tieBreaker,
                        )}
                      >
                        {index + 1}. {TIE_BREAKER_LABELS[tieBreaker]}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
