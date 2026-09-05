export type TournamentStatus =
  | "draft"
  | "registration_open"
  | "registration_closed"
  | "scheduled"
  | "live"
  | "completed"
  | "cancelled";

export const publicTournamentStatuses = [
  "registration_open",
  "registration_closed",
  "scheduled",
  "live",
  "completed",
] as const;

const transitions: Record<TournamentStatus, TournamentStatus[]> = {
  draft: ["draft", "registration_open", "cancelled"],
  registration_open: ["registration_open", "registration_closed", "cancelled"],
  registration_closed: ["registration_closed", "registration_open", "scheduled", "cancelled"],
  scheduled: ["scheduled", "live", "cancelled"],
  live: ["live", "completed", "cancelled"],
  completed: ["completed"],
  cancelled: ["cancelled"],
};

export function validateTournamentTransition(input: {
  current: TournamentStatus;
  next: TournamentStatus;
  hasFixtures: boolean;
  allCompetitionFixturesComplete: boolean;
  registrationDeadlinePassed: boolean;
}) {
  if (!transitions[input.current]?.includes(input.next)) {
    throw new Error(`Tournament cannot move from ${input.current.replaceAll("_", " ")} to ${input.next.replaceAll("_", " ")}.`);
  }
  if (
    input.next === "registration_open" &&
    input.current !== "registration_open" &&
    (input.hasFixtures || input.registrationDeadlinePassed)
  ) {
    throw new Error("Registration cannot reopen after scheduling begins or after its deadline.");
  }
  if (["scheduled", "live"].includes(input.next) && !input.hasFixtures) {
    throw new Error("Generate fixtures before moving the tournament into its scheduled or live stage.");
  }
  if (input.next === "completed" && !input.allCompetitionFixturesComplete) {
    throw new Error("Every required competition fixture must be completed first.");
  }
}

export function tournamentEndDate(startDate: string, durationDays: number) {
  const [year, month, day] = startDate.split("-").map(Number);
  const end = new Date(Date.UTC(year, month - 1, day + Math.max(1, durationDays) - 1));
  return `${end.getUTCFullYear()}-${String(end.getUTCMonth() + 1).padStart(2, "0")}-${String(end.getUTCDate()).padStart(2, "0")}`;
}
