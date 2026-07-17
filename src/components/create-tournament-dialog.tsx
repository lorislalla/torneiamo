"use client";

import { useMemo, useState } from "react";
import { GitBranch, ListOrdered, Sparkles, Trophy } from "lucide-react";
import type { Tournament, TournamentFormat } from "@/domain/types";
import { createTournament } from "@/domain/tournament-engine";
import { cn } from "@/lib/cn";
import { Button, FieldLabel, Modal } from "./ui";

const FORMATS: Array<{
  id: TournamentFormat;
  label: string;
  description: string;
  icon: typeof Trophy;
}> = [
  {
    id: "league",
    label: "Campionato",
    description: "Tutti contro tutti, sola andata o andata e ritorno.",
    icon: ListOrdered,
  },
  {
    id: "knockout",
    label: "Eliminazione",
    description: "Tabellone diretto con sorteggio e bye automatici.",
    icon: GitBranch,
  },
  {
    id: "hybrid",
    label: "Gironi + playoff",
    description: "Fase a gironi e tabellone finale per i qualificati.",
    icon: Trophy,
  },
];

export function CreateTournamentDialog({
  open,
  onClose,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (tournament: Tournament) => void;
}) {
  const [name, setName] = useState("");
  const [format, setFormat] = useState<TournamentFormat>("league");
  const [names, setNames] = useState("");
  const [leagueLegs, setLeagueLegs] = useState<1 | 2>(1);
  const [knockoutLegs, setKnockoutLegs] = useState<1 | 2>(1);
  const [groupCount, setGroupCount] = useState(2);
  const [qualifiers, setQualifiers] = useState(2);
  const [shuffle, setShuffle] = useState(true);
  const [error, setError] = useState("");

  const participants = useMemo(
    () =>
      names
        .split(/[\n,]/)
        .map((value) => value.trim())
        .filter(Boolean),
    [names],
  );

  function resetAndClose() {
    setError("");
    onClose();
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const uniqueParticipants = new Set(
      participants.map((participant) => participant.toLocaleLowerCase("it")),
    );
    if (name.trim().length < 3) {
      setError("Dai al torneo un nome di almeno 3 caratteri.");
      return;
    }
    if (participants.length < 2 || participants.length > 16) {
      setError("Inserisci da 2 a 16 partecipanti.");
      return;
    }
    if (uniqueParticipants.size !== participants.length) {
      setError("Ogni partecipante deve avere un nome diverso.");
      return;
    }
    if (format === "hybrid" && participants.length < groupCount * 2) {
      setError(`Servono almeno ${groupCount * 2} partecipanti per ${groupCount} gironi.`);
      return;
    }

    onCreate(
      createTournament({
        name,
        format,
        participantNames: participants,
        settings: {
          leagueLegs,
          knockoutLegs,
          groupCount,
          qualifiersPerGroup: qualifiers,
          shuffleParticipants: shuffle,
        },
      }),
    );
    setName("");
    setNames("");
    setError("");
  }

  return (
    <Modal
      open={open}
      onClose={resetAndClose}
      title="Crea un nuovo torneo"
      description="Configura il formato, aggiungi i giocatori e pensa solo ai risultati."
    >
      <form className="space-y-7 p-5 sm:p-7" onSubmit={submit}>
        <label className="block">
          <FieldLabel>Nome del torneo</FieldLabel>
          <input
            className="h-12 w-full rounded-xl border border-white/10 bg-white/[.055] px-4 text-white outline-none transition placeholder:text-white/25 focus:border-lime-300/50 focus:ring-2 focus:ring-lime-300/10"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Es. Friday Night Cup"
            autoFocus
          />
        </label>

        <fieldset>
          <FieldLabel>Formato</FieldLabel>
          <div className="grid gap-2 sm:grid-cols-3">
            {FORMATS.map((item) => {
              const Icon = item.icon;
              const selected = item.id === format;
              return (
                <button
                  type="button"
                  key={item.id}
                  className={cn(
                    "rounded-2xl border p-4 text-left transition",
                    selected
                      ? "border-lime-300/55 bg-lime-300/[.08]"
                      : "border-white/8 bg-white/[.025] hover:border-white/15 hover:bg-white/[.05]",
                  )}
                  onClick={() => setFormat(item.id)}
                  aria-pressed={selected}
                >
                  <Icon className={cn("mb-5 size-5", selected ? "text-lime-300" : "text-white/45")} />
                  <span className="block text-sm font-semibold text-white">{item.label}</span>
                  <span className="mt-1 block text-xs leading-5 text-white/45">
                    {item.description}
                  </span>
                </button>
              );
            })}
          </div>
        </fieldset>

        <label className="block">
          <div className="mb-2 flex items-end justify-between gap-4">
            <FieldLabel>Partecipanti</FieldLabel>
            <span className={cn("mb-2 font-mono text-xs", participants.length > 16 ? "text-red-300" : "text-white/35")}>
              {participants.length}/16
            </span>
          </div>
          <textarea
            className="min-h-32 w-full resize-y rounded-xl border border-white/10 bg-white/[.055] px-4 py-3 text-white outline-none transition placeholder:text-white/25 focus:border-lime-300/50 focus:ring-2 focus:ring-lime-300/10"
            value={names}
            onChange={(event) => setNames(event.target.value)}
            placeholder={"Un nome per riga\nLoris\nSimo\nDaniele\nMauri"}
          />
          <span className="mt-2 block text-xs text-white/35">Un nome per riga oppure separati da virgola.</span>
        </label>

        <div className="grid gap-4 rounded-2xl border border-white/8 bg-black/15 p-4 sm:grid-cols-2">
          {(format === "league" || format === "hybrid") && (
            <label>
              <FieldLabel>{format === "hybrid" ? "Partite nei gironi" : "Calendario"}</FieldLabel>
              <select
                className="h-11 w-full rounded-xl border border-white/10 bg-[#14231c] px-3 text-sm text-white outline-none focus:border-lime-300/50"
                value={leagueLegs}
                onChange={(event) => setLeagueLegs(Number(event.target.value) as 1 | 2)}
              >
                <option value={1}>Sola andata</option>
                <option value={2}>Andata e ritorno</option>
              </select>
            </label>
          )}
          {(format === "knockout" || format === "hybrid") && (
            <label>
              <FieldLabel>{format === "hybrid" ? "Partite playoff" : "Turni"}</FieldLabel>
              <select
                className="h-11 w-full rounded-xl border border-white/10 bg-[#14231c] px-3 text-sm text-white outline-none focus:border-lime-300/50"
                value={knockoutLegs}
                onChange={(event) => setKnockoutLegs(Number(event.target.value) as 1 | 2)}
              >
                <option value={1}>Gara singola</option>
                <option value={2}>Andata e ritorno</option>
              </select>
            </label>
          )}
          {format === "hybrid" && (
            <>
              <label>
                <FieldLabel>Numero di gironi</FieldLabel>
                <select
                  className="h-11 w-full rounded-xl border border-white/10 bg-[#14231c] px-3 text-sm text-white outline-none focus:border-lime-300/50"
                  value={groupCount}
                  onChange={(event) => setGroupCount(Number(event.target.value))}
                >
                  <option value={2}>2 gironi</option>
                  <option value={3}>3 gironi</option>
                  <option value={4}>4 gironi</option>
                </select>
              </label>
              <label>
                <FieldLabel>Qualificati per girone</FieldLabel>
                <select
                  className="h-11 w-full rounded-xl border border-white/10 bg-[#14231c] px-3 text-sm text-white outline-none focus:border-lime-300/50"
                  value={qualifiers}
                  onChange={(event) => setQualifiers(Number(event.target.value))}
                >
                  <option value={1}>1 partecipante</option>
                  <option value={2}>2 partecipanti</option>
                </select>
              </label>
            </>
          )}
        </div>

        <label className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl border border-white/8 bg-white/[.025] p-4">
          <span>
            <span className="flex items-center gap-2 text-sm font-medium text-white">
              <Sparkles className="size-4 text-lime-300" /> Sorteggio automatico
            </span>
            <span className="mt-1 block text-xs leading-5 text-white/40">
              Mescola l’ordine dei partecipanti prima di generare calendario o tabellone.
            </span>
          </span>
          <input
            type="checkbox"
            className="size-5 accent-lime-300"
            checked={shuffle}
            onChange={(event) => setShuffle(event.target.checked)}
          />
        </label>

        {error ? (
          <p className="rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-200" role="alert">
            {error}
          </p>
        ) : null}

        <div className="flex flex-col-reverse gap-3 border-t border-white/8 pt-5 sm:flex-row sm:justify-end">
          <Button type="button" variant="ghost" onClick={resetAndClose}>Annulla</Button>
          <Button type="submit"><Trophy className="size-4" /> Genera torneo</Button>
        </div>
      </form>
    </Modal>
  );
}

