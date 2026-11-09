import assert from 'node:assert/strict';
import test from 'node:test';
import { patchAlreadyApplied, sameValue } from '../src/data/powersync/stale-patch.ts';

const server = { id: 'a', volume_ml: 12000, rate_paise_per_litre: 4500, deleted_at: null, is_milking: true, updated_at: '2026-10-19T21:11:12.500+00:00', updated_by: 'u1', version: 7 };

test('replayed batch: server already holds every patched value', () => {
  assert.equal(patchAlreadyApplied({ volume_ml: 12000, rate_paise_per_litre: 4500, updated_at: '2026-10-19T21:11:12.100Z', updated_by: 'u1' }, server), true);
});

test('server-owned columns never block or decide the result', () => {
  assert.equal(patchAlreadyApplied({ volume_ml: 12000, updated_at: '1999-01-01T00:00:00.000Z', updated_by: 'someone-else' }, server), true);
});

test('any differing value is a real conflict', () => {
  assert.equal(patchAlreadyApplied({ volume_ml: 12000, rate_paise_per_litre: 5000 }, server), false);
});

test('edit overwritten later by another edit stays a conflict', () => {
  assert.equal(patchAlreadyApplied({ volume_ml: 9000 }, server), false);
});

test('timestamp-only patch (unchanged auto-save) carries no data, so it counts as applied', () => {
  assert.equal(patchAlreadyApplied({}, server), true);
  assert.equal(patchAlreadyApplied({ updated_at: '2026-10-20T08:00:00.000Z', updated_by: 'u1' }, server), true);
});

test('timestamp-only patch still needs the server row to exist', () => {
  assert.equal(patchAlreadyApplied({ updated_at: '2026-10-20T08:00:00.000Z' }, null), false);
});

test('missing or hidden server row is never treated as applied', () => {
  assert.equal(patchAlreadyApplied({ volume_ml: 12000 }, null), false);
  assert.equal(patchAlreadyApplied({ volume_ml: 12000 }, undefined), false);
});

test('column absent on the server row does not match a real value', () => {
  assert.equal(patchAlreadyApplied({ not_a_column: 5 }, server), false);
});

test('soft delete replay: timestamp formats differ but instant is equal', () => {
  const deleted = { ...server, deleted_at: '2026-10-19T21:11:12.123+00:00' };
  assert.equal(patchAlreadyApplied({ deleted_at: '2026-10-19T21:11:12.123Z' }, deleted), true);
  assert.equal(patchAlreadyApplied({ deleted_at: '2026-10-19T21:11:12.124Z' }, deleted), false);
});

test('soft delete not yet applied on the server stays a conflict', () => {
  assert.equal(patchAlreadyApplied({ deleted_at: '2026-10-19T21:11:12.123Z' }, server), false);
});

test('sqlite 0/1 versus postgres boolean', () => {
  assert.equal(sameValue(1, true), true);
  assert.equal(sameValue(0, false), true);
  assert.equal(sameValue(1, false), false);
});

test('null handling', () => {
  assert.equal(sameValue(null, undefined), true);
  assert.equal(sameValue(null, 0), false);
  assert.equal(sameValue('', null), false);
});

test('numbers versus numeric strings (bigint columns)', () => {
  assert.equal(sameValue(12000, '12000'), true);
  assert.equal(sameValue(12000, '12001'), false);
  assert.equal(sameValue(12000, 'abc'), false);
});

test('plain dates compare as exact strings', () => {
  assert.equal(sameValue('2026-10-19', '2026-10-19'), true);
  assert.equal(sameValue('2026-10-19', '2026-10-20'), false);
});

test('structured values are compared conservatively', () => {
  assert.equal(sameValue('{"a":1}', { a: 1 }), false);
  assert.equal(sameValue({ a: 1 }, { a: 1 }), true);
});
