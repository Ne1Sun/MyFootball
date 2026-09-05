export type MatchSnapshot = {
  stage: string;
  status: string;
  period: string;
  homeEntryId: string;
  awayEntryId: string;
  homeScore: number;
  awayScore: number;
  homeScorePenalties: number;
  awayScorePenalties: number;
};

export type MatchResult = {
  winnerEntryId: string;
  loserEntryId: string;
};

export function deriveKnockoutResult(match: MatchSnapshot): MatchResult {
  if (match.stage !== "knockout") {
    throw new Error("Only knockout matches have a bracket winner.");
  }
  if (match.homeScore > match.awayScore) {
    return { winnerEntryId: match.homeEntryId, loserEntryId: match.awayEntryId };
  }
  if (match.awayScore > match.homeScore) {
    return { winnerEntryId: match.awayEntryId, loserEntryId: match.homeEntryId };
  }
  if (match.homeScorePenalties > match.awayScorePenalties) {
    return { winnerEntryId: match.homeEntryId, loserEntryId: match.awayEntryId };
  }
  if (match.awayScorePenalties > match.homeScorePenalties) {
    return { winnerEntryId: match.awayEntryId, loserEntryId: match.homeEntryId };
  }
  throw new Error("A knockout match cannot finish level. Record the shootout before full time.");
}

export function canStartShootout(match: MatchSnapshot) {
  return (
    match.stage === "knockout" &&
    match.status === "in_progress" &&
    match.homeScore === match.awayScore &&
    ["second_half", "extra_time", "penalties"].includes(match.period)
  );
}

export function validateMatchTransition(
  current: MatchSnapshot,
  nextStatus: string,
  nextPeriod: string,
) {
  if (current.status === "completed") {
    throw new Error("Completed matches are locked. Use Correct result to make an audited correction.");
  }

  const allowed = new Set([
    "scheduled:scheduled->in_progress:first_half",
    "in_progress:first_half->in_progress:first_half",
    "in_progress:first_half->in_progress:half_time",
    "in_progress:half_time->in_progress:second_half",
    "in_progress:second_half->in_progress:second_half",
    "in_progress:second_half->in_progress:extra_time",
    "in_progress:extra_time->in_progress:extra_time",
    "in_progress:second_half->in_progress:penalties",
    "in_progress:extra_time->in_progress:penalties",
    "in_progress:penalties->in_progress:penalties",
    "in_progress:first_half->completed:completed",
    "in_progress:half_time->completed:completed",
    "in_progress:second_half->completed:completed",
    "in_progress:extra_time->completed:completed",
    "in_progress:penalties->completed:completed",
  ]);

  const key = `${current.status}:${current.period}->${nextStatus}:${nextPeriod}`;
  if (!allowed.has(key)) {
    throw new Error(`Invalid match transition from ${current.period} to ${nextPeriod}.`);
  }
}

export function goalDelta(type: string, eventEntryId: string, match: Pick<MatchSnapshot, "homeEntryId" | "awayEntryId">) {
  if (type === "goal" || type === "penalty_goal") {
    return eventEntryId === match.homeEntryId
      ? { home: 1, away: 0 }
      : { home: 0, away: 1 };
  }
  if (type === "own_goal") {
    return eventEntryId === match.homeEntryId
      ? { home: 0, away: 1 }
      : { home: 1, away: 0 };
  }
  return { home: 0, away: 0 };
}

export type ShootoutKickSnapshot = { isHome: boolean; scored: boolean };

export function calculateShootout(kicks: ShootoutKickSnapshot[]) {
  const home = kicks.filter((kick) => kick.isHome);
  const away = kicks.filter((kick) => !kick.isHome);
  const homeScore = home.filter((kick) => kick.scored).length;
  const awayScore = away.filter((kick) => kick.scored).length;
  const homeTaken = home.length;
  const awayTaken = away.length;
  let winner: "home" | "away" | null = null;

  if (homeTaken <= 5 && awayTaken <= 5) {
    const homeRemaining = 5 - homeTaken;
    const awayRemaining = 5 - awayTaken;
    if (homeScore > awayScore + awayRemaining) winner = "home";
    if (awayScore > homeScore + homeRemaining) winner = "away";
    if (homeTaken === 5 && awayTaken === 5 && homeScore !== awayScore) {
      winner = homeScore > awayScore ? "home" : "away";
    }
  } else if (homeTaken === awayTaken && homeTaken >= 6 && homeScore !== awayScore) {
    winner = homeScore > awayScore ? "home" : "away";
  }

  return {
    homeScore,
    awayScore,
    homeTaken,
    awayTaken,
    winner,
    isFinished: winner !== null,
    nextIsHome: homeTaken === awayTaken,
    nextSequence: kicks.length + 1,
  };
}
