import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assignParticipantRanks,
  computeAdminAnalytics,
  computeStatsRollover,
  filterSortPaginateParticipants,
  getRiyadhDateKeys,
  validateIstighfarDelta,
  validateParticipantInput,
} from './campaignLogic';
import type { CampaignStats, IstighfarLog, Participant } from '../types/campaign';

test('validateParticipantInput accepts valid Arabic name and optional city', () => {
  const res = validateParticipantInput('  عبدالله   الشمري ', ' الرياض ');
  assert.equal(res.valid, true);
  assert.equal(res.displayName, 'عبدالله الشمري');
  assert.equal(res.city, 'الرياض');
});

test('validateParticipantInput rejects empty or too short names and unsafe characters', () => {
  assert.equal(validateParticipantInput('   ', '').valid, false);
  assert.equal(validateParticipantInput('أ', '').valid, false);
  assert.equal(validateParticipantInput('<script>', '').valid, false);
  assert.equal(validateParticipantInput('أحمد', '<img/>').valid, false);
});

test('validateIstighfarDelta permits only allowed increments and exact undo', () => {
  assert.equal(validateIstighfarDelta(1, 0, 0, 'none').valid, true);
  assert.equal(validateIstighfarDelta(10, 5, 1, 'log_1').valid, true);
  assert.equal(validateIstighfarDelta(33, 5, 1, 'log_1').valid, true);
  assert.equal(validateIstighfarDelta(100, 5, 1, 'log_1').valid, true);

  // Arbitrary delta blocked
  assert.equal(validateIstighfarDelta(500, 5, 1, 'log_1').valid, false);
  assert.equal(validateIstighfarDelta(0, 5, 1, 'log_1').valid, false);

  // Valid undo matches lastLogDelta
  assert.equal(validateIstighfarDelta(-33, 40, 33, 'log_2').valid, true);
  // Double undo or mismatched undo blocked
  assert.equal(validateIstighfarDelta(-33, 40, 0, 'undone').valid, false);
  assert.equal(validateIstighfarDelta(-10, 40, 33, 'log_2').valid, false);
  assert.equal(validateIstighfarDelta(-33, 10, 33, 'log_2').valid, false);
});

test('computeStatsRollover increments same day and resets on new day/week/month', () => {
  const baseStats: CampaignStats = {
    totalIstighfar: 150,
    totalParticipants: 4,
    todayIstighfar: 50,
    todayDate: '2026-11-24',
    weeklyIstighfar: 120,
    weekKey: '2026-W48',
    monthlyIstighfar: 150,
    monthKey: '2026-11',
    lastLogId: 'log_1',
    lastUpdatedMs: 1000,
  };

  const sameDay = computeStatsRollover(baseStats, 33, {
    todayDate: '2026-11-24',
    weekKey: '2026-W48',
    monthKey: '2026-11',
  });
  assert.equal(sameDay.totalIstighfar, 183);
  assert.equal(sameDay.todayIstighfar, 83);
  assert.equal(sameDay.weeklyIstighfar, 153);
  assert.equal(sameDay.monthlyIstighfar, 183);

  const newMonth = computeStatsRollover(baseStats, 10, {
    todayDate: '2026-12-01',
    weekKey: '2026-W49',
    monthKey: '2026-12',
  });
  assert.equal(newMonth.totalIstighfar, 160);
  assert.equal(newMonth.todayIstighfar, 10);
  assert.equal(newMonth.weeklyIstighfar, 10);
  assert.equal(newMonth.monthlyIstighfar, 10);
});

test('filterSortPaginateParticipants ranks, searches, sorts, and paginates accurately', () => {
  const sample: Participant[] = [
    {
      id: 'p1',
      displayName: 'سارة محمد',
      city: 'جدة',
      totalIstighfar: 120,
      lastLogId: 'l1',
      lastLogDelta: 10,
      isPublic: true,
      createdAtMs: 1000,
      updatedAtMs: 1000,
    },
    {
      id: 'p2',
      displayName: 'أحمد العتيبي',
      city: 'الرياض',
      totalIstighfar: 500,
      lastLogId: 'l2',
      lastLogDelta: 100,
      isPublic: true,
      createdAtMs: 2000,
      updatedAtMs: 2000,
    },
    {
      id: 'p3',
      displayName: 'خالد السبيعي',
      city: 'الدمام',
      totalIstighfar: 300,
      lastLogId: 'l3',
      lastLogDelta: 33,
      isPublic: true,
      createdAtMs: 3000,
      updatedAtMs: 3000,
    },
  ];

  const ranked = assignParticipantRanks(sample);
  assert.equal(ranked[0].id, 'p2');
  assert.equal(ranked[0].rank, 1);
  assert.equal(ranked[1].id, 'p3');
  assert.equal(ranked[1].rank, 2);

  const searched = filterSortPaginateParticipants(sample, {
    searchQuery: 'الرياض',
    sortMode: 'most',
    page: 1,
    pageSize: 10,
  });
  assert.equal(searched.totalFiltered, 1);
  assert.equal(searched.items[0].id, 'p2');

  const pagedNewest = filterSortPaginateParticipants(sample, {
    searchQuery: '',
    sortMode: 'newest',
    page: 1,
    pageSize: 2,
  });
  assert.equal(pagedNewest.totalPages, 2);
  assert.equal(pagedNewest.items[0].id, 'p3');
  assert.equal(pagedNewest.items[1].id, 'p2');
});

test('getRiyadhDateKeys produces properly formatted ISO keys', () => {
  const keys = getRiyadhDateKeys(new Date('2026-11-24T10:00:00Z'));
  assert.match(keys.todayDate, /^\d{4}-\d{2}-\d{2}$/);
  assert.match(keys.weekKey, /^\d{4}-W\d{2}$/);
  assert.match(keys.monthKey, /^\d{4}-\d{2}$/);
});

test('computeAdminAnalytics aggregates period totals and detects rapid bursts', () => {
  const keys = { todayDate: '2026-11-24', weekKey: '2026-W48', monthKey: '2026-11' };
  const logs: IstighfarLog[] = Array.from({ length: 16 }, (_, idx) => ({
    id: `log_${idx}`,
    participantId: 'bot_1',
    count: 100,
    actionType: 'increment' as const,
    date: '2026-11-24',
    weekKey: '2026-W48',
    monthKey: '2026-11',
    createdAtMs: 1_700_000_000_000 + idx * 400,
  }));

  const summary = computeAdminAnalytics(logs, keys);
  assert.equal(summary.todayFromLogs, 1600);
  assert.equal(summary.rapidBursts.length, 1);
  assert.equal(summary.rapidBursts[0].participantId, 'bot_1');
});
