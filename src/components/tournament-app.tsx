"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  CalendarRange,
  Cloud,
  GitBranch,
  LayoutDashboard,
  Menu,
  Plus,
  Smartphone,
  Sparkles,
  Trophy,
  X,
} from "lucide-react";
import type { Tournament } from "@/domain/types";
import { getTournamentRepository } from "@/data/local-storage-tournament-repository";
import { cn } from "@/lib/cn";
import { CreateTournamentDialog } from "./create-tournament-dialog";
import { PwaManager } from "./pwa-manager";
import { TournamentView } from "./tournament-view";
import { Button } from "./ui";

export function TournamentApp() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const repository = useMemo(() => getTournamentRepository(), []);

  useEffect(() => {
    repository.list().then((items) => {
      const sorted = [...items].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      setTournaments(sorted);
      setActiveId(sorted[0]?.id ?? null);
      setReady(true);
    });
  }, [repository]);

  const activeTournament = tournaments.find((tournament) => tournament.id === activeId);

  async function create(tournament: Tournament) {
    await repository.save(tournament);
    setTournaments((current) => [tournament, ...current]);
    setActiveId(tournament.id);
    setCreateOpen(false);
  }

  async function update(tournament: Tournament) {
    setTournaments((current) =>
      current.map((item) => (item.id === tournament.id ? tournament : item)),
    );
    await repository.save(tournament);
  }

  async function remove(tournament: Tournament) {
    if (!window.confirm(`Eliminare definitivamente “${tournament.name}”?`)) return;
    await repository.remove(tournament.id);
    const next = tournaments.filter((item) => item.id !== tournament.id);
    setTournaments(next);
    setActiveId(next[0]?.id ?? null);
  }

  if (!ready) return <LoadingScreen />;

  return (
    <div className="min-h-dvh bg-[#07110d] text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_78%_-10%,rgba(185,255,102,.08),transparent_36%),radial-gradient(circle_at_15%_90%,rgba(82,212,169,.055),transparent_30%)]" />

      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-white/[.065] bg-[#07110d]/90 px-4 backdrop-blur-xl lg:hidden">
        <Brand />
        <Button variant="ghost" size="icon" onClick={() => setMobileMenuOpen((value) => !value)} aria-label="Apri menu">
          {mobileMenuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
        </Button>
      </header>

      <div className="relative lg:grid lg:min-h-dvh lg:grid-cols-[280px_1fr]">
        <aside className={cn(
          "border-r border-white/[.065] bg-[#09140f]/98 p-4 lg:sticky lg:top-0 lg:block lg:h-dvh",
          mobileMenuOpen ? "fixed inset-x-0 top-16 z-20 block max-h-[calc(100dvh-4rem)] overflow-y-auto border-b" : "hidden",
        )}>
          <div className="hidden h-14 items-center px-2 lg:flex"><Brand /></div>
          <Button className="mt-2 w-full" onClick={() => { setCreateOpen(true); setMobileMenuOpen(false); }}>
            <Plus className="size-4" /> Nuovo torneo
          </Button>

          <div className="mt-7">
            <p className="px-2 text-[10px] font-semibold uppercase tracking-[.17em] text-white/25">I tuoi tornei</p>
            <nav className="mt-2 space-y-1" aria-label="Tornei salvati">
              {tournaments.length === 0 ? (
                <p className="px-2 py-4 text-xs leading-5 text-white/30">I tornei salvati su questo dispositivo compariranno qui.</p>
              ) : tournaments.map((tournament) => (
                <button
                  key={tournament.id}
                  type="button"
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition",
                    activeId === tournament.id ? "bg-white/[.08] text-white" : "text-white/48 hover:bg-white/[.04] hover:text-white/75",
                  )}
                  onClick={() => { setActiveId(tournament.id); setMobileMenuOpen(false); }}
                >
                  <span className={cn("grid size-8 shrink-0 place-items-center rounded-lg", activeId === tournament.id ? "bg-lime-300 text-emerald-950" : "bg-white/[.055]")}>
                    {tournament.format === "league" ? <CalendarRange className="size-4" /> : tournament.format === "knockout" ? <GitBranch className="size-4" /> : <Trophy className="size-4" />}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{tournament.name}</span>
                    <span className="mt-0.5 block text-[10px] uppercase tracking-[.1em] text-white/25">{tournament.status === "completed" ? "Completato" : "In corso"}</span>
                  </span>
                </button>
              ))}
            </nav>
          </div>

          <div className="mt-8 rounded-2xl border border-white/[.065] bg-white/[.025] p-4 lg:absolute lg:inset-x-4 lg:bottom-4">
            <div className="flex items-center gap-2 text-xs font-medium text-white/60"><Cloud className="size-4 text-lime-300" /> Solo su questo dispositivo</div>
            <p className="mt-2 text-[11px] leading-5 text-white/30">La struttura dati è pronta per la futura sincronizzazione Supabase.</p>
          </div>
        </aside>

        <main className="min-w-0">
          {activeTournament ? (
            <TournamentView key={activeTournament.id} tournament={activeTournament} onUpdate={update} onDelete={() => remove(activeTournament)} />
          ) : (
            <EmptyDashboard onCreate={() => setCreateOpen(true)} />
          )}
        </main>
      </div>

      <CreateTournamentDialog open={createOpen} onClose={() => setCreateOpen(false)} onCreate={create} />
      <PwaManager />
    </div>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-2.5">
      <span className="relative grid size-9 place-items-center overflow-hidden rounded-xl bg-lime-300 text-emerald-950 shadow-[0_8px_26px_rgba(185,255,102,.15)]">
        <Trophy className="size-4" />
        <span className="absolute -bottom-2 -right-2 size-4 rounded-full border-2 border-emerald-950/15" />
      </span>
      <span className="text-lg font-semibold tracking-[-.035em]">torneiamo<span className="text-lime-300">.</span></span>
    </div>
  );
}

function EmptyDashboard({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="mx-auto flex min-h-[calc(100dvh-4rem)] max-w-6xl flex-col justify-center px-5 py-14 sm:px-10 lg:min-h-dvh">
      <div className="max-w-3xl">
        <span className="inline-flex items-center gap-2 rounded-full border border-lime-300/15 bg-lime-300/[.06] px-3 py-1.5 text-xs text-lime-200">
          <Sparkles className="size-3.5" /> Il foglio di calcolo, finalmente bello
        </span>
        <h1 className="mt-6 text-5xl font-medium leading-[.96] tracking-[-.055em] text-white sm:text-7xl">
          Il torneo si gioca.<br /><span className="text-white/35">Al resto pensiamo noi.</span>
        </h1>
        <p className="mt-6 max-w-xl text-base leading-7 text-white/45 sm:text-lg">
          Crea calendari, inserisci risultati e segui classifiche e tabelloni che si aggiornano da soli. Fino a 16 partecipanti, su ogni schermo.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Button onClick={onCreate}><Plus className="size-4" /> Crea il primo torneo</Button>
          <span className="inline-flex items-center justify-center gap-2 px-3 text-xs text-white/30"><Smartphone className="size-4" /> Installabile sul telefono</span>
        </div>
      </div>

      <div className="mt-14 grid gap-3 sm:grid-cols-3">
        {[
          { icon: CalendarRange, title: "Campionato", copy: "Sola andata o A/R, classifica e scontri diretti automatici." },
          { icon: GitBranch, title: "Eliminazione", copy: "Sorteggio, bye e tabellone che avanza con ogni risultato." },
          { icon: Trophy, title: "Gironi + playoff", copy: "Qualificazioni configurabili e incroci finali senza formule." },
        ].map((item) => (
          <button key={item.title} type="button" onClick={onCreate} className="group rounded-2xl border border-white/8 bg-white/[.025] p-5 text-left transition hover:-translate-y-1 hover:border-lime-300/20 hover:bg-white/[.045]">
            <div className="flex items-center justify-between"><item.icon className="size-5 text-lime-300/75" /><ArrowRight className="size-4 text-white/20 transition group-hover:translate-x-1 group-hover:text-white/55" /></div>
            <h2 className="mt-8 font-medium text-white">{item.title}</h2>
            <p className="mt-2 text-xs leading-5 text-white/38">{item.copy}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

function LoadingScreen() {
  return (
    <div className="grid min-h-dvh place-items-center bg-[#07110d] text-white">
      <div className="text-center">
        <span className="mx-auto grid size-12 animate-pulse place-items-center rounded-2xl bg-lime-300 text-emerald-950"><LayoutDashboard className="size-5" /></span>
        <p className="mt-4 text-sm text-white/40">Prepariamo il campo…</p>
      </div>
    </div>
  );
}
