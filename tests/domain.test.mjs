import test from 'node:test';
import assert from 'node:assert/strict';
import {
  seedState, createOrder, findMatch, acceptMatch, cancelOrder,
  submitQuote, acceptQuote, addDirection, isDirectionCompatible, amountFor,
  confirmSettlement, providerMetrics, migrateState,
  toggleDirection, orderExecution, reportProblem, CURRENCIES, BANKS,
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

const partialInput = (partial = true) => ({
  give: { currency: 'USD', method: 'bank', bank: 'revolut' },
  receive: { currency: 'EUR', method: 'cash', city: 'Дубай', address: 'Демо: Dubai Mall, вход 1' },
  amount: 100, minReceive: 90, partial,
});
const partialState = () => ({ version: 2, orders: [], directions: [], notifications: [], collateral: { totalUSDT: 10000, reservedUSDT: 0 } });
const partialPeer = (amount = 45, minReceive = 50, partial = false, id = 'partial-peer') => ({
  id, owner: 'peer', give: { ...partialInput().receive }, receive: { ...partialInput().give },
  amount, minReceive, partial, status: 'searching', createdAt: 1, quotes: [],
});
const partialDirection = (state, changes = {}) => addDirection(state, {
  give: partialInput().receive, receive: partialInput().give, min: 1, max: 1000, available: 2000, ...changes,
});

test('partial direct reservation does not resize orders, and acceptance preserves both asset totals', () => {
  const state = partialState();
  const peer = partialPeer();
  state.orders.push(peer);
  const order = createOrder(state, partialInput(), 100);
  assert.equal(order.partial, true);
  assert.equal(order.status, 'matched');
  assert.deepEqual(orderExecution(order), { giveAmount: 50, receiveAmount: 45 });
  assert.equal(order.amount, 100);
  assert.equal(order.minReceive, 90);
  assert.equal(state.orders.length, 2);
  acceptMatch(state, order.id, 200);
  const remainder = state.orders.find(item => item.id === order.remainderOrderId);
  assert.equal(order.amount, 50);
  assert.equal(order.minReceive, 45);
  assert.equal(remainder.amount, 50);
  assert.equal(remainder.minReceive, 45);
  assert.equal(remainder.status, 'searching');
  assert.equal(remainder.partial, true);
  assert.equal(remainder.rootOrderId, order.id);
  assert.equal(remainder.parentOrderId, order.id);
  assert.equal(order.rootOrderId, order.id);
  assert.deepEqual(remainder.quotes, []);
  assert.equal(order.amount + remainder.amount, 100);
  assert.equal(order.minReceive + remainder.minReceive, 90);
  assert.equal(peer.amount, 45);
  assert.equal(peer.minReceive, 50);
  assert.deepEqual(orderExecution(peer), { giveAmount: 45, receiveAmount: 50 });
  const before = JSON.stringify(state);
  assert.throws(() => acceptMatch(state, order.id), /нет активного/);
  assert.equal(JSON.stringify(state), before);
});

test('partial false on either side forbids resizing that side', () => {
  const fullOwn = partialState();
  fullOwn.orders.push(partialPeer());
  assert.equal(createOrder(fullOwn, partialInput(false)).status, 'searching');
  const fullPeer = partialState();
  fullPeer.orders.push(partialPeer(180, 200, false));
  assert.equal(createOrder(fullPeer, partialInput(true)).status, 'searching');
  const flexiblePeer = partialState();
  const peer = partialPeer(180, 200, true);
  flexiblePeer.orders.push(peer);
  const order = createOrder(flexiblePeer, partialInput(false));
  assert.equal(order.status, 'matched');
  assert.deepEqual(orderExecution(order), { giveAmount: 100, receiveAmount: 90 });
  assert.equal(peer.amount, 180);
  acceptMatch(flexiblePeer, order.id);
  const remainder = flexiblePeer.orders.find(item => item.id === peer.remainderOrderId);
  assert.equal(order.remainderOrderId, undefined);
  assert.equal(peer.amount + remainder.amount, 180);
  assert.equal(peer.minReceive + remainder.minReceive, 200);
});

test('cancelling a partial reserve restores the unmodified peer without creating remainders', () => {
  const state = partialState();
  const peer = partialPeer(180, 200, true);
  state.orders.push(peer);
  const order = createOrder(state, partialInput());
  cancelOrder(state, order.id);
  assert.equal(state.orders.length, 2);
  assert.equal(order.amount, 100);
  assert.equal(order.minReceive, 90);
  assert.equal(peer.amount, 180);
  assert.equal(peer.minReceive, 200);
  assert.equal(peer.status, 'searching');
  for (const item of [order, peer]) {
    assert.equal(item.matchedOrderId, undefined);
    assert.equal(item.matchedGive, undefined);
    assert.equal(item.matchedReceive, undefined);
    assert.equal(item.remainderOrderId, undefined);
  }
});

test('a peer remainder rematches another waiting client exactly once after the first acceptance', () => {
  const state = partialState();
  const peer = partialPeer(180, 200, true);
  state.orders.push(peer);
  const first = createOrder(state, partialInput(false));
  const second = createOrder(state, partialInput(false));
  const third = createOrder(state, partialInput(false));
  assert.equal(second.status, 'searching');
  acceptMatch(state, first.id, 1000);
  const remainder = state.orders.find(item => item.id === peer.remainderOrderId);
  const next = [second, third].filter(item => item.status === 'matched');
  assert.equal(next.length, 1);
  assert.equal(remainder.matchedOrderId, next[0].id);
  assert.equal(next[0].matchedOrderId, remainder.id);
  acceptMatch(state, next[0].id, 2000);
  assert.equal(state.orders.filter(item => item.owner === 'peer').reduce((sum, item) => sum + item.amount, 0), 180);
  assert.equal(state.orders.filter(item => item.owner === 'peer').reduce((sum, item) => sum + item.minReceive, 0), 200);
  assert.equal(state.orders.filter(item => item.owner === 'me' && item.status === 'searching').length, 1);
});

test('partial matching chooses the actual largest received amount, not the unsplit peer headline', () => {
  const state = partialState();
  const large = partialPeer(900, 1000, true, 'large');
  const better = partialPeer(95, 100, false, 'better');
  state.orders.push(large, better);
  const order = createOrder(state, partialInput());
  assert.equal(order.matchedOrderId, better.id);
  assert.deepEqual(orderExecution(order), { giveAmount: 100, receiveAmount: 95 });
});

test('partial quote uses its chosen give amount for rates and keeps the pending request unchanged', () => {
  const state = partialState();
  partialDirection(state);
  const order = createOrder(state, partialInput());
  const quote = submitQuote(state, order.id, { giveAmount: 40, inputMode: 'rate', rate: 0.92, incomeUSDT: 2 }, 1000);
  assert.equal(quote.giveAmount, 40);
  assert.equal(quote.amount, 36.8);
  assert.equal(quote.effectiveRate, 36.8 / 40);
  assert.deepEqual(orderExecution(order), { giveAmount: 100, receiveAmount: 90 });
  assert.equal(state.orders.length, 1);
  const available = state.directions[0].available;
  acceptQuote(state, order.id, quote.id, 2000);
  const remainder = state.orders.find(item => item.id === order.remainderOrderId);
  assert.deepEqual(orderExecution(order), { giveAmount: 40, receiveAmount: 36.8 });
  assert.equal(order.amount, 40);
  assert.equal(order.minReceive, 36);
  assert.equal(remainder.amount, 60);
  assert.equal(remainder.minReceive, 54);
  assert.equal(state.directions[0].available, available - 36.8);
  assert.equal(state.collateral.reservedUSDT, 40);
  assert.equal(providerMetrics(state).pendingIncomeUSDT, 2);
  const before = JSON.stringify(state);
  assert.throws(() => acceptQuote(state, order.id, quote.id, 2100), /зарезервирована/);
  assert.equal(JSON.stringify(state), before);
});

test('partial provider capacity filters a feasible portion and acceptance only reserves that portion', () => {
  const state = partialState();
  const direction = partialDirection(state, { min: 20, max: 45, available: 30 });
  const order = createOrder(state, partialInput());
  assert.equal(isDirectionCompatible(direction, order), true);
  assert.equal(isDirectionCompatible(direction, { ...order, partial: false }), false);
  assert.equal(isDirectionCompatible({ ...direction, min: 31 }, order), false);
  assert.equal(isDirectionCompatible({ ...direction, available: 0 }, order), false);
  const quote = submitQuote(state, order.id, { giveAmount: 33.33, amount: 30 }, 1000);
  acceptQuote(state, order.id, quote.id, 2000);
  assert.equal(direction.available, 0);
  assert.equal(order.amount, 33.33);
  assert.equal(order.minReceive, 30);
  const remainder = state.orders.find(item => item.id === order.remainderOrderId);
  assert.equal(remainder.amount, 66.67);
  assert.equal(remainder.minReceive, 60);
});

test('quote splitting rounds the executed minimum upward and conserves both original sums across repeated fills', () => {
  const state = partialState();
  partialDirection(state);
  const order = createOrder(state, { ...partialInput(), minReceive: 92 });
  const first = submitQuote(state, order.id, { giveAmount: 33.33, amount: 30.67 }, 1000);
  assert.throws(() => submitQuote(state, order.id, { giveAmount: 33.33, amount: 30.66 }, 1000), /минимальной/);
  acceptQuote(state, order.id, first.id, 2000);
  const remainder = state.orders.find(item => item.id === order.remainderOrderId);
  const second = submitQuote(state, remainder.id, { giveAmount: 33.33, amount: 31 }, 3000);
  acceptQuote(state, remainder.id, second.id, 4000);
  const final = state.orders.find(item => item.id === remainder.remainderOrderId);
  assert.equal(final.rootOrderId, order.id);
  assert.equal(final.parentOrderId, remainder.id);
  assert.equal(Number(state.orders.reduce((sum, item) => sum + item.amount, 0).toFixed(2)), 100);
  assert.equal(Number(state.orders.reduce((sum, item) => sum + item.minReceive, 0).toFixed(2)), 92);
  assert.equal(state.orders.filter(item => item.status === 'searching').length, 1);
});

test('invalid partial amounts reject atomically and do not replace an earlier pending quote', () => {
  for (const partial of [false, true]) {
    const state = partialState();
    partialDirection(state);
    const order = createOrder(state, partialInput(partial));
    const first = submitQuote(state, order.id, { amount: 92 }, 1000);
    for (const giveAmount of [0, -1, 101, Infinity, NaN, '', null, false, ...(partial ? [] : [40])]) {
      const before = JSON.stringify(state);
      assert.throws(() => submitQuote(state, order.id, { giveAmount, amount: 92 }, 1100));
      assert.equal(JSON.stringify(state), before);
      assert.equal(first.status, 'pending');
    }
  }
  const state = partialState();
  partialDirection(state);
  const tinyMinimum = createOrder(state, { ...partialInput(), minReceive: 0.01 });
  const before = JSON.stringify(state);
  assert.throws(() => submitQuote(state, tinyMinimum.id, { giveAmount: 99.99, amount: 1 }), /остаток/);
  assert.equal(JSON.stringify(state), before);
});

test('a partial quote revalidates client permission and the exact reserved volume before accepting', () => {
  const state = partialState();
  partialDirection(state);
  const order = createOrder(state, partialInput());
  const quote = submitQuote(state, order.id, { giveAmount: 40, amount: 36 }, 1000);
  order.partial = false;
  let before = JSON.stringify(state);
  assert.throws(() => acceptQuote(state, order.id, quote.id, 2000), /всей суммы/);
  assert.equal(JSON.stringify(state), before);
  order.partial = true;
  state.directions[0].available = 35;
  before = JSON.stringify(state);
  assert.throws(() => acceptQuote(state, order.id, quote.id, 2000), /Объём провайдера/);
  assert.equal(JSON.stringify(state), before);
});

test('provider quote leftovers can immediately match a peer while the accepted deal stays isolated', () => {
  const state = partialState();
  partialDirection(state);
  const order = createOrder(state, partialInput());
  const quote = submitQuote(state, order.id, { giveAmount: 40, amount: 36 }, 1000);
  state.orders.push(partialPeer(54, 60));
  acceptQuote(state, order.id, quote.id, 2000);
  const remainder = state.orders.find(item => item.id === order.remainderOrderId);
  assert.equal(order.status, 'agreed');
  assert.equal(order.matchedOrderId, undefined);
  assert.equal(remainder.status, 'matched');
  assert.equal(remainder.matchedOrderId, 'partial-peer');
  assert.equal(remainder.acceptedQuoteId, undefined);
  assert.equal(remainder.collateralReservedUSDT, undefined);
  assert.deepEqual(remainder.quotes, []);
  assert.equal(createOrder(state, { ...partialInput(false), amount: 60, minReceive: 54 }).status, 'searching');
});

test('a provider problem stops remaining confirmations without releasing collateral or counting income', () => {
  const state = partialState();
  partialDirection(state);
  const order = createOrder(state, partialInput());
  const quote = submitQuote(state, order.id, { amount: 92, incomeUSDT: 3 }, 1000);
  acceptQuote(state, order.id, quote.id, 2000);
  confirmSettlement(state, order.id, 'provider', 3000);
  const metrics = providerMetrics(state);
  assert.equal(reportProblem(state, order.id, { reason: 'not-received', comment: 'Средства пока не поступили.' }, 4000), order);
  assert.equal(order.problem.type, 'not-received');
  assert.equal(order.problem.status, 'open');
  assert.equal(order.problem.createdAt, 4000);
  assert.equal(order.status, 'agreed');
  assert.match(state.notifications[0].message, /не отправлялось/);
  const before = JSON.stringify(state);
  assert.throws(() => confirmSettlement(state, order.id, 'client', 5000), /открыта проблема/);
  assert.throws(() => reportProblem(state, order.id, { reason: 'other', comment: 'Повторное обращение.' }), /уже зафиксирована/);
  assert.equal(JSON.stringify(state), before);
  assert.deepEqual(providerMetrics(state), metrics);
  assert.equal(providerMetrics(state).earnedUSDT, 0);
});

test('a direct peer problem blocks settlement and duplicate problem reports from both sides', () => {
  const state = partialState();
  const peer = partialPeer();
  state.orders.push(peer);
  const order = createOrder(state, partialInput());
  acceptMatch(state, order.id);
  reportProblem(state, peer.id, { reason: 'wrong-amount', comment: 'Полученная сумма отличается.' }, 1000);
  assert.equal(state.notifications[0].orderId, order.id);
  for (const item of [peer, order]) {
    const before = JSON.stringify(state);
    assert.throws(() => confirmSettlement(state, item.id, 'client'), /открыта проблема/);
    assert.throws(() => reportProblem(state, item.id, { reason: 'other', comment: 'Повторное описание проблемы.' }), /уже зафиксирована/);
    assert.equal(JSON.stringify(state), before);
  }
  const remainder = state.orders.find(item => item.id === order.remainderOrderId);
  assert.equal(remainder.problem, undefined);
  assert.equal(remainder.status, 'searching');
});

test('problem reasons, comment length and deal lifecycle are validated without mutations', () => {
  const state = partialState();
  partialDirection(state);
  const order = createOrder(state, partialInput());
  const valid = { reason: 'other', comment: 'Описание проблемы со сделкой.' };
  assert.throws(() => reportProblem(state, order.id, valid), /согласованной/);
  const quote = submitQuote(state, order.id, 92, 1000);
  acceptQuote(state, order.id, quote.id, 2000);
  for (const invalid of [{ ...valid, reason: 'refund' }, { ...valid, comment: 'коротко' }, { ...valid, comment: 'x'.repeat(1001) }, { ...valid, comment: null }]) {
    const before = JSON.stringify(state);
    assert.throws(() => reportProblem(state, order.id, invalid));
    assert.equal(JSON.stringify(state), before);
  }
  confirmSettlement(state, order.id, 'client', 3000);
  confirmSettlement(state, order.id, 'provider', 4000);
  assert.throws(() => reportProblem(state, order.id, valid), /незавершённой/);
});

test('AED uses the demo dirham rate and supports cash and catalogued UAE bank endpoints', () => {
  assert.equal(CURRENCIES.find(item => item.code === 'AED').rateUSD, 3.6725);
  assert.equal(amountFor(100, 'USD', 'AED'), 367.25);
  const bank = BANKS.find(item => item.currencies.includes('AED'));
  assert.ok(bank);
  const state = partialState();
  const order = createOrder(state, { ...partialInput(), receive: { currency: 'AED', method: 'bank', bank: bank.id }, minReceive: 367.25 });
  assert.equal(order.receive.bank, bank.id);
  assert.equal(order.receive.country, 'AE');
  assert.equal(createOrder(state, { ...partialInput(), receive: { currency: 'AED', method: 'cash', city: 'Дубай', address: 'Демо: Dubai Mall, вход 1' }, minReceive: 367.25 }).receive.currency, 'AED');
});

test('a one-micro-unit crypto shortfall cannot overdraw liquidity or collateral', () => {
  const state = partialState();
  const order = createOrder(state, {
    give: { currency: 'USD', method: 'cash', city: 'Дубай', address: 'Демо: Dubai Mall, вход 1' },
    receive: { currency: 'USDT', method: 'crypto', network: 'TRC20' },
    amount: 100, minReceive: 100, partial: true,
  });
  const direction = addDirection(state, { give: order.receive, receive: order.give, min: 1, max: 1000, available: 49.999999 });
  let before = JSON.stringify(state);
  assert.throws(() => submitQuote(state, order.id, { giveAmount: 50, amount: 50 }, 1000), /остатком/);
  assert.equal(JSON.stringify(state), before);
  direction.available = 50;
  const quote = submitQuote(state, order.id, { giveAmount: 50, amount: 50 }, 1000);
  state.collateral.totalUSDT = 49.999999;
  before = JSON.stringify(state);
  assert.throws(() => acceptQuote(state, order.id, quote.id, 2000), /обеспечения/);
  assert.equal(JSON.stringify(state), before);
});

test('targeted matching uses only the requested peer and rejects unavailable, incompatible and own targets atomically', () => {
  const state = partialState();
  const target = partialPeer(90, 100, false, 'link-target');
  const better = partialPeer(95, 100, false, 'better-unrelated');
  state.orders.push(target, better);
  const matched = createOrder(state, { ...partialInput(false), matchTargetId: target.id });
  assert.equal(matched.matchedOrderId, target.id);
  assert.equal(better.status, 'searching');
  for (const id of [target.id, 'missing']) {
    const before = JSON.stringify(state);
    assert.throws(() => createOrder(state, { ...partialInput(false), matchTargetId: id }), /Заявка по ссылке/);
    assert.equal(JSON.stringify(state), before);
  }
  const incompatible = { ...partialPeer(90, 100, false, 'incompatible'), receive: { ...partialInput().give, bank: 'ameria' } };
  const own = { ...partialPeer(90, 100, false, 'own'), owner: 'me' };
  state.orders.push(incompatible, own);
  for (const id of [incompatible.id, own.id, matched.id]) {
    const before = JSON.stringify(state);
    assert.throws(() => createOrder(state, { ...partialInput(false), matchTargetId: id }), /Заявка по ссылке/);
    assert.equal(JSON.stringify(state), before);
  }
  assert.equal(better.status, 'searching');
});

test('retired bank-currency pairs cannot be newly created, matched, quoted, accepted or reactivated', () => {
  const state = partialState();
  const give = { currency: 'EUR', method: 'bank', bank: 'ameria' };
  const receive = { currency: 'USD', method: 'cash', city: 'Дубай', address: 'Демо: Dubai Mall, вход 1' };
  assert.throws(() => createOrder(state, { give, receive, amount: 100, minReceive: 100 }), /банк/);
  const order = { id: 'retired', owner: 'me', give, receive, amount: 100, minReceive: 100, partial: false, status: 'searching', quotes: [{ id: 'retired-quote', directionId: 'retired-direction', amount: 100, status: 'pending', expiresAt: 10000 }] };
  const peer = { id: 'retired-peer', owner: 'peer', give: receive, receive: give, amount: 100, minReceive: 100, partial: false, status: 'searching', quotes: [] };
  const direction = { id: 'retired-direction', give: receive, receive: give, min: 1, max: 1000, available: 1000, active: true };
  state.orders.push(order, peer);
  state.directions.push(direction);
  assert.equal(findMatch(state, order), null);
  assert.equal(isDirectionCompatible(direction, order), false);
  let before = JSON.stringify(state);
  assert.throws(() => submitQuote(state, order.id, 100, 1000), /Банк больше не поддерживает/);
  assert.throws(() => acceptQuote(state, order.id, 'retired-quote', 1000), /Банк больше не поддерживает/);
  assert.equal(JSON.stringify(state), before);
  order.status = peer.status = 'matched';
  order.matchedOrderId = peer.id;
  peer.matchedOrderId = order.id;
  before = JSON.stringify(state);
  assert.throws(() => acceptMatch(state, order.id), /Банк больше не поддерживает/);
  assert.equal(JSON.stringify(state), before);
  toggleDirection(state, direction.id);
  assert.throws(() => toggleDirection(state, direction.id), /Банк больше не поддерживает/);
});

test('bank-currency migration cancels only open invalid orders, releases valid peers and preserves settled history', () => {
  const state = partialState();
  const give = { currency: 'EUR', method: 'bank', bank: 'ameria' };
  const receive = { currency: 'USD', method: 'cash', city: 'Дубай', address: 'Демо: Dubai Mall, вход 1' };
  const make = (id, status) => ({ id, owner: 'me', give: { ...give }, receive: { ...receive }, amount: 100, minReceive: 100, status, quotes: [] });
  const searching = make('retired-searching', 'searching');
  searching.quotes.push({ id: 'pending', amount: 100, status: 'pending' });
  const matched = make('retired-matched', 'matched');
  const peer = { ...make('valid-peer', 'matched'), owner: 'peer', give: receive, receive: { currency: 'EUR', method: 'bank', bank: 'revolut' }, matchedOrderId: matched.id, matchedGive: 100, matchedReceive: 100 };
  matched.matchedOrderId = peer.id;
  matched.matchedGive = matched.matchedReceive = 100;
  const agreed = make('retired-agreed', 'agreed');
  const completed = make('retired-completed', 'completed');
  state.orders = [searching, matched, peer, agreed, completed];
  state.directions = [{ id: 'retired-pool', give: receive, receive: give, active: true, min: 1, max: 1000, available: 1000 }];
  migrateState(state);
  assert.equal(searching.status, 'cancelled');
  assert.equal(searching.quotes[0].status, 'declined');
  assert.equal(matched.status, 'cancelled');
  assert.equal(matched.invalidReason, 'unsupported-bank-currency');
  assert.equal(peer.status, 'searching');
  assert.equal(peer.matchedOrderId, undefined);
  assert.equal(peer.matchedGive, undefined);
  assert.equal(peer.matchedReceive, undefined);
  assert.equal(agreed.status, 'agreed');
  assert.equal(completed.status, 'completed');
  assert.equal(agreed.give.currency, 'EUR');
  assert.equal(agreed.give.bank, 'ameria');
  assert.equal(state.directions[0].active, false);
  assert.equal(state.directions[0].invalidReason, 'unsupported-bank-currency');
  const once = JSON.stringify(state);
  migrateState(state);
  assert.equal(JSON.stringify(state), once);
});

test('KZT supports the demo rate, Kazakhstan banks and both requested cash cities', () => {
  assert.equal(amountFor(100, 'USD', 'KZT'), 50000);
  const bank = BANKS.find(item => item.country === 'KZ' && item.currencies.includes('KZT'));
  assert.ok(bank);
  const state = partialState();
  const order = createOrder(state, { ...partialInput(), receive: { currency: 'KZT', method: 'bank', bank: bank.id }, minReceive: 50000 });
  assert.equal(order.receive.country, 'KZ');
  for (const city of ['Алматы', 'Астана']) {
    assert.equal(createOrder(state, { ...partialInput(), receive: { currency: 'KZT', method: 'cash', city, address: 'Демо: центр города' }, minReceive: 50000 }).receive.city, city);
  }
});
