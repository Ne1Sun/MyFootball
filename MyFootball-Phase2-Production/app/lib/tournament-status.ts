export function publicTournamentStatus(
  status: string,
  registrationClosesAt?: string | null,
  now = Date.now(),
) {
  if (
    status === "registration_open" &&
    registrationClosesAt &&
    Number.isFinite(new Date(registrationClosesAt).getTime()) &&
    new Date(registrationClosesAt).getTime() <= now
  ) {
    return "registration_closed";
  }
  return status;
}
