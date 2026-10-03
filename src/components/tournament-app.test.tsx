// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { completeScoreboardTournament, createTournament } from "@/domain/tournament-engine";
import { getLocalTournamentRepository } from "@/data/local-storage-tournament-repository";
import { TournamentApp } from "./tournament-app";

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getUser: async () => ({ data: { user: null } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: vi.fn() } } }),
    },
  }),
}));

beforeEach(() => {
  const values = new Map<string, string>();
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    },
  });
});

describe("TournamentApp", () => {
  afterEach(cleanup);
  it("mostra un badge per i tornei aperti anche quando non sono selezionati", async () => {
    const active = createTournament({ name: "Aperto", format: "scoreboard", participants: [{ name: "Ada" }, { name: "Bea" }] });
    const completed = completeScoreboardTournament({ ...active, id: "completed", name: "Concluso" }, active.participants[0].id);
    await getLocalTournamentRepository().replace([completed, active]);
    render(<TournamentApp />);
    const navigation = await screen.findByRole("navigation", { name: "Tornei salvati" });
    const activeButton = await within(navigation).findByRole("button", { name: /Aperto/ });
    const completedButton = within(navigation).getByRole("button", { name: /Concluso/ });
    expect(within(activeButton).getByText("In corso")).toBeDefined();
    expect(within(completedButton).queryByText("In corso")).toBeNull();
    expect(within(completedButton).getByText(/Fine/)).toBeDefined();
    fireEvent.click(activeButton);
    expect(within(activeButton).getByText("In corso")).toBeDefined();
  });
});
