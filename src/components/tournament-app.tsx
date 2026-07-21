"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import {
  ArrowRight,
  CalendarRange,
  ChartNoAxesColumnIncreasing,
  Cloud,
  CloudOff,
  GitBranch,
  LayoutDashboard,
  LogIn,
  LogOut,
  Menu,
  Plus,
  RefreshCw,
  Smartphone,
  Swords,
  Trophy,
  Users,
  UsersRound,
  X,
} from "lucide-react";
import type { Tournament } from "@/domain/types";
import { getLocalTournamentRepository } from "@/data/local-storage-tournament-repository";
import {
  SupabaseTournamentRepository,
  SyncConflictError,
} from "@/data/supabase-tournament-repository";
import type { TournamentRepository, TournamentRole } from "@/data/tournament-repository";
import { hashInviteCode } from "@/lib/invite-code";
import { cn } from "@/lib/cn";
import { createClient } from "@/lib/supabase/client";
import { AuthDialog } from "./auth-dialog";
import { CollaborationDialog } from "./collaboration-dialog";
import { CreateTournamentDialog } from "./create-tournament-dialog";
import { PwaManager, usePwaInstallation } from "./pwa-manager";
import { TournamentView } from "./tournament-view";
import { Button } from "./ui";

const ROLE_LABELS: Record<TournamentRole, string> = {
  owner: "Proprietario",
  editor: "Editor",
  viewer: "Sola lettura",
};

export function TournamentApp() {
  const supabase = useMemo(() => createClient(), []);
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [collaborationOpen, setCollaborationOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const { installable, install } = usePwaInstallation();
  const claimedInvite = useRef("");

  const repository = useMemo<TournamentRepository>(() => {
    if (!user) return getLocalTournamentRepository();
    return new SupabaseTournamentRepository(supabase, user.id);
  }, [supabase, user]);

  const loadRepository = useCallback(async () => {
    setSyncing(Boolean(user));
    try {
      const items = await repository.list();
      const sorted = [...items].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      setTournaments(sorted);
      setActiveId((current) => current && sorted.some((item) => item.id === current)
        ? current
        : sorted[0]?.id ?? null);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Sincronizzazione non riuscita.");
    } finally {
      setReady(true);
      setSyncing(false);
    }
  }, [repository, user]);

  useEffect(() => {
    let active = true;
    void supabase.auth.getUser().then(({ data }) => {
      if (!active) return;
      setUser(data.user ?? null);
      setAuthReady(true);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setAuthReady(true);
    });
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    if (!authReady) return;
    setReady(false);
    void loadRepository();
    const unsubscribe = repository.subscribe?.((change) => {
      if (change.type === "remove") {
        setTournaments((current) => current.filter((item) => item.id !== change.tournamentId));
        setActiveId((current) => current === change.tournamentId ? null : current);
        return;
      }
      setTournaments((current) => {
        const exists = current.some((item) => item.id === change.tournament.id);
        const next = exists
          ? current.map((item) => item.id === change.tournament.id ? change.tournament : item)
          : [change.tournament, ...current];
        return next.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      });
    });
    return unsubscribe;
  }, [authReady, loadRepository, repository]);

  useEffect(() => {
    if (!authReady) return;
    const params = new URLSearchParams(window.location.search);
    const code = params.get("invite") ?? window.localStorage.getItem("torneiamo:pending-invite");
    if (code) {
      setInviteCode(code);
      window.localStorage.setItem("torneiamo:pending-invite", code);
      if (!user) setAuthOpen(true);
    }
    if (params.get("authError")) {
      setNotice("Il link di accesso non è valido o è scaduto. Richiedine uno nuovo.");
      params.delete("authError");
      window.history.replaceState({}, "", `${window.location.pathname}${params.size ? `?${params}` : ""}`);
    }
  }, [authReady, user]);

  useEffect(() => {
    if (!user || !inviteCode) return;
    const claimKey = `${user.id}:${inviteCode}`;
    if (claimedInvite.current === claimKey) return;
    claimedInvite.current = claimKey;

    void (async () => {
      setSyncing(true);
      const tokenHash = await hashInviteCode(inviteCode);
      const { error } = await supabase.from("invite_claims").insert({
        user_id: user.id,
        token_hash: tokenHash,
      });

      window.localStorage.removeItem("torneiamo:pending-invite");
      const url = new URL(window.location.href);
      url.searchParams.delete("invite");
      window.history.replaceState({}, "", `${url.pathname}${url.search}`);
      setInviteCode(null);
      setAuthOpen(false);

      if (error) {
        setNotice("Questo invito non è valido, è scaduto oppure è già stato usato.");
      } else {
        setNotice("Invito accettato: il torneo è ora disponibile e sincronizzato.");
        await loadRepository();
      }
      setSyncing(false);
    })();
  }, [inviteCode, loadRepository, supabase, user]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 5000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const activeTournament = tournaments.find((tournament) => tournament.id === activeId);
  const activeRole = activeTournament ? repository.roleFor(activeTournament.id) : "owner";
  const canEdit = !user || activeRole !== "viewer";

  async function create(tournament: Tournament) {
    setTournaments((current) => [tournament, ...current]);
    setActiveId(tournament.id);
    setCreateOpen(false);
    try {
      await repository.save(tournament);
      if (user) setNotice("Torneo creato e sincronizzato.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Torneo salvato solo sul dispositivo.");
    }
  }

  async function update(tournament: Tournament) {
    if (!canEdit) return;
    setTournaments((current) =>
      current.map((item) => item.id === tournament.id ? tournament : item),
    );
    try {
      await repository.save(tournament);
    } catch (error) {
      if (error instanceof SyncConflictError) {
        setTournaments((current) => current.map((item) =>
          item.id === error.latest.id ? error.latest : item,
        ));
        setNotice("Era arrivata una modifica più recente: ho caricato la versione aggiornata.");
      } else {
        setNotice(error instanceof Error ? error.message : "Modifica salvata solo offline.");
      }
    }
  }

  async function remove(tournament: Tournament) {
    if (!window.confirm(`Eliminare definitivamente “${tournament.name}”?`)) return;
    try {
      await repository.remove(tournament.id);
      const next = tournaments.filter((item) => item.id !== tournament.id);
      setTournaments(next);
      setActiveId(next[0]?.id ?? null);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Impossibile eliminare il torneo.");
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    setNotice("Sei uscito. La cache resta disponibile su questo dispositivo.");
    setMobileMenuOpen(false);
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

          <div className="mt-7 lg:max-h-[calc(100dvh-300px)] lg:overflow-y-auto">
            <p className="px-2 text-[10px] font-semibold uppercase tracking-[.17em] text-white/25">I tuoi tornei</p>
            <nav className="mt-2 space-y-1" aria-label="Tornei salvati">
              {tournaments.length === 0 ? (
                <p className="px-2 py-4 text-xs leading-5 text-white/30">I tornei che crei o condividono con te compariranno qui.</p>
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
                    {tournament.format === "league" ? <CalendarRange className="size-4" /> : tournament.format === "duel" ? <Swords className="size-4" /> : tournament.format === "scoreboard" ? <ChartNoAxesColumnIncreasing className="size-4" /> : tournament.format === "team-scoreboard" ? <UsersRound className="size-4" /> : tournament.format === "knockout" ? <GitBranch className="size-4" /> : <Trophy className="size-4" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{tournament.name}</span>
                    <span className="mt-0.5 block text-[10px] uppercase tracking-[.1em] text-white/25">{tournament.status === "completed" ? "Completato" : "In corso"}</span>
                  </span>
                  {user && repository.roleFor(tournament.id) !== "owner" ? <Users className="size-3.5 text-white/25" /> : null}
                </button>
              ))}
            </nav>
          </div>

          <AccountPanel
            user={user}
            syncing={syncing}
            onSignIn={() => { setAuthOpen(true); setMobileMenuOpen(false); }}
            onSignOut={() => void signOut()}
          />
        </aside>

        <main className="min-w-0">
          {activeTournament ? (
            <TournamentView
              key={activeTournament.id}
              tournament={activeTournament}
              onUpdate={update}
              onDelete={() => remove(activeTournament)}
              canEdit={canEdit}
              canDelete={!user || activeRole === "owner"}
              isSynced={Boolean(user)}
              roleLabel={ROLE_LABELS[activeRole]}
              onManageAccess={user ? () => setCollaborationOpen(true) : undefined}
            />
          ) : (
            <EmptyDashboard
              onCreate={() => setCreateOpen(true)}
              onSync={!user ? () => setAuthOpen(true) : undefined}
              installable={installable}
            />
          )}
        </main>
      </div>

      <CreateTournamentDialog open={createOpen} onClose={() => setCreateOpen(false)} onCreate={create} />
      <AuthDialog open={authOpen} onClose={() => setAuthOpen(false)} supabase={supabase} inviteCode={inviteCode} />
      {user && activeTournament ? (
        <CollaborationDialog
          open={collaborationOpen}
          onClose={() => setCollaborationOpen(false)}
          supabase={supabase}
          user={user}
          tournament={activeTournament}
          role={activeRole}
        />
      ) : null}
      {notice ? (
        <div className="fixed bottom-5 left-1/2 z-[70] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 rounded-2xl border border-white/10 bg-[#14231c]/95 px-4 py-3 text-center text-sm text-white/75 shadow-2xl backdrop-blur" role="status">
          {notice}
        </div>
      ) : null}
      <PwaManager installable={installable} onInstall={install} />
    </div>
  );
}

function AccountPanel({ user, syncing, onSignIn, onSignOut }: { user: User | null; syncing: boolean; onSignIn: () => void; onSignOut: () => void }) {
  return (
    <div className="mt-8 rounded-2xl border border-white/[.065] bg-white/[.025] p-4 lg:absolute lg:inset-x-4 lg:bottom-4">
      {user ? (
        <>
          <div className="flex items-center gap-2 text-xs font-medium text-white/65">
            {syncing ? <RefreshCw className="size-4 animate-spin text-lime-300" /> : <Cloud className="size-4 text-lime-300" />}
            {syncing ? "Sincronizzazione…" : "Sincronizzato"}
          </div>
          <p className="mt-2 truncate text-[11px] text-white/35">{user.email}</p>
          <Button className="mt-3 w-full" variant="ghost" size="sm" onClick={onSignOut}><LogOut className="size-4" /> Esci</Button>
        </>
      ) : (
        <>
          <div className="flex items-center gap-2 text-xs font-medium text-white/60"><CloudOff className="size-4 text-white/35" /> Solo su questo dispositivo</div>
          <p className="mt-2 text-[11px] leading-5 text-white/30">Accedi per sincronizzare, collaborare e usare gli stessi tornei ovunque.</p>
          <Button className="mt-3 w-full" variant="secondary" size="sm" onClick={onSignIn}><LogIn className="size-4" /> Attiva sync</Button>
        </>
      )}
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

function EmptyDashboard({
  onCreate,
  onSync,
  installable,
}: {
  onCreate: () => void;
  onSync?: () => void;
  installable: boolean;
}) {
  return (
    <div className="mx-auto flex min-h-[calc(100dvh-4rem)] max-w-6xl flex-col justify-center px-5 py-14 sm:px-10 lg:min-h-dvh">
      <div className="max-w-3xl">
        <h1 className="text-5xl font-medium leading-[.96] tracking-[-.055em] text-white sm:text-7xl">
          I tuoi tornei.
        </h1>
        <p className="mt-6 max-w-xl text-base leading-7 text-white/45 sm:text-lg">
          Crea calendari, inserisci risultati e collabora in tempo reale su classifiche e tabelloni che si aggiornano da soli.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Button onClick={onCreate}><Plus className="size-4" /> Crea il primo torneo</Button>
          {onSync ? <Button variant="secondary" onClick={onSync}><Cloud className="size-4" /> Attiva sincronizzazione</Button> : null}
          {installable ? (
            <span className="inline-flex items-center justify-center gap-2 px-3 text-xs text-white/30">
              <Smartphone className="size-4" /> Installabile sul telefono
            </span>
          ) : null}
        </div>
      </div>

      <div className="mt-14 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {[
          { icon: CalendarRange, title: "Campionato", copy: "Tutti contro tutti, con una o due sfide per coppia." },
          { icon: Swords, title: "Campionato a 2", copy: "Due partecipanti, sfide libere finché vuoi." },
          { icon: GitBranch, title: "Eliminazione", copy: "Sorteggio, bye e tabellone che avanza con ogni risultato." },
          { icon: Trophy, title: "Gironi + playoff", copy: "Qualificazioni configurabili e incroci finali." },
          { icon: ChartNoAxesColumnIncreasing, title: "Classifica libera", copy: "Punteggi personalizzabili per qualsiasi gioco." },
          { icon: UsersRound, title: "Classifica a squadre", copy: "Punteggi individuali e totale condiviso." },
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
        <p className="mt-4 text-sm text-white/40">Prepariamo tutto…</p>
      </div>
    </div>
  );
}
