// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ScoreInput } from "./score-input";

afterEach(cleanup);

describe("ScoreInput", () => {
  it("non attiva il punteggio al pointer down usato per iniziare uno scroll", () => {
    const select = vi.spyOn(HTMLInputElement.prototype, "select");
    const focus = vi.spyOn(HTMLInputElement.prototype, "focus");
    render(
      <ScoreInput
        score={12}
        participantName="Ada"
        readOnly={false}
        onCommit={vi.fn()}
      />,
    );

    fireEvent.pointerDown(screen.getByRole("textbox", { name: "Punteggio di Ada" }));

    expect(focus).not.toHaveBeenCalled();
    expect(select).not.toHaveBeenCalled();
    focus.mockRestore();
    select.mockRestore();
  });

  it("seleziona il punteggio esistente dopo un tap completo", () => {
    const select = vi.spyOn(HTMLInputElement.prototype, "select");
    render(
      <ScoreInput
        score={12}
        participantName="Ada"
        readOnly={false}
        onCommit={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("textbox", { name: "Punteggio di Ada" }));

    expect(select).toHaveBeenCalledOnce();
    select.mockRestore();
  });
});
