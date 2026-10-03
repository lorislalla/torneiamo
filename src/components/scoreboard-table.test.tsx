// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createTournament, updateScoreboardRoundScore } from "@/domain/tournament-engine";
import { ScoreboardTable } from "./scoreboard-table";

describe("ScoreboardTable", () => {
  afterEach(() => { cleanup(); vi.restoreAllMocks(); });
  it("accorpa posizione e partecipante per lasciare spazio ai round su mobile", () => {
    const tournament = createTournament({
      name: "Minigolf",
      format: "scoreboard",
      participants: [{ name: "Carola" }, { name: "Denny" }],
      settings: { shuffleParticipants: false },
    });

    render(
      <ScoreboardTable
        tournament={tournament}
        onScore={vi.fn()}
        onAddRound={vi.fn()}
        onRemoveRound={vi.fn()}
      />,
    );

    const scrollRegion = screen.getByRole("region", {
      name: "Punteggi dei partecipanti per round",
    });
    expect(within(scrollRegion).queryByRole("columnheader", { name: "#" })).toBeNull();
    expect(within(scrollRegion).getByRole("rowheader", { name: "1. Carola" })).toBeDefined();
    expect(within(scrollRegion).getByRole("columnheader", { name: "Totale" })).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Mostra nome di Carola" }));
    expect(screen.getByRole("status").textContent).toBe("Carola");
    fireEvent.click(screen.getByRole("button", { name: "Mostra nome di Carola" }));
    expect(screen.queryByRole("status")).toBeNull();
  });

  it.each([12, -3])("protegge un round con punteggio %i e rispetta annullamento e conferma", (score) => {
    const created = createTournament({ name: "Golf", format: "scoreboard", participants: [{ name: "Ada" }, { name: "Bea" }] });
    const roundId = created.scoreboardRounds[0].id;
    const tournament = updateScoreboardRoundScore(created, roundId, created.participants[1].id, score);
    const onRemoveRound = vi.fn();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<ScoreboardTable tournament={tournament} onScore={vi.fn()} onAddRound={vi.fn()} onRemoveRound={onRemoveRound} />);

    fireEvent.click(screen.getByRole("button", { name: "Elimina Round 1" }));
    expect(confirm).toHaveBeenCalledWith(expect.stringContaining("Round 1"));
    expect(onRemoveRound).not.toHaveBeenCalled();
    confirm.mockReturnValue(true);
    fireEvent.click(screen.getByRole("button", { name: "Elimina Round 1" }));
    expect(onRemoveRound).toHaveBeenCalledExactlyOnceWith(roundId);
  });

  it("elimina senza conferma quando tutti i punteggi sono zero e nasconde i comandi in sola lettura", () => {
    const tournament = createTournament({ name: "Golf", format: "scoreboard", participants: [{ name: "Ada" }, { name: "Bea" }] });
    const onRemoveRound = vi.fn();
    const confirm = vi.spyOn(window, "confirm");
    const { rerender } = render(<ScoreboardTable tournament={tournament} onScore={vi.fn()} onAddRound={vi.fn()} onRemoveRound={onRemoveRound} />);
    fireEvent.click(screen.getByRole("button", { name: "Elimina Round 1" }));
    expect(confirm).not.toHaveBeenCalled();
    expect(onRemoveRound).toHaveBeenCalledExactlyOnceWith(tournament.scoreboardRounds[0].id);
    rerender(<ScoreboardTable tournament={tournament} onScore={vi.fn()} onAddRound={vi.fn()} onRemoveRound={onRemoveRound} readOnly />);
    expect(screen.queryByRole("button", { name: "Elimina Round 1" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Aggiungi round" })).toBeNull();
  });
});
