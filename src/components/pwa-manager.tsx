"use client";

import { useEffect, useRef, useState } from "react";
import { Download, RefreshCw, Smartphone, X } from "lucide-react";
import { Button } from "./ui";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function usePwaInstallation() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const onBeforeInstall = (event: Event) => {
      const navigatorWithStandalone = navigator as Navigator & {
        standalone?: boolean;
      };
      if (
        window.matchMedia("(display-mode: standalone)").matches ||
        navigatorWithStandalone.standalone === true
      ) {
        return;
      }
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setInstallPrompt(null);
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function install() {
    if (!installPrompt) return;
    await installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  }

  return { installable: installPrompt !== null, install };
}

export function PwaManager({
  installable,
  onInstall,
}: {
  installable: boolean;
  onInstall: () => Promise<void>;
}) {
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  const [dismissedUpdate, setDismissedUpdate] = useState(false);
  const reloading = useRef(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    let registration: ServiceWorkerRegistration | null = null;
    const watchWorker = (worker: ServiceWorker | null) => {
      if (!worker) return;
      worker.addEventListener("statechange", () => {
        if (worker.state === "installed" && navigator.serviceWorker.controller) {
          setWaitingWorker(worker);
          setDismissedUpdate(false);
        }
      });
    };
    navigator.serviceWorker
      .register("/sw.js", { updateViaCache: "none" })
      .then((currentRegistration) => {
        registration = currentRegistration;
        if (currentRegistration.waiting && navigator.serviceWorker.controller) {
          setWaitingWorker(currentRegistration.waiting);
        }
        currentRegistration.addEventListener("updatefound", () => watchWorker(currentRegistration.installing));
      })
      .catch(() => undefined);

    const onControllerChange = () => {
      if (reloading.current) return;
      reloading.current = true;
      window.location.reload();
    };
    const checkForUpdates = () => {
      if (document.visibilityState === "visible") registration?.update();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
    document.addEventListener("visibilitychange", checkForUpdates);
    window.addEventListener("focus", checkForUpdates);
    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
      document.removeEventListener("visibilitychange", checkForUpdates);
      window.removeEventListener("focus", checkForUpdates);
    };
  }, []);

  return (
    <div className="fixed inset-x-3 bottom-3 z-40 flex flex-col items-end gap-2 sm:inset-x-auto sm:right-4 sm:max-w-sm">
      {waitingWorker && !dismissedUpdate ? (
        <div className="w-full rounded-2xl border border-lime-300/25 bg-[#13241b] p-4 shadow-[0_20px_70px_rgba(0,0,0,.45)]">
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-lime-300 text-emerald-950"><RefreshCw className="size-4" /></span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-white">Nuova versione disponibile</p>
              <p className="mt-1 text-xs leading-5 text-white/45">Aggiorna ora per usare l’ultima versione di Torneiamo.</p>
            </div>
            <button type="button" className="text-white/30 hover:text-white" onClick={() => setDismissedUpdate(true)} aria-label="Chiudi avviso"><X className="size-4" /></button>
          </div>
          <Button className="mt-3 w-full" size="sm" onClick={() => waitingWorker.postMessage({ type: "SKIP_WAITING" })}>
            <RefreshCw className="size-3.5" /> Aggiorna e ricarica
          </Button>
        </div>
      ) : null}
      {installable ? (
        <Button variant="secondary" onClick={() => void onInstall()} className="border-lime-300/15 bg-[#13241b] shadow-xl">
          <Download className="size-4 text-lime-300" /> Installa app
        </Button>
      ) : null}
      <span className="hidden items-center gap-1.5 px-1 font-mono text-[9px] text-white/20 sm:inline-flex">
        <Smartphone className="size-3" /> v{process.env.NEXT_PUBLIC_APP_VERSION ?? "0.1.0"}
      </span>
    </div>
  );
}
