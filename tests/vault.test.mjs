import test from 'node:test';
import assert from 'node:assert/strict';
import { migrateVault, vaultMetrics, setVaultEnabled, depositVault, requestVaultWithdrawal, confirmVaultWithdrawal } from '../dist/vault.js';
import { seedState, migrateState, submitQuote, acceptQuote, confirmSettlement, providerMetrics } from '../dist/domain.js';
import { vaultPage, vaultModal, vaultSummaryCard } from '../dist/vault-ui.js';

test('enabling and disabling the vault change preference only and preserve existing locks', () => {
  const state = seedState();
  assert.equal(vaultMetrics(state).availableUSDT, 10000);
  assert.throws(() => depositVault(state, 1000), /включите/);
  setVaultEnabled(state, true);
  assert.equal(vaultMetrics(state).depositedUSDT, 0);
  const position = depositVault(state, 1500, 1000);
  setVaultEnabled(state, false);
  assert.equal(position.status, 'active');
  assert.equal(vaultMetrics(state).availableUSDT, 8500);
  const before = JSON.stringify(state);
  assert.throws(() => depositVault(state, 1), /включите/);
  assert.equal(JSON.stringify(state), before);
});

test('depositing trade-reserved collateral is rejected atomically', () => {
  const state = seedState();
  const quote = submitQuote(state, 'HS-1042', 1030000, 1000);
  acceptQuote(state, 'HS-1042', quote.id, 2000);
  setVaultEnabled(state, true);
  const free = vaultMetrics(state).availableUSDT;
  const before = JSON.stringify(state);
  assert.throws(() => depositVault(state, free + 0.000001), /свободного обеспечения/);
  assert.equal(JSON.stringify(state), before);
  depositVault(state, free);
  assert.equal(vaultMetrics(state).availableUSDT, 0);
  assert.equal(state.collateral.reservedUSDT, providerMetrics(state).collateralReservedUSDT);
});

test('a pending offer cannot reserve collateral that was subsequently placed in the vault', () => {
  const state = seedState();
  const quote = submitQuote(state, 'HS-1042', 1030000, 1000);
  setVaultEnabled(state, true);
  const position = depositVault(state, 9000, 1500);
  const before = JSON.stringify(state);
  assert.throws(() => acceptQuote(state, 'HS-1042', quote.id, 2000), /обеспечения/);
  assert.equal(JSON.stringify(state), before);
  requestVaultWithdrawal(state, position.id, 2100);
  assert.equal(vaultMetrics(state).availableUSDT, 1000);
  assert.throws(() => acceptQuote(state, 'HS-1042', quote.id, 2200), /обеспечения/);
  confirmVaultWithdrawal(state, position.id, 2300);
  acceptQuote(state, 'HS-1042', quote.id, 2400);
  assert.equal(state.orders.find(order => order.id === 'HS-1042').status, 'agreed');
});

test('withdrawal requires separate confirmation, releases exactly once and works while disabled', () => {
  const state = seedState();
  setVaultEnabled(state, true);
  const first = depositVault(state, 1000.123456, 1000);
  const second = depositVault(state, 2000, 1100);
  assert.throws(() => confirmVaultWithdrawal(state, first.id), /ожидающий/);
  setVaultEnabled(state, false);
  requestVaultWithdrawal(state, first.id, 2000);
  assert.equal(vaultMetrics(state).depositedUSDT, 3000.123456);
  assert.equal(vaultMetrics(state).withdrawalPendingUSDT, 1000.123456);
  assert.equal(vaultMetrics(state).availableUSDT, 6999.876544);
  const before = JSON.stringify(state);
  assert.throws(() => requestVaultWithdrawal(state, first.id), /уже создан/);
  assert.equal(JSON.stringify(state), before);
  confirmVaultWithdrawal(state, first.id, 3000);
  assert.equal(first.status, 'withdrawn');
  assert.equal(first.withdrawnAt, 3000);
  assert.equal(second.status, 'active');
  assert.equal(vaultMetrics(state).availableUSDT, 8000);
  assert.equal(vaultMetrics(state).withdrawnUSDT, 1000.123456);
  assert.throws(() => confirmVaultWithdrawal(state, first.id), /ожидающий/);
  assert.equal(vaultMetrics(state).availableUSDT, 8000);
});

test('settlement releases trade collateral but cannot release a vault deposit', () => {
  const state = seedState();
  setVaultEnabled(state, true);
  depositVault(state, 5000, 1000);
  const quote = submitQuote(state, 'HS-1042', { amount: 1030000, incomeUSDT: 5 }, 2000);
  acceptQuote(state, 'HS-1042', quote.id, 3000);
  const before = providerMetrics(state);
  confirmSettlement(state, 'HS-1042', 'provider', 4000);
  assert.equal(providerMetrics(state).collateralAvailableUSDT, before.collateralAvailableUSDT);
  confirmSettlement(state, 'HS-1042', 'client', 5000);
  assert.equal(providerMetrics(state).collateralReservedUSDT, 0);
  assert.equal(providerMetrics(state).collateralVaultLockedUSDT, 5000);
  assert.equal(providerMetrics(state).collateralAvailableUSDT, 5000);
});

test('migration preserves active and pending locks and reconstructed trade reserves idempotently', () => {
  const state = seedState();
  setVaultEnabled(state, true);
  const first = depositVault(state, 2000, 1000);
  const pending = depositVault(state, 1000, 1100);
  requestVaultWithdrawal(state, pending.id, 1200);
  const quote = submitQuote(state, 'HS-1042', 1030000, 1500);
  acceptQuote(state, 'HS-1042', quote.id, 2000);
  const expected = vaultMetrics(state);
  state.collateral.reservedUSDT = 0;
  state.version = 1;
  migrateState(state);
  assert.deepEqual(vaultMetrics(state), expected);
  assert.equal(state.vault.deposits.find(item => item.id === first.id).status, 'active');
  assert.equal(state.vault.deposits.find(item => item.id === pending.id).status, 'withdrawal-pending');
  const once = JSON.stringify(state);
  migrateState(state);
  migrateVault(state);
  assert.equal(JSON.stringify(state), once);
});

test('invalid precision, negative amounts and insufficient amounts cannot mutate vault balances', () => {
  const state = seedState();
  setVaultEnabled(state, true);
  for (const amount of [NaN, Infinity, -1, 0, '', null, false, [], {}, 0.0000001, 1.0000001, 10000.000001]) {
    const before = JSON.stringify(state);
    assert.throws(() => depositVault(state, amount));
    assert.equal(JSON.stringify(state), before);
  }
  depositVault(state, 0.000001, 1000);
  assert.equal(vaultMetrics(state).depositedUSDT, 0.000001);
  assert.equal(vaultMetrics(state).availableUSDT, 9999.999999);
});

test('malformed or overcommitted saved vault data is preserved and cannot create free collateral', () => {
  for (const deposits of [
    [{ id: 'old', amountUSDT: 500, status: 'unknown' }],
    [{ id: 'old', amountUSDT: 'broken', status: 'active' }],
    [{ id: 'old', amountUSDT: 10001, status: 'active' }],
  ]) {
    const state = seedState();
    state.vault = { version: 1, enabled: true, deposits };
    migrateState(state);
    assert.equal(state.vault.deposits, deposits);
    assert.equal(vaultMetrics(state).availableUSDT, 0);
    assert.equal(vaultMetrics(state).invalidState, true);
    const before = JSON.stringify(state);
    assert.throws(() => depositVault(state, 1), /проверки/);
    assert.equal(JSON.stringify(state), before);
  }
});

test('rendered review shows the real limit change, no yield claim, and no changes on rendering', () => {
  const state = seedState();
  setVaultEnabled(state, true);
  const before = JSON.stringify(state);
  const review = vaultModal(state, { mode: 'deposit', amount: 3000 }, { language: 'en', fmt: String });
  assert.match(review.body, /10000/);
  assert.match(review.body, /7000/);
  assert.match(review.body, /vault-deposit-confirm/);
  const page = vaultPage(state, { language: 'en' });
  assert.match(page, /Variable/);
  assert.match(page, /Not connected/);
  assert.match(page, /vault-deposit-form/);
  assert.doesNotMatch(page, /[0-9]\s*%|guaranteed|walletconnect|ethereum\.request/i);
  assert.equal(JSON.stringify(state), before);
  assert.match(vaultSummaryCard(state, { language: 'en' }), /vault-open/);
});

test('withdrawal reviews keep the limit fixed until the explicit return step', () => {
  const state = seedState();
  setVaultEnabled(state, true);
  const position = depositVault(state, 2000);
  const first = vaultModal(state, { mode: 'withdraw', depositId: position.id }, { language: 'en', fmt: String });
  assert.equal((first.body.match(/8000/g) || []).length, 2);
  requestVaultWithdrawal(state, position.id);
  const second = vaultModal(state, { mode: 'confirm-withdrawal', depositId: position.id }, { language: 'en', fmt: String });
  assert.match(second.body, /10000/);
  assert.match(second.body, /vault-confirm-withdrawal/);
});

test('malformed saved positions render a blocked vault without discarding records or unlocking collateral', () => {
  const state = seedState();
  state.vault = { version: 1, enabled: true, deposits: [null, 42, { id: 'valid', amountUSDT: 2000, status: 'active', createdAt: 1000 }] };
  const before = structuredClone(state);
  const page = vaultPage(state, { language: 'en' });
  assert.match(page, /Deposit data needs review/);
  assert.match(page, /id="vault-amount"[^>]*disabled/);
  assert.equal(vaultMetrics(state).availableUSDT, 0);
  assert.doesNotThrow(() => vaultModal(state, { mode: 'disable' }));
  assert.deepEqual(state, before);
  requestVaultWithdrawal(state, 'valid', 2000);
  assert.doesNotThrow(() => vaultModal(state, { mode: 'confirm-withdrawal', depositId: 'valid' }));
  confirmVaultWithdrawal(state, 'valid', 3000);
  assert.equal(vaultMetrics(state).availableUSDT, 0);
  assert.equal(state.vault.deposits[0], null);
});
