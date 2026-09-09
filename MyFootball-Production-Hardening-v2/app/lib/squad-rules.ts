/**
 * AIFF Youth Regulations & Squad Invariants Engine
 *
 * Implements:
 * 1. AIFF Age Category Cutoff Verification (U-13, U-15, U-17, U-19, etc.).
 * 2. Matchday Starting Lineup Invariants:
 *    - Exactly 1 Goalkeeper (GK) in the Starting XI.
 *    - Starting players count (typically 11, minimum 7 to start).
 *    - Unique jersey numbers in squad (1 to 99).
 *    - Maximum squad size enforcement.
 *    - Duplicate player protection.
 */

export interface DivisionContext {
  id: string;
  name: string;
  ageCutoffDate?: string | null;
  teamFormat?: string | null;
  maxSquadSize: number;
  requirePlayers?: boolean | null;
  requireDocuments?: boolean | null;
}

export interface PlayerRecord {
  id: string;
  name: string;
  dateOfBirth?: string | null;
  jerseyNumber: number;
  position: string; // "GK" | "DEF" | "MID" | "FWD"
}

export interface SquadMemberInput {
  playerId: string;
  isStarting?: boolean;
  jerseyNumberOverride?: number | null;
  positionOverride?: string | null;
}

export interface SquadValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  startingCount: number;
  substituteCount: number;
  goalkeeperCount: number;
}

/**
 * Extracts the age category number from a division name (e.g., "Under-15 Boys" -> 15, "U17" -> 17).
 * Returns null if Open / Senior or unrecognized.
 */
export function extractAgeLimitFromDivisionName(divisionName: string): number | null {
  if (!divisionName) return null;
  const match = divisionName.match(/(?:under|u)[-\s]?(\d{1,2})\b/i);
  if (match && match[1]) {
    const age = parseInt(match[1], 10);
    if (!isNaN(age) && age > 5 && age < 40) return age;
  }
  return null;
}

/**
 * Computes the AIFF cutoff date for an age category.
 * AIFF Standard: Born on or after January 1st of (TournamentYear - AgeLimit).
 * E.g., for 2026 season: U-15 requires born on or after 2011-01-01.
 */
export function computeCutoffDate(ageLimit: number, referenceYear = new Date().getFullYear()): string {
  const cutoffYear = referenceYear - ageLimit;
  return `${cutoffYear}-01-01`;
}

/**
 * Checks if a player's date of birth meets the division's youth eligibility threshold.
 */
export function isPlayerAgeEligible(
  dateOfBirth: string | null | undefined,
  cutoffDate: string
): { eligible: boolean; reason?: string } {
  if (!dateOfBirth) {
    return { eligible: false, reason: "Missing date of birth." };
  }

  // Compare ISO date strings YYYY-MM-DD directly
  const dob = dateOfBirth.trim().slice(0, 10);
  const cutoff = cutoffDate.trim().slice(0, 10);

  if (dob < cutoff) {
    return {
      eligible: false,
      reason: `Born ${dob}, which is prior to the category cutoff of ${cutoff} (overage).`,
    };
  }

  return { eligible: true };
}

/**
 * Validates a squad against AIFF age and matchday lineup rules.
 */
export function validateSquadEligibility(
  division: DivisionContext,
  squad: SquadMemberInput[],
  clubPlayers: PlayerRecord[],
  referenceYear: number = new Date().getFullYear()
): SquadValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const playerMap = new Map<string, PlayerRecord>();
  for (const p of clubPlayers) {
    playerMap.set(p.id, p);
  }

  // 1. Squad Size Limits
  if (squad.length > division.maxSquadSize) {
    errors.push(`Squad size (${squad.length}) exceeds maximum limit (${division.maxSquadSize}).`);
  }

  // 2. Duplicate Player Check
  const playerIds = squad.map((s) => s.playerId);
  const uniquePlayerIds = new Set(playerIds);
  if (uniquePlayerIds.size !== playerIds.length) {
    errors.push("Duplicate players found in squad submission.");
  }

  // Determine applicable age cutoff
  let effectiveCutoff = division.ageCutoffDate?.trim() || null;
  if (!effectiveCutoff) {
    const ageLimit = extractAgeLimitFromDivisionName(division.name);
    if (ageLimit !== null) {
      effectiveCutoff = computeCutoffDate(ageLimit, referenceYear);
    }
  }

  let startingCount = 0;
  let substituteCount = 0;
  let goalkeeperCount = 0;
  const jerseyNumberMap = new Map<number, string>();

  for (const item of squad) {
    const player = playerMap.get(item.playerId);
    if (!player) {
      errors.push(`Player ID ${item.playerId} does not exist in club roster.`);
      continue;
    }

    const effectivePosition = (item.positionOverride || player.position || "").toUpperCase();
    const effectiveJersey = item.jerseyNumberOverride !== null && item.jerseyNumberOverride !== undefined
      ? item.jerseyNumberOverride
      : player.jerseyNumber;

    if (item.isStarting) {
      startingCount += 1;
      if (effectivePosition === "GK") {
        goalkeeperCount += 1;
      }
    } else {
      substituteCount += 1;
    }

    // Jersey Number Validation (1 to 99)
    if (effectiveJersey > 0) {
      if (effectiveJersey > 99) {
        errors.push(`Player ${player.name} has invalid jersey number (${effectiveJersey}). Numbers must be 1–99.`);
      } else {
        if (jerseyNumberMap.has(effectiveJersey)) {
          errors.push(`Duplicate jersey number #${effectiveJersey} between ${player.name} and ${jerseyNumberMap.get(effectiveJersey)}.`);
        } else {
          jerseyNumberMap.set(effectiveJersey, player.name);
        }
      }
    } else if (division.requirePlayers || item.isStarting) {
      errors.push(`Player ${player.name} requires a valid jersey number (1–99).`);
    }

    // Age Cutoff Verification
    if (effectiveCutoff) {
      if (!player.dateOfBirth) {
        if (division.requireDocuments) {
          errors.push(`Player ${player.name} is missing Date of Birth for age-restricted division ${division.name}.`);
        } else {
          warnings.push(`Player ${player.name} has no Date of Birth recorded.`);
        }
      } else {
        const ageCheck = isPlayerAgeEligible(player.dateOfBirth, effectiveCutoff);
        if (!ageCheck.eligible) {
          errors.push(`Player ${player.name} (${player.dateOfBirth}) is ineligible: ${ageCheck.reason}`);
        }
      }
    }
  }

  // 3. Starting Lineup Invariants (when starting lineup is designated)
  if (startingCount > 0) {
    const format = (division.teamFormat || "11v11").toLowerCase();
    const maxStarters = format === "5v5" ? 5 : format === "7v7" ? 7 : 11;
    if (startingCount > maxStarters) {
      errors.push(
        `Starting lineup has ${startingCount} players. Maximum is ${maxStarters} for ${division.teamFormat || "11v11"} match format.`,
      );
    }

    if (goalkeeperCount === 0) {
      errors.push("Starting lineup must include exactly 1 Goalkeeper (GK). None was selected.");
    } else if (goalkeeperCount > 1) {
      errors.push(`Starting lineup must include exactly 1 Goalkeeper (GK). Found ${goalkeeperCount}.`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    startingCount,
    substituteCount,
    goalkeeperCount,
  };
}
