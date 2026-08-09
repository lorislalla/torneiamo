import { describe, expect, it, vi } from "vitest";
import type {
  Match,
  Participant,
  ScoringRules,
  Tournament,
} from "./types";
import {
  calculateStandings,
  calculateTeamStandings,
  completeScoreboardTournament,
  compareRankedScores,
  createTournament,
  DEFAULT_SCORING_RULES,
  generateBracket,
  generateRoundRobin,
  getChampionId,
  getScoreboardLeaderIds,
  getMatchWinner,
  isMatchPlayed,
  isTournamentComplete,
  normalizeTournament,
  rankScoreboardParticipants,
  rankTournamentScoreboardParticipants,
  reconcileBracket,
  setTournamentStatus,
  tournamentProgress,
  updateMatchScore,
  updateParticipantScore,
  addScoreboardRound,
  updateScoreboardRoundScore,
  updateTournamentName,
  updateTournamentScoringRules,
} from "./tournament-engine";

function rules(overrides: Partial<ScoringRules> = {}): ScoringRules {
  return {
    ...DEFAULT_SCORING_RULES,
    tieBreakers: [...DEFAULT_SCORING_RULES.tieBreakers],
    ...overrides,
  };
}

function match(
  homeId: string | null,
  awayId: string | null,
  homeScore: number | null,
  awayScore: number | null,
  overrides: Partial<Match> = {},
): Match {
  return {
    id: overrides.id ?? `${homeId ?? "bye"}-${awayId ?? "bye"}`,
    phase: "league",
    round: 1,
    roundLabel: "Giornata 1",
    homeId,
    awayId,
    homeScore,
    awayScore,
    returnHomeScore: null,
    returnAwayScore: null,
    winnerOverrideId: null,
    twoLegs: false,
    ...overrides,
  };
}

function participant(
  id: string,
  name: string,
  score?: number,
  teamName?: string,
): Participant {
  return {
    id,
    name,
    accent: "#fff",
    ...(score === undefined ? {} : { score }),
    ...(teamName === undefined ? {} : { teamName }),
  };
}

function create(format: Tournament["format"], names: string[], settings = {}) {
  return createTournament({
    name: "Torneo test",
    format,
    participants: names.map((name) => ({ name })),
    settings: {
      shuffleParticipants: false,
      ...settings,
    },
  });
}

describe("generazione del calendario all'italiana", () => {
  for (const participantCount of Array.from({ length: 15 }, (_, index) => index + 2)) {
    for (const legs of [1, 2] as const) {
      it(`genera tutte e sole le coppie con ${participantCount} partecipanti e ${legs} gir${legs === 1 ? "one" : "oni"}`, () => {
        const ids = Array.from(
          { length: participantCount },
          (_, index) => `p${index + 1}`,
        );
        const matches = generateRoundRobin(ids, legs, "league");
        const expectedMatchCount = (participantCount * (participantCount - 1) / 2) * legs;

        expect(matches).toHaveLength(expectedMatchCount);
        expect(new Set(matches.map((item) => item.id)).size).toBe(matches.length);

        const pairCounts = new Map<string, number>();
        const participantMatches = new Map(ids.map((id) => [id, 0]));
        const rounds = new Map<number, Set<string>>();

        for (const item of matches) {
          expect(item.homeId).not.toBe(item.awayId);
          expect(item.homeId).not.toBeNull();
          expect(item.awayId).not.toBeNull();
          const pair = [item.homeId!, item.awayId!].sort().join("-");
          pairCounts.set(pair, (pairCounts.get(pair) ?? 0) + 1);
          participantMatches.set(
            item.homeId!,
            (participantMatches.get(item.homeId!) ?? 0) + 1,
          );
          participantMatches.set(
            item.awayId!,
            (participantMatches.get(item.awayId!) ?? 0) + 1,
          );

          const roundParticipants = rounds.get(item.round) ?? new Set<string>();
          expect(roundParticipants.has(item.homeId!)).toBe(false);
          expect(roundParticipants.has(item.awayId!)).toBe(false);
          roundParticipants.add(item.homeId!);
          roundParticipants.add(item.awayId!);
          rounds.set(item.round, roundParticipants);
        }

        expect(pairCounts.size).toBe(participantCount * (participantCount - 1) / 2);
        expect([...pairCounts.values()].every((count) => count === legs)).toBe(true);
        expect(
          [...participantMatches.values()].every(
            (count) => count === (participantCount - 1) * legs,
          ),
        ).toBe(true);
      });
    }
  }

  it("inverte casa e trasferta nel girone di ritorno", () => {
    const firstLeg = generateRoundRobin(["a", "b", "c", "d"], 1, "league");
    const twoLegs = generateRoundRobin(["a", "b", "c", "d"], 2, "league");

    expect(twoLegs.slice(0, firstLeg.length)).toEqual(firstLeg);
    twoLegs.slice(firstLeg.length).forEach((returnMatch, index) => {
      expect(returnMatch.homeId).toBe(firstLeg[index].awayId);
      expect(returnMatch.awayId).toBe(firstLeg[index].homeId);
      expect(returnMatch.round).toBe(firstLeg[index].round + 3);
    });
  });
});

describe("calcolo delle classifiche", () => {
  it("calcola presenze, esiti, punti e differenza con le regole standard", () => {
    const standings = calculateStandings(
      ["a", "b", "c"],
      [
        match("a", "b", 3, 1),
        match("a", "c", 2, 2, { id: "a-c" }),
        match("b", "c", 0, 1, { id: "b-c" }),
      ],
    );

    expect(standings.map((row) => row.participantId)).toEqual(["a", "c", "b"]);
    expect(standings[0]).toEqual({
      participantId: "a",
      played: 2,
      won: 1,
      drawn: 1,
      lost: 0,
      goalsFor: 5,
      goalsAgainst: 3,
      goalDifference: 2,
      points: 4,
      position: 1,
    });
    expect(standings[1]).toMatchObject({
      participantId: "c",
      played: 2,
      won: 1,
      drawn: 1,
      lost: 0,
      points: 4,
    });
    expect(standings[2]).toMatchObject({
      participantId: "b",
      played: 2,
      won: 0,
      drawn: 0,
      lost: 2,
      points: 0,
    });
  });

  it("supporta punteggi personalizzati, valori negativi e vittoria col valore minore", () => {
    const standings = calculateStandings(
      ["a", "b", "c"],
      [
        match("a", "b", 1, 5),
        match("a", "c", 4, 4, { id: "a-c" }),
        match("b", "c", -2, 3, { id: "b-c" }),
      ],
      rules({
        winPoints: 5,
        drawPoints: 2,
        lossPoints: -1,
        scoreDirection: "lower",
      }),
    );

    expect(standings.map((row) => [row.participantId, row.points])).toEqual([
      ["a", 7],
      ["b", 4],
      ["c", 1],
    ]);
    expect(standings[0]).toMatchObject({
      goalsFor: 5,
      goalsAgainst: 9,
      goalDifference: 4,
      won: 1,
      drawn: 1,
    });
    expect(standings[1]).toMatchObject({
      goalsFor: 3,
      goalsAgainst: 4,
      goalDifference: 1,
      won: 1,
      lost: 1,
    });
  });

  it("ignora partite incomplete, bye e partecipanti estranei alla classifica", () => {
    const standings = calculateStandings(
      ["a", "b"],
      [
        match("a", "b", null, null),
        match("a", null, 5, 0, { id: "bye" }),
        match("a", "outsider", 2, 0, { id: "outsider" }),
      ],
    );

    expect(standings).toEqual([
      expect.objectContaining({ participantId: "a", played: 0, points: 0 }),
      expect.objectContaining({ participantId: "b", played: 0, points: 0 }),
    ]);
  });

  it("usa lo scontro diretto tra due partecipanti a pari punti", () => {
    const standings = calculateStandings(
      ["b", "a", "c", "d"],
      [
        match("a", "b", 1, 0),
        match("c", "a", 1, 0, { id: "c-a" }),
        match("b", "c", 1, 0, { id: "b-c" }),
        match("c", "d", 1, 0, { id: "c-d" }),
      ],
      rules({ tieBreakers: ["headToHead", "participantOrder"] }),
    );

    expect(standings.map((row) => row.participantId)).toEqual(["c", "a", "b", "d"]);
  });

  it("calcola una mini-classifica negli scontri diretti a tre", () => {
    const standings = calculateStandings(
      ["c", "b", "a", "d"],
      [
        match("a", "b", 2, 0),
        match("b", "c", 3, 0, { id: "b-c" }),
        match("c", "a", 1, 0, { id: "c-a" }),
        match("a", "d", 1, 0, { id: "a-d" }),
        match("b", "d", 5, 0, { id: "b-d" }),
        match("c", "d", 10, 0, { id: "c-d" }),
      ],
      rules({ tieBreakers: ["headToHead", "scoreDifference"] }),
    );

    expect(standings.map((row) => row.participantId)).toEqual(["b", "a", "c", "d"]);
  });

  it("rispetta l'ordine configurato tra punteggio segnato e differenza", () => {
    const matches = [
      match("a", "c", 10, 9),
      match("b", "d", 2, 0, { id: "b-d" }),
    ];

    const scoreForFirst = calculateStandings(
      ["a", "b", "c", "d"],
      matches,
      rules({ tieBreakers: ["scoreFor", "scoreDifference", "participantOrder"] }),
    );
    const differenceFirst = calculateStandings(
      ["a", "b", "c", "d"],
      matches,
      rules({ tieBreakers: ["scoreDifference", "scoreFor", "participantOrder"] }),
    );

    expect(scoreForFirst.slice(0, 2).map((row) => row.participantId)).toEqual(["a", "b"]);
    expect(differenceFirst.slice(0, 2).map((row) => row.participantId)).toEqual(["b", "a"]);
  });

  it("usa il numero di vittorie prima dell'ordine di inserimento", () => {
    const standings = calculateStandings(
      ["b", "a", "c", "d"],
      [
        match("a", "c", 1, 0),
        match("b", "c", 0, 0, { id: "b-c" }),
        match("b", "d", 0, 0, { id: "b-d" }),
      ],
      rules({
        winPoints: 2,
        drawPoints: 1,
        tieBreakers: ["wins", "participantOrder"],
      }),
    );

    expect(standings.slice(0, 2).map((row) => row.participantId)).toEqual(["a", "b"]);
  });

  it("usa l'ordine dei partecipanti come ultimo spareggio stabile", () => {
    const standings = calculateStandings(
      ["c", "a", "b"],
      [],
      rules({ tieBreakers: ["participantOrder"] }),
    );

    expect(standings.map((row) => row.participantId)).toEqual(["c", "a", "b"]);
    expect(standings.map((row) => row.position)).toEqual([1, 2, 3]);
  });

  it("interpreta correttamente gli spareggi anche col punteggio minore", () => {
    const matches = [
      match("a", "c", 1, 4),
      match("b", "d", -2, 0, { id: "b-d" }),
    ];
    const byDifference = calculateStandings(
      ["a", "b", "c", "d"],
      matches,
      rules({
        scoreDirection: "lower",
        tieBreakers: ["scoreDifference", "participantOrder"],
      }),
    );
    const byScoreFor = calculateStandings(
      ["a", "b", "c", "d"],
      matches,
      rules({
        scoreDirection: "lower",
        tieBreakers: ["scoreFor", "participantOrder"],
      }),
    );

    expect(byDifference.slice(0, 2).map((row) => row.participantId)).toEqual(["a", "b"]);
    expect(byScoreFor.slice(0, 2).map((row) => row.participantId)).toEqual(["b", "a"]);
  });

  it("applica lo scontro diretto anche quando vince il risultato minore", () => {
    const standings = calculateStandings(
      ["b", "a", "c", "d"],
      [
        match("a", "b", 1, 5),
        match("c", "a", 1, 5, { id: "c-a" }),
        match("b", "c", 1, 5, { id: "b-c" }),
        match("c", "d", 1, 5, { id: "c-d" }),
      ],
      rules({
        scoreDirection: "lower",
        tieBreakers: ["headToHead", "participantOrder"],
      }),
    );

    expect(standings.map((row) => row.participantId)).toEqual(["c", "a", "b", "d"]);
  });

  for (const direction of ["higher", "lower"] as const) {
    it(`mantiene gli invarianti matematici su calendari completi (${direction})`, () => {
      for (let participantCount = 2; participantCount <= 8; participantCount += 1) {
        const ids = Array.from(
          { length: participantCount },
          (_, index) => `p${index + 1}`,
        );
        const matches = generateRoundRobin(ids, 2, "league").map((item, index) => ({
          ...item,
          homeScore: (index * 7) % 9 - 3,
          awayScore: (index * 5) % 9 - 3,
        }));
        const scoring = rules({
          winPoints: 5,
          drawPoints: 2,
          lossPoints: -1,
          scoreDirection: direction,
        });
        const standings = calculateStandings(ids, matches, scoring);
        const decisiveMatches = matches.filter(
          (item) => item.homeScore !== item.awayScore,
        ).length;
        const drawnMatches = matches.length - decisiveMatches;

        expect(standings.reduce((sum, row) => sum + row.played, 0)).toBe(matches.length * 2);
        expect(standings.reduce((sum, row) => sum + row.won, 0)).toBe(decisiveMatches);
        expect(standings.reduce((sum, row) => sum + row.lost, 0)).toBe(decisiveMatches);
        expect(standings.reduce((sum, row) => sum + row.drawn, 0)).toBe(drawnMatches * 2);
        expect(standings.reduce((sum, row) => sum + row.goalsFor, 0)).toBe(
          standings.reduce((sum, row) => sum + row.goalsAgainst, 0),
        );
        expect(standings.reduce((sum, row) => sum + row.goalDifference, 0)).toBe(0);
        expect(standings.reduce((sum, row) => sum + row.points, 0)).toBe(
          decisiveMatches * (scoring.winPoints + scoring.lossPoints) +
            drawnMatches * scoring.drawPoints * 2,
        );
      }
    });
  }
});

describe("vincitore di una sfida", () => {
  it("risolve i bye del primo turno su entrambi i lati", () => {
    expect(getMatchWinner(match("a", null, null, null), false)).toBe("a");
    expect(getMatchWinner(match(null, "b", null, null), false)).toBe("b");
  });

  it("non decide partite senza partecipanti o risultato completo", () => {
    expect(getMatchWinner(match(null, null, null, null), false)).toBeNull();
    expect(getMatchWinner(match("a", "b", 1, null), false)).toBeNull();
  });

  it("sceglie il valore maggiore o minore in base alla regola", () => {
    const played = match("a", "b", -2, 4);
    expect(getMatchWinner(played, false, "higher")).toBe("b");
    expect(getMatchWinner(played, false, "lower")).toBe("a");
  });

  it("richiede uno spareggio esplicito in caso di parità", () => {
    const tied = match("a", "b", 2, 2);
    expect(getMatchWinner(tied, false)).toBeNull();
    expect(
      getMatchWinner({ ...tied, winnerOverrideId: "b" }, false),
    ).toBe("b");
  });

  it("somma correttamente andata e ritorno invertendo casa e trasferta", () => {
    const twoLegged = match("a", "b", 2, 0, {
      twoLegs: true,
      returnHomeScore: 3,
      returnAwayScore: 0,
    });

    expect(getMatchWinner(twoLegged, true, "higher")).toBe("b");
    expect(getMatchWinner(twoLegged, true, "lower")).toBe("a");
    expect(
      getMatchWinner({ ...twoLegged, returnAwayScore: null }, true),
    ).toBeNull();
  });

  it("usa lo spareggio sull'aggregato in parità", () => {
    const tied = match("a", "b", 2, 0, {
      twoLegs: true,
      returnHomeScore: 3,
      returnAwayScore: 1,
      winnerOverrideId: "a",
    });

    expect(getMatchWinner(tied, true)).toBe("a");
  });
});

describe("tabellone a eliminazione", () => {
  for (let participantCount = 2; participantCount <= 16; participantCount += 1) {
    it(`crea un tabellone coerente per ${participantCount} partecipanti`, () => {
      const ids = Array.from(
        { length: participantCount },
        (_, index) => `p${index + 1}`,
      );
      const bracket = generateBracket(ids, 1);
      const bracketSize = 2 ** Math.ceil(Math.log2(participantCount));
      const firstRound = bracket.filter((item) => item.round === 1);
      const firstRoundParticipants = firstRound.flatMap((item) =>
        [item.homeId, item.awayId].filter(Boolean),
      );

      expect(bracket).toHaveLength(bracketSize - 1);
      expect(firstRound).toHaveLength(bracketSize / 2);
      expect(firstRound.filter((item) => !item.homeId || !item.awayId)).toHaveLength(
        bracketSize - participantCount,
      );
      expect(firstRoundParticipants).toHaveLength(participantCount);
      expect(new Set(firstRoundParticipants).size).toBe(participantCount);
      expect(bracket.at(-1)?.roundLabel).toBe("Finale");
    });
  }

  it("propaga bye e vincitori fino alla finale", () => {
    let bracket = reconcileBracket(generateBracket(["a", "b", "c", "d", "e"], 1));
    const firstRound = bracket.filter((item) => item.round === 1);
    const playedFirstRound = firstRound.find((item) => item.homeId && item.awayId)!;
    bracket = bracket.map((item) =>
      item.id === playedFirstRound.id
        ? { ...item, homeScore: 0, awayScore: 1 }
        : item,
    );
    bracket = reconcileBracket(bracket);

    const secondRound = bracket.filter((item) => item.round === 2);
    expect(secondRound.every((item) => item.homeId && item.awayId)).toBe(true);
    expect(secondRound.flatMap((item) => [item.homeId, item.awayId])).toContain(
      playedFirstRound.awayId,
    );
  });

  it("conserva i risultati a valle se gli stessi partecipanti restano qualificati", () => {
    let bracket = generateBracket(["a", "b", "c", "d"], 1);
    bracket = bracket.map((item) => {
      if (item.id === "knockout-r1-m1") return { ...item, homeScore: 2, awayScore: 0 };
      if (item.id === "knockout-r1-m2") return { ...item, homeScore: 0, awayScore: 3 };
      return item;
    });
    bracket = reconcileBracket(bracket);
    bracket = bracket.map((item) =>
      item.round === 2 ? { ...item, homeScore: 1, awayScore: 0 } : item,
    );
    bracket = reconcileBracket(bracket);

    expect(bracket.find((item) => item.round === 2)).toMatchObject({
      homeId: "a",
      awayId: "d",
      homeScore: 1,
      awayScore: 0,
    });
  });

  it("cancella i risultati a valle quando cambia un qualificato", () => {
    let bracket = generateBracket(["a", "b", "c", "d"], 1);
    bracket = bracket.map((item) => {
      if (item.id === "knockout-r1-m1") return { ...item, homeScore: 2, awayScore: 0 };
      if (item.id === "knockout-r1-m2") return { ...item, homeScore: 0, awayScore: 3 };
      return item;
    });
    bracket = reconcileBracket(bracket).map((item) =>
      item.round === 2 ? { ...item, homeScore: 1, awayScore: 0 } : item,
    );
    bracket = bracket.map((item) =>
      item.id === "knockout-r1-m1"
        ? { ...item, homeScore: 0, awayScore: 2 }
        : item,
    );
    bracket = reconcileBracket(bracket);

    expect(bracket.find((item) => item.round === 2)).toMatchObject({
      homeId: "b",
      awayId: "d",
      homeScore: null,
      awayScore: null,
    });
  });
});

describe("ciclo di vita dei tornei", () => {
  it("applica il sorteggio predefinito senza perdere partecipanti", () => {
    const random = vi.spyOn(Math, "random").mockReturnValue(0);
    const tournament = createTournament({
      name: "Sorteggio",
      format: "league",
      participants: [{ name: "A" }, { name: "B" }, { name: "C" }],
    });

    expect(tournament.participants).toHaveLength(3);
    expect(tournament.matches).toHaveLength(3);
    random.mockRestore();
  });

  it("crea dati puliti, impostazioni annidate e punteggi iniziali", () => {
    const tournament = createTournament({
      name: "  Serata giochi  ",
      format: "team-scoreboard",
      participants: [
        { name: "  Ada  ", teamName: "  Rosso  " },
        { name: "Bea", teamName: "Rosso" },
      ],
      settings: {
        shuffleParticipants: false,
        scoring: rules({ scoreDirection: "lower" }),
      },
    });

    expect(tournament.name).toBe("Serata giochi");
    expect(tournament.participants[0]).toMatchObject({
      name: "Ada",
      teamName: "Rosso",
      score: 0,
    });
    expect(tournament.settings).toMatchObject({
      leagueLegs: 1,
      knockoutLegs: 1,
      scoring: expect.objectContaining({ scoreDirection: "lower", winPoints: 3 }),
    });
  });

  it("completa automaticamente un campionato e individua il campione", () => {
    let tournament = create("league", ["A", "B", "C"]);
    const [a] = tournament.participants;
    tournament.matches.forEach((item) => {
      const homeWins = item.homeId === a.id;
      tournament = updateMatchScore(tournament, item.id, {
        homeScore: homeWins ? 2 : 0,
        awayScore: homeWins ? 0 : 2,
      });
    });

    expect(tournament.status).toBe("completed");
    expect(isTournamentComplete(tournament)).toBe(true);
    expect(getChampionId(tournament)).toBe(a.id);
    expect(tournamentProgress(tournament)).toEqual({
      played: 3,
      total: 3,
      percentage: 100,
    });
  });

  it("registra la data di fine automatica e la rimuove quando il torneo viene riaperto", () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-07-21T10:00:00.000Z"));
      let tournament = create("league", ["A", "B"]);
      vi.setSystemTime(new Date("2026-07-21T12:00:00.000Z"));
      tournament = updateMatchScore(tournament, tournament.matches[0].id, {
        homeScore: 2,
        awayScore: 1,
      });

      expect(tournament.completedAt).toBe("2026-07-21T12:00:00.000Z");

      vi.setSystemTime(new Date("2026-07-21T13:00:00.000Z"));
      tournament = updateMatchScore(tournament, tournament.matches[0].id, {
        homeScore: null,
        awayScore: null,
      });
      expect(tournament.status).toBe("active");
      expect(tournament.completedAt).toBeUndefined();
    } finally {
      vi.useRealTimers();
    }
  });

  it("rinomina il torneo preservando i dati e aggiornando la modifica", () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-07-22T09:30:00.000Z"));
      const tournament = create("scoreboard", ["A", "B"]);
      const renamed = updateTournamentName(tournament, "  Fifa 27  ");

      expect(renamed).not.toBe(tournament);
      expect(renamed.name).toBe("Fifa 27");
      expect(renamed.updatedAt).toBe("2026-07-22T09:30:00.000Z");
      expect(renamed.participants).toBe(tournament.participants);
      expect(updateTournamentName(renamed, "   ")).toBe(renamed);
      expect(updateTournamentName(renamed, "Fifa 27")).toBe(renamed);
    } finally {
      vi.useRealTimers();
    }
  });

  it("gestisce una serie a due aperta, alternando casa e trasferta", () => {
    let tournament = create("duel", ["A", "B"]);
    const [a, b] = tournament.participants;
    expect(tournament.matches[0]).toMatchObject({ homeId: a.id, awayId: b.id });

    tournament = updateMatchScore(tournament, tournament.matches[0].id, {
      homeScore: 3,
      awayScore: 1,
    });
    expect(tournament.matches).toHaveLength(2);
    expect(tournament.matches[1]).toMatchObject({ homeId: b.id, awayId: a.id });

    tournament = updateMatchScore(tournament, tournament.matches[1].id, {
      homeScore: 0,
      awayScore: 2,
    });
    expect(tournament.matches).toHaveLength(3);
    expect(tournament.matches[2]).toMatchObject({ homeId: a.id, awayId: b.id });

    tournament = updateMatchScore(tournament, tournament.matches[0].id, {
      homeScore: null,
      awayScore: null,
    });
    expect(tournament.matches).toHaveLength(2);

    tournament = updateMatchScore(tournament, tournament.matches[0].id, {
      homeScore: 3,
      awayScore: 1,
    });
    expect(tournament.matches).toHaveLength(3);

    tournament = setTournamentStatus(tournament, "completed");
    expect(tournament.matches).toHaveLength(2);
    expect(tournament.status).toBe("completed");
    expect(getChampionId(tournament)).toBe(a.id);

    tournament = setTournamentStatus(tournament, "active");
    expect(tournament.matches).toHaveLength(3);
    expect(tournament.matches.at(-1)?.homeScore).toBeNull();
  });

  it("non aggiunge sfide a un duello concluso quando si modifica un risultato", () => {
    let tournament = create("duel", ["A", "B"]);
    tournament = updateMatchScore(tournament, tournament.matches[0].id, {
      homeScore: 2,
      awayScore: 1,
    });
    tournament = setTournamentStatus(tournament, "completed");
    tournament = updateMatchScore(tournament, tournament.matches[0].id, {
      homeScore: 3,
      awayScore: 1,
    });

    expect(tournament.matches).toHaveLength(1);
    expect(tournament.status).toBe("completed");
  });

  it("decide una finale con andata e ritorno e aggiorna il campione cambiando direzione", () => {
    let tournament = create("knockout", ["A", "B"], { knockoutLegs: 2 });
    const final = tournament.matches[0];
    const homeId = final.homeId;
    const awayId = final.awayId;
    tournament = updateMatchScore(tournament, final.id, {
      homeScore: 2,
      awayScore: 0,
    });
    expect(tournament.status).toBe("active");
    expect(tournamentProgress(tournament)).toEqual({
      played: 0,
      total: 1,
      percentage: 0,
    });

    tournament = updateMatchScore(tournament, final.id, {
      homeScore: 2,
      awayScore: 0,
      returnHomeScore: 3,
      returnAwayScore: 0,
    });

    expect(tournament.status).toBe("completed");
    expect(getChampionId(tournament)).toBe(awayId);

    tournament = updateTournamentScoringRules(
      tournament,
      rules({ scoreDirection: "lower" }),
    );
    expect(tournament.status).toBe("completed");
    expect(getChampionId(tournament)).toBe(homeId);
  });

  it("ricalcola e pulisce il tabellone quando cambia la direzione del punteggio", () => {
    let tournament = create("knockout", ["A", "B", "C", "D"]);
    const semifinals = tournament.matches.filter((item) => item.round === 1);
    for (const semifinal of semifinals) {
      tournament = updateMatchScore(tournament, semifinal.id, {
        homeScore: 3,
        awayScore: 1,
      });
    }
    const oldFinal = tournament.matches.find((item) => item.round === 2)!;
    tournament = updateMatchScore(tournament, oldFinal.id, {
      homeScore: 4,
      awayScore: 2,
    });
    expect(tournament.status).toBe("completed");

    tournament = updateTournamentScoringRules(
      tournament,
      rules({ scoreDirection: "lower" }),
    );
    const newFinal = tournament.matches.find((item) => item.round === 2)!;

    expect(newFinal.homeId).toBe(semifinals[0].awayId);
    expect(newFinal.awayId).toBe(semifinals[1].awayId);
    expect(newFinal.homeScore).toBeNull();
    expect(newFinal.awayScore).toBeNull();
    expect(tournament.status).toBe("active");
  });

  it("genera playoff incrociati dopo il completamento dei gironi", () => {
    let tournament = create("hybrid", ["A", "B", "C", "D", "E", "F", "G", "H"], {
      groupCount: 2,
      qualifiersPerGroup: 2,
    });
    const [groupA, groupB] = tournament.groups;
    const ranks = new Map<string, number>();
    tournament.groups.forEach((group) =>
      group.participantIds.forEach((id, index) => ranks.set(id, index)),
    );
    const groupMatches = [...tournament.matches];
    for (const item of groupMatches) {
      const homeWins = ranks.get(item.homeId!)! < ranks.get(item.awayId!)!;
      tournament = updateMatchScore(tournament, item.id, {
        homeScore: homeWins ? 10 : 0,
        awayScore: homeWins ? 0 : 10,
      });
    }

    expect(tournament.bracketSeedIds).toEqual([
      groupA.participantIds[0],
      groupB.participantIds[1],
      groupB.participantIds[0],
      groupA.participantIds[1],
    ]);
    expect(tournament.matches.filter((item) => item.phase === "knockout")).toHaveLength(3);
    expect(tournamentProgress(tournament)).toEqual({
      played: 12,
      total: 15,
      percentage: 80,
    });

    for (const semifinal of tournament.matches.filter(
      (item) => item.phase === "knockout" && item.round === 1,
    )) {
      tournament = updateMatchScore(tournament, semifinal.id, {
        homeScore: 1,
        awayScore: 0,
      });
    }
    const final = tournament.matches.find(
      (item) => item.phase === "knockout" && item.round === 2,
    )!;
    tournament = updateMatchScore(tournament, final.id, {
      homeScore: 0,
      awayScore: 2,
    });

    expect(tournament.status).toBe("completed");
    expect(getChampionId(tournament)).toBe(final.awayId);
    expect(tournamentProgress(tournament).percentage).toBe(100);
  });

  it("genera i seed playoff generici con tre gironi", () => {
    let tournament = create("hybrid", ["A", "B", "C", "D", "E", "F"], {
      groupCount: 3,
      qualifiersPerGroup: 1,
    });
    const expectedWinners = tournament.groups.map((group) => group.participantIds[0]);
    for (const item of [...tournament.matches]) {
      const homeWins = expectedWinners.includes(item.homeId!);
      tournament = updateMatchScore(tournament, item.id, {
        homeScore: homeWins ? 2 : 0,
        awayScore: homeWins ? 0 : 2,
      });
    }

    expect(tournament.bracketSeedIds).toEqual(expectedWinners);
    expect(tournament.matches.filter((item) => item.phase === "knockout")).toHaveLength(3);
    expect(tournamentProgress(tournament)).toEqual({
      played: 3,
      total: 5,
      percentage: 60,
    });

    tournament = updateTournamentScoringRules(
      tournament,
      rules({ scoreDirection: "lower" }),
    );
    expect(tournament.bracketSeedIds).toEqual(
      tournament.groups.map((group) => group.participantIds[1]),
    );
    expect(tournament.status).toBe("active");
  });

  it("calcola l'avanzamento a eliminazione senza contare i bye come sfide", () => {
    let tournament = create("knockout", ["A", "B", "C"]);
    expect(tournamentProgress(tournament)).toEqual({
      played: 0,
      total: 2,
      percentage: 0,
    });

    const semifinal = tournament.matches.find(
      (item) => item.round === 1 && item.homeId && item.awayId,
    )!;
    tournament = updateMatchScore(tournament, semifinal.id, {
      homeScore: 1,
      awayScore: 0,
    });
    expect(tournamentProgress(tournament)).toEqual({
      played: 1,
      total: 2,
      percentage: 50,
    });

    const final = tournament.matches.find((item) => item.round === 2)!;
    tournament = updateMatchScore(tournament, final.id, {
      homeScore: 0,
      awayScore: 1,
    });
    expect(tournamentProgress(tournament)).toEqual({
      played: 2,
      total: 2,
      percentage: 100,
    });
  });

  it("limita il numero dei gironi affinché contengano almeno due persone", () => {
    const tournament = create("hybrid", ["A", "B", "C", "D", "E"], {
      groupCount: 4,
    });

    expect(tournament.groups).toHaveLength(2);
    expect(tournament.groups.map((group) => group.participantIds.length).sort()).toEqual([2, 3]);
  });
});

describe("classifiche libere e a squadre", () => {
  it("ordina punteggi positivi, nulli e negativi in entrambe le direzioni", () => {
    const participants = [
      participant("a", "Ada", 12),
      participant("b", "Bea", -4),
      participant("c", "Carlo", 0),
    ];

    expect(rankScoreboardParticipants(participants, "higher").map((item) => item.id)).toEqual([
      "a",
      "c",
      "b",
    ]);
    expect(rankScoreboardParticipants(participants, "lower").map((item) => item.id)).toEqual([
      "b",
      "c",
      "a",
    ]);
    expect(participants.map((item) => item.id)).toEqual(["a", "b", "c"]);
  });

  it("risolve una parità alfabeticamente e considera zero i punteggi assenti", () => {
    const participants = [
      participant("z", "Zoe"),
      participant("a", "Ada", 0),
    ];

    expect(rankScoreboardParticipants(participants, "higher").map((item) => item.id)).toEqual([
      "a",
      "z",
    ]);
  });

  it("aggiorna, conclude manualmente e individua il vincitore della classifica libera", () => {
    let tournament = create("scoreboard", ["Ada", "Bea", "Carlo"]);
    tournament = updateParticipantScore(tournament, tournament.participants[0].id, -11);
    tournament = updateParticipantScore(tournament, tournament.participants[1].id, 56);
    tournament = updateParticipantScore(tournament, tournament.participants[2].id, 7);

    expect(tournament.status).toBe("active");
    expect(isTournamentComplete(tournament)).toBe(false);
    tournament = setTournamentStatus(tournament, "completed");
    expect(getChampionId(tournament)).toBe(tournament.participants[1].id);

    tournament = updateTournamentScoringRules(
      tournament,
      rules({ scoreDirection: "lower" }),
    );
    expect(tournament.status).toBe("active");
    tournament = setTournamentStatus(tournament, "completed");
    expect(getChampionId(tournament)).toBe(tournament.participants[0].id);
  });

  it("somma i punteggi individuali e ordina squadre e membri", () => {
    const participants = [
      participant("r1", "Zoe", 5, " Rosso "),
      participant("r2", "Ada", -3, "rosso"),
      participant("b1", "Carlo", 0, "Blu"),
      participant("b2", "Bea", 1, "Blu"),
    ];

    const higher = calculateTeamStandings(participants, "higher");
    const lower = calculateTeamStandings(participants, "lower");

    expect(higher.map((team) => [team.name, team.total, team.position])).toEqual([
      ["Rosso", 2, 1],
      ["Blu", 1, 2],
    ]);
    expect(higher[0].participants.map((item) => item.id)).toEqual(["r1", "r2"]);
    expect(lower.map((team) => [team.name, team.total])).toEqual([
      ["Blu", 1],
      ["Rosso", 2],
    ]);
    expect(lower[1].participants.map((item) => item.id)).toEqual(["r2", "r1"]);
  });

  it("raggruppa chi non ha squadra e risolve i totali pari per nome", () => {
    const standings = calculateTeamStandings(
      [
        participant("z", "Zoe", 3),
        participant("b", "Bea", 3, "Beta"),
        participant("a", "Ada", 3, "Alfa"),
      ],
      "higher",
    );

    expect(standings.map((team) => team.name)).toEqual(["Alfa", "Beta", "Senza squadra"]);
  });

  it("mantiene manuale lo stato delle classifiche a squadre e non inventa un ID campione", () => {
    let tournament = createTournament({
      name: "Squadre",
      format: "team-scoreboard",
      participants: [
        { name: "A", teamName: "Rosso" },
        { name: "B", teamName: "Rosso" },
        { name: "C", teamName: "Blu" },
        { name: "D", teamName: "Blu" },
      ],
      settings: { shuffleParticipants: false },
    });
    tournament = updateParticipantScore(tournament, tournament.participants[0].id, 10);
    tournament = setTournamentStatus(tournament, "completed");

    expect(isTournamentComplete(tournament)).toBe(true);
    expect(getChampionId(tournament)).toBeNull();
    expect(calculateTeamStandings(tournament.participants, "higher")[0].name).toBe("Rosso");
  });
});

describe("compatibilità, immutabilità e funzioni di supporto", () => {
  it("normalizza tornei precedenti privi delle nuove impostazioni", () => {
    const current = create("scoreboard", ["A", "B"]);
    const legacy = {
      ...current,
      participants: current.participants.map((item) => ({
        id: item.id,
        name: item.name,
        accent: item.accent,
        ...(item.teamName ? { teamName: item.teamName } : {}),
      })),
      settings: {
        leagueLegs: 1,
        knockoutLegs: 1,
        groupCount: 2,
        qualifiersPerGroup: 2,
        shuffleParticipants: false,
      },
      scoreboardRounds: undefined,
    } as unknown as Tournament;

    const normalized = normalizeTournament(legacy);

    expect(normalized.participants.every((item) => item.score === 0)).toBe(true);
    expect(normalized.settings.scoring).toEqual(DEFAULT_SCORING_RULES);
    expect(normalized.scoreboardRounds).toHaveLength(1);
    expect(normalized.scoreboardRounds[0].scores).toEqual(Object.fromEntries(
      normalized.participants.map((participant) => [participant.id, 0]),
    ));
  });

  it("somma i punteggi di più round senza modificare il torneo sorgente", () => {
    let tournament = create("scoreboard", ["Ada", "Bea"], {
      scoring: rules({ scoreDirection: "lower" }),
    });
    const [ada, bea] = tournament.participants;
    const firstRoundId = tournament.scoreboardRounds[0].id;
    const source = structuredClone(tournament);

    tournament = updateScoreboardRoundScore(tournament, firstRoundId, ada.id, 3);
    tournament = updateScoreboardRoundScore(tournament, firstRoundId, bea.id, 5);
    tournament = addScoreboardRound(tournament);
    const secondRoundId = tournament.scoreboardRounds[1].id;
    tournament = updateScoreboardRoundScore(tournament, secondRoundId, ada.id, 9);
    tournament = updateScoreboardRoundScore(tournament, secondRoundId, bea.id, 5);

    expect(source.scoreboardRounds[0].scores).toEqual({
      [ada.id]: 0,
      [bea.id]: 0,
    });
    expect(tournament.participants.map((item) => item.score)).toEqual([12, 10]);
    expect(getChampionId(setTournamentStatus(tournament, "completed"))).toBe(bea.id);
  });

  it.each(["higher", "lower"] as const)(
    "conta soltanto i round vinti con punteggio %s e non assegna i round pari",
    (scoreDirection) => {
      let tournament = create("scoreboard", ["Ada", "Bea", "Carlo"], {
        scoring: rules({ scoreDirection, scoreboardAggregation: "roundWins" }),
      });
      const [ada, bea, carlo] = tournament.participants;
      const winningScore = scoreDirection === "higher" ? 10 : -10;
      const losingScore = scoreDirection === "higher" ? -2 : 12;
      const firstRoundId = tournament.scoreboardRounds[0].id;

      tournament = updateScoreboardRoundScore(tournament, firstRoundId, ada.id, winningScore);
      tournament = updateScoreboardRoundScore(tournament, firstRoundId, bea.id, losingScore);
      tournament = updateScoreboardRoundScore(tournament, firstRoundId, carlo.id, losingScore);
      tournament = addScoreboardRound(tournament);
      const secondRoundId = tournament.scoreboardRounds[1].id;
      tournament = updateScoreboardRoundScore(tournament, secondRoundId, ada.id, winningScore);
      tournament = updateScoreboardRoundScore(tournament, secondRoundId, bea.id, winningScore);
      tournament = updateScoreboardRoundScore(tournament, secondRoundId, carlo.id, losingScore);

      expect(tournament.participants.map((item) => item.score)).toEqual([1, 0, 0]);
      expect(getScoreboardLeaderIds(tournament)).toEqual([ada.id]);
    },
  );

  it("richiede un vincitore tra tutti i primi a pari merito e conserva la nota", () => {
    let tournament = create("scoreboard", ["Ada", "Bea", "Carlo"], {
      scoring: rules({ scoreDirection: "lower" }),
    });
    const [ada, bea, carlo] = tournament.participants;
    const roundId = tournament.scoreboardRounds[0].id;
    tournament = updateScoreboardRoundScore(tournament, roundId, ada.id, 27);
    tournament = updateScoreboardRoundScore(tournament, roundId, bea.id, 27);
    tournament = updateScoreboardRoundScore(tournament, roundId, carlo.id, 27);

    const unresolved = setTournamentStatus(tournament, "completed");
    expect(unresolved.status).toBe("active");
    expect(getChampionId(unresolved)).toBeNull();
    expect(getScoreboardLeaderIds(unresolved)).toEqual([ada.id, bea.id, carlo.id]);
    expect(completeScoreboardTournament(tournament, "not-a-leader")).toBe(tournament);
    expect(getScoreboardLeaderIds(create("league", ["A", "B"]))).toEqual([]);

    const completed = completeScoreboardTournament(
      tournament,
      bea.id,
      "Ha vinto la buca di spareggio.",
    );
    expect(completed.status).toBe("completed");
    expect(getChampionId(completed)).toBe(bea.id);
    expect(completed.winnerOverrideId).toBe(bea.id);
    expect(completed.winnerOverrideNote).toBe("Ha vinto la buca di spareggio.");
    expect(rankTournamentScoreboardParticipants(completed)[0].id).toBe(bea.id);
    expect(rankTournamentScoreboardParticipants({
      ...completed,
      winnerOverrideId: "not-a-participant",
    })[0].id).toBe(ada.id);

    const reopened = setTournamentStatus(completed, "active");
    expect(reopened.status).toBe("active");
    expect(reopened.winnerOverrideId).toBeUndefined();
    expect(reopened.winnerOverrideNote).toBeUndefined();
  });

  it("riapre una classifica conclusa quando cambia un punteggio", () => {
    let tournament = create("scoreboard", ["Ada", "Bea"]);
    const [ada, bea] = tournament.participants;
    const roundId = tournament.scoreboardRounds[0].id;
    tournament = completeScoreboardTournament(tournament, bea.id, "Spareggio");

    tournament = updateScoreboardRoundScore(tournament, roundId, ada.id, 2);

    expect(tournament.status).toBe("active");
    expect(tournament.winnerOverrideId).toBeUndefined();
    expect(tournament.winnerOverrideNote).toBeUndefined();
    expect(getScoreboardLeaderIds(tournament)).toEqual([ada.id]);
  });

  it("ricostruisce la data di fine dei tornei storici conclusi", () => {
    const tournament = create("scoreboard", ["A", "B"]);
    const normalized = normalizeTournament({
      ...tournament,
      status: "completed",
      updatedAt: "2026-06-15T20:30:00.000Z",
      completedAt: undefined,
    });

    expect(normalized.completedAt).toBe("2026-06-15T20:30:00.000Z");
  });

  it("deduplica gli spareggi salvati e completa quelli mancanti", () => {
    const tournament = create("league", ["A", "B"]);
    const normalized = normalizeTournament({
      ...tournament,
      settings: {
        ...tournament.settings,
        scoring: {
          ...tournament.settings.scoring,
          winPoints: 7,
          tieBreakers: ["wins", "wins"] as ScoringRules["tieBreakers"],
        },
      },
    });

    expect(normalized.settings.scoring.winPoints).toBe(7);
    expect(normalized.settings.scoring.tieBreakers).toEqual([
      "wins",
      "headToHead",
      "scoreDifference",
    ]);
  });

  it("non aggiunge punteggi ai partecipanti dei formati a partite", () => {
    const tournament = create("league", ["A", "B"]);
    const normalized = normalizeTournament(tournament);
    expect(normalized.participants.every((item) => item.score === undefined)).toBe(true);
  });

  it("non modifica gli oggetti sorgente durante aggiornamenti e ordinamenti", () => {
    const tournament = create("scoreboard", ["A", "B"]);
    const before = structuredClone(tournament);
    const updated = updateParticipantScore(
      tournament,
      tournament.participants[0].id,
      10,
    );

    expect(tournament).toEqual(before);
    expect(updated).not.toBe(tournament);
    expect(updated.participants).not.toBe(tournament.participants);
  });

  it("confronta numeri secondo entrambe le direzioni", () => {
    expect(compareRankedScores(10, 5, "higher")).toBeLessThan(0);
    expect(compareRankedScores(10, 5, "lower")).toBeGreaterThan(0);
    expect(compareRankedScores(5, 5, "higher")).toBe(0);
  });

  it("riconosce come giocata solo una partita con entrambi i punteggi", () => {
    expect(isMatchPlayed(match("a", "b", 0, 0))).toBe(true);
    expect(isMatchPlayed(match("a", "b", 0, null))).toBe(false);
  });

  it("restituisce avanzamento zero in assenza di partite", () => {
    const tournament = create("scoreboard", ["A", "B"]);
    expect(tournamentProgress(tournament)).toEqual({
      played: 0,
      total: 0,
      percentage: 0,
    });
  });
});
