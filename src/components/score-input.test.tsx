// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ScoreInput } from "./score-input";

describe("ScoreInput", () => {
  it("seleziona il punteggio esistente quando riceve il focus", () => {
    const select = vi.spyOn(HTMLInputElement.prototype, "select");
    render(
      <ScoreInput
        score={12}
        participantName="Ada"
        readOnly={false}
        onCommit={vi.fn()}
      />,
    );

    fireEvent.focus(screen.getByRole("textbox", { name: "Punteggio di Ada" }));
    fireEvent.pointerDown(screen.getByRole("textbox", { name: "Punteggio di Ada" }));

    expect(select.mock.calls.length).toBeGreaterThanOrEqual(2);
    select.mockRestore();
  });
});
