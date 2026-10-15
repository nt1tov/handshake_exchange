import test from 'node:test';
import assert from 'node:assert/strict';
import {
  seedState, createOrder, findMatch, acceptMatch, cancelOrder,
  submitQuote, acceptQuote, addDirection, isDirectionCompatible, amountFor,
  confirmSettlement, providerMetrics, migrateState,
  toggleDirection,
} from '../dist/domain.js';

const input = () => ({
  give: { currency: 'RUB', method: 'bank', bank: 'tbank' },
  receive: { currency: 'AMD', method: 'cash', city: 'Ереван', address: 'Демо: площадь Республики, 1' },
  amount: 100000, minReceive: amountFor(100000, 'RUB', 'AMD'),
});

test('opposing compatible orders reserve both full amounts and cannot reuse a peer', () => {
  const state = seedState();
  const first = createOrder(state, input());
  assert.equal(first.status, 'matched');
  assert.equal(first.matchedOrderId, 'HS-1038');
  assert.equal(state.orders.find((order) => order.id === 'HS-1038').matchedOrderId, first.id);
  const second = createOrder(state, input());
  assert.equal(second.status, 'searching');
  assert.equal(findMatch(state, second), null);
  acceptMatch(state, first.id);
  assert.equal(first.status, 'agreed');
  assert.equal(state.orders.find((order) => order.id === 'HS-1038').status, 'agreed');
  assert.throws(() => cancelOrder(state, first.id), /Завершённую/);
});

test('matching requires opposite bank, city, currency and network compatibility', () => {
  for (const change of [
    (candidate) => { candidate.receive.bank = 'sber'; },
    (candidate) => { candidate.give.city = 'Москва'; },
    (candidate) => { candidate.give.currency = 'USD'; },
    (candidate) => { candidate.receive.method = 'cash'; candidate.receive.city = 'Москва'; },
  ]) {
    const state = seedState();
    change(state.orders.find((order) => order.id === 'HS-1038'));
    assert.equal(createOrder(state, input()).status, 'searching');
  }
  const state = seedState();
  state.orders = [{
    id: 'crypto-peer', owner: 'peer', give: { currency: 'USDT', method: 'crypto', network: 'ERC20' },
    receive: input().give, amount: 1052.64, minReceive: 100000, status: 'searching', quotes: [],
  }];
  assert.equal(createOrder(state, { ...input(), receive: { currency: 'USDT', method: 'crypto', network: 'TRC20' }, minReceive: 1050 }).status, 'searching');
});

test('a full-size match must meet both minimum receive amounts', () => {
  const state = seedState();
  assert.equal(createOrder(state, { ...input(), minReceive: 500000 }).status, 'searching');
  assert.equal(createOrder(seedState(), { ...input(), amount: 90000 }).status, 'searching');
});

test('cancelling a reserved match makes its peer available again', () => {
  const state = seedState();
  const first = createOrder(state, input());
  cancelOrder(state, first.id);
  assert.equal(first.status, 'cancelled');
  assert.equal(state.orders.find((order) => order.id === 'HS-1038').status, 'searching');
  assert.equal(createOrder(state, input()).status, 'matched');
});

test('cancelling rematches waiting clients once and closes competing provider quotes', () => {
  const state = seedState();
  const first = createOrder(state, input());
  const second = createOrder(state, input());
  const third = createOrder(state, input());
  const quote = submitQuote(state, third.id, 420000);
  assert.equal(second.status, 'searching');
  assert.equal(third.status, 'searching');
  cancelOrder(state, first.id);
  const rematched = [second, third].filter((order) => order.status === 'matched');
  assert.equal(rematched.length, 1);
  assert.equal(third.status, 'matched');
  assert.equal(second.status, 'searching');
  assert.equal(third.matchedOrderId, 'HS-1038');
  assert.equal(third.matchedReceive, amountFor(100000, 'RUB', 'AMD'));
  const peer = state.orders.find((order) => order.id === 'HS-1038');
  assert.equal(peer.status, 'matched');
  assert.equal(peer.matchedOrderId, third.id);
  assert.equal(peer.matchedReceive, 100000);
  assert.equal(quote.status, 'declined');
  assert.equal(state.notifications.filter((notice) => notice.orderId === third.id && notice.type === 'match').length, 1);
  assert.equal(state.notifications.filter((notice) => notice.orderId === first.id && notice.type === 'cancel').length, 1);
});

test('creating a match also closes pending quotes on the reserved peer', () => {
  const state = seedState();
  const peer = state.orders.find((order) => order.id === 'HS-1038');
  peer.quotes.push({ id: 'peer-quote', amount: 100000, status: 'pending', expiresAt: Date.now() + 300000 });
  createOrder(state, input());
  assert.equal(peer.quotes[0].status, 'declined');
});

test('expired quote cannot be accepted and does not change balances', () => {
  const state = seedState();
  const quote = submitQuote(state, 'HS-1042', 1030000, 1000);
  const original = state.directions[0].available;
  assert.throws(() => acceptQuote(state, 'HS-1042', quote.id, quote.expiresAt), /истёк/);
  assert.equal(state.directions[0].available, original);
  assert.equal(state.orders.find((order) => order.id === 'HS-1042').status, 'searching');
});

test('quote acceptance is exclusive and consumes demo available amount once', () => {
  const state = seedState();
  const first = submitQuote(state, 'HS-1042', 1030000, 1000);
  const second = submitQuote(state, 'HS-1042', 1040000, 1000);
  assert.equal(first.status, 'declined');
  assert.throws(() => acceptQuote(state, 'HS-1042', first.id, 2000), /Предложение больше недоступно/);
  const original = state.directions[0].available;
  const order = acceptQuote(state, 'HS-1042', second.id, 2000);
  assert.equal(order.status, 'agreed');
  assert.equal(first.status, 'declined');
  assert.equal(second.status, 'accepted');
  assert.equal(state.directions[0].available, original - second.amount);
  assert.throws(() => acceptQuote(state, order.id, first.id, 2000), /зарезервирована/);
  assert.throws(() => acceptQuote(state, order.id, second.id, 2000), /зарезервирована/);
  assert.equal(state.directions[0].available, original - second.amount);
});

test('failed quote revisions preserve the previous valid offer and notifications', () => {
  const state = seedState();
  const quote = submitQuote(state, 'HS-1042', 1030000, 1000);
  const notices = state.notifications.length;
  for (const amount of [1, NaN, Infinity, -1, 0, '', null, false, [], '   ', 9000000]) {
    assert.throws(() => submitQuote(state, 'HS-1042', amount, 2000));
    assert.equal(quote.status, 'pending');
    assert.equal(state.orders.find((order) => order.id === 'HS-1042').quotes.length, 1);
    assert.equal(state.notifications.length, notices);
  }
});

test('cancelled orders reject new quotes, quote acceptance and match acceptance', () => {
  const state = seedState();
  const quote = submitQuote(state, 'HS-1042', 1030000, 1000);
  cancelOrder(state, 'HS-1042');
  assert.equal(quote.status, 'declined');
  assert.throws(() => submitQuote(state, 'HS-1042', 1040000, 2000), /отменена/);
  assert.throws(() => acceptQuote(state, 'HS-1042', quote.id, 2000), /отменена/);
  assert.throws(() => acceptMatch(state, 'HS-1042'), /нет активного/);
});

test('quotes recheck direction capacity and activity when accepted', () => {
  const state = seedState();
  const quote = submitQuote(state, 'HS-1042', 1030000, 1000);
  state.directions[0].available = 100000;
  assert.throws(() => acceptQuote(state, 'HS-1042', quote.id, 2000), /Объём провайдера/);
  state.directions[0].available = 5200000;
  state.directions[0].active = false;
  assert.throws(() => acceptQuote(state, 'HS-1042', quote.id, 2000), /Объём провайдера/);
});

test('a quote stays bound to its issuing direction even when another compatible pool exists', () => {
  for (const invalidate of [
    (direction) => { direction.available = 0; },
    (direction) => { direction.active = false; },
    (direction) => { direction.max = 500000; },
  ]) {
    const state = seedState();
    const original = state.directions[0];
    const alternative = { ...original, id: 'dir-alternative', available: 9000000 };
    state.directions.push(alternative);
    const quote = submitQuote(state, 'HS-1042', 1030000, 1000);
    assert.equal(quote.directionId, original.id);
    invalidate(original);
    assert.throws(() => acceptQuote(state, 'HS-1042', quote.id, 2000), /Объём провайдера/);
    assert.equal(alternative.available, 9000000);
    assert.equal(quote.status, 'pending');
    assert.equal(state.orders.find((order) => order.id === 'HS-1042').status, 'searching');
  }
});

test('a successful revision may explicitly issue a new quote from another available direction', () => {
  const state = seedState();
  const original = state.directions[0];
  const alternative = { ...original, id: 'dir-alternative', available: 9000000 };
  state.directions.push(alternative);
  const first = submitQuote(state, 'HS-1042', 1030000, 1000);
  original.active = false;
  const second = submitQuote(state, 'HS-1042', 1040000, 2000);
  assert.equal(first.status, 'declined');
  assert.equal(second.directionId, alternative.id);
  acceptQuote(state, 'HS-1042', second.id, 3000);
  assert.equal(alternative.available, 7960000);
  assert.equal(original.available, 5200000);
});

test('provider range is compared in the currency the provider gives', () => {
  const state = seedState();
  const order = state.orders.find((item) => item.id === 'HS-1037');
  const direction = state.directions.find((item) => item.id === 'dir-amd-usdt');
  assert.equal(order.amount, 1500);
  assert.equal(order.minReceive, 585000);
  assert.equal(isDirectionCompatible(direction, order), true);
  assert.equal(isDirectionCompatible({ ...direction, max: 500000 }, order), false);
  assert.equal(isDirectionCompatible({ ...direction, active: false }, order), false);
});

test('invalid amounts and endpoint combinations fail without changing state', () => {
  const state = seedState();
  const count = state.orders.length;
  for (const amount of [NaN, Infinity, -1, 0, '', null, false, [], {}, '   ']) {
    assert.throws(() => createOrder(state, { ...input(), amount }), /Сумма/);
  }
  for (const minReceive of [NaN, Infinity, -1, 0, '', false, [], {}, '   ']) {
    assert.throws(() => createOrder(state, { ...input(), minReceive }), /Минимальная/);
  }
  assert.throws(() => createOrder(state, { ...input(), give: { currency: 'AMD', method: 'bank', bank: 'tbank' } }), /банк/);
  assert.throws(() => createOrder(state, { ...input(), give: { currency: 'USDT', method: 'cash', city: 'Ереван' } }), /сеть/);
  assert.throws(() => createOrder(state, { ...input(), give: { currency: 'USDC', method: 'crypto', network: 'TRC20' } }), /сеть/);
  assert.equal(state.orders.length, count);
  assert.throws(() => addDirection(state, { give: input().receive, receive: input().give, min: 10, max: 5, available: 0 }), /Минимальная/);
});

test('conversion validates currencies and finite output, and directions reject invalid limits', () => {
  assert.throws(() => amountFor(10, 'BTC', 'AMD'), /валюту/);
  assert.throws(() => amountFor(10, 'RUB', 'BTC'), /валюту/);
  assert.throws(() => amountFor(1e308, 'USDT', 'AMD'), /слишком велика/);
  assert.throws(() => amountFor([], 'RUB', 'AMD'), /Сумма/);
  assert.equal(amountFor(0, 'RUB', 'AMD'), 0);
  const state = seedState();
  const direction = { give: input().receive, receive: input().give, min: 100, max: 10000, available: 20000 };
  const count = state.directions.length;
  for (const field of ['min', 'max', 'available']) {
    for (const value of [NaN, Infinity, -1, '', null, false, [], '   ']) {
      assert.throws(() => addDirection(state, { ...direction, [field]: value }));
    }
  }
  assert.equal(state.directions.length, count);
});

test('Dubai cash orders require the exact city and support provider directions', () => {
  const dubaiInput = {
    ...input(),
    receive: { currency: 'USD', method: 'cash', city: 'Дубай', address: 'Демо: Dubai Mall, вход 1' },
    minReceive: amountFor(100000, 'RUB', 'USD'),
  };
  const stateForCity = (city) => ({
    version: 1, directions: [], notifications: [],
    orders: [{
      id: 'cash-peer', owner: 'peer',
      give: { currency: 'USD', method: 'cash', city },
      receive: { ...dubaiInput.give },
      amount: dubaiInput.minReceive, minReceive: dubaiInput.amount,
      partial: false, status: 'searching', createdAt: Date.now(), quotes: [],
    }],
  });
  const yerevanState = stateForCity('Ереван');
  const waiting = createOrder(yerevanState, dubaiInput);
  assert.equal(waiting.receive.city, 'Дубай');
  assert.equal(waiting.status, 'searching');
  assert.equal(findMatch(yerevanState, waiting), null);
  const dubaiState = stateForCity('Дубай');
  const matched = createOrder(dubaiState, dubaiInput);
  assert.equal(matched.status, 'matched');
  assert.equal(matched.matchedOrderId, 'cash-peer');
  const direction = addDirection(yerevanState, {
    give: { ...dubaiInput.receive }, receive: { ...dubaiInput.give },
    min: 100, max: 5000, available: 10000,
  });
  assert.equal(direction.give.city, 'Дубай');
  assert.equal(isDirectionCompatible(direction, waiting), true);
});

test('the best compatible peer is chosen by received amount regardless of address within a city', () => {
  const state = seedState();
  const peer = state.orders.find((order) => order.id === 'HS-1038');
  const better = { ...peer, id: 'better-peer', amount: peer.amount + 2000, give: { ...peer.give, address: 'Демо: другая улица, 4' }, quotes: [] };
  state.orders.push(better);
  const created = createOrder(state, input());
  assert.equal(created.matchedOrderId, better.id);
  assert.equal(created.matchedReceive, better.amount);
  assert.equal(peer.status, 'searching');
});

test('cash addresses are mandatory for new orders and directions without exact-address matching', () => {
  for (const address of [undefined, '', 'ab', '  ', 'a'.repeat(161)]) {
    const state = seedState();
    const cash = { ...input().receive, address };
    assert.throws(() => createOrder(state, { ...input(), receive: cash }), /адрес/);
    assert.throws(() => addDirection(state, { give: cash, receive: input().give, min: 100, max: 10000, available: 20000 }), /адрес/);
  }
  const created = createOrder(seedState(), { ...input(), receive: { ...input().receive, address: '  Тестовый адрес, 3  ' } });
  assert.equal(created.receive.address, 'Тестовый адрес, 3');
  assert.equal(created.status, 'matched');
});

test('quote rate computes the client receive amount and income is included rather than added', () => {
  const state = seedState();
  const quote = submitQuote(state, 'HS-1042', { inputMode: 'rate', rate: 4.1234567, incomeUSDT: 12.5 }, 1000);
  assert.equal(quote.amount, 1030864.18);
  assert.equal(quote.rate, 4.1234567);
  assert.equal(quote.effectiveRate, quote.amount / 250000);
  assert.equal(quote.incomeUSDT, 12.5);
  assert.equal(quote.inputMode, 'rate');
  const amountQuote = submitQuote(state, 'HS-1042', { amount: 1040000.126, incomeUSDT: 7 }, 2000);
  assert.equal(amountQuote.amount, 1040000.13);
  assert.equal(amountQuote.rate, amountQuote.amount / 250000);
  const compatibleLegacy = submitQuote(state, 'HS-1042', 1050000, 3000);
  assert.equal(compatibleLegacy.incomeUSDT, 0);
  assert.equal(compatibleLegacy.inputMode, 'amount');
});

test('crypto receive quotes round to six decimals and invalid income leaves previous quotes intact', () => {
  const state = seedState();
  const order = createOrder(state, {
    give: { currency: 'USD', method: 'cash', city: 'Дубай', address: 'Демо: Dubai Mall, вход 1' },
    receive: { currency: 'USDT', method: 'crypto', network: 'TRC20' }, amount: 1500, minReceive: 1500,
  });
  addDirection(state, { give: order.receive, receive: order.give, min: 100, max: 10000, available: 20000 });
  const quote = submitQuote(state, order.id, { inputMode: 'rate', rate: 1.001234567, incomeUSDT: 1.5 });
  assert.equal(quote.amount, 1501.851851);
  for (const incomeUSDT of [-1, Infinity, NaN, '', false, []]) {
    assert.throws(() => submitQuote(state, order.id, { amount: 1502, incomeUSDT }), /Доход/);
    assert.equal(quote.status, 'pending');
  }
  for (const rate of [0, -1, Infinity, NaN, '', null]) {
    assert.throws(() => submitQuote(state, order.id, { inputMode: 'rate', rate, incomeUSDT: 0 }), /Курс/);
  }
});

test('provider income counts only after both confirmations and collateral releases once', () => {
  const state = seedState();
  const baseline = providerMetrics(state);
  assert.equal(baseline.completedCount, 3);
  assert.equal(baseline.earnedUSDT, 53.25);
  assert.equal(baseline.collateralAvailableUSDT, 10000);
  const quote = submitQuote(state, 'HS-1042', { amount: 1030000, incomeUSDT: 7.25 }, 1000);
  assert.deepEqual(providerMetrics(state), baseline);
  const order = acceptQuote(state, 'HS-1042', quote.id, 2000);
  const required = amountFor(quote.amount, 'AMD', 'USDT');
  assert.equal(order.collateralReservedUSDT, required);
  assert.equal(providerMetrics(state).collateralReservedUSDT, required);
  assert.equal(providerMetrics(state).pendingIncomeUSDT, 7.25);
  assert.equal(providerMetrics(state).activeCount, 1);
  confirmSettlement(state, order.id, 'provider', 3000);
  assert.equal(order.status, 'agreed');
  assert.equal(providerMetrics(state).earnedUSDT, baseline.earnedUSDT);
  assert.throws(() => confirmSettlement(state, order.id, 'provider', 3500), /уже подтвердила/);
  confirmSettlement(state, order.id, 'client', 4000);
  assert.equal(order.status, 'completed');
  assert.equal(order.settlement.providerSentAt, 3000);
  assert.equal(order.settlement.clientReceivedAt, 4000);
  assert.deepEqual(providerMetrics(state), { ...baseline, completedCount: 4, earnedUSDT: 60.5 });
  assert.throws(() => confirmSettlement(state, order.id, 'client', 5000), /незавершённой/);
  assert.equal(state.collateral.reservedUSDT, 0);
});

test('collateral cap blocks acceptance atomically even if direction liquidity is sufficient', () => {
  const state = seedState();
  state.collateral.totalUSDT = 3000;
  const first = submitQuote(state, 'HS-1042', { amount: 1030000, incomeUSDT: 5 }, 1000);
  acceptQuote(state, 'HS-1042', first.id, 2000);
  const secondOrder = createOrder(state, { ...input(), amount: 250000, minReceive: amountFor(250000, 'RUB', 'AMD') });
  const second = submitQuote(state, secondOrder.id, 1030000, 3000);
  const before = JSON.stringify(state);
  assert.throws(() => acceptQuote(state, secondOrder.id, second.id, 4000), /демо-обеспечения/);
  assert.equal(JSON.stringify(state), before);
  confirmSettlement(state, 'HS-1042', 'client', 5000);
  confirmSettlement(state, 'HS-1042', 'provider', 6000);
  acceptQuote(state, secondOrder.id, second.id, 7000);
  assert.equal(secondOrder.status, 'agreed');
});

test('direct exchanges complete for both clients without affecting provider income or collateral', () => {
  const state = seedState();
  const before = providerMetrics(state);
  const order = createOrder(state, input());
  assert.throws(() => confirmSettlement(state, order.id, 'client'), /незавершённой/);
  acceptMatch(state, order.id);
  assert.throws(() => confirmSettlement(state, order.id, 'provider'), /провайдер не участвует/);
  confirmSettlement(state, order.id, 'client', 1000);
  assert.equal(order.status, 'completed');
  assert.equal(state.orders.find((item) => item.id === order.matchedOrderId).status, 'completed');
  assert.deepEqual(providerMetrics(state), before);
});

test('migration preserves legacy addresses as unknown and reconstructs active collateral idempotently', () => {
  const state = seedState();
  const quote = submitQuote(state, 'HS-1042', 1030000, 1000);
  const agreed = acceptQuote(state, 'HS-1042', quote.id, 2000);
  state.version = 1;
  delete state.collateral;
  delete agreed.collateralReservedUSDT;
  delete agreed.settlement;
  for (const item of [...state.orders, ...state.directions]) {
    for (const side of ['give', 'receive']) if (item[side].method === 'cash') delete item[side].address;
  }
  delete quote.incomeUSDT;
  const migrated = migrateState(state);
  assert.equal(migrated.version, 2);
  assert.equal(migrated.orders[0].receive.address, '');
  assert.equal(migrated.directions[0].give.address, '');
  assert.equal(quote.incomeUSDT, 0);
  assert.equal(migrated.collateral.reservedUSDT, amountFor(quote.amount, 'AMD', 'USDT'));
  const once = JSON.stringify(migrated);
  assert.equal(JSON.stringify(migrateState(migrated)), once);
  confirmSettlement(migrated, agreed.id, 'provider', 3000);
  confirmSettlement(migrated, agreed.id, 'client', 4000);
  assert.equal(migrated.collateral.reservedUSDT, 0);
});

test('same currency is rejected atomically across banks, payment methods and crypto networks', () => {
  const cases = [
    [{ currency: 'RUB', method: 'bank', bank: 'tbank' }, { currency: 'RUB', method: 'cash', city: 'Москва', address: 'Демо: офис, 1' }],
    [{ currency: 'EUR', method: 'bank', bank: 'revolut' }, { currency: 'EUR', method: 'bank', bank: 'wise' }],
    [{ currency: 'USDT', method: 'crypto', network: 'TRC20' }, { currency: 'USDT', method: 'crypto', network: 'ERC20' }],
  ];
  for (const [give, receive] of cases) {
    const state = seedState();
    const before = JSON.stringify(state);
    assert.throws(() => createOrder(state, { give, receive, amount: 1000, minReceive: 1000 }), /разные валюты/);
    assert.throws(() => addDirection(state, { give, receive, min: 100, max: 1000, available: 10000 }), /разные валюты/);
    assert.equal(JSON.stringify(state), before);
  }
});

test('legacy same-currency data cannot match, quote, accept or reactivate before migration', () => {
  const state = seedState();
  const give = { currency: 'RUB', method: 'bank', bank: 'tbank' };
  const receive = { currency: 'RUB', method: 'cash', city: 'Москва', address: 'Демо: офис, 1' };
  const order = { id: 'legacy-order', owner: 'me', give, receive, amount: 1000, minReceive: 1000, status: 'searching', quotes: [{ id: 'legacy-quote', directionId: 'legacy-pool', amount: 1000, status: 'pending', expiresAt: 10000 }] };
  const peer = { id: 'legacy-peer', owner: 'peer', give: receive, receive: give, amount: 1000, minReceive: 1000, status: 'searching', quotes: [] };
  const direction = { id: 'legacy-pool', give: receive, receive: give, active: true, min: 100, max: 2000, available: 10000 };
  state.orders.push(order, peer);
  state.directions.push(direction);
  const before = JSON.stringify(state);
  assert.equal(findMatch(state, order), null);
  assert.equal(isDirectionCompatible(direction, order), false);
  assert.throws(() => submitQuote(state, order.id, 1000), /разные валюты/);
  assert.throws(() => acceptQuote(state, order.id, 'legacy-quote', 1000), /разные валюты/);
  assert.equal(JSON.stringify(state), before);
  order.status = peer.status = 'matched';
  order.matchedOrderId = peer.id;
  peer.matchedOrderId = order.id;
  const reserved = JSON.stringify(state);
  assert.throws(() => acceptMatch(state, order.id), /разные валюты/);
  assert.equal(JSON.stringify(state), reserved);
  toggleDirection(state, direction.id);
  assert.equal(direction.active, false);
  const disabled = JSON.stringify(state);
  assert.throws(() => toggleDirection(state, direction.id), /разные валюты/);
  assert.equal(JSON.stringify(state), disabled);
});

test('a changed same-currency pool cannot be used by an earlier valid quote', () => {
  const state = seedState();
  const quote = submitQuote(state, 'HS-1042', 1030000, 1000);
  state.directions[0].receive = { currency: 'AMD', method: 'bank', bank: 'ameria' };
  const before = JSON.stringify(state);
  assert.equal(isDirectionCompatible(state.directions[0], state.orders[0]), false);
  assert.throws(() => acceptQuote(state, 'HS-1042', quote.id, 2000), /разные валюты/);
  assert.equal(JSON.stringify(state), before);
});

test('migration closes only open same-currency records and keeps agreed and completed history', () => {
  const state = seedState();
  const give = { currency: 'EUR', method: 'bank', bank: 'revolut' };
  const receive = { currency: 'EUR', method: 'cash', city: 'Ереван', address: 'Старый адрес' };
  const make = (id, status) => ({ id, owner: 'me', give: { ...give }, receive: { ...receive }, amount: 1000, minReceive: 1000, status, quotes: [{ id: `quote-${id}`, directionId: 'old-eur', amount: 1000, status: status === 'agreed' || status === 'completed' ? 'accepted' : 'pending', expiresAt: 10000, incomeUSDT: 10 }], ...(status === 'agreed' || status === 'completed' ? { acceptedQuoteId: `quote-${id}` } : {}) });
  const searching = make('old-searching', 'searching');
  const matched = make('old-matched', 'matched');
  const peer = { ...make('old-peer', 'matched'), owner: 'peer', give: { ...receive }, receive: { ...give } };
  matched.matchedOrderId = peer.id;
  matched.matchedReceive = 1000;
  peer.matchedOrderId = matched.id;
  const agreed = make('old-agreed', 'agreed');
  const completed = make('old-completed', 'completed');
  state.orders = [searching, matched, peer, agreed, completed];
  state.directions = [{ id: 'old-eur', give: { ...receive }, receive: { ...give }, active: true, min: 100, max: 5000, available: 10000 }];
  migrateState(state);
  for (const order of [searching, matched, peer]) {
    assert.equal(order.status, 'cancelled');
    assert.equal(order.invalidReason, 'same-currency');
    assert.equal(order.quotes[0].status, 'declined');
    assert.equal(order.give.currency, 'EUR');
    assert.equal(order.receive.currency, 'EUR');
    assert.equal(order.matchedOrderId, undefined);
  }
  assert.equal(agreed.status, 'agreed');
  assert.equal(completed.status, 'completed');
  assert.equal(agreed.receive.address, 'Старый адрес');
  assert.equal(state.directions[0].active, false);
  assert.equal(state.directions[0].invalidReason, 'same-currency');
  assert.equal(state.directions[0].give.currency, 'EUR');
  const once = JSON.stringify(state);
  migrateState(state);
  assert.equal(JSON.stringify(state), once);
  confirmSettlement(state, agreed.id, 'provider', 1000);
  confirmSettlement(state, agreed.id, 'client', 2000);
  assert.equal(agreed.status, 'completed');
  assert.equal(state.collateral.reservedUSDT, 0);
});

test('every seeded order and pool exchanges different currencies with matching examples', () => {
  const state = seedState();
  for (const item of [...state.orders, ...state.directions]) assert.notEqual(item.give.currency, item.receive.currency);
  const request = state.orders.find(order => order.id === 'HS-1035');
  const direction = state.directions.find(item => item.id === 'dir-eur-revolut');
  assert.equal(request.give.currency, 'USD');
  assert.equal(request.receive.currency, 'EUR');
  assert.equal(isDirectionCompatible(direction, request), true);
});
