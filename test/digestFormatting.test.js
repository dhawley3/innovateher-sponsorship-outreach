const test = require('node:test');
const assert = require('node:assert/strict');
const { formatSkippedForDigest_: formatSkippedRaw } = require('./loadSrc')('DigestFormatting.js');

// The sandboxed function returns an Array from the vm context's realm, whose prototype
// differs from this file's Array -- deepStrictEqual treats that as a mismatch even when
// the contents are identical, so normalize to a plain host-realm array first.
function formatSkippedForDigest_(skipped) {
  return Array.from(formatSkippedRaw(skipped));
}

test('reports nothing skipped when the list is empty', () => {
  assert.deepEqual(formatSkippedForDigest_([]), ['  (nothing skipped)']);
});

test('reports nothing skipped when given undefined', () => {
  assert.deepEqual(formatSkippedForDigest_(undefined), ['  (nothing skipped)']);
});

test('groups multiple sponsors under the same reason into one line', () => {
  const lines = formatSkippedForDigest_([
    { sponsorName: 'SalesForce', reason: 'No Purdue email on file for "Ria"' },
    { sponsorName: 'StateFarm', reason: 'No Purdue email on file for "Ria"' }
  ]);
  assert.deepEqual(lines, ['  - No Purdue email on file for "Ria": SalesForce, StateFarm']);
});

test('keeps distinct reasons on separate lines, in first-seen order', () => {
  const lines = formatSkippedForDigest_([
    { sponsorName: 'Babbel', reason: 'No contact found' },
    { sponsorName: 'Memrise', reason: 'already hit the 8-draft cap for this run' },
    { sponsorName: 'Duolingo', reason: 'No contact found' }
  ]);
  assert.deepEqual(lines, [
    '  - No contact found: Babbel, Duolingo',
    '  - already hit the 8-draft cap for this run: Memrise'
  ]);
});

test('falls back to "unknown reason" when reason is missing', () => {
  const lines = formatSkippedForDigest_([{ sponsorName: 'Mystery Co' }]);
  assert.deepEqual(lines, ['  - unknown reason: Mystery Co']);
});
