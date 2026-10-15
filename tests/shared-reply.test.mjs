import test from 'node:test';
import assert from 'node:assert/strict';
import { createSharedReply } from '../dist/shared-reply.js';
import { buildRequestLink, parseRequestLink, requestFingerprint } from '../dist/share-links.js';

const now = Date.UTC(2026, 9, 15, 12);
const bank = { method: 'bank', currency: 'RUB', bank: 'tbank' };
const cash = { method: 'cash', currency: 'AMD', city: 'Ереван', address: 'Демо: площадь Республики' };
const source = (patch = {}) => ({
  id: 'HS-shared-1', owner: 'other', give: cash, receive: bank,
  amount: 40000, minReceive: 10000, partial: false, status: 'searching', createdAt: now - 1000, quotes: [], ...patch,
});
const snapshot = (patch = {}) => parseRequestLink(buildRequestLink(source(patch)));
const input = (patch = {}) => ({ give: { ...bank }, receive: { ...cash }, amount: 10000, minReceive: 40000, partial: false, ...patch });
const fresh = () => ({ orders: [], directions: [], notifications: [], collateral: { totalUSDT: 10000, reservedUSDT: 0 }, sentinel: { keep: true } });
const imported = (record = snapshot(), patch = {}) => ({
  ...record, owner: 'shared', status: 'searching', quotes: [], sourceRequestId: record.id,
  sourceRequestFingerprint: requestFingerprint(record), ...patch,
});

test('a shared reply reserves the exact imported request instead of a better unrelated offer', () => {
  const state = fresh();
  state.orders.push(source({ id: 'better-unrelated', amount: 45000 }));
  const order = createSharedReply(state, snapshot(), input({ matchTargetId: 'better-unrelated' }), now);
  const peer = state.orders.find(item => item.id === 'HS-shared-1');
  assert.equal(order.status, 'matched');
  assert.equal(order.replyToRequestId, peer.id);
  assert.equal(order.matchedOrderId, peer.id);
  assert.equal(peer.matchedOrderId, order.id);
  assert.equal(peer.sourceRequestId, peer.id);
  assert.equal(peer.sourceRequestFingerprint, requestFingerprint(snapshot()));
  assert.equal(state.orders.find(item => item.id === 'better-unrelated').status, 'searching');
  assert.equal(state.orders.find(item => item.id === order.id), order);
  assert.deepEqual(state.sentinel, { keep: true });
});

test('incompatible or invalid drafts do not import a peer or mutate any existing state', () => {
  for (const draft of [input({ amount: 9000 }), input({ minReceive: 45000 }), input({ amount: 0 }),
    input({ give: { ...bank, bank: 'sber' } }), input({ receive: { ...cash, address: '' } })]) {
    const state = fresh();
    state.orders.push(source({ id: 'unrelated' }));
    const before = structuredClone(state);
    const oldOrders = state.orders;
    assert.throws(() => createSharedReply(state, snapshot(), draft, now));
    assert.deepEqual(state, before);
    assert.equal(state.orders, oldOrders);
  }
});

test('duplicate replies and locally reserved or closed imports are rejected atomically', () => {
  const state = fresh();
  createSharedReply(state, snapshot(), input(), now);
  const before = structuredClone(state);
  assert.throws(() => createSharedReply(state, snapshot(), input(), now + 1), /зарезервирована/);
  assert.deepEqual(state, before);
  for (const status of ['matched', 'agreed', 'completed', 'cancelled']) {
    const closed = fresh();
    closed.orders.push(imported(snapshot(), { status }));
    const original = structuredClone(closed);
    assert.throws(() => createSharedReply(closed, snapshot(), input(), now), /зарезервирована|закрыта/);
    assert.deepEqual(closed, original);
  }
});

test('own IDs and snapshots of non-open requests cannot become imported peers', () => {
  const state = fresh();
  state.orders.push(source({ owner: 'me' }));
  const before = structuredClone(state);
  assert.throws(() => createSharedReply(state, snapshot(), input(), now), /свою/);
  assert.deepEqual(state, before);
  for (const status of ['matched', 'agreed', 'completed', 'cancelled']) {
    const empty = fresh();
    assert.throws(() => createSharedReply(empty, snapshot({ status }), input(), now), /открытую/);
    assert.deepEqual(empty, fresh());
  }
});

test('same-ID term changes and edited imported terms cannot replace the original offer', () => {
  const record = snapshot();
  for (const changed of [snapshot({ amount: 41000 }), snapshot({ minReceive: 11000 }), snapshot({ partial: true }),
    snapshot({ give: { ...cash, city: 'Москва' } }), snapshot({ receive: { ...bank, bank: 'sber' } })]) {
    const state = fresh();
    state.orders.push(imported(record));
    const before = structuredClone(state);
    assert.throws(() => createSharedReply(state, changed, input(), now), /отличаются/);
    assert.deepEqual(state, before);
  }
  const state = fresh();
  state.orders.push(imported(record, { amount: 45000 }));
  const before = structuredClone(state);
  assert.throws(() => createSharedReply(state, record, input(), now), /отличаются/);
  assert.deepEqual(state, before);
});

test('an unchanged open import is reused and timestamp changes do not alter its terms', () => {
  const state = fresh();
  state.orders.push(imported());
  const order = createSharedReply(state, { ...snapshot(), createdAt: now }, input(), now);
  assert.equal(state.orders.length, 2);
  assert.equal(order.matchedOrderId, 'HS-shared-1');
});

test('omitted cash landmarks stay unknown and private snapshot extras are never imported', () => {
  const state = fresh();
  const record = snapshot();
  record.owner = 'PRIVATE_OWNER';
  record.paymentDetails = { receive: 'PRIVATE_PAYMENT' };
  record.kyc = 'PRIVATE_KYC';
  record.give.contact = 'PRIVATE_CONTACT';
  record.receive.holder = 'PRIVATE_HOLDER';
  record.problem = { comment: 'PRIVATE_PROBLEM' };
  const before = structuredClone(record);
  createSharedReply(state, record, input(), now);
  const peer = state.orders.find(item => item.id === record.id);
  assert.equal(peer.give.address, '');
  assert.deepEqual(peer.receive, bank);
  assert.ok(!JSON.stringify(state).includes('PRIVATE_'));
  assert.deepEqual(record, before);
});

test('malformed snapshots, conflicting imported IDs and invalid time leave state unchanged', () => {
  for (const record of [null, { ...snapshot(), partial: 'true' }, { ...snapshot(), amount: NaN },
    { ...snapshot(), give: { ...cash, address: '<script>' } }]) {
    const state = fresh();
    assert.throws(() => createSharedReply(state, record, input(), now));
    assert.deepEqual(state, fresh());
  }
  const state = fresh();
  state.orders.push(imported(), imported(snapshot(), { id: 'duplicate-import' }));
  const before = structuredClone(state);
  assert.throws(() => createSharedReply(state, snapshot(), input(), now), /конфликтующие/);
  assert.deepEqual(state, before);
  assert.throws(() => createSharedReply(fresh(), snapshot(), input(), NaN), /время/);
});
