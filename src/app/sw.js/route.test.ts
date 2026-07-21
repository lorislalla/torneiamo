import vm from "node:vm";
import { describe, expect, it, vi } from "vitest";
import { GET } from "./route";

describe("service worker", () => {
  it("clona la risposta prima di restituirla al browser", async () => {
    const source = await GET().text();
    const listeners = new Map<string, (event: unknown) => void>();
    let releaseCache: (() => void) | undefined;
    const cacheReady = new Promise<void>((resolve) => {
      releaseCache = resolve;
    });
    const copy = {};
    const networkResponse = {
      ok: true,
      clone: vi.fn(() => copy),
    };
    const cachePut = vi.fn().mockResolvedValue(undefined);

    vm.runInNewContext(source, {
      URL,
      Response,
      caches: {
        keys: vi.fn().mockResolvedValue([]),
        match: vi.fn().mockResolvedValue(undefined),
        open: vi.fn(async () => {
          await cacheReady;
          return { add: vi.fn(), put: cachePut };
        }),
      },
      fetch: vi.fn().mockResolvedValue(networkResponse),
      self: {
        clients: { claim: vi.fn() },
        location: { origin: "https://torneiamo.test" },
        skipWaiting: vi.fn(),
        addEventListener: (type: string, listener: (event: unknown) => void) => {
          listeners.set(type, listener);
        },
      },
    });

    let responsePromise: Promise<unknown> | undefined;
    listeners.get("fetch")?.({
      request: {
        method: "GET",
        mode: "navigate",
        url: "https://torneiamo.test/torneo",
      },
      respondWith: (promise: Promise<unknown>) => {
        responsePromise = promise;
      },
    });

    await Promise.resolve();
    await Promise.resolve();
    expect(networkResponse.clone).toHaveBeenCalledOnce();

    releaseCache?.();
    expect(await responsePromise).toBe(networkResponse);
    expect(cachePut).toHaveBeenCalledWith(expect.anything(), copy);
  });
});
