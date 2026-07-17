import type { Participant } from "./types";

export function participantLabel(participant: Participant) {
  return participant.teamName
    ? `${participant.name} · ${participant.teamName}`
    : participant.name;
}
