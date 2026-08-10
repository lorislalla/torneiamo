export function ScoreInput({
  score,
  participantName,
  readOnly,
  onCommit,
  compact = false,
}: {
  score: number;
  participantName: string;
  readOnly: boolean;
  onCommit: (score: number) => void;
  compact?: boolean;
}) {
  return (
    <input
      key={score}
      type="text"
      inputMode="numeric"
      enterKeyHint="done"
      disabled={readOnly}
      className={`h-11 rounded-xl border border-white/10 bg-black/25 px-2 text-center font-mono text-base font-semibold text-white outline-none transition focus:border-lime-300/55 focus:ring-2 focus:ring-lime-300/10 ${compact ? "w-16 sm:w-20" : "w-20 sm:w-24"}`}
      defaultValue={score}
      onFocus={(event) => event.currentTarget.select()}
      onClick={(event) => event.currentTarget.select()}
      onBlur={(event) => {
        const parsed = Number.parseInt(event.currentTarget.value, 10);
        if (Number.isNaN(parsed)) {
          event.currentTarget.value = String(score);
          return;
        }
        event.currentTarget.value = String(parsed);
        if (parsed !== score) onCommit(parsed);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
        if (event.key === "Escape") {
          event.currentTarget.value = String(score);
          event.currentTarget.blur();
        }
      }}
      aria-label={`Punteggio di ${participantName}`}
    />
  );
}
