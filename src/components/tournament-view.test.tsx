// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createTournament, DEFAULT_SCORING_RULES, setTournamentStatus, updateMatchScore, updateParticipantScore } from "@/domain/tournament-engine";
import { TournamentView } from "./tournament-view";

describe("TournamentView", () => {
  afterEach(cleanup);
  it.each(["league", "duel"] as const)("evidenzia il campione di %s anche quando la tabella viene riordinata", (format) => {
    const created = createTournament({ name: "Campionato", format, participants: [{ name: "Ada" }, { name: "Bea" }], settings: { shuffleParticipants: false } });
    const props = { onUpdate: vi.fn(), onDelete: vi.fn() };
    const { rerender } = render(<TournamentView tournament={created} {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Classifica" }));
    expect(screen.queryByText("Vincitore")).toBeNull();

    const match = created.matches[0];
    const completed = setTournamentStatus(updateMatchScore(created, match.id, { homeScore: 12, awayScore: 3 }), "completed");
    rerender(<TournamentView tournament={completed} {...props} />);
    const winnerName = completed.participants.find((participant) => participant.id === match.homeId)!.name;
    expect(screen.getByText("Vincitore").closest("tr")!.textContent).toContain(winnerName);
    fireEvent.click(screen.getByRole("button", { name: "Partecipante" }));
    fireEvent.click(screen.getByRole("button", { name: "Partecipante" }));
    expect(screen.getByText("Vincitore").closest("tr")!.textContent).toContain(winnerName);
    expect(screen.getAllByText("Vincitore")).toHaveLength(1);
  });

  it.each(["higher", "lower"] as const)("evidenzia la squadra vincitrice con punteggio %s e rimuove il segnale riaprendo", (scoreDirection) => {
    let tournament = createTournament({
      name: "Squadre", format: "team-scoreboard", participants: [{ name: "Ada", teamName: "Rosso" }, { name: "Bea", teamName: "Blu" }],
      settings: { shuffleParticipants: false, scoring: { ...DEFAULT_SCORING_RULES, scoreDirection } },
    });
    tournament = updateParticipantScore(tournament, tournament.participants[0].id, -12);
    tournament = updateParticipantScore(tournament, tournament.participants[1].id, 25);
    const props = { onUpdate: vi.fn(), onDelete: vi.fn() };
    const { rerender } = render(<TournamentView tournament={tournament} {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Classifica" }));
    expect(screen.queryByText("Squadra vincitrice")).toBeNull();
    tournament = setTournamentStatus(tournament, "completed");
    rerender(<TournamentView tournament={tournament} {...props} />);
    expect(screen.getByText("Squadra vincitrice").closest("section")!.textContent).toContain(scoreDirection === "higher" ? "Blu" : "Rosso");
    expect(screen.getAllByText("Squadra vincitrice")).toHaveLength(1);
    rerender(<TournamentView tournament={setTournamentStatus(tournament, "active")} {...props} />);
    expect(screen.queryByText("Squadra vincitrice")).toBeNull();
  });
  it.each(["Panoramica", "Classifica"])("elimina il round dalla scheda %s tramite il motore", (tab) => {
    const tournament = createTournament({ name: "Golf", format: "scoreboard", participants: [{ name: "Ada" }, { name: "Bea" }] });
    const onUpdate = vi.fn();
    render(<TournamentView tournament={tournament} onUpdate={onUpdate} onDelete={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: tab }));
    fireEvent.click(screen.getByRole("button", { name: "Elimina Round 1" }));
    expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({ scoreboardRounds: [], status: "active" }));
  });
  it("chiede vincitore e nota prima di concludere una classifica libera in parità", () => {
    const tournament = createTournament({
      name: "Minigolf",
      format: "scoreboard",
      participants: [{ name: "Ada" }, { name: "Bea" }, { name: "Carlo" }],
      settings: { shuffleParticipants: false },
    });
    const onUpdate = vi.fn();
    render(
      <TournamentView
        tournament={tournament}
        onUpdate={onUpdate}
        onDelete={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Dettagli" }));
    fireEvent.click(screen.getByRole("button", { name: "Concludi torneo" }));

    const dialog = screen.getByRole("dialog", { name: "Scegli il vincitore" });
    fireEvent.click(within(dialog).getByRole("radio", { name: /Bea/ }));
    fireEvent.change(within(dialog).getByPlaceholderText(/buca di spareggio/i), {
      target: { value: "Ha vinto la buca 19." },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Concludi torneo" }));

    expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({
      status: "completed",
      winnerOverrideId: tournament.participants[1].id,
      winnerOverrideNote: "Ha vinto la buca 19.",
    }));
  });
});
