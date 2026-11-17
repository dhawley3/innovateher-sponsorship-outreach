const test = require('node:test');
const assert = require('node:assert/strict');
const { cleanOrganizationName_ } = require('./loadSrc')('Apollo.js');

test('leaves a plain name untouched', () => {
  assert.equal(cleanOrganizationName_('Babbel'), 'Babbel');
});

test('strips a single trailing suffix', () => {
  assert.equal(cleanOrganizationName_('Acme Inc.'), 'Acme');
});

test('strips multiple stacked suffixes', () => {
  assert.equal(cleanOrganizationName_('Acme Corp. Group'), 'Acme');
});

test('strips a .com suffix with no preceding space', () => {
  assert.equal(cleanOrganizationName_('memrise.com'), 'memrise');
});

test('trims surrounding whitespace', () => {
  assert.equal(cleanOrganizationName_('  Acme  '), 'Acme');
});

test('handles empty/missing input without throwing', () => {
  assert.equal(cleanOrganizationName_(''), '');
  assert.equal(cleanOrganizationName_(null), '');
  assert.equal(cleanOrganizationName_(undefined), '');
});

test('does not strip a suffix-like substring that is not actually a trailing suffix', () => {
  assert.equal(cleanOrganizationName_('Company House'), 'Company House');
});
