import test from 'node:test';
import assert from 'node:assert/strict';
import { LANGUAGES, translate, parseNumber, formatNumber, formatTime } from '../dist/i18n.js';
import { seedState, createOrder, amountFor } from '../dist/domain.js';

test('Russian and English amount formats preserve the actual exchange amount', () => {
  for (const language of ['ru', 'en']) {
    for (const amount of [0, 100000, 410526.32, 1234567.89]) {
      assert.equal(parseNumber(formatNumber(amount, language), language), amount);
    }
    const state = seedState();
    const result = createOrder(state, {
      give: { currency: 'RUB', method: 'bank', bank: 'tbank' },
      receive: { currency: 'AMD', method: 'cash', city: 'Ереван', address: 'Демо: площадь Республики' },
      amount: parseNumber(formatNumber(100000, language), language),
      minReceive: parseNumber(formatNumber(amountFor(100000, 'RUB', 'AMD'), language), language),
    });
    assert.equal(result.amount, 100000);
    assert.equal(result.status, 'matched');
  }
});

test('locale parsing supports decimal keyboard input and rejects ambiguous or malformed grouping', () => {
  assert.equal(parseNumber('1\u202f234\u00a0567,89', 'ru'), 1234567.89);
  assert.equal(parseNumber('1234.56', 'ru'), 1234.56);
  assert.equal(parseNumber('1,234,567.89', 'en'), 1234567.89);
  assert.equal(parseNumber('0.5', 'en'), 0.5);
  for (const [value, language] of [['12,34', 'en'], ['1,2,3', 'en'], ['1.234,56', 'ru'], ['', 'en'], ['Infinity', 'en'], ['1e6', 'ru']]) {
    assert.ok(Number.isNaN(parseNumber(value, language)), `${value} must not silently become a different amount`);
  }
});

test('display translation leaves stored cities, currencies and source strings intact', () => {
  const source = 'Наличные · Дубай';
  assert.equal(translate(source, 'en'), 'Cash · Dubai');
  assert.equal(translate(source, 'ru'), source);
  assert.equal(translate('USDT · TRC20', 'en'), 'USDT · TRC20');
  assert.equal(translate('ЗаявкаXYZ', 'en'), 'ЗаявкаXYZ');
  assert.equal(translate('  Мои заявки  ', 'en'), '  My requests  ');
  assert.deepEqual(LANGUAGES.map(item => item.code), ['ru', 'en']);
});

test('time labels and unsupported-language fallback are deterministic', () => {
  const timestamp = new Date(2026, 9, 15, 13, 27).getTime();
  assert.equal(formatTime(timestamp, 'en'), '13:27');
  assert.equal(formatTime(timestamp, 'ru'), '13:27');
  assert.equal(translate('Наличные', 'unknown'), 'Наличные');
});
