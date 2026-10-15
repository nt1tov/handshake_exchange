// Browser-local accounting only. No protocol, wallet, price feed or yield accrual.
const SCALE = 1000000;
let sequence = 0;

function units(value, allowZero = false) {
  if (!['number', 'string'].includes(typeof value) || String(value).trim() === '') throw new Error('Укажите сумму vault в USDT.');
  const amount = Number(value);
  const scaled = amount * SCALE;
  const rounded = Math.round(scaled);
  if (!Number.isFinite(amount) || !Number.isSafeInteger(rounded) || (allowZero ? amount < 0 : amount <= 0)
    || Math.abs(scaled - rounded) > Math.max(0.000001, Number.EPSILON * Math.abs(scaled) * 2)) {
    throw new Error('Сумма vault должна быть положительным числом с точностью до 6 знаков.');
  }
  if (!allowZero && rounded === 0) throw new Error('Минимальная демо-сумма vault — 0,000001 USDT.');
  return rounded;
}

function balanceUnits(value) {
  try { return units(value, true); } catch { return null; }
}

export function migrateVault(state) {
  if (state.vault == null) state.vault = { version: 1, enabled: false, deposits: [] };
  if (typeof state.vault !== 'object' || Array.isArray(state.vault)) return state;
  state.vault.version ??= 1;
  state.vault.enabled = state.vault.enabled === true;
  state.vault.deposits ??= [];
  return state;
}

export function vaultMetrics(state) {
  const collateral = state.collateral;
  const total = balanceUnits(collateral?.totalUSDT ?? 10000);
  const reserved = balanceUnits(collateral?.reservedUSDT ?? 0);
  const positions = state.vault?.deposits ?? [];
  let invalidState = total == null || reserved == null || !Array.isArray(positions)
    || (state.vault != null && (typeof state.vault !== 'object' || Array.isArray(state.vault)));
  let active = 0;
  let pending = 0;
  let withdrawn = 0;
  const ids = new Set();
  for (const position of Array.isArray(positions) ? positions : []) {
    const amount = balanceUnits(position?.amountUSDT);
    if (amount == null || amount === 0 || !position.id || ids.has(position.id)) invalidState = true;
    ids.add(position?.id);
    if (position?.status === 'withdrawn') withdrawn += amount ?? 0;
    else if (position?.status === 'withdrawal-pending') pending += amount ?? 0;
    else {
      active += amount ?? 0;
      if (position?.status !== 'active') invalidState = true;
    }
  }
  const locked = active + pending;
  if (![active, pending, withdrawn, locked].every(Number.isSafeInteger)) invalidState = true;
  const free = (total ?? 0) - (reserved ?? 0) - locked;
  if (free < 0) invalidState = true;
  return {
    activeUSDT: active / SCALE, withdrawalPendingUSDT: pending / SCALE,
    depositedUSDT: locked / SCALE, withdrawnUSDT: withdrawn / SCALE,
    collateralTotalUSDT: (total ?? 0) / SCALE, tradeReservedUSDT: (reserved ?? 0) / SCALE,
    availableUSDT: invalidState ? 0 : free / SCALE, invalidState,
  };
}

export function setVaultEnabled(state, enabled) {
  if (typeof enabled !== 'boolean') throw new Error('Выберите состояние опции vault.');
  if (vaultMetrics(state).invalidState) throw new Error('Данные vault требуют проверки. Новые размещения недоступны.');
  migrateVault(state);
  state.vault.enabled = enabled;
  return state.vault;
}

export function depositVault(state, amount, now = Date.now()) {
  const value = units(amount);
  const metrics = vaultMetrics(state);
  if (metrics.invalidState) throw new Error('Данные vault требуют проверки. Новые размещения недоступны.');
  if (state.vault?.enabled !== true) throw new Error('Сначала включите демо-vault после просмотра условий.');
  if (value > Math.round(metrics.availableUSDT * SCALE)) throw new Error('Недостаточно свободного обеспечения для размещения в vault.');
  let id;
  do { id = `vault-${now.toString(36)}-${(++sequence).toString(36)}`; } while (state.vault.deposits.some(item => item.id === id));
  const deposit = { id, amountUSDT: value / SCALE, status: 'active', createdAt: now };
  state.vault.deposits.unshift(deposit);
  return deposit;
}

function positionFor(state, id) {
  const deposits = state.vault?.deposits;
  const position = Array.isArray(deposits) ? deposits.find(item => item?.id === id) : null;
  if (!position) throw new Error('Размещение в vault не найдено.');
  return position;
}

export function requestVaultWithdrawal(state, id, now = Date.now()) {
  const deposit = positionFor(state, id);
  if (deposit.status !== 'active') throw new Error('Запрос на вывод уже создан или размещение закрыто.');
  deposit.status = 'withdrawal-pending';
  deposit.withdrawalRequestedAt = now;
  return deposit;
}

export function confirmVaultWithdrawal(state, id, now = Date.now()) {
  const deposit = positionFor(state, id);
  if (deposit.status !== 'withdrawal-pending') throw new Error('Подтвердить можно только ожидающий демо-вывод.');
  deposit.status = 'withdrawn';
  deposit.withdrawnAt = now;
  return deposit;
}
