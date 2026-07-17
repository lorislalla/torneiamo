export type TournamentFormat = "league" | "knockout" | "hybrid";

export type TournamentStatus = "active" | "completed";

export type MatchPhase = "league" | "group" | "knockout";

export interface Participant {
  id: string;
  name: string;
  teamName?: string;
  accent: string;
}

export interface TournamentGroup {
  id: string;
  name: string;
  participantIds: string[];
}

export interface Match {
  id: string;
  phase: MatchPhase;
  round: number;
  roundLabel: string;
  groupId?: string;
  homeId: string | null;
  awayId: string | null;
  homeScore: number | null;
  awayScore: number | null;
  returnHomeScore: number | null;
  returnAwayScore: number | null;
  winnerOverrideId: string | null;
  twoLegs: boolean;
  nextMatchId?: string;
  nextSlot?: "home" | "away";
}

export interface TournamentSettings {
  leagueLegs: 1 | 2;
  knockoutLegs: 1 | 2;
  groupCount: number;
  qualifiersPerGroup: number;
  shuffleParticipants: boolean;
}

export interface Tournament {
  id: string;
  name: string;
  format: TournamentFormat;
  status: TournamentStatus;
  createdAt: string;
  updatedAt: string;
  participants: Participant[];
  settings: TournamentSettings;
  groups: TournamentGroup[];
  bracketSeedIds: string[];
  matches: Match[];
}

export interface StandingRow {
  participantId: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
  position: number;
}

export interface MatchScoreUpdate {
  homeScore: number | null;
  awayScore: number | null;
  returnHomeScore?: number | null;
  returnAwayScore?: number | null;
  winnerOverrideId?: string | null;
}
