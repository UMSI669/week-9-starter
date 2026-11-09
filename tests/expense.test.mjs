import test from 'node:test';
import assert from 'node:assert/strict';
import { amountToCents, decodeExpenses, parseExpenseTranscript } from '../src/lib/expense.js';

test('parses numeric, decimal, and word amounts with categories', () => {
  assert.deepEqual(parseExpenseTranscript('I spent 12 dollars on lunch.'), { amount: '12.00', category: 'Food', description: 'lunch', ambiguous: false });
  assert.deepEqual(parseExpenseTranscript('I spent 4.50 dollars on coffee.'), { amount: '4.50', category: 'Food', description: 'coffee', ambiguous: false });
  assert.equal(parseExpenseTranscript('I spent $8 on parking.').category, 'Transportation');
  assert.equal(parseExpenseTranscript('I spent twelve dollars for groceries.').amount, '12.00');
  assert.equal(parseExpenseTranscript('I spent 20 dollars on a movie.').category, 'Entertainment');
  assert.equal(parseExpenseTranscript('I spent 5 dollars on a shirt.').category, 'Shopping');
  assert.equal(parseExpenseTranscript('I spent 5 dollars on soap.').category, 'Other');
});

test('does not guess a missing or ambiguous amount', () => {
  assert.equal(parseExpenseTranscript('I bought coffee.').amount, '');
  const result = parseExpenseTranscript('I spent 12 or 13 dollars on lunch.');
  assert.equal(result.amount, '');
  assert.equal(result.ambiguous, true);
});

test('validates whole dollar input and integer cents', () => {
  assert.equal(amountToCents('$12.00'), 1200);
  assert.equal(amountToCents('3.50'), 350);
  assert.equal(1200 + 350, 1550);
  for (const value of ['0', '-1', '2.345', '12abc', '1e3', 'Infinity', '90071992547409.92']) assert.equal(amountToCents(value), null);
});

test('rejects malformed saved data', () => {
  assert.deepEqual(decodeExpenses(null), []);
  assert.throws(() => decodeExpenses('{oops'));
  assert.throws(() => decodeExpenses('[{"id":"x"}]'));
});
