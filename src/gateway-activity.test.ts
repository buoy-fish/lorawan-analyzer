import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hasRecentStats, isGatewayActive } from './gateway-activity.js';

const NOW = new Date('2026-06-14T00:00:00Z').getTime();
const hoursAgo = (h: number) => new Date(NOW - h * 3600_000).toISOString();

test('hasRecentStats: true within the window, false outside, false when null/invalid', () => {
  assert.equal(hasRecentStats(hoursAgo(0.1), 24, NOW), true);
  assert.equal(hasRecentStats(hoursAgo(48), 24, NOW), false);
  assert.equal(hasRecentStats(null, 24, NOW), false);
  assert.equal(hasRecentStats('not-a-date', 24, NOW), false);
  assert.equal(hasRecentStats(new Date(NOW - 3600_000), 24, NOW), true);
});

test('isGatewayActive: included when RF traffic meets the threshold', () => {
  assert.equal(isGatewayActive({ packet_count: 10, last_stats_at: null }, 24, NOW), true);
  assert.equal(isGatewayActive({ packet_count: 9, last_stats_at: null }, 24, NOW), false);
});

// The Tier-2 case: an online-but-RF-silent gateway (no recent packets) must
// still appear because its stats heartbeat is fresh.
test('isGatewayActive: included on a fresh stats heartbeat even with zero packets', () => {
  assert.equal(isGatewayActive({ packet_count: 0, last_stats_at: hoursAgo(0.05) }, 24, NOW), true);
});

test('isGatewayActive: excluded when both RF and stats are stale/absent', () => {
  assert.equal(isGatewayActive({ packet_count: 0, last_stats_at: hoursAgo(48) }, 24, NOW), false);
  assert.equal(isGatewayActive({ packet_count: 2, last_stats_at: null }, 24, NOW), false);
});
