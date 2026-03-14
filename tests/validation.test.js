/**
 * RF Social Studio — localStorage schema validation tests
 * Uses Node.js built-in test runner (node:test) — no external deps.
 *
 * Run: node --test tests/validation.test.js
 *
 * Tests the data validation logic that guards against corrupt/malicious
 * localStorage data being loaded into the application state.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

// ── Replicate the constants and validation logic from App.jsx ──────────────

const PLATFORMS = {
  ig_post:  { label: 'IG Post',  color: '#BE185D' },
  ig_story: { label: 'IG Story', color: '#9333EA' },
  linkedin: { label: 'LinkedIn', color: '#0A66C2' },
};

const STATUSES = {
  idea:         { label: 'Idea'         },
  draft:        { label: 'Draft'        },
  needs_review: { label: 'Needs Review' },
  approved:     { label: 'Approved'     },
  scheduled:    { label: 'Scheduled'    },
  posted:       { label: 'Posted'       },
};

const MAX_NOTE_LENGTH   = 280;
const MAX_CAPTION_LG    = 3000;
const MAX_CAPTION_IG    = 2200;

function isValidRow(r) {
  return !!(r && typeof r === 'object' &&
    typeof r.id === 'string' &&
    (r.scheduledAt === null || r.scheduledAt === undefined || typeof r.scheduledAt === 'string') &&
    typeof r.platform === 'string' &&
    typeof r.status === 'string' &&
    // Use Object.hasOwn to avoid prototype-chain lookups (__proto__, constructor, etc.)
    Object.hasOwn(PLATFORMS, r.platform) &&
    Object.hasOwn(STATUSES, r.status));
}

function clampNote(v)    { return typeof v === 'string' ? v.slice(0, MAX_NOTE_LENGTH)    : ''; }
function clampCaption(v, platform) {
  const max = platform === 'linkedin' ? MAX_CAPTION_LG : MAX_CAPTION_IG;
  return typeof v === 'string' ? v.slice(0, max) : '';
}

// Simulate safe localStorage (in-memory map, no browser required)
const store = new Map();
function lsSet(key, value) {
  try {
    if (value == null) store.delete(key);
    else store.set(key, JSON.stringify(value));
    return true;
  } catch { return false; }
}
function lsGet(key) {
  try { return JSON.parse(store.get(key) || 'null'); } catch { return null; }
}

function loadRows() {
  try {
    const raw = lsGet('rf_rows');
    if (!Array.isArray(raw)) return null;
    const valid = raw.filter(isValidRow);
    return valid.length > 0 ? valid : null;
  } catch { return null; }
}

// ── Helper to make a minimal valid row ────────────────────────────────────
function makeRow(overrides = {}) {
  return {
    id: 'test_' + Math.random().toString(36).slice(2),
    scheduledAt: new Date().toISOString(),
    note: 'Test post',
    caption: '',
    platform: 'ig_post',
    status: 'idea',
    assignee: null,
    comments: [],
    storyElements: null,
    order: 0,
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe('isValidRow — schema validation', () => {
  test('accepts a fully valid row', () => {
    assert.equal(isValidRow(makeRow()), true);
  });

  test('accepts row with null scheduledAt', () => {
    assert.equal(isValidRow(makeRow({ scheduledAt: null })), true);
  });

  test('accepts row with undefined scheduledAt', () => {
    assert.equal(isValidRow(makeRow({ scheduledAt: undefined })), true);
  });

  test('accepts all valid platform values', () => {
    for (const platform of Object.keys(PLATFORMS)) {
      assert.equal(isValidRow(makeRow({ platform })), true, `platform=${platform}`);
    }
  });

  test('accepts all valid status values', () => {
    for (const status of Object.keys(STATUSES)) {
      assert.equal(isValidRow(makeRow({ status })), true, `status=${status}`);
    }
  });

  test('rejects null', () => {
    assert.equal(isValidRow(null), false);
  });

  test('rejects undefined', () => {
    assert.equal(isValidRow(undefined), false);
  });

  test('rejects a string', () => {
    assert.equal(isValidRow('not a row'), false);
  });

  test('rejects row with missing id', () => {
    const r = makeRow();
    delete r.id;
    assert.equal(isValidRow(r), false);
  });

  test('rejects row with numeric id', () => {
    assert.equal(isValidRow(makeRow({ id: 12345 })), false);
  });

  test('rejects row with missing platform', () => {
    const r = makeRow();
    delete r.platform;
    assert.equal(isValidRow(r), false);
  });

  test('rejects row with unknown platform', () => {
    assert.equal(isValidRow(makeRow({ platform: 'tiktok' })), false);
    assert.equal(isValidRow(makeRow({ platform: '' })), false);
    assert.equal(isValidRow(makeRow({ platform: '__proto__' })), false);
  });

  test('rejects row with unknown status', () => {
    assert.equal(isValidRow(makeRow({ status: 'published' })), false);
    assert.equal(isValidRow(makeRow({ status: '' })), false);
  });

  test('rejects row with non-string scheduledAt', () => {
    assert.equal(isValidRow(makeRow({ scheduledAt: 1234567890 })), false);
    assert.equal(isValidRow(makeRow({ scheduledAt: {} })), false);
  });
});

describe('loadRows — persistence layer', () => {
  test('returns null when storage is empty', () => {
    store.clear();
    assert.equal(loadRows(), null);
  });

  test('returns null when stored value is not an array', () => {
    store.clear();
    lsSet('rf_rows', { not: 'an array' });
    assert.equal(loadRows(), null);
  });

  test('returns null when stored value is corrupt JSON', () => {
    store.clear();
    store.set('rf_rows', 'this is not json {{{');
    assert.equal(loadRows(), null);
  });

  test('loads valid rows correctly', () => {
    store.clear();
    const rows = [makeRow(), makeRow({ platform: 'linkedin', status: 'draft' })];
    lsSet('rf_rows', rows);
    const loaded = loadRows();
    assert.ok(Array.isArray(loaded));
    assert.equal(loaded.length, 2);
  });

  test('filters out corrupt rows and keeps valid ones', () => {
    store.clear();
    const goodRow = makeRow();
    const badRow  = { id: 'bad', platform: 'tiktok', status: 'UNKNOWN' }; // invalid
    lsSet('rf_rows', [goodRow, badRow]);
    const loaded = loadRows();
    assert.ok(Array.isArray(loaded));
    assert.equal(loaded.length, 1);
    assert.equal(loaded[0].id, goodRow.id);
  });

  test('returns null when all stored rows are corrupt', () => {
    store.clear();
    lsSet('rf_rows', [{ id: 'x', platform: 'bad', status: 'bad' }]);
    assert.equal(loadRows(), null);
  });

  test('handles array with null entries', () => {
    store.clear();
    lsSet('rf_rows', [null, makeRow(), undefined]);
    const loaded = loadRows();
    assert.ok(Array.isArray(loaded));
    assert.equal(loaded.length, 1); // only the valid row
  });
});

describe('clampNote — input length limiting', () => {
  test('returns empty string for non-string input', () => {
    assert.equal(clampNote(null), '');
    assert.equal(clampNote(undefined), '');
    assert.equal(clampNote(42), '');
  });

  test('passes through strings within limit', () => {
    const short = 'Hello world';
    assert.equal(clampNote(short), short);
  });

  test('clamps strings exceeding MAX_NOTE_LENGTH', () => {
    const long = 'a'.repeat(MAX_NOTE_LENGTH + 100);
    const clamped = clampNote(long);
    assert.equal(clamped.length, MAX_NOTE_LENGTH);
  });

  test('accepts exactly MAX_NOTE_LENGTH characters', () => {
    const exact = 'a'.repeat(MAX_NOTE_LENGTH);
    assert.equal(clampNote(exact).length, MAX_NOTE_LENGTH);
  });
});

describe('clampCaption — platform-aware length limiting', () => {
  test('uses LinkedIn limit for linkedin platform', () => {
    const long = 'a'.repeat(MAX_CAPTION_LG + 100);
    const clamped = clampCaption(long, 'linkedin');
    assert.equal(clamped.length, MAX_CAPTION_LG);
  });

  test('uses Instagram limit for ig_post platform', () => {
    const long = 'a'.repeat(MAX_CAPTION_IG + 100);
    const clamped = clampCaption(long, 'ig_post');
    assert.equal(clamped.length, MAX_CAPTION_IG);
  });

  test('uses Instagram limit for ig_story platform', () => {
    const long = 'a'.repeat(MAX_CAPTION_IG + 100);
    const clamped = clampCaption(long, 'ig_story');
    assert.equal(clamped.length, MAX_CAPTION_IG);
  });

  test('LinkedIn limit is larger than Instagram limit', () => {
    assert.ok(MAX_CAPTION_LG > MAX_CAPTION_IG, 'LinkedIn should allow longer captions');
  });

  test('returns empty string for non-string input', () => {
    assert.equal(clampCaption(null, 'ig_post'), '');
    assert.equal(clampCaption(undefined, 'linkedin'), '');
  });
});

describe('lsSet / lsGet — safe storage helpers', () => {
  test('round-trips a valid object', () => {
    store.clear();
    const obj = { foo: 'bar', n: 42 };
    lsSet('test_key', obj);
    assert.deepEqual(lsGet('test_key'), obj);
  });

  test('returns null for missing key', () => {
    store.clear();
    assert.equal(lsGet('nonexistent'), null);
  });

  test('returns null when stored value is corrupt JSON', () => {
    store.set('bad_key', 'not json {{');
    assert.equal(lsGet('bad_key'), null);
  });

  test('deletes key when value is null', () => {
    store.clear();
    lsSet('to_delete', { data: 'yes' });
    lsSet('to_delete', null);
    assert.equal(lsGet('to_delete'), null);
  });

  test('round-trips an array of rows', () => {
    store.clear();
    const rows = [makeRow(), makeRow()];
    lsSet('rf_rows', rows);
    const loaded = lsGet('rf_rows');
    assert.ok(Array.isArray(loaded));
    assert.equal(loaded.length, 2);
  });
});
