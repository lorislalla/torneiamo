import type {
  Match,
  MatchScoreUpdate,
  Participant,
  ScoringRules,
  ScoreDirection,
  StandingRow,
  TeamStandingRow,
  Tournament,
  TournamentFormat,
  TournamentGroup,
  TournamentSettings,
} from "./types";

const PARTICIPANT_ACCENTS = [
  "#B9FF66",
  "#69E8FF",
  "#FFB86B",
  "#D6A5FF",
  "#FF7C9B",
  "#8DFFCB",
  "#FFE36B",
  "#8CB4FF",
];

export const DEFAULT_SCORING_RULES: ScoringRules = {
  winPoints: 3,
  drawPoints: 1,
  lossPoints: 0,
  scoreDirection: "higher",
  tieBreakers: ["headToHead", "scoreDifference", "scoreFor"],
};

export const DEFAULT_TOURNAMENT_SETTINGS: TournamentSettings = {
  leagueLegs: 1,
  knockoutLegs: 1,
  groupCount: 2,
  qualifiersPerGroup: 2,
  shuffleParticipants: true,
  scoring: DEFAULT_SCORING_RULES,
};

function createId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function shuffle<T>(items: T[]) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[randomIndex]] = [result[randomIndex], result[index]];
  }
  return result;
}

export function createTournament(input: {
  name: string;
  format: TournamentFormat;
  participants: Array<{ name: string; teamName?: string }>;
  settings?: Partial<TournamentSettings>;
}): Tournament {
  const now = new Date().toISOString();
  const participants = input.participants.map((participant, index) => ({
    id: createId("player"),
    name: participant.name.trim(),
    ...(participant.teamName?.trim()
      ? { teamName: participant.teamName.trim() }
      : {}),
    ...(input.format === "scoreboard" || input.format === "team-scoreboard"
      ? { score: 0 }
      : {}),
    accent: PARTICIPANT_ACCENTS[index % PARTICIPANT_ACCENTS.length],
  }));
  const settings = {
    ...DEFAULT_TOURNAMENT_SETTINGS,
    ...input.settings,
    scoring: {
      ...DEFAULT_SCORING_RULES,
      ...input.settings?.scoring,
    },
  };
  const orderedParticipants = settings.shuffleParticipants
    ? shuffle(participants)
    : participants;

  const base: Tournament = {
    id: createId("tournament"),
    name: input.name.trim(),
    format: input.format,
    status: "active",
    createdAt: now,
    updatedAt: now,
    participants,
    settings,
    groups: [],
    bracketSeedIds: [],
    matches: [],
  };

  if (input.format === "league") {
    base.matches = generateRoundRobin(
      orderedParticipants.map((participant) => participant.id),
      settings.leagueLegs,
      "league",
    );
  }

  if (input.format === "duel") {
    base.matches = [createDuelMatch(participants, 1)];
  }

  if (input.format === "knockout") {
    base.bracketSeedIds = orderedParticipants.map((participant) => participant.id);
    base.matches = generateBracket(
      base.bracketSeedIds,
      settings.knockoutLegs,
      "knockout",
    );
    base.matches = reconcileBracket(
      base.matches,
      settings.scoring.scoreDirection,
    );
  }

  if (input.format === "hybrid") {
    base.groups = createGroups(orderedParticipants, settings.groupCount);
    base.matches = base.groups.flatMap((group) =>
      generateRoundRobin(
        group.participantIds,
        settings.leagueLegs,
        "group",
        group,
      ),
    );
  }

  return base;
}

export function updateMatchScore(
  tournament: Tournament,
  matchId: string,
  score: MatchScoreUpdate,
): Tournament {
  let next: Tournament = {
    ...tournament,
    updatedAt: new Date().toISOString(),
    matches: tournament.matches.map((match) =>
      match.id === matchId
        ? {
            ...match,
            homeScore: score.homeScore,
            awayScore: score.awayScore,
            returnHomeScore:
              score.returnHomeScore === undefined
                ? match.returnHomeScore
                : score.returnHomeScore,
            returnAwayScore:
              score.returnAwayScore === undefined
                ? match.returnAwayScore
                : score.returnAwayScore,
            winnerOverrideId:
              score.winnerOverrideId === undefined
                ? match.winnerOverrideId
                : score.winnerOverrideId,
          }
        : match,
    ),
  };

  if (tournament.format === "knockout") {
    next.matches = reconcileBracket(
      next.matches,
      next.settings.scoring.scoreDirection,
    );
  }

  if (tournament.format === "hybrid") {
    next = refreshHybridBracket(next);
  }

  if (tournament.format === "duel" && tournament.status === "active") {
    const lastMatch = next.matches.at(-1);
    const earlierMatchNeedsScore = next.matches
      .slice(0, -1)
      .some((match) => !isMatchPlayed(match));

    if (lastMatch && !isMatchPlayed(lastMatch) && earlierMatchNeedsScore) {
      next.matches = next.matches.slice(0, -1);
    }

    if (next.matches.length > 0 && next.matches.every(isMatchPlayed)) {
      next.matches = [
        ...next.matches,
        createDuelMatch(next.participants, next.matches.length + 1),
      ];
    }
  }

  if (
    tournament.format === "duel" ||
    tournament.format === "scoreboard" ||
    tournament.format === "team-scoreboard"
  ) {
    next = withTournamentStatus(next, tournament.status);
  } else if (isTournamentComplete(next)) {
    next = withTournamentStatus(next, "completed");
  } else {
    next = withTournamentStatus(next, "active");
  }

  return next;
}

function createDuelMatch(participants: Participant[], round: number): Match {
  const reverseOrder = round % 2 === 0;
  return createMatch({
    id: `duel-r${round}`,
    phase: "league",
    round,
    roundLabel: `Sfida ${round}`,
    homeId: participants[reverseOrder ? 1 : 0]?.id ?? null,
    awayId: participants[reverseOrder ? 0 : 1]?.id ?? null,
  });
}

export function updateParticipantScore(
  tournament: Tournament,
  participantId: string,
  score: number,
): Tournament {
  return {
    ...tournament,
    updatedAt: new Date().toISOString(),
    participants: tournament.participants.map((participant) =>
      participant.id === participantId ? { ...participant, score } : participant,
    ),
  };
}

export function updateTournamentName(
  tournament: Tournament,
  name: string,
): Tournament {
  const trimmedName = name.trim();
  if (!trimmedName || trimmedName === tournament.name) return tournament;
  return {
    ...tournament,
    name: trimmedName,
    updatedAt: new Date().toISOString(),
  };
}

export function updateTournamentScoringRules(
  tournament: Tournament,
  scoring: ScoringRules,
): Tournament {
  let next: Tournament = {
    ...tournament,
    settings: { ...tournament.settings, scoring },
    updatedAt: new Date().toISOString(),
  };

  if (next.format === "knockout") {
    next.matches = reconcileBracket(next.matches, scoring.scoreDirection);
  }

  if (next.format === "hybrid") {
    next = refreshHybridBracket(next);
  }

  if (
    next.format !== "duel" &&
    next.format !== "scoreboard" &&
    next.format !== "team-scoreboard"
  ) {
    next = withTournamentStatus(
      next,
      isTournamentComplete(next) ? "completed" : "active",
    );
  }

  return next;
}

export function normalizeTournament(tournament: Tournament): Tournament {
  const storedTieBreakers = [
    ...new Set(tournament.settings?.scoring?.tieBreakers ?? []),
  ];
  const tieBreakers = [
    ...storedTieBreakers,
    ...DEFAULT_SCORING_RULES.tieBreakers.filter(
      (tieBreaker) => !storedTieBreakers.includes(tieBreaker),
    ),
  ].slice(0, 3);
  const scoring = {
    ...DEFAULT_SCORING_RULES,
    ...(tournament.settings?.scoring ?? {}),
    tieBreakers,
  };

  return withTournamentStatus({
    ...tournament,
    participants: tournament.participants.map((participant) =>
      (tournament.format === "scoreboard" || tournament.format === "team-scoreboard") &&
      participant.score === undefined
        ? { ...participant, score: 0 }
        : participant,
    ),
    settings: {
      ...DEFAULT_TOURNAMENT_SETTINGS,
      ...tournament.settings,
      scoring,
    },
  }, tournament.status);
}

export function setTournamentStatus(
  tournament: Tournament,
  status: Tournament["status"],
): Tournament {
  let matches = tournament.matches;

  if (tournament.format === "duel") {
    if (status === "completed") {
      matches = matches.filter(isMatchPlayed);
    } else if (matches.length === 0 || matches.every(isMatchPlayed)) {
      matches = [
        ...matches,
        createDuelMatch(tournament.participants, matches.length + 1),
      ];
    }
  }

  const updatedAt = new Date().toISOString();
  return withTournamentStatus({
    ...tournament,
    matches,
    status,
    updatedAt,
  }, status);
}

function withTournamentStatus(
  tournament: Tournament,
  status: Tournament["status"],
): Tournament {
  const next = { ...tournament, status };
  if (status === "completed") {
    next.completedAt = tournament.completedAt ?? tournament.updatedAt;
  } else {
    delete next.completedAt;
  }
  return next;
}

export function generateRoundRobin(
  participantIds: string[],
  legs: 1 | 2,
  phase: "league" | "group",
  group?: TournamentGroup,
): Match[] {
  const rotation: Array<string | null> = [...participantIds];
  if (rotation.length % 2 !== 0) rotation.push(null);
  const roundsPerLeg = rotation.length - 1;
  const fixtures: Match[] = [];

  for (let roundIndex = 0; roundIndex < roundsPerLeg; roundIndex += 1) {
    for (let pairIndex = 0; pairIndex < rotation.length / 2; pairIndex += 1) {
      const first = rotation[pairIndex];
      const second = rotation[rotation.length - 1 - pairIndex];
      if (!first || !second) continue;
      const swapHome = (roundIndex + pairIndex) % 2 === 1;
      const homeId = swapHome ? second : first;
      const awayId = swapHome ? first : second;
      const idPrefix = group ? `${phase}-${group.id}` : phase;
      fixtures.push(
        createMatch({
          id: `${idPrefix}-r${roundIndex + 1}-m${pairIndex + 1}`,
          phase,
          round: roundIndex + 1,
          roundLabel: `Giornata ${roundIndex + 1}`,
          groupId: group?.id,
          homeId,
          awayId,
        }),
      );
    }

    const fixed = rotation[0];
    const rest = rotation.slice(1);
    rest.unshift(rest.pop() ?? null);
    rotation.splice(0, rotation.length, fixed, ...rest);
  }

  if (legs === 2) {
    const returnFixtures = fixtures.map((match) => ({
      ...match,
      id: `${match.id}-return`,
      round: match.round + roundsPerLeg,
      roundLabel: `Giornata ${match.round + roundsPerLeg}`,
      homeId: match.awayId,
      awayId: match.homeId,
    }));
    fixtures.push(...returnFixtures);
  }

  return fixtures;
}

export function generateBracket(
  participantIds: string[],
  legs: 1 | 2,
  phase: "knockout" = "knockout",
): Match[] {
  const bracketSize = 2 ** Math.ceil(Math.log2(Math.max(2, participantIds.length)));
  const matchCount = bracketSize / 2;
  const byeCount = bracketSize - participantIds.length;
  const firstRoundPairs: Array<[string | null, string | null]> = [];
  let participantIndex = 0;

  for (let index = 0; index < matchCount; index += 1) {
    if (index < byeCount) {
      firstRoundPairs.push([participantIds[participantIndex++] ?? null, null]);
    } else {
      firstRoundPairs.push([
        participantIds[participantIndex++] ?? null,
        participantIds[participantIndex++] ?? null,
      ]);
    }
  }

  const roundCount = Math.log2(bracketSize);
  const matches: Match[] = [];
  for (let round = 1; round <= roundCount; round += 1) {
    const matchesInRound = bracketSize / 2 ** round;
    for (let index = 0; index < matchesInRound; index += 1) {
      const nextMatchId =
        round < roundCount
          ? `${phase}-r${round + 1}-m${Math.floor(index / 2) + 1}`
          : undefined;
      matches.push(
        createMatch({
          id: `${phase}-r${round}-m${index + 1}`,
          phase,
          round,
          roundLabel: knockoutRoundLabel(matchesInRound, round === roundCount),
          homeId: round === 1 ? firstRoundPairs[index][0] : null,
          awayId: round === 1 ? firstRoundPairs[index][1] : null,
          nextMatchId,
          nextSlot: nextMatchId ? (index % 2 === 0 ? "home" : "away") : undefined,
        }),
      );
    }
  }

  return matches.map((match) => ({ ...match, twoLegs: legs === 2 }));
}

function createMatch(
  input: Pick<
    Match,
    "id" | "phase" | "round" | "roundLabel" | "homeId" | "awayId"
  > &
    Partial<Pick<Match, "groupId" | "nextMatchId" | "nextSlot">>,
): Match {
  return {
    ...input,
    homeScore: null,
    awayScore: null,
    returnHomeScore: null,
    returnAwayScore: null,
    winnerOverrideId: null,
    twoLegs: false,
  };
}

function knockoutRoundLabel(matchesInRound: number, isFinal: boolean) {
  if (isFinal) return "Finale";
  if (matchesInRound === 2) return "Semifinali";
  if (matchesInRound === 4) return "Quarti di finale";
  if (matchesInRound === 8) return "Ottavi di finale";
  return `Turno con ${matchesInRound * 2} squadre`;
}

export function reconcileBracket(
  matches: Match[],
  scoreDirection: ScoreDirection = "higher",
): Match[] {
  const previousById = new Map(matches.map((match) => [match.id, match]));
  const result = matches.map((match) =>
    match.round === 1
      ? { ...match }
      : {
          ...match,
          homeId: null,
          awayId: null,
          homeScore: null,
          awayScore: null,
          returnHomeScore: null,
          returnAwayScore: null,
          winnerOverrideId: null,
        },
  );
  const resultById = new Map(result.map((match) => [match.id, match]));
  const maxRound = Math.max(...result.map((match) => match.round));

  for (let round = 1; round <= maxRound; round += 1) {
    const roundMatches = result.filter((match) => match.round === round);
    for (const match of roundMatches) {
      if (round > 1 && match.homeId && match.awayId) {
        const previous = previousById.get(match.id);
        if (
          previous?.homeId === match.homeId &&
          previous?.awayId === match.awayId
        ) {
          match.homeScore = previous.homeScore;
          match.awayScore = previous.awayScore;
          match.returnHomeScore = previous.returnHomeScore;
          match.returnAwayScore = previous.returnAwayScore;
          match.winnerOverrideId = previous.winnerOverrideId;
        }
      }

      const winnerId = getMatchWinner(match, match.twoLegs, scoreDirection);
      if (!winnerId || !match.nextMatchId || !match.nextSlot) continue;
      const nextMatch = resultById.get(match.nextMatchId);
      if (nextMatch) {
        if (match.nextSlot === "home") nextMatch.homeId = winnerId;
        if (match.nextSlot === "away") nextMatch.awayId = winnerId;
      }
    }
  }
  return result;
}

export function getMatchWinner(
  match: Match,
  twoLegs: boolean,
  scoreDirection: ScoreDirection = "higher",
) {
  if (match.round === 1 && match.homeId && !match.awayId) return match.homeId;
  if (match.round === 1 && !match.homeId && match.awayId) return match.awayId;
  if (!match.homeId || !match.awayId) return null;
  if (match.homeScore === null || match.awayScore === null) return null;

  let homeTotal = match.homeScore;
  let awayTotal = match.awayScore;
  if (twoLegs) {
    if (match.returnHomeScore === null || match.returnAwayScore === null) return null;
    homeTotal += match.returnAwayScore;
    awayTotal += match.returnHomeScore;
  }

  if (homeTotal !== awayTotal) {
    const homeWins = scoreDirection === "higher"
      ? homeTotal > awayTotal
      : homeTotal < awayTotal;
    return homeWins ? match.homeId : match.awayId;
  }
  return match.winnerOverrideId;
}

export function isMatchPlayed(match: Match) {
  return match.homeScore !== null && match.awayScore !== null;
}

export function calculateStandings(
  participantIds: string[],
  matches: Match[],
  scoring: ScoringRules = DEFAULT_SCORING_RULES,
): StandingRow[] {
  const table = new Map<string, Omit<StandingRow, "position">>();
  const participantOrder = new Map(
    participantIds.map((participantId, index) => [participantId, index]),
  );
  participantIds.forEach((participantId) => {
    table.set(participantId, {
      participantId,
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDifference: 0,
      points: 0,
    });
  });

  for (const match of matches) {
    if (!match.homeId || !match.awayId || !isMatchPlayed(match)) continue;
    const home = table.get(match.homeId);
    const away = table.get(match.awayId);
    if (!home || !away) continue;
    const homeScore = match.homeScore ?? 0;
    const awayScore = match.awayScore ?? 0;
    home.played += 1;
    away.played += 1;
    home.goalsFor += homeScore;
    home.goalsAgainst += awayScore;
    away.goalsFor += awayScore;
    away.goalsAgainst += homeScore;
    const homeWins = scoring.scoreDirection === "higher"
      ? homeScore > awayScore
      : homeScore < awayScore;
    const awayWins = scoring.scoreDirection === "higher"
      ? awayScore > homeScore
      : awayScore < homeScore;
    if (homeWins) {
      home.won += 1;
      away.lost += 1;
      home.points += scoring.winPoints;
      away.points += scoring.lossPoints;
    } else if (awayWins) {
      away.won += 1;
      home.lost += 1;
      away.points += scoring.winPoints;
      home.points += scoring.lossPoints;
    } else {
      home.drawn += 1;
      away.drawn += 1;
      home.points += scoring.drawPoints;
      away.points += scoring.drawPoints;
    }
  }

  const rows = Array.from(table.values()).map((row) => ({
    ...row,
    goalDifference: scoring.scoreDirection === "higher"
      ? row.goalsFor - row.goalsAgainst
      : row.goalsAgainst - row.goalsFor,
  }));
  const headToHead = buildHeadToHead(rows, matches, scoring);

  rows.sort((first, second) => {
    if (second.points !== first.points) return second.points - first.points;
    for (const tieBreaker of scoring.tieBreakers) {
      if (tieBreaker === "headToHead") {
        const firstH2h = headToHead.get(first.participantId) ?? { points: 0, gd: 0 };
        const secondH2h = headToHead.get(second.participantId) ?? { points: 0, gd: 0 };
        if (secondH2h.points !== firstH2h.points) return secondH2h.points - firstH2h.points;
        if (secondH2h.gd !== firstH2h.gd) return secondH2h.gd - firstH2h.gd;
      }
      if (tieBreaker === "scoreDifference" && second.goalDifference !== first.goalDifference) {
        return second.goalDifference - first.goalDifference;
      }
      if (tieBreaker === "scoreFor" && second.goalsFor !== first.goalsFor) {
        return scoring.scoreDirection === "higher"
          ? second.goalsFor - first.goalsFor
          : first.goalsFor - second.goalsFor;
      }
      if (tieBreaker === "wins" && second.won !== first.won) return second.won - first.won;
      if (tieBreaker === "participantOrder") {
        return (participantOrder.get(first.participantId) ?? 0) -
          (participantOrder.get(second.participantId) ?? 0);
      }
    }
    return (participantOrder.get(first.participantId) ?? 0) -
      (participantOrder.get(second.participantId) ?? 0);
  });

  return rows.map((row, index) => ({ ...row, position: index + 1 }));
}

function buildHeadToHead(
  rows: Array<Omit<StandingRow, "position">>,
  matches: Match[],
  scoring: ScoringRules,
) {
  const tiedPointGroups = new Map<number, Set<string>>();
  for (const row of rows) {
    const group = tiedPointGroups.get(row.points) ?? new Set<string>();
    group.add(row.participantId);
    tiedPointGroups.set(row.points, group);
  }
  const result = new Map<string, { points: number; gd: number }>();
  rows.forEach((row) => result.set(row.participantId, { points: 0, gd: 0 }));

  for (const group of tiedPointGroups.values()) {
    if (group.size < 2) continue;
    for (const match of matches) {
      if (
        !match.homeId ||
        !match.awayId ||
        !group.has(match.homeId) ||
        !group.has(match.awayId) ||
        !isMatchPlayed(match)
      ) {
        continue;
      }
      const home = result.get(match.homeId)!;
      const away = result.get(match.awayId)!;
      const homeScore = match.homeScore ?? 0;
      const awayScore = match.awayScore ?? 0;
      const difference = scoring.scoreDirection === "higher"
        ? homeScore - awayScore
        : awayScore - homeScore;
      home.gd += difference;
      away.gd -= difference;
      const homeWins = scoring.scoreDirection === "higher"
        ? homeScore > awayScore
        : homeScore < awayScore;
      const awayWins = scoring.scoreDirection === "higher"
        ? awayScore > homeScore
        : awayScore < homeScore;
      if (homeWins) {
        home.points += scoring.winPoints;
        away.points += scoring.lossPoints;
      }
      else if (awayWins) {
        away.points += scoring.winPoints;
        home.points += scoring.lossPoints;
      }
      else {
        home.points += scoring.drawPoints;
        away.points += scoring.drawPoints;
      }
    }
  }
  return result;
}

function createGroups(participants: Participant[], requestedGroupCount: number) {
  const groupCount = Math.max(
    2,
    Math.min(requestedGroupCount, Math.floor(participants.length / 2)),
  );
  const groups: TournamentGroup[] = Array.from({ length: groupCount }, (_, index) => ({
    id: `group-${String.fromCharCode(97 + index)}`,
    name: `Girone ${String.fromCharCode(65 + index)}`,
    participantIds: [],
  }));
  participants.forEach((participant, index) => {
    const cycle = Math.floor(index / groupCount);
    const offset = index % groupCount;
    const groupIndex = cycle % 2 === 0 ? offset : groupCount - 1 - offset;
    groups[groupIndex].participantIds.push(participant.id);
  });
  return groups;
}

function refreshHybridBracket(tournament: Tournament): Tournament {
  const groupMatches = tournament.matches.filter((match) => match.phase === "group");
  if (groupMatches.some((match) => !isMatchPlayed(match))) return tournament;

  const qualifiedByGroup = tournament.groups.map((group) => {
      const standings = calculateStandings(
        group.participantIds,
        groupMatches.filter((match) => match.groupId === group.id),
        tournament.settings.scoring,
    );
    return standings
      .slice(0, tournament.settings.qualifiersPerGroup)
      .map((row) => row.participantId);
  });
  const seeds = buildHybridSeeds(qualifiedByGroup);
  const existingKnockout = tournament.matches.filter(
    (match) => match.phase === "knockout",
  );
  const sameSeeds =
    tournament.bracketSeedIds.length === seeds.length &&
    tournament.bracketSeedIds.every((id, index) => id === seeds[index]);

  const knockoutMatches = sameSeeds && existingKnockout.length > 0
    ? reconcileBracket(existingKnockout, tournament.settings.scoring.scoreDirection)
    : reconcileBracket(
        generateBracket(seeds, tournament.settings.knockoutLegs, "knockout"),
        tournament.settings.scoring.scoreDirection,
      );

  return {
    ...tournament,
    bracketSeedIds: seeds,
    matches: [...groupMatches, ...knockoutMatches],
  };
}

function buildHybridSeeds(groups: string[][]) {
  if (groups.length === 2 && groups[0].length === 2 && groups[1].length === 2) {
    return [groups[0][0], groups[1][1], groups[1][0], groups[0][1]];
  }
  const maxQualified = Math.max(...groups.map((group) => group.length));
  const seeds: string[] = [];
  for (let rank = 0; rank < maxQualified; rank += 1) {
    groups.forEach((group, groupIndex) => {
      const source = rank % 2 === 0 ? groupIndex : groups.length - 1 - groupIndex;
      const participantId = groups[source]?.[rank];
      if (participantId && !seeds.includes(participantId)) seeds.push(participantId);
    });
  }
  return seeds;
}

export function isTournamentComplete(tournament: Tournament) {
  if (
    tournament.format === "duel" ||
    tournament.format === "scoreboard" ||
    tournament.format === "team-scoreboard"
  ) {
    return tournament.status === "completed";
  }
  if (tournament.format === "league") {
    return tournament.matches.length > 0 && tournament.matches.every(isMatchPlayed);
  }
  const knockoutMatches = tournament.matches.filter(
    (match) => match.phase === "knockout",
  );
  if (knockoutMatches.length === 0) return false;
  const finalRound = Math.max(...knockoutMatches.map((match) => match.round));
  const final = knockoutMatches.find((match) => match.round === finalRound);
  return Boolean(
    final && getMatchWinner(
      final,
      tournament.settings.knockoutLegs === 2,
      tournament.settings.scoring.scoreDirection,
    ),
  );
}

export function tournamentProgress(tournament: Tournament) {
  const groupOrLeagueMatches = tournament.matches.filter(
    (match) => match.phase !== "knockout",
  );
  const knockoutMatches = tournament.matches.filter(
    (match) => match.phase === "knockout",
  );
  const playedGroupOrLeague = groupOrLeagueMatches.filter(isMatchPlayed).length;
  const playedKnockout = knockoutMatches.filter(
    (match) =>
      match.homeId &&
      match.awayId &&
      getMatchWinner(
        match,
        match.twoLegs,
        tournament.settings.scoring.scoreDirection,
      ),
  ).length;

  let total = groupOrLeagueMatches.length;
  if (tournament.format === "knockout") {
    total = Math.max(0, tournament.participants.length - 1);
  }
  if (tournament.format === "hybrid") {
    const qualifierCount = tournament.groups.reduce(
      (sum, group) =>
        sum +
        Math.min(
          group.participantIds.length,
          tournament.settings.qualifiersPerGroup,
        ),
      0,
    );
    total += Math.max(0, qualifierCount - 1);
  }
  const played = playedGroupOrLeague + playedKnockout;
  return {
    played,
    total,
    percentage: total === 0 ? 0 : Math.round((played / total) * 100),
  };
}

export function getChampionId(tournament: Tournament) {
  if (!isTournamentComplete(tournament)) return null;
  if (tournament.format === "scoreboard") {
    return rankScoreboardParticipants(
      tournament.participants,
      tournament.settings.scoring.scoreDirection,
    )[0]?.id ?? null;
  }
  if (tournament.format === "team-scoreboard") return null;
  if (tournament.format === "league" || tournament.format === "duel") {
    return calculateStandings(
      tournament.participants.map((participant) => participant.id),
      tournament.matches,
      tournament.settings.scoring,
    )[0]?.participantId ?? null;
  }
  const knockoutMatches = tournament.matches.filter(
    (match) => match.phase === "knockout",
  );
  const finalRound = Math.max(...knockoutMatches.map((match) => match.round));
  const final = knockoutMatches.find((match) => match.round === finalRound);
  return final
    ? getMatchWinner(
        final,
        tournament.settings.knockoutLegs === 2,
        tournament.settings.scoring.scoreDirection,
      )
    : null;
}

export function compareRankedScores(
  first: number,
  second: number,
  direction: ScoreDirection,
) {
  return direction === "higher" ? second - first : first - second;
}

export function rankScoreboardParticipants(
  participants: Participant[],
  direction: ScoreDirection,
) {
  return [...participants].sort(
    (first, second) =>
      compareRankedScores(first.score ?? 0, second.score ?? 0, direction) ||
      first.name.localeCompare(second.name, "it", { sensitivity: "base" }),
  );
}

export function calculateTeamStandings(
  participants: Participant[],
  direction: ScoreDirection,
): TeamStandingRow[] {
  const teamMap = new Map<string, { name: string; participants: Participant[] }>();
  for (const participant of participants) {
    const teamName = participant.teamName?.trim() || "Senza squadra";
    const teamKey = teamName.toLocaleLowerCase("it");
    const current = teamMap.get(teamKey);
    teamMap.set(teamKey, {
      name: current?.name ?? teamName,
      participants: [...(current?.participants ?? []), participant],
    });
  }

  return Array.from(teamMap.values(), ({ name, participants: teamParticipants }) => ({
    name,
    participants: rankScoreboardParticipants(teamParticipants, direction),
    total: teamParticipants.reduce(
      (sum, participant) => sum + (participant.score ?? 0),
      0,
    ),
  }))
    .sort(
      (first, second) =>
        compareRankedScores(first.total, second.total, direction) ||
        first.name.localeCompare(second.name, "it", { sensitivity: "base" }),
    )
    .map((team, index) => ({ ...team, position: index + 1 }));
}
