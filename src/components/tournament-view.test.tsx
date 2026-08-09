// @vitest-environment jsdom

import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createTournament } from "@/domain/tournament-engine";
import { TournamentView } from "./tournament-view";

describe("TournamentView", () => {
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
