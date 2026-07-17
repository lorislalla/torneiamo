"use client";

import { useCallback, useEffect, useState } from "react";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { Check, Copy, Link2, LoaderCircle, Share2, Trash2, Users } from "lucide-react";
import type { Tournament } from "@/domain/types";
import type { TournamentRole } from "@/data/tournament-repository";
import { createInviteCode, hashInviteCode } from "@/lib/invite-code";
import type { Database } from "@/lib/supabase/database.types";
import { Button, FieldLabel, Modal } from "./ui";

type Member = {
  userId: string;
  role: TournamentRole;
  displayName: string;
  joinedAt: string;
};

const ROLE_LABELS: Record<TournamentRole, string> = {
  owner: "Proprietario",
  editor: "Può modificare",
  viewer: "Sola lettura",
};

export function CollaborationDialog({
  open,
  onClose,
  supabase,
  user,
  tournament,
  role,
}: {
  open: boolean;
  onClose: () => void;
  supabase: SupabaseClient<Database>;
  user: User;
  tournament: Tournament;
  role: TournamentRole;
}) {
  const [members, setMembers] = useState<Member[]>([]);
  const [inviteRole, setInviteRole] = useState<"editor" | "viewer">("editor");
  const [inviteLink, setInviteLink] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  const loadMembers = useCallback(async () => {
    if (!open) return;
    setLoading(true);
    setError("");
    const { data: rows, error: memberError } = await supabase
      .from("tournament_members")
      .select("user_id, role, joined_at")
      .eq("tournament_id", tournament.id)
      .order("joined_at");

    if (memberError) {
      setError(memberError.message);
      setLoading(false);
      return;
    }

    const userIds = rows.map((item) => item.user_id);
    const { data: profiles } = userIds.length
      ? await supabase.from("profiles").select("id, display_name").in("id", userIds)
      : { data: [] };
    const names = new Map((profiles ?? []).map((profile) => [profile.id, profile.display_name]));

    setMembers(rows.map((item) => ({
      userId: item.user_id,
      role: item.role as TournamentRole,
      displayName: names.get(item.user_id) ?? (item.user_id === user.id ? user.email ?? "Tu" : "Collaboratore"),
      joinedAt: item.joined_at,
    })));
    setLoading(false);
  }, [open, supabase, tournament.id, user.email, user.id]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadMembers(), 0);
    return () => window.clearTimeout(timer);
  }, [loadMembers]);

  async function createInvite() {
    setLoading(true);
    setError("");
    setCopied(false);
    const code = createInviteCode();
    const tokenHash = await hashInviteCode(code);
    const { error: inviteError } = await supabase.from("tournament_invites").insert({
      tournament_id: tournament.id,
      token_hash: tokenHash,
      role: inviteRole,
    });
    setLoading(false);

    if (inviteError) {
      setError(inviteError.message);
      return;
    }

    const url = new URL(window.location.origin);
    url.searchParams.set("invite", code);
    setInviteLink(url.toString());
  }

  async function copyInvite() {
    await navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  async function shareInvite() {
    if (navigator.share) {
      await navigator.share({
        title: `Invito a ${tournament.name}`,
        text: `Partecipa al torneo “${tournament.name}” su Torneiamo.`,
        url: inviteLink,
      });
    } else {
      await copyInvite();
    }
  }

  async function updateRole(member: Member, nextRole: "editor" | "viewer") {
    const { error: updateError } = await supabase
      .from("tournament_members")
      .update({ role: nextRole })
      .eq("tournament_id", tournament.id)
      .eq("user_id", member.userId);
    if (updateError) setError(updateError.message);
    else await loadMembers();
  }

  async function removeMember(member: Member) {
    if (!window.confirm(`Rimuovere ${member.displayName} dal torneo?`)) return;
    const { error: removeError } = await supabase
      .from("tournament_members")
      .delete()
      .eq("tournament_id", tournament.id)
      .eq("user_id", member.userId);
    if (removeError) setError(removeError.message);
    else await loadMembers();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Persone e accessi"
      description={`Collabora in tempo reale su “${tournament.name}”.`}
    >
      <div className="space-y-7 p-5 sm:p-7">
        {role === "owner" ? (
          <section>
            <FieldLabel>Crea un link monouso</FieldLabel>
            <div className="flex flex-col gap-2 sm:flex-row">
              <select
                className="h-11 rounded-xl border border-white/10 bg-[#14231c] px-3 text-sm text-white outline-none focus:border-lime-300/50"
                value={inviteRole}
                onChange={(event) => setInviteRole(event.target.value as "editor" | "viewer")}
              >
                <option value="editor">Può modificare</option>
                <option value="viewer">Sola lettura</option>
              </select>
              <Button className="sm:flex-1" onClick={createInvite} disabled={loading}>
                <Link2 className="size-4" /> Genera invito
              </Button>
            </div>
            <p className="mt-2 text-xs leading-5 text-white/35">Il link scade dopo 7 giorni e può essere usato da una sola persona.</p>
            {inviteLink ? (
              <div className="mt-4 rounded-2xl border border-lime-300/15 bg-lime-300/[.045] p-3">
                <p className="truncate font-mono text-xs text-lime-100/70">{inviteLink}</p>
                <div className="mt-3 flex gap-2">
                  <Button size="sm" variant="secondary" onClick={copyInvite}>
                    {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                    {copied ? "Copiato" : "Copia"}
                  </Button>
                  <Button size="sm" onClick={shareInvite}><Share2 className="size-4" /> Condividi</Button>
                </div>
              </div>
            ) : null}
          </section>
        ) : null}

        <section>
          <div className="mb-3 flex items-center justify-between">
            <FieldLabel>Collaboratori</FieldLabel>
            <span className="mb-2 inline-flex items-center gap-1.5 text-xs text-white/35">
              <Users className="size-3.5" /> {members.length}
            </span>
          </div>
          {loading && members.length === 0 ? (
            <div className="grid min-h-28 place-items-center text-white/35"><LoaderCircle className="size-5 animate-spin" /></div>
          ) : (
            <div className="space-y-2">
              {members.map((member) => (
                <div key={member.userId} className="flex flex-col gap-3 rounded-2xl border border-white/8 bg-white/[.025] p-4 sm:flex-row sm:items-center">
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-white/[.07] text-sm font-semibold text-white/70">
                    {member.displayName.slice(0, 2).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-white">{member.displayName}{member.userId === user.id ? " (tu)" : ""}</p>
                    <p className="mt-0.5 text-xs text-white/35">{ROLE_LABELS[member.role]}</p>
                  </div>
                  {role === "owner" && member.role !== "owner" ? (
                    <div className="flex items-center gap-2">
                      <select
                        className="h-9 rounded-lg border border-white/10 bg-[#14231c] px-2 text-xs text-white outline-none"
                        value={member.role}
                        onChange={(event) => void updateRole(member, event.target.value as "editor" | "viewer")}
                      >
                        <option value="editor">Modifica</option>
                        <option value="viewer">Lettura</option>
                      </select>
                      <Button variant="danger" size="icon" onClick={() => void removeMember(member)} aria-label="Rimuovi collaboratore">
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </section>
        {error ? <p className="rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-200">{error}</p> : null}
      </div>
    </Modal>
  );
}
