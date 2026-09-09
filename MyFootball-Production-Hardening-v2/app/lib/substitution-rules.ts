/**
 * IFAB Law 3 Substitution Rules Engine
 *
 * Implements the official IFAB Law 3 (The Players) regulations:
 * 1. Maximum of 5 substitutions per team in regular time.
 * 2. Maximum of 3 in-play substitution opportunities ("windows") per team during normal playing time (1st and 2nd half).
 * 3. Substitutions made during the half-time interval do NOT count towards the 3 in-play windows.
 * 4. Multiple substitutions made by the same team during the same stoppage (same minute and in-play period)
 *    count as only 1 in-play window.
 * 5. Extra time expansion (optional): 1 additional substitution (6th sub) and 1 additional window opportunity.
 *    Substitutions made before extra time starts or at extra time half-time do not count as windows.
 */

export interface SubstitutionEvent {
  id?: string;
  entryId: string;
  matchMinute: number;
  matchPeriod: string;
  type?: string;
  playerId?: string | null;
  assistPlayerId?: string | null;
}

export interface SubstitutionState {
  usedSubs: number;
  maxSubs: number;
  remainingSubs: number;
  usedWindows: number;
  maxWindows: number;
  remainingWindows: number;
  isWindowExhausted: boolean;
  isSubExhausted: boolean;
  usedWindowKeys: string[];
}

export interface SubstitutionValidationResult {
  allowed: boolean;
  reason?: string;
  state: SubstitutionState;
}

/**
 * Checks if a given match period represents an in-play period
 * that consumes a substitution window.
 */
export function isInPlayPeriod(period: string): boolean {
  const p = (period || "").toLowerCase();
  return p === "first_half" || p === "second_half" || p === "extra_time";
}

/**
 * Checks if a substitution is made during an interval (e.g. half-time),
 * which does NOT consume an in-play window under IFAB Law 3.
 */
export function isIntervalPeriod(period: string): boolean {
  const p = (period || "").toLowerCase();
  return p === "half_time" || p === "extra_time_half_time" || p === "pre_extra_time";
}

/**
 * Computes the current substitution state for a team based on previously recorded substitution events.
 */
export function computeSubstitutionState(
  teamEntryId: string,
  events: SubstitutionEvent[],
  currentPeriod: string = "second_half",
  isExtraTimeAllowed = false
): SubstitutionState {
  const teamSubs = events.filter(
    (e) => e.entryId === teamEntryId && (e.type === "substitution" || !e.type)
  );

  const isExtraTimePeriod = currentPeriod.toLowerCase() === "extra_time";
  const maxSubs = isExtraTimeAllowed && isExtraTimePeriod ? 6 : 5;
  const maxWindows = isExtraTimeAllowed && isExtraTimePeriod ? 4 : 3;

  const usedSubs = teamSubs.length;

  // Track distinct in-play substitution windows.
  // Multiple substitutions at the same stoppage (same period and minute) share one window.
  const windowKeySet = new Set<string>();

  for (const sub of teamSubs) {
    const period = (sub.matchPeriod || "").toLowerCase();
    if (isInPlayPeriod(period)) {
      const windowKey = `${period}_${sub.matchMinute}`;
      windowKeySet.add(windowKey);
    }
  }

  const usedWindows = windowKeySet.size;
  const remainingSubs = Math.max(0, maxSubs - usedSubs);
  const remainingWindows = Math.max(0, maxWindows - usedWindows);

  return {
    usedSubs,
    maxSubs,
    remainingSubs,
    usedWindows,
    maxWindows,
    remainingWindows,
    isSubExhausted: usedSubs >= maxSubs,
    isWindowExhausted: usedWindows >= maxWindows,
    usedWindowKeys: Array.from(windowKeySet),
  };
}

/**
 * Validates whether a proposed new substitution is permitted under IFAB Law 3.
 */
export function validateSubstitutionAttempt(
  teamEntryId: string,
  events: SubstitutionEvent[],
  newMinute: number,
  newPeriod: string,
  isExtraTimeAllowed = false
): SubstitutionValidationResult {
  const currentState = computeSubstitutionState(teamEntryId, events, newPeriod, isExtraTimeAllowed);

  // 1. Check maximum substitution quota
  if (currentState.usedSubs >= currentState.maxSubs) {
    return {
      allowed: false,
      reason: `Maximum of ${currentState.maxSubs} substitutions reached under IFAB Law 3.`,
      state: currentState,
    };
  }

  // 2. Check in-play window quota
  const normalizedPeriod = (newPeriod || "").toLowerCase();
  const isNewInPlay = isInPlayPeriod(normalizedPeriod);

  if (isNewInPlay) {
    const candidateWindowKey = `${normalizedPeriod}_${newMinute}`;
    const sharesExistingWindow = currentState.usedWindowKeys.includes(candidateWindowKey);

    // If it requires a new in-play window and windows are exhausted
    if (!sharesExistingWindow && currentState.usedWindows >= currentState.maxWindows) {
      return {
        allowed: false,
        reason: `All ${currentState.maxWindows} in-play substitution windows exhausted under IFAB Law 3.`,
        state: currentState,
      };
    }
  }

  return {
    allowed: true,
    state: currentState,
  };
}
