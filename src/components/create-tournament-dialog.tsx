"use client";

import { useRef, useState } from "react";
import { GitBranch, ListOrdered, Plus, Sparkles, Trash2, Trophy } from "lucide-react";
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

type ParticipantDraft = {
  id: number;
  name: string;
  teamName: string;
};

function initialParticipants(): ParticipantDraft[] {
  return [
    { id: 0, name: "", teamName: "" },
    { id: 1, name: "", teamName: "" },
  ];
}

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
  const [participantRows, setParticipantRows] = useState(initialParticipants);
  const nextParticipantId = useRef(2);
  const [leagueLegs, setLeagueLegs] = useState<1 | 2>(1);
  const [knockoutLegs, setKnockoutLegs] = useState<1 | 2>(1);
  const [groupCount, setGroupCount] = useState(2);
  const [qualifiers, setQualifiers] = useState(2);
  const [shuffle, setShuffle] = useState(true);
  const [error, setError] = useState("");

  const participants = participantRows
    .filter((participant) => participant.name.trim())
    .map((participant) => ({
      name: participant.name.trim(),
      ...(participant.teamName.trim()
        ? { teamName: participant.teamName.trim() }
        : {}),
    }));

  function updateParticipant(
    id: number,
    field: "name" | "teamName",
    value: string,
  ) {
    setParticipantRows((current) =>
      current.map((participant) =>
        participant.id === id ? { ...participant, [field]: value } : participant,
      ),
    );
  }

  function addParticipant() {
    if (participantRows.length >= 16) return;
    const id = nextParticipantId.current;
    nextParticipantId.current += 1;
    setParticipantRows((current) => [
      ...current,
      { id, name: "", teamName: "" },
    ]);
  }

  function removeParticipant(id: number) {
    setParticipantRows((current) =>
      current.length <= 2
        ? current.map((participant) =>
            participant.id === id
              ? { ...participant, name: "", teamName: "" }
              : participant,
          )
        : current.filter((participant) => participant.id !== id),
    );
  }

  function resetAndClose() {
    setError("");
    onClose();
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const uniqueParticipants = new Set(
      participants.map((participant) =>
        `${participant.name}\u0000${participant.teamName ?? ""}`.toLocaleLowerCase("it"),
      ),
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
      setError("Ogni combinazione persona e squadra deve essere diversa.");
      return;
    }
    if (participantRows.some((participant) => !participant.name.trim() && participant.teamName.trim())) {
      setError("Inserisci il nome della persona per ogni squadra indicata.");
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
        participants,
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
    setParticipantRows(initialParticipants());
    nextParticipantId.current = 2;
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

        <fieldset>
          <div className="mb-2 flex items-end justify-between gap-4">
            <FieldLabel>Partecipanti</FieldLabel>
            <span className="mb-2 font-mono text-xs text-white/35">
              {participants.length}/16
            </span>
          </div>
          <div className="overflow-hidden rounded-2xl border border-white/8 bg-black/15">
            <div className="hidden grid-cols-[2rem_1fr_1fr_2.5rem] gap-2 border-b border-white/8 px-3 py-2.5 text-[10px] font-semibold uppercase tracking-[.13em] text-white/30 sm:grid">
              <span>#</span>
              <span>Persona</span>
              <span>Squadra (facoltativa)</span>
              <span />
            </div>
            <div className="divide-y divide-white/[.055]">
              {participantRows.map((participant, index) => (
                <div key={participant.id} className="grid grid-cols-[2rem_1fr_2.5rem] gap-2 p-3 sm:grid-cols-[2rem_1fr_1fr_2.5rem]">
                  <span className="grid h-11 place-items-center font-mono text-xs text-white/25">{index + 1}</span>
                  <label className="min-w-0">
                    <span className="mb-1 block text-[10px] uppercase tracking-[.12em] text-white/30 sm:hidden">Persona</span>
                    <input
                      className="h-11 w-full rounded-xl border border-white/10 bg-white/[.055] px-3 text-sm text-white outline-none transition placeholder:text-white/22 focus:border-lime-300/50 focus:ring-2 focus:ring-lime-300/10"
                      value={participant.name}
                      onChange={(event) => updateParticipant(participant.id, "name", event.target.value)}
                      placeholder="Es. Loris"
                      aria-label={`Nome partecipante ${index + 1}`}
                    />
                  </label>
                  <label className="col-start-2 min-w-0 sm:col-start-auto">
                    <span className="mb-1 block text-[10px] uppercase tracking-[.12em] text-white/30 sm:hidden">Squadra (facoltativa)</span>
                    <input
                      className="h-11 w-full rounded-xl border border-white/10 bg-white/[.055] px-3 text-sm text-white outline-none transition placeholder:text-white/22 focus:border-lime-300/50 focus:ring-2 focus:ring-lime-300/10"
                      value={participant.teamName}
                      onChange={(event) => updateParticipant(participant.id, "teamName", event.target.value)}
                      placeholder="Es. Lazio"
                      aria-label={`Squadra partecipante ${index + 1}, facoltativa`}
                    />
                  </label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="self-end text-white/30 hover:text-red-200"
                    onClick={() => removeParticipant(participant.id)}
                    aria-label={`Rimuovi partecipante ${index + 1}`}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between gap-4">
            <p className="text-xs leading-5 text-white/35">La squadra è utile per videogiochi o sport di squadra; lasciala vuota per calcio balilla e tornei individuali.</p>
            <Button type="button" variant="secondary" size="sm" onClick={addParticipant} disabled={participantRows.length >= 16}>
              <Plus className="size-4" /> Aggiungi
            </Button>
          </div>
        </fieldset>

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
