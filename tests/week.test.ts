import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getWeekId, weekLabel } from '../utils/week';

test('Saturday 23:59 and Sunday 00:00 are different local weeks', () => {
  assert.equal(getWeekId(new Date(2026, 10, 7, 23, 59, 59)), '2026-11-01');
  assert.equal(getWeekId(new Date(2026, 10, 8, 0, 0)), '2026-11-08');
});
test('the November DST transition stays in the same Sunday week', () => {
  assert.equal(getWeekId(new Date('2026-11-01T01:30:00-04:00')), '2026-11-01');
  assert.equal(getWeekId(new Date('2026-11-01T01:30:00-05:00')), '2026-11-01');
  assert.equal(getWeekId(new Date(2026, 9, 31, 23, 59)), '2026-10-25');
});
test('week boundaries handle a year rollover', () => {
  assert.equal(getWeekId(new Date(2027, 0, 1)), '2026-12-27');
  assert.equal(getWeekId(new Date(2027, 0, 3)), '2027-01-03');
  assert.equal(weekLabel('2026-12-27'), 'Dec 27 – Jan 2');
});
