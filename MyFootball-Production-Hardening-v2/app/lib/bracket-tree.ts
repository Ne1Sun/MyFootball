export type KnockoutRoundCode =
  | "round_of_64"
  | "round_of_32"
  | "round_of_16"
  | "quarter_final"
  | "semi_final"
  | "final"
  | "third_place";

export interface KnockoutFixtureBlueprint {
  roundNumber: number;
  roundName: string;
  stage: "knockout";
  bracketRound: KnockoutRoundCode;
  bracketMatchIndex: number;
  homeEntryId: string;
  awayEntryId: string;
  isByeMatch?: boolean;
  advancingEntryId?: string;
  parentMatchIndex?: number;
  parentRoundCode?: KnockoutRoundCode;
  parentSlot?: "home" | "away";
}

/**
 * Computes the smallest power of 2 >= n, capped at 64.
 */
export function getBracketCapacity(n: number): number {
  if (n < 2) return 2;
  const power = Math.ceil(Math.log2(n));
  return Math.min(64, Math.pow(2, power));
}

/**
 * Computes standard folded tournament seeding array of length capacity.
 * S_2 = [1, 2]
 * S_2k[2j] = S_k[j], S_2k[2j+1] = 2k + 1 - S_k[j]
 * e.g. for 8: [1, 8, 4, 5, 2, 7, 3, 6]
 */
export function generateFoldedSeeds(capacity: number): number[] {
  let seeds = [1, 2];
  while (seeds.length < capacity) {
    const nextSize = seeds.length * 2;
    const nextSeeds: number[] = new Array(nextSize);
    for (let j = 0; j < seeds.length; j++) {
      nextSeeds[2 * j] = seeds[j];
      nextSeeds[2 * j + 1] = nextSize + 1 - seeds[j];
    }
    seeds = nextSeeds;
  }
  return seeds;
}

/**
 * Maps round capacity to canonical database round codes.
 */
export function getRoundCodeForMatches(matches: number): KnockoutRoundCode {
  switch (matches) {
    case 32:
      return "round_of_64";
    case 16:
      return "round_of_32";
    case 8:
      return "round_of_16";
    case 4:
      return "quarter_final";
    case 2:
      return "semi_final";
    case 1:
      return "final";
    default:
      return "quarter_final";
  }
}

export function getRoundNameForCode(code: KnockoutRoundCode, matchIndex?: number, totalMatches?: number): string {
  switch (code) {
    case "round_of_64":
      return `Round of 64 Match ${matchIndex}`;
    case "round_of_32":
      return `Round of 32 Match ${matchIndex}`;
    case "round_of_16":
      return `Round of 16 Match ${matchIndex}`;
    case "quarter_final":
      return `Quarter-Final ${matchIndex}`;
    case "semi_final":
      return `Semi-Final ${matchIndex}`;
    case "final":
      return "Grand Final";
    case "third_place":
      return "3rd Place Playoff";
    default:
      return `Match ${matchIndex}`;
  }
}

/**
 * Builds the complete knockout tree for N teams supporting odd counts and byes.
 */
export function buildKnockoutTree(
  entryIds: string[],
  startRoundNumber = 1
): KnockoutFixtureBlueprint[] {
  const n = entryIds.length;
  if (n < 2) return [];

  const capacity = getBracketCapacity(n);
  const byes = capacity - n;
  const foldedSeeds = generateFoldedSeeds(capacity);

  // Map seed number (1-based) to entryId. Seeds 1..n get teams, seeds > n are Byes
  const seedToEntry = new Map<number, string | null>();
  for (let s = 1; s <= capacity; s++) {
    seedToEntry.set(s, s <= n ? entryIds[s - 1] : null);
  }

  const fallbackEntryId = entryIds[0];
  const blueprints: KnockoutFixtureBlueprint[] = [];

  // 1. Generate all rounds from opening round down to Final
  let currentMatches = capacity / 2;
  let currentRoundNum = startRoundNumber;

  // Track match node outcomes for downstream population
  // Map of `${roundCode}_${matchIndex}` => { homeEntryId, awayEntryId }
  const slotMap = new Map<string, { home: string; away: string }>();

  // Initialize opening round pairings from folded seeds
  const openingRoundCode = getRoundCodeForMatches(currentMatches);

  for (let i = 0; i < currentMatches; i++) {
    const matchIndex = i + 1;
    const homeSeed = foldedSeeds[2 * i];
    const awaySeed = foldedSeeds[2 * i + 1];

    const homeEntry = seedToEntry.get(homeSeed);
    const awayEntry = seedToEntry.get(awaySeed);

    const isBye = !homeEntry || !awayEntry;
    const advancingEntry = isBye ? (homeEntry || awayEntry || fallbackEntryId) : undefined;

    // Both IDs must be non-null in DB: if bye, use the advancing team as placeholder
    const hId = homeEntry || fallbackEntryId;
    const aId = awayEntry || homeEntry || fallbackEntryId;

    blueprints.push({
      roundNumber: currentRoundNum,
      roundName: getRoundNameForCode(openingRoundCode, matchIndex, currentMatches),
      stage: "knockout",
      bracketRound: openingRoundCode,
      bracketMatchIndex: matchIndex,
      homeEntryId: hId,
      awayEntryId: aId,
      isByeMatch: isBye,
      advancingEntryId: advancingEntry,
      parentMatchIndex: Math.ceil(matchIndex / 2),
      parentSlot: matchIndex % 2 === 1 ? "home" : "away",
    });

    if (isBye && advancingEntry) {
      // Propagate bye team directly to parent round slot
      const parentMatchIdx = Math.ceil(matchIndex / 2);
      const parentSlot = matchIndex % 2 === 1 ? "home" : "away";
      const nextRoundCode = getRoundCodeForMatches(currentMatches / 2);
      const key = `${nextRoundCode}_${parentMatchIdx}`;
      const existing = slotMap.get(key) || { home: fallbackEntryId, away: fallbackEntryId };
      if (parentSlot === "home") existing.home = advancingEntry;
      else existing.away = advancingEntry;
      slotMap.set(key, existing);
    }
  }

  // 2. Build remaining downstream rounds (QF -> SF -> Final)
  while (currentMatches > 1) {
    currentMatches = currentMatches / 2;
    currentRoundNum += 1;
    const roundCode = getRoundCodeForMatches(currentMatches);

    for (let i = 0; i < currentMatches; i++) {
      const matchIndex = i + 1;
      const key = `${roundCode}_${matchIndex}`;
      const prefilled = slotMap.get(key);

      const hId = prefilled?.home || entryIds[(2 * i) % n] || fallbackEntryId;
      const aId = prefilled?.away || entryIds[(2 * i + 1) % n] || fallbackEntryId;

      blueprints.push({
        roundNumber: currentRoundNum,
        roundName: getRoundNameForCode(roundCode, matchIndex, currentMatches),
        stage: "knockout",
        bracketRound: roundCode,
        bracketMatchIndex: matchIndex,
        homeEntryId: hId,
        awayEntryId: aId,
        parentMatchIndex: currentMatches > 1 ? Math.ceil(matchIndex / 2) : undefined,
        parentSlot: matchIndex % 2 === 1 ? "home" : "away",
      });
    }
  }

  // 3. Add Third Place Playoff (consolation for Semi-Final losers)
  if (capacity >= 4) {
    blueprints.push({
      roundNumber: currentRoundNum,
      roundName: "3rd Place Playoff",
      stage: "knockout",
      bracketRound: "third_place",
      bracketMatchIndex: 1,
      homeEntryId: entryIds[0],
      awayEntryId: entryIds[1] || entryIds[0],
    });
  }

  return blueprints;
}
