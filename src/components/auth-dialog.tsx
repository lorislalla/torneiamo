"use client";

import { useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { CheckCircle2, Mail, Sparkles } from "lucide-react";
import type { Database } from "@/lib/supabase/database.types";
import { Button, FieldLabel, Modal } from "./ui";

export function AuthDialog({
  open,
  onClose,
  supabase,
  inviteCode,
}: {
  open: boolean;
  onClose: () => void;
  supabase: SupabaseClient<Database>;
  inviteCode?: string | null;
}) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  function close() {
    setError("");
    setSent(false);
    onClose();
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");

    const next = inviteCode ? `/?invite=${encodeURIComponent(inviteCode)}` : "/";
    const callback = new URL("/auth/callback", window.location.origin);
    callback.searchParams.set("next", next);

    const { error: authError } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: callback.toString(),
        shouldCreateUser: true,
      },
    });

    setLoading(false);
    if (authError) {
      setError(authError.message);
      return;
    }
    setSent(true);
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title={inviteCode ? "Accedi per accettare l’invito" : "Porta i tornei nel cloud"}
      description="Niente password: ricevi un link sicuro via email."
    >
      {sent ? (
        <div className="p-6 text-center sm:p-9">
          <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-lime-300/10 text-lime-300">
            <CheckCircle2 className="size-6" />
          </span>
          <h3 className="mt-5 text-xl font-medium text-white">Controlla la posta</h3>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-white/45">
            Abbiamo inviato il link di accesso a <strong className="text-white/75">{email}</strong>.
            Puoi chiudere questa finestra e tornare qui dal link.
          </p>
          <Button className="mt-6" variant="secondary" onClick={close}>Chiudi</Button>
        </div>
      ) : (
        <form className="space-y-5 p-5 sm:p-7" onSubmit={submit}>
          <div className="rounded-2xl border border-lime-300/10 bg-lime-300/[.04] p-4 text-sm leading-6 text-white/48">
            <span className="mb-2 flex items-center gap-2 font-medium text-lime-200">
              <Sparkles className="size-4" /> Sync e collaborazione inclusi
            </span>
            I dati locali saranno importati automaticamente. Potrai aprire gli stessi tornei da più dispositivi e invitare altre persone.
          </div>
          <label className="block">
            <FieldLabel>Email</FieldLabel>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-white/30" />
              <input
                className="h-12 w-full rounded-xl border border-white/10 bg-white/[.055] pl-11 pr-4 text-white outline-none transition placeholder:text-white/25 focus:border-lime-300/50 focus:ring-2 focus:ring-lime-300/10"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="tu@esempio.it"
                autoFocus
              />
            </div>
          </label>
          {error ? <p className="rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-200">{error}</p> : null}
          <Button className="w-full" type="submit" disabled={loading}>
            <Mail className="size-4" /> {loading ? "Invio in corso…" : "Invia link di accesso"}
          </Button>
        </form>
      )}
    </Modal>
  );
}
