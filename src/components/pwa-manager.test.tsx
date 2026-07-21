// @vitest-environment jsdom

import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PwaManager, usePwaInstallation } from "./pwa-manager";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function mockDisplayMode(standalone: boolean) {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query === "(display-mode: standalone)" && standalone,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

function createInstallPromptEvent() {
  const event = new Event("beforeinstallprompt", { cancelable: true });
  Object.assign(event, {
    prompt: vi.fn().mockResolvedValue(undefined),
    userChoice: Promise.resolve({ outcome: "dismissed" as const }),
  });
  return event;
}

function PwaHarness() {
  const { installable, install } = usePwaInstallation();
  return (
    <>
      {installable ? <span>Installabile sul telefono</span> : null}
      <PwaManager installable={installable} onInstall={install} />
    </>
  );
}

describe("disponibilità dell'installazione PWA", () => {
  it("mostra invito e pulsante solo dopo il prompt del browser", async () => {
    mockDisplayMode(false);
    render(<PwaHarness />);

    expect(screen.queryByText("Installabile sul telefono")).toBeNull();
    expect(screen.queryByRole("button", { name: "Installa app" })).toBeNull();

    const installEvent = createInstallPromptEvent();
    act(() => window.dispatchEvent(installEvent));

    expect(installEvent.defaultPrevented).toBe(true);
    expect(await screen.findByText("Installabile sul telefono")).toBeDefined();
    expect(screen.getByRole("button", { name: "Installa app" })).toBeDefined();
  });

  it("nasconde l'invito quando l'app viene installata", async () => {
    mockDisplayMode(false);
    render(<PwaHarness />);
    act(() => window.dispatchEvent(createInstallPromptEvent()));
    await screen.findByText("Installabile sul telefono");

    act(() => window.dispatchEvent(new Event("appinstalled")));

    await waitFor(() => {
      expect(screen.queryByText("Installabile sul telefono")).toBeNull();
      expect(screen.queryByRole("button", { name: "Installa app" })).toBeNull();
    });
  });

  it("ignora il prompt se la webapp è già in modalità standalone", async () => {
    mockDisplayMode(true);
    render(<PwaHarness />);
    const installEvent = createInstallPromptEvent();

    act(() => window.dispatchEvent(installEvent));

    await waitFor(() => {
      expect(screen.queryByText("Installabile sul telefono")).toBeNull();
      expect(screen.queryByRole("button", { name: "Installa app" })).toBeNull();
    });
    expect(installEvent.defaultPrevented).toBe(false);
  });
});
