// @vitest-environment jsdom

import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createTournament } from "@/domain/tournament-engine";
import { ScoreboardTable } from "./scoreboard-table";

describe("ScoreboardTable", () => {
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
      />,
    );

    const scrollRegion = screen.getByRole("region", {
      name: "Punteggi dei partecipanti per round",
    });
    expect(within(scrollRegion).queryByRole("columnheader", { name: "#" })).toBeNull();
    expect(within(scrollRegion).getByRole("rowheader", { name: /1\s*Carola/ })).toBeDefined();
    expect(within(scrollRegion).getByRole("columnheader", { name: "Totale" })).toBeDefined();
  });
});
