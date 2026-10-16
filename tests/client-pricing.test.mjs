import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateClientPricing, rateDisplay } from '../dist/client-pricing.js';
import { referenceRate, formatAmount } from '../dist/domain.js';

const draft = (changes = {}) => ({ give: { currency: 'AMD' }, receive: { currency: 'USDT' }, amount: 100000, ...changes });

test('automatic pricing defaults to the precise reference rate and respects an explicit minimum', () => {
  const input = draft();
  const before = structuredClone(input);
  const rate = referenceRate('AMD', 'USDT');
  assert.equal(rate, 1 / 390);
  const calculated = calculateClientPricing(input, { referenceRate: rate });
  assert.deepEqual(calculated, { pricingMode: 'auto', amount: 100000, minReceive: 256.410256, rate: 256.410256 / 100000 });
  assert.equal(calculateClientPricing(draft({ minReceive: 270.123456 })).minReceive, 270.123456);
  assert.deepEqual(input, before);
});

test('manual rate is authoritative, retained at full precision and respects currency units', () => {
  const rate = 0.002623456789;
  const result = calculateClientPricing(draft({ pricingMode: 'manual', manualRate: rate, minReceive: 1 }));
  assert.equal(result.manualRate, rate);
  assert.equal(result.rate, rate);
  assert.equal(result.minReceive, 262.345679);
  const fiat = calculateClientPricing({ give: { currency: 'USDT' }, receive: { currency: 'EUR' }, amount: 1.000001, pricingMode: 'manual', manualRate: 0.92 });
  assert.equal(fiat.amount, 1.000001);
  assert.equal(fiat.minReceive, 0.93);
  assert.ok(fiat.minReceive >= fiat.amount * fiat.manualRate);
  const decimal = calculateClientPricing({ give: { currency: 'USD' }, receive: { currency: 'EUR' }, amount: 0.1, pricingMode: 'manual', manualRate: 0.2 });
  assert.equal(decimal.minReceive, 0.02);
});

test('invalid modes, rates, amounts and arithmetic overflow are rejected without changing the draft', () => {
  for (const manualRate of [null, false, [], {}, '', ' ', 0, -1, NaN, Infinity]) {
    const input = draft({ pricingMode: 'manual', manualRate });
    const before = structuredClone(input);
    assert.throws(() => calculateClientPricing(input), /Свой курс/);
    assert.deepEqual(input, before);
  }
  for (const pricingMode of [null, false, 'market', 1]) assert.throws(() => calculateClientPricing(draft({ pricingMode })), /Выберите автоматический/);
  for (const amount of [null, false, [], '', 0, -1, NaN, Infinity, 0.001]) assert.throws(() => calculateClientPricing(draft({ amount }), { referenceRate: 1 }));
  assert.throws(() => calculateClientPricing(draft({ pricingMode: 'manual', manualRate: 1e308 })), /слишком велика/);
  assert.throws(() => calculateClientPricing(draft({ minReceive: Infinity })), /Минимальная сумма/);
  assert.throws(() => calculateClientPricing(draft()), /Демонстрационный курс/);
});

test('display bases keep tiny pairs visible without changing their execution rate', () => {
  const rate = referenceRate('AMD', 'USDT');
  const display = rateDisplay(rate);
  assert.equal(display.base, 1000);
  assert.equal(display.quote, rate * 1000);
  assert.deepEqual(rateDisplay(0.01), { base: 1, quote: 0.01 });
  assert.deepEqual(rateDisplay(0.92), { base: 1, quote: 0.92 });
  assert.deepEqual(rateDisplay(500), { base: 1, quote: 500 });
  for (const value of [0, -1, Infinity, NaN, '', null]) assert.throws(() => rateDisplay(value));
  const amount = calculateClientPricing(draft(), { referenceRate: rate }).minReceive;
  assert.equal(amount, 256.410256);
  assert.equal(formatAmount(amount), '256,41');
  assert.equal(formatAmount(1), '1,00');
  assert.equal(formatAmount(0), '0,00');
});
