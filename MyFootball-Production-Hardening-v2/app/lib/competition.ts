export type CompetitionFormat = "single_round_robin" | "double_round_robin" | "knockout" | "group_knockout";

export const knockoutRounds = (teams: number) =>
  teams < 2 ? 0 : Math.ceil(Math.log2(teams));

export function knockoutRoundName(matches: number) {
  if (matches === 1) return "Final";
  if (matches === 2) return "Semi-Finals";
  if (matches === 4) return "Quarter-Finals";
  if (matches === 8) return "Round of 16";
  return `Round of ${matches * 2}`;
}

export function normalizeFormat(value: string): CompetitionFormat {
  if (value === "round_robin") return "single_round_robin";
  if (["single_round_robin", "double_round_robin", "knockout", "group_knockout"].includes(value)) {
    return value as CompetitionFormat;
  }
  return "group_knockout";
}

export function maxMinuteForPeriod(period: string, halfMinutes: number) {
  const firstEnd = halfMinutes;
  const secondEnd = halfMinutes * 2;
  const stoppageBuffer = 15; // Support up to 15 minutes of added injury/stoppage time per period
  if (period === "first_half") return firstEnd + stoppageBuffer;
  if (period === "second_half") return secondEnd + stoppageBuffer;
  if (period === "extra_time") return secondEnd + halfMinutes + stoppageBuffer;
  return secondEnd + stoppageBuffer;
}

export function shootoutIsDecided(home: number, away: number, homeTaken: number, awayTaken: number) {
  const regulationKicks = 5;
  if (homeTaken < regulationKicks || awayTaken < regulationKicks) {
    return home > away + (regulationKicks - awayTaken) || away > home + (regulationKicks - homeTaken);
  }
  return homeTaken === awayTaken && homeTaken >= regulationKicks && home !== away;
}

/** Circle-method rounds. A null opponent represents a bye. */
export function roundRobinRounds(ids: string[], doubleLeg = false) {
  const rotation: Array<string | null> = [...ids];
  if (rotation.length % 2) rotation.push(null);
  const rounds: Array<Array<[string, string]>> = [];
  for (let round = 0; round < rotation.length - 1; round += 1) {
    const games: Array<[string, string]> = [];
    for (let i = 0; i < rotation.length / 2; i += 1) {
      const home = rotation[i];
      const away = rotation[rotation.length - 1 - i];
      if (home && away) games.push([home, away]);
    }
    rounds.push(games);
    const fixed = rotation[0];
    const rest = rotation.slice(1);
    rest.unshift(rest.pop() ?? null);
    rotation.splice(0, rotation.length, fixed, ...rest);
  }
  return doubleLeg ? [...rounds, ...rounds.map((games) => games.map(([a, b]) => [b, a] as [string, string]))] : rounds;
}
