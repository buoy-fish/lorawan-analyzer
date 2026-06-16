// Pure inclusion/liveness logic for the gateway list. Kept dependency-free
// (no DB, no imports) so it's unit-testable without a live Postgres.

export interface GatewayActivityInput {
  packet_count: number;
  last_stats_at: Date | string | null;
}

const MS_PER_HOUR = 3600_000;

function toMillis(ts: Date | string | null): number | null {
  if (!ts) return null;
  const t = ts instanceof Date ? ts.getTime() : new Date(ts).getTime();
  return Number.isNaN(t) ? null : t;
}

// True when the gateway has sent a stats heartbeat within the window. This is
// the RF-independent online signal (gateways emit stats ~every 30s even with
// zero device traffic).
export function hasRecentStats(
  lastStatsAt: Date | string | null,
  hours: number,
  now: number,
): boolean {
  const t = toMillis(lastStatsAt);
  return t !== null && t > now - hours * MS_PER_HOUR;
}

// A gateway belongs in the list if it has meaningful RF traffic OR a recent
// stats heartbeat. The stats clause is what lets an online-but-RF-silent
// gateway appear at all — without it the `packet_count >= 10` filter would
// drop it, defeating the connectivity dot that consumes this endpoint.
export function isGatewayActive(
  gw: GatewayActivityInput,
  hours: number,
  now: number,
): boolean {
  return gw.packet_count >= 10 || hasRecentStats(gw.last_stats_at, hours, now);
}
