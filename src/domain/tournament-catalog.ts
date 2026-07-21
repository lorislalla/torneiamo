import type { Tournament } from "./types";

export type TournamentSortOrder =
  | "updated-desc"
  | "created-desc"
  | "created-asc"
  | "completed-desc";

export function searchAndSortTournaments(
  tournaments: Tournament[],
  query: string,
  sortOrder: TournamentSortOrder,
): Tournament[] {
  const terms = normalizeSearchText(query).split(/\s+/).filter(Boolean);
  const filtered = terms.length === 0
    ? tournaments
    : tournaments.filter((tournament) => {
        const searchableText = normalizeSearchText([
          tournament.name,
          ...tournament.participants.flatMap((participant) => [
            participant.name,
            participant.teamName ?? "",
          ]),
        ].join(" "));
        return terms.every((term) => searchableText.includes(term));
      });

  return [...filtered].sort((first, second) => {
    if (sortOrder === "created-asc") {
      return compareDates(first.createdAt, second.createdAt);
    }
    if (sortOrder === "created-desc") {
      return compareDates(second.createdAt, first.createdAt);
    }
    if (sortOrder === "completed-desc") {
      return compareOptionalDates(
        tournamentCompletedAt(second),
        tournamentCompletedAt(first),
      );
    }
    return compareDates(second.updatedAt, first.updatedAt);
  });
}

export function tournamentCompletedAt(tournament: Tournament) {
  return tournament.completedAt ?? (
    tournament.status === "completed" ? tournament.updatedAt : undefined
  );
}

export function formatTournamentDate(value: string) {
  return new Intl.DateTimeFormat("it-IT", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function normalizeSearchText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("it");
}

function compareDates(first: string, second: string) {
  return first.localeCompare(second);
}

function compareOptionalDates(first?: string, second?: string) {
  if (first && second) return compareDates(first, second);
  if (first) return 1;
  if (second) return -1;
  return 0;
}
