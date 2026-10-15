import test from 'node:test';
import assert from 'node:assert/strict';
import { BANKS, NETWORKS } from '../dist/domain.js';
import { paymentFields, createDemoPaymentDetails, validatePaymentDetails, setPaymentDetails } from '../dist/payment-details.js';

const bank = { method: 'bank', currency: 'RUB', bank: 'tbank' };
const cash = { method: 'cash', currency: 'AMD', city: 'Ереван', address: 'Demo district' };
const crypto = { method: 'crypto', currency: 'USDT', network: 'TRC20' };
const agreedState = () => ({ orders: [{ id: 'order-1', status: 'agreed', give: { ...bank }, receive: { ...cash } }] });

test('bank forms follow the bank location, not the currency', () => {
  assert.equal(paymentFields({ method: 'bank', bank: 'ameria', currency: 'USD' })[1].label, 'Номер счёта (демо)');
  assert.equal(paymentFields({ method: 'bank', bank: 'bog', currency: 'USD' })[1].label, 'IBAN (демо)');
  assert.equal(paymentFields({ method: 'bank', bank: 'enbd', currency: 'AED' })[1].label, 'IBAN (демо)');
  assert.equal(paymentFields({ method: 'bank', bank: 'wise', currency: 'EUR' })[1].label, 'IBAN / номер счёта (демо)');
  for (const item of BANKS) {
    for (const currency of item.currencies) {
      const endpoint = { method: 'bank', bank: item.id, currency };
      const demo = createDemoPaymentDetails(endpoint);
      assert.deepEqual(validatePaymentDetails(endpoint, demo), demo);
      assert.deepEqual(Object.keys(demo), ['holder', 'account']);
      assert.ok(demo.account.startsWith('DEMO-'));
      for (const field of paymentFields(endpoint)) assert.match(demo[field.key], new RegExp(`^(?:${field.pattern})$`, 'v'));
    }
  }
});

test('wallet identifiers are demo-only and bound to the selected network', () => {
  for (const network of NETWORKS) {
    const endpoint = { ...crypto, network };
    const demo = createDemoPaymentDetails(endpoint);
    assert.deepEqual(validatePaymentDetails(endpoint, demo), demo);
    assert.ok(demo.wallet.startsWith(`DEMO-${network.toUpperCase()}-WALLET-`));
    assert.throws(() => validatePaymentDetails(endpoint, { ...demo, wallet: '0x1234567890123456789012345678901234567890' }));
  }
  assert.throws(() => validatePaymentDetails(crypto, { wallet: 'DEMO-ERC20-WALLET-0001' }));
  assert.deepEqual(validatePaymentDetails(crypto, { wallet: 'DEMO-TRC20-WALLET-0001', memo: ' ' }), { wallet: 'DEMO-TRC20-WALLET-0001' });
  assert.throws(() => paymentFields({ ...crypto, currency: 'USDC', network: 'TRC20' }));
});

test('cash fields use a demo meeting place and time without identity or contact fields', () => {
  const demo = createDemoPaymentDetails(cash);
  assert.deepEqual(Object.keys(demo), ['meetingPlace', 'meetingTime']);
  assert.deepEqual(validatePaymentDetails(cash, demo), demo);
  assert.throws(() => validatePaymentDetails(cash, { ...demo, meetingPlace: 'Real home address' }));
  assert.throws(() => validatePaymentDetails(cash, { ...demo, meetingTime: '' }));
});

test('payment details cannot be saved before agreement or after completion', () => {
  for (const status of ['searching', 'matched', 'cancelled', 'completed']) {
    const state = agreedState();
    state.orders[0].status = status;
    assert.throws(() => setPaymentDetails(state, 'order-1', 'give', createDemoPaymentDetails(bank)));
    assert.equal(state.orders[0].paymentDetails, undefined);
  }
});

test('each exchange side keeps its own endpoint snapshot and data allowlist', () => {
  const state = agreedState();
  state.orders[0].give.secret = 'must not persist';
  const raw = { ...createDemoPaymentDetails(bank), holder: '  DEMO-Recipient  ', cvv: '123', card: '4111111111111111', password: 'secret', meetingPlace: 'DEMO-wrong side' };
  const saved = setPaymentDetails(state, 'order-1', 'give', raw, 1234);
  assert.deepEqual(saved, { endpoint: bank, values: { holder: 'DEMO-Recipient', account: 'DEMO-RU-ACCOUNT-0001' }, savedAt: 1234 });
  assert.equal(state.orders[0].paymentDetails.receive, undefined);
  setPaymentDetails(state, 'order-1', 'receive', createDemoPaymentDetails(cash), 1250);
  assert.equal(state.orders[0].paymentDetails.give.savedAt, 1234);
  assert.equal(state.orders[0].paymentDetails.receive.savedAt, 1250);
  assert.deepEqual(state.orders[0].paymentDetails.receive.endpoint, { method: 'cash', currency: 'AMD', city: 'Ереван' });
  raw.holder = 'DEMO-changed outside';
  assert.equal(saved.values.holder, 'DEMO-Recipient');
});

test('validation rejects real data, malformed fields and unexpected endpoint configurations', () => {
  const demo = createDemoPaymentDetails(bank);
  for (const values of [
    { ...demo, holder: 'Actual Recipient' },
    { ...demo, account: '40817810000000000000' },
    { ...demo, account: 'DEMO-GE-IBAN-0001' },
    { ...demo, holder: 'DEMO-<script>alert(1)</script>' },
    { ...demo, holder: 'DEMO-recipient\nextra' },
    { ...demo, holder: 'DEMO-' + 'x'.repeat(120) },
    { ...demo, holder: 42 },
    { ...demo, holder: null },
    [], null,
  ]) assert.throws(() => validatePaymentDetails(bank, values));
  assert.throws(() => paymentFields({ ...bank, bank: 'unknown' }));
  assert.throws(() => paymentFields({ ...bank, currency: 'AMD' }));
  assert.throws(() => paymentFields({ ...cash, currency: 'USDT' }));
  assert.throws(() => paymentFields({ ...cash, city: 'Unknown' }));
  assert.throws(() => paymentFields({ ...crypto, method: 'unknown' }));
  const state = agreedState();
  assert.throws(() => setPaymentDetails(state, 'order-1', '__proto__', demo));
  assert.throws(() => setPaymentDetails(state, 'missing', 'give', demo));
  assert.throws(() => setPaymentDetails(state, 'order-1', 'give', demo, NaN));
  assert.equal(state.orders[0].paymentDetails, undefined);
});

test('direct exchanges mirror details to the peer’s opposite side without sharing objects', () => {
  const state = agreedState();
  state.orders[0].matchedOrderId = 'peer-1';
  state.orders.push({ id: 'peer-1', status: 'agreed', matchedOrderId: 'order-1', give: { ...cash }, receive: { ...bank } });
  const record = setPaymentDetails(state, 'order-1', 'give', createDemoPaymentDetails(bank), 500);
  assert.deepEqual(state.orders[1].paymentDetails.receive, record);
  assert.notEqual(state.orders[1].paymentDetails.receive.values, record.values);
  assert.notEqual(state.orders[1].paymentDetails.receive.endpoint, record.endpoint);
  assert.equal(state.orders[1].paymentDetails.give, undefined);
  setPaymentDetails(state, 'peer-1', 'give', createDemoPaymentDetails(cash), 600);
  assert.deepEqual(state.orders[0].paymentDetails.receive, state.orders[1].paymentDetails.give);
});

test('unavailable or mismatched direct peers cause no partial writes', () => {
  const state = agreedState();
  state.orders[0].matchedOrderId = 'peer-1';
  assert.throws(() => setPaymentDetails(state, 'order-1', 'give', createDemoPaymentDetails(bank)));
  assert.equal(state.orders[0].paymentDetails, undefined);
  state.orders.push({ id: 'peer-1', status: 'agreed', matchedOrderId: 'order-1', give: { ...cash }, receive: { ...bank, bank: 'sber' } });
  assert.throws(() => setPaymentDetails(state, 'order-1', 'give', createDemoPaymentDetails(bank)));
  assert.equal(state.orders[0].paymentDetails, undefined);
  assert.equal(state.orders[1].paymentDetails, undefined);
});
