import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCardData } from '../dist/share-card.js';

const now = Date.UTC(2026, 9, 15, 10, 30);
function order(overrides = {}) {
  return {
    id: 'HS-demo-42', status: 'searching', amount: 1000, minReceive: 389000,
    give: { currency: 'USDT', method: 'crypto', network: 'TRC20' },
    receive: { currency: 'AMD', method: 'cash', city: 'Ереван', address: 'Северный проспект, вход рядом с кафе' },
    quotes: [], ...overrides,
  };
}

test('sharing excludes exact location unless it is explicitly opted in', () => {
  const source = order();
  for (const includeAddress of [undefined, false, 'true', 1]) {
    const data = buildCardData(source, { now, includeAddress });
    assert.equal(data.receive.address, '');
    assert.deepEqual(data.addresses, []);
    assert.ok(!JSON.stringify(data).includes(source.receive.address));
    assert.ok(data.caption.includes('Ереван'));
  }
  const shared = buildCardData(source, { now, includeAddress: true });
  assert.equal(shared.addresses[0].value, source.receive.address);
  assert.ok(shared.caption.includes(source.receive.address));
});

test('private provider, contact, KYC and settlement details never enter card data', () => {
  const source = order({
    provider: { name: 'PRIVATE_PROVIDER', margin: 'PRIVATE_MARGIN' },
    contact: 'PRIVATE_CONTACT', kyc: 'PRIVATE_KYC', accountNumber: 'PRIVATE_ACCOUNT',
    paymentDetails: {
      give: { endpoint: { private: 'PRIVATE_ENDPOINT' }, values: { holder: 'PRIVATE_HOLDER', account: 'PRIVATE_ACCOUNT', wallet: 'PRIVATE_WALLET', memo: 'PRIVATE_MEMO' }, savedAt: now },
      receive: { values: { meetingPlace: 'PRIVATE_EXACT_MEETING', meetingTime: 'PRIVATE_MEETING_TIME' } },
    },
    problem: { description: 'PRIVATE_DISPUTE_TEXT', contact: 'PRIVATE_DISPUTE_CONTACT' },
    problems: [{ message: 'PRIVATE_ISSUE_MESSAGE' }],
    give: { currency: 'USDT', method: 'crypto', network: 'TRC20', address: 'PRIVATE_WALLET', wallet: 'PRIVATE_WALLET' },
    receive: { currency: 'AMD', method: 'cash', city: 'Ереван', address: 'Public meeting point', contact: 'PRIVATE_CONTACT' },
    quotes: [{ id: 'quote-1', amount: 390500, status: 'accepted', providerName: 'PRIVATE_PROVIDER', commission: 'PRIVATE_COMMISSION' }],
  });
  const serialized = JSON.stringify(buildCardData(source, { now, includeAddress: true }));
  assert.ok(!serialized.includes('PRIVATE_'));
  assert.ok(serialized.includes('Public meeting point'));
});

test('accepted price wins over matched amount and minimum without sharing other quotes', () => {
  const source = order({ status: 'agreed', acceptedQuoteId: 'accepted', matchedReceive: 390000,
    quotes: [{ id: 'pending', amount: 999999, status: 'pending' }, { id: 'accepted', amount: 391250, status: 'accepted' }] });
  const data = buildCardData(source, { language: 'en', now });
  assert.equal(data.receive.amount, 391250);
  assert.equal(data.minimum, false);
  assert.ok(data.caption.includes('I receive: 391,250 AMD'));
  assert.ok(!data.caption.includes('999,999'));
  assert.ok(!data.caption.includes('at least'));
});

test('matched requests use reserved amount, searching requests show their minimum', () => {
  const matched = buildCardData(order({ status: 'matched', matchedReceive: 390100 }), { now });
  assert.equal(matched.receive.amount, 390100);
  assert.equal(matched.minimum, false);
  const searching = buildCardData(order({ matchedReceive: 500000 }), { now });
  assert.equal(searching.receive.amount, 389000);
  assert.equal(searching.minimum, true);
  assert.ok(searching.caption.includes('Получаю от'));
});

test('English cards localize cities, banks, methods and status without changing the order', () => {
  const source = order({ give: { currency: 'RUB', method: 'bank', bank: 'tbank' }, receive: { currency: 'USD', method: 'cash', city: 'Дубай' }, amount: 100000, minReceive: 1000 });
  const before = JSON.stringify(source);
  const data = buildCardData(source, { language: 'en', now });
  assert.equal(data.give.detail, 'T-Bank');
  assert.equal(data.give.methodLabel, 'Bank transfer');
  assert.deepEqual(data.cities, ['Dubai']);
  assert.equal(data.status, 'Open');
  assert.ok(!/[А-Яа-яЁё]/.test(data.caption));
  assert.equal(JSON.stringify(source), before);
});

test('partial exchanges share the committed amounts and a partial-fill label', () => {
  const matched = buildCardData(order({ partial: true, status: 'matched', matchedGive: 400, matchedReceive: 156000 }), { now });
  assert.equal(matched.give.amount, 400);
  assert.equal(matched.receive.amount, 156000);
  assert.equal(matched.partial, true);
  assert.ok(matched.caption.includes('Можно частями'));
  const accepted = buildCardData(order({ partial: true, status: 'agreed', matchedGive: 400, matchedReceive: 156000,
    acceptedQuoteId: 'q-1', quotes: [{ id: 'q-1', status: 'accepted', giveAmount: 300, amount: 117500 }],
  }), { language: 'en', now });
  assert.equal(accepted.give.amount, 300);
  assert.equal(accepted.receive.amount, 117500);
  assert.ok(accepted.caption.includes('Partial fills allowed'));
  assert.ok(accepted.caption.includes('I give: 300 USDT'));
});

test('searching cards ignore stale matched quantities and malformed partial flags', () => {
  const searching = buildCardData(order({ partial: 'true', matchedGive: 50 }), { language: 'en', now });
  assert.equal(searching.give.amount, 1000);
  assert.equal(searching.partial, false);
  assert.ok(!searching.caption.includes('Partial fills allowed'));
  for (const matchedGive of [0, -1, NaN, Infinity]) {
    assert.equal(buildCardData(order({ status: 'matched', matchedGive }), { now }).give.amount, 1000);
  }
});

test('share cards use the same simplified exchange statuses in both languages', () => {
  const statuses = [
    ['searching', 'Открыта', 'Open'], ['matched', 'Открыта', 'Open'],
    ['agreed', 'В процессе', 'In progress'], ['completed', 'Состоялась', 'Completed'],
    ['cancelled', 'Отменена', 'Cancelled'],
  ];
  for (const [status, ru, en] of statuses) {
    assert.equal(buildCardData(order({ status }), { language: 'ru', now }).status, ru);
    assert.equal(buildCardData(order({ status }), { language: 'en', now }).status, en);
  }
});

test('card boundary rejects unknown endpoint data and invalid numeric values', () => {
  const data = buildCardData(order({ id: 'contact@example.com', amount: Infinity,
    give: { currency: 'PRIVATE_CURRENCY', method: 'PRIVATE_METHOD', bank: 'PRIVATE_BANK' },
    receive: { currency: 'AMD', method: 'cash', city: 'PRIVATE_CITY', address: 'secret' },
    quotes: [{ status: 'accepted', amount: NaN }],
  }), { now });
  assert.equal(data.id, 'HS');
  assert.equal(data.give.amount, null);
  assert.equal(data.give.amountText, '—');
  assert.equal(data.receive.amount, 389000);
  assert.ok(!JSON.stringify(data).includes('PRIVATE_'));
  assert.ok(!data.caption.includes('contact@example.com'));
});

test('crypto payouts preserve all six decimals, including a one-micro-unit amount', () => {
  const source = order({
    give: { currency: 'USDC', method: 'crypto', network: 'Solana' }, amount: 12.345678,
    receive: { currency: 'USDT', method: 'crypto', network: 'TRC20' }, minReceive: 0.000001,
  });
  const english = buildCardData(source, { language: 'en', now });
  assert.equal(english.give.amountText, '12.345678');
  assert.equal(english.receive.amountText, '0.000001');
  assert.ok(english.caption.includes('0.000001 USDT'));
  const russian = buildCardData(source, { language: 'ru', now });
  assert.equal(russian.give.amountText, '12,345678');
  assert.equal(russian.receive.amountText, '0,000001');
});
