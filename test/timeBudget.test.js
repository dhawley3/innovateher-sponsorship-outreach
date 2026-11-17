const test = require('node:test');
const assert = require('node:assert/strict');
const { hasTimeBudgetRemaining_ } = require('./loadSrc')('TimeBudget.js');

test('true when well under budget', () => {
  assert.equal(hasTimeBudgetRemaining_(0, 1000, 60000), true);
});

test('false the instant elapsed time reaches the budget', () => {
  assert.equal(hasTimeBudgetRemaining_(0, 60000, 60000), false);
});

test('false once elapsed time exceeds the budget', () => {
  assert.equal(hasTimeBudgetRemaining_(0, 90000, 60000), false);
});

test('true immediately at start (zero elapsed)', () => {
  assert.equal(hasTimeBudgetRemaining_(1000, 1000, 60000), true);
});
