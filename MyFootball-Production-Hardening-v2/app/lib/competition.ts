export type CompetitionFormat = "single_round_robin" | "double_round_robin" | "knockout" | "group_knockout";
export type TeamFormat = "5v5" | "7v7" | "11v11";

export function normalizeTeamFormat(value: unknown): TeamFormat {
  if (typeof value !== "string") return "11v11";
  const cleaned = value.trim().toLowerCase();
  if (cleaned === "5v5" || cleaned === "5-a-side" || cleaned === "5aside" || cleaned === "5") return "5v5";
  if (cleaned === "7v7" || cleaned === "7-a-side" || cleaned === "7aside" || cleaned === "7") return "7v7";
  return "11v11";
}

export function getDefaultFormatSquadSize(format: TeamFormat): number {
  if (format === "5v5") return 10;
  if (format === "7v7") return 14;
  return 18;
}

export function getDefaultFormatMatchDuration(format: TeamFormat): number {
  if (format === "5v5") return 40;
  if (format === "7v7") return 50;
  return 90;
}

export function getRecommendedHalftime(totalMinutes: number): number {
  if (totalMinutes <= 40) return 5;
  if (totalMinutes <= 60) return 10;
  return 15;
}

export function getFormatDurationPresets(format: TeamFormat): number[] {
  if (format === "5v5") return [20, 30, 40, 50];
  if (format === "7v7") return [40, 50, 60, 70];
  return [60, 70, 80, 90];
}

export function validateMatchDuration(
  val: unknown,
  fallback = 90
): { valid: boolean; value: number; error?: string } {
  if (val === undefined || val === null || val === "") {
    return { valid: true, value: fallback };
  }
  if (typeof val !== "number" && typeof val !== "string") {
    return { valid: false, value: fallback, error: "Match duration must be a valid number in minutes." };
  }
  if (typeof val === "string" && val.trim() === "") {
    return { valid: true, value: fallback };
  }
  const num = typeof val === "number" ? val : Number(val);
  if (Number.isNaN(num) || !Number.isFinite(num)) {
    return { valid: false, value: fallback, error: "Match duration must be a valid number in minutes." };
  }
  if (!Number.isInteger(num)) {
    return { valid: false, value: fallback, error: "Match duration must be a whole integer without decimals." };
  }
  if (num < 10) {
    return { valid: false, value: fallback, error: "Match duration must be at least 10 minutes." };
  }
  if (num > 180) {
    return { valid: false, value: fallback, error: "Match duration cannot exceed 180 minutes." };
  }
  if (num % 2 !== 0) {
    return {
      valid: false,
      value: fallback,
      error: `Match duration must be an even number cleanly divisible by 2 so both regulation halves are equal whole numbers (${num / 2} min halves are not permitted). Suggested: ${num - 1} min or ${num + 1} min.`
    };
  }
  return { valid: true, value: num };
}

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
