/** Shared by source normalization and every Momence write path. */
export const MOMENCE_HOSTS = { bengaluru: "33905", mumbai: "13752" } as const;

export function resolveMomenceHost(lead: { center: string; hostId?: string }): string {
  const center = lead.center.normalize("NFKC").toLowerCase();
  if (/\b(bengaluru|bangalore|kenkere|indiranagar|koramangala)\b|copper\s*\+?\s*cloves/.test(center)) {
    return MOMENCE_HOSTS.bengaluru;
  }
  if (/\b(mumbai|bombay|bandra|kemps|kwality|supreme)\b/.test(center)) {
    return MOMENCE_HOSTS.mumbai;
  }
  // Unrecognized/event locations retain a known source account; default is Mumbai.
  return lead.hostId === MOMENCE_HOSTS.bengaluru ? MOMENCE_HOSTS.bengaluru : MOMENCE_HOSTS.mumbai;
}
