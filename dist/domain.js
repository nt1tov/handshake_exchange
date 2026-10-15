export const CURRENCIES = [
  { code: 'RUB', name: 'Российский рубль', symbol: '₽', color: '#3868ed', rateUSD: 95 },
  { code: 'AMD', name: 'Армянский драм', symbol: '֏', color: '#af703f', rateUSD: 390 },
  { code: 'USDT', name: 'Tether', symbol: '₮', color: '#26a17b', rateUSD: 1 },
  { code: 'EUR', name: 'Евро', symbol: '€', color: '#5a61c7', rateUSD: 0.92 },
  { code: 'USD', name: 'Доллар США', symbol: '$', color: '#5c896d', rateUSD: 1 },
  { code: 'GEL', name: 'Грузинский лари', symbol: '₾', color: '#9165b1', rateUSD: 2.72 },
  { code: 'USDC', name: 'USD Coin', symbol: '$', color: '#2775ca', rateUSD: 1 },
];

export const BANKS = [
  { id: 'tbank', name: 'Т-Банк', currencies: ['RUB'], kind: 'bank', color: '#f5cf35' },
  { id: 'sber', name: 'Сбер', currencies: ['RUB'], kind: 'bank', color: '#2aaa4e' },
  { id: 'alfa', name: 'Альфа-Банк', currencies: ['RUB'], kind: 'bank', color: '#e95252' },
  { id: 'raiffeisen', name: 'Райффайзен', currencies: ['RUB'], kind: 'bank', color: '#e4cc34' },
  { id: 'ameria', name: 'Ameriabank', currencies: ['AMD', 'USD', 'EUR'], kind: 'bank', color: '#5f9d3c' },
  { id: 'acba', name: 'ACBA', currencies: ['AMD', 'USD', 'EUR'], kind: 'bank', color: '#267b5e' },
  { id: 'idbank', name: 'IDBank', currencies: ['AMD', 'USD', 'EUR'], kind: 'bank', color: '#eb764b' },
  { id: 'revolut', name: 'Revolut', currencies: ['EUR', 'USD'], kind: 'fintech', color: '#292d39' },
  { id: 'wise', name: 'Wise', currencies: ['EUR', 'USD', 'GEL'], kind: 'fintech', color: '#9acd66' },
  { id: 'bog', name: 'Bank of Georgia', currencies: ['GEL', 'USD', 'EUR'], kind: 'bank', color: '#f18a41' },
  { id: 'tbc', name: 'TBC Bank', currencies: ['GEL', 'USD', 'EUR'], kind: 'bank', color: '#48a6da' },
];

export const CITIES = ['Ереван', 'Москва', 'Тбилиси', 'Санкт-Петербург', 'Дубай'];
export const NETWORKS = ['TRC20', 'ERC20', 'TON', 'Solana'];

const cryptoCurrencies = new Set(['USDT', 'USDC']);
const networksByCurrency = { USDT: NETWORKS, USDC: ['ERC20', 'Solana'] };
const tolerance = 0.000001;
let idCounter = 0;

function makeId(prefix, now = Date.now()) {
  idCounter += 1;
  return `${prefix}-${now.toString(36)}-${idCounter.toString(36)}`;
}

function currency(code) {
  const result = CURRENCIES.find((item) => item.code === code);
  if (!result) throw new Error('Выберите поддерживаемую валюту.');
  return result;
}

function number(value, label, allowZero = false) {
  if (!['number', 'string'].includes(typeof value) || (typeof value === 'string' && value.trim() === '')) {
    throw new Error(`${label}: укажите число.`);
  }
  const result = Number(value);
  if (!Number.isFinite(result) || (allowZero ? result < 0 : result <= 0)) {
    throw new Error(`${label}: укажите ${allowZero ? 'неотрицательное' : 'положительное'} конечное число.`);
  }
  return result;
}

function endpoint(input) {
  if (!input || typeof input !== 'object') throw new Error('Заполните способ передачи денег.');
  currency(input.currency);
  if (!['bank', 'cash', 'crypto'].includes(input.method)) throw new Error('Выберите способ передачи денег.');
  const result = { currency: input.currency, method: input.method };
  if (input.method === 'crypto') {
    if (!cryptoCurrencies.has(input.currency)) throw new Error('Для криптовалюты выберите USDT или USDC.');
    if (!networksByCurrency[input.currency].includes(input.network)) throw new Error('Выберите доступную сеть для этой криптовалюты.');
    result.network = input.network;
  } else {
    if (cryptoCurrencies.has(input.currency)) throw new Error('USDT и USDC передаются через криптовалютную сеть.');
    if (input.method === 'bank') {
      const bank = BANKS.find((item) => item.id === input.bank);
      if (!bank || !bank.currencies.includes(input.currency)) throw new Error('Выберите банк, поддерживающий эту валюту.');
      result.bank = bank.id;
    } else {
      if (!CITIES.includes(input.city)) throw new Error('Выберите город передачи наличных.');
      const address = typeof input.address === 'string' ? input.address.trim() : '';
      if (address.length < 3 || address.length > 160) throw new Error('Укажите адрес передачи наличных: от 3 до 160 символов.');
      result.city = input.city;
      result.address = address;
    }
  }
  return result;
}

function sameEndpoint(first, second) {
  if (!first || !second || first.currency !== second.currency || first.method !== second.method) return false;
  if (first.method === 'bank') return first.bank === second.bank;
  if (first.method === 'cash') return first.city === second.city;
  return first.network === second.network;
}

function sameCurrency(item) {
  return Boolean(item?.give?.currency && item.give.currency === item.receive?.currency);
}

function requireDifferentCurrencies(item) {
  if (sameCurrency(item)) throw new Error('Выберите разные валюты для отправки и получения.');
}

function endpoints(input) {
  const give = endpoint(input.give);
  const receive = endpoint(input.receive);
  requireDifferentCurrencies({ give, receive });
  return { give, receive };
}

function getOrder(state, orderId) {
  const result = state.orders.find((order) => order.id === orderId);
  if (!result) throw new Error('Заявка не найдена.');
  return result;
}

function requireSearching(order) {
  if (order.status !== 'searching') throw new Error('Заявка уже зарезервирована, завершена или отменена.');
}

function notify(state, type, title, message, orderId, now = Date.now()) {
  state.notifications.unshift({ id: makeId('notice', now), type, title, message, orderId, createdAt: now, read: false });
}

export function amountFor(giveAmount, giveCurrency, receiveCurrency) {
  const amount = number(giveAmount, 'Сумма', true);
  const converted = amount / currency(giveCurrency).rateUSD * currency(receiveCurrency).rateUSD;
  if (!Number.isFinite(converted)) throw new Error('Сумма обмена слишком велика.');
  return roundCurrency(converted, receiveCurrency);
}

function roundCurrency(amount, code) {
  currency(code);
  const precision = cryptoCurrencies.has(code) ? 6 : 2;
  const factor = 10 ** precision;
  const scaled = amount * factor;
  return Number.isFinite(scaled)
    ? Math.round(scaled + Number.EPSILON * Math.max(1, Math.abs(scaled))) / factor
    : Number(amount.toFixed(precision));
}

export function formatAmount(amount) {
  const value = Number(amount);
  if (!Number.isFinite(value)) return '—';
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(value);
}

export function findMatch(state, order) {
  if (order.status !== 'searching' || sameCurrency(order)) return null;
  return state.orders.filter((candidate) => (
    candidate.id !== order.id
    && candidate.owner !== order.owner
    && candidate.status === 'searching'
    && !sameCurrency(candidate)
    && sameEndpoint(order.give, candidate.receive)
    && sameEndpoint(order.receive, candidate.give)
    && candidate.amount + tolerance >= order.minReceive
    && order.amount + tolerance >= candidate.minReceive
  )).sort((first, second) => second.amount - first.amount || first.createdAt - second.createdAt)[0] || null;
}

function reserveMatch(order, match) {
  order.status = match.status = 'matched';
  order.matchedOrderId = match.id;
  order.matchedReceive = match.amount;
  match.matchedOrderId = order.id;
  match.matchedReceive = order.amount;
  for (const item of [order, match]) {
    for (const quote of item.quotes) if (quote.status === 'pending') quote.status = 'declined';
  }
}

export function createOrder(state, input, now = Date.now()) {
  const sides = endpoints(input);
  const amount = number(input.amount, 'Сумма отправки');
  const minReceive = number(input.minReceive ?? amountFor(amount, sides.give.currency, sides.receive.currency), 'Минимальная сумма получения');
  const order = {
    id: makeId('HS', now), owner: 'me', ...sides, amount, minReceive,
    partial: false, status: 'searching', createdAt: now, quotes: [],
  };
  const match = findMatch(state, order);
  if (match) reserveMatch(order, match);
  state.orders.unshift(order);
  notify(state, match ? 'match' : 'order', match ? 'Встречная заявка найдена' : 'Заявка опубликована', match ? 'Условия совпали. Подтвердите обмен в своей заявке.' : 'Ищем встречную заявку. Провайдеры наличных могут предложить свою цену.', order.id, now);
  return order;
}

export function acceptMatch(state, orderId) {
  const order = getOrder(state, orderId);
  requireDifferentCurrencies(order);
  if (order.status !== 'matched') throw new Error('У этой заявки нет активного совпадения.');
  const match = getOrder(state, order.matchedOrderId);
  requireDifferentCurrencies(match);
  if (match.status !== 'matched' || match.matchedOrderId !== order.id) throw new Error('Встречная заявка больше недоступна.');
  order.status = 'agreed';
  match.status = 'agreed';
  order.agreedAt = match.agreedAt = Date.now();
  for (const item of [order, match]) {
    for (const quote of item.quotes) if (quote.status === 'pending') quote.status = 'declined';
  }
  notify(state, 'agreement', 'Условия обмена согласованы', 'Демо-сделка зафиксирована. Реальное движение денег не выполняется.', order.id);
  return order;
}

export function isDirectionCompatible(direction, order) {
  if (!direction.active || order.status !== 'searching' || sameCurrency(direction) || sameCurrency(order)) return false;
  if (!sameEndpoint(direction.give, order.receive) || !sameEndpoint(direction.receive, order.give)) return false;
  const amount = order.minReceive ?? amountFor(order.amount, order.give.currency, order.receive.currency);
  return amount + tolerance >= direction.min && amount <= direction.max + tolerance && amount <= direction.available + tolerance;
}

function canQuoteAmount(direction, order, amount) {
  return direction && isDirectionCompatible(direction, order)
    && amount + tolerance >= direction.min
    && amount <= direction.max + tolerance
    && amount <= direction.available + tolerance;
}

export function submitQuote(state, orderId, input, now = Date.now()) {
  const order = getOrder(state, orderId);
  requireDifferentCurrencies(order);
  requireSearching(order);
  if (order.give.method !== 'cash' && order.receive.method !== 'cash') throw new Error('Отклики провайдера доступны для заявок с наличными.');
  const values = input && typeof input === 'object' && !Array.isArray(input) ? input : { amount: input };
  const inputMode = values.inputMode ?? 'amount';
  if (!['amount', 'rate'].includes(inputMode)) throw new Error('Выберите ввод суммы или курса.');
  const enteredRate = inputMode === 'rate' ? number(values.rate, 'Курс') : null;
  const rawAmount = inputMode === 'rate' ? number(order.amount * enteredRate, 'Сумма предложения') : number(values.amount, 'Сумма предложения');
  const quoteAmount = number(roundCurrency(rawAmount, order.receive.currency), 'Сумма предложения');
  const incomeUSDT = number(values.incomeUSDT ?? 0, 'Доход в USDT', true);
  if (quoteAmount + tolerance < order.minReceive) throw new Error('Предложение ниже минимальной суммы, указанной клиентом.');
  const direction = state.directions.find((item) => canQuoteAmount(item, order, quoteAmount));
  if (!direction) throw new Error('Нет активного направления с подходящими условиями и достаточным остатком.');
  const quote = {
    id: makeId('quote', now), directionId: direction.id, amount: quoteAmount,
    rate: enteredRate ?? quoteAmount / order.amount, effectiveRate: quoteAmount / order.amount,
    inputMode, incomeUSDT: roundCurrency(incomeUSDT, 'USDT'),
    expiresAt: now + 5 * 60 * 1000, status: 'pending',
  };
  for (const previous of order.quotes) if (previous.status === 'pending') previous.status = 'declined';
  order.quotes.push(quote);
  notify(state, 'quote', 'Новое предложение', `По заявке предложено ${formatAmount(quote.amount)} ${order.receive.currency}. Цена действует 5 минут.`, order.id, now);
  return quote;
}

export function acceptQuote(state, orderId, quoteId, now = Date.now()) {
  const order = getOrder(state, orderId);
  requireDifferentCurrencies(order);
  requireSearching(order);
  const quote = order.quotes.find((item) => item.id === quoteId);
  if (!quote || quote.status !== 'pending') throw new Error('Предложение больше недоступно.');
  if (quote.expiresAt <= now) throw new Error('Срок действия цены истёк. Запросите новое предложение.');
  const direction = state.directions.find((item) => item.id === quote.directionId);
  requireDifferentCurrencies(direction);
  if (!canQuoteAmount(direction, order, quote.amount)) throw new Error('Объём провайдера больше недоступен. Запросите новое предложение.');
  const collateral = state.collateral ?? { totalUSDT: 10000, reservedUSDT: 0 };
  const requiredUSDT = amountFor(quote.amount, order.receive.currency, 'USDT');
  if (requiredUSDT > collateral.totalUSDT - collateral.reservedUSDT + tolerance) throw new Error('Недостаточно свободного демо-обеспечения провайдера.');
  state.collateral = collateral;
  collateral.reservedUSDT = roundCurrency(collateral.reservedUSDT + requiredUSDT, 'USDT');
  direction.available = Number((direction.available - quote.amount).toFixed(6));
  order.status = 'agreed';
  order.acceptedQuoteId = quote.id;
  order.agreedAt = now;
  order.collateralReservedUSDT = requiredUSDT;
  order.settlement = { providerSentAt: null, clientReceivedAt: null };
  for (const item of order.quotes) item.status = item.id === quote.id ? 'accepted' : 'declined';
  notify(state, 'agreement', 'Предложение принято', 'Условия демо-сделки зафиксированы, объём зарезервирован.', order.id, now);
  return order;
}

function acceptedProviderQuote(order) {
  return order.acceptedQuoteId ? order.quotes.find((quote) => quote.id === order.acceptedQuoteId && quote.status === 'accepted') : null;
}

export function confirmSettlement(state, orderId, actor, now = Date.now()) {
  const order = getOrder(state, orderId);
  if (!['provider', 'client'].includes(actor)) throw new Error('Выберите сторону подтверждения: клиент или провайдер.');
  if (order.status !== 'agreed') throw new Error('Подтверждение доступно только для согласованной незавершённой сделки.');
  const quote = acceptedProviderQuote(order);
  if (!quote) {
    if (actor !== 'client') throw new Error('Прямой обмен подтверждает клиент, провайдер не участвует.');
    const peer = state.orders.find((item) => item.id === order.matchedOrderId);
    if (!peer || peer.status !== 'agreed' || peer.matchedOrderId !== order.id) throw new Error('Встречная сделка больше недоступна для подтверждения.');
    for (const item of [order, peer]) {
      item.status = 'completed';
      item.completedAt = now;
      item.settlement = { clientReceivedAt: now };
    }
    notify(state, 'settlement', 'Обмен завершён', 'Получение средств подтверждено в демо-сделке.', order.id, now);
    return order;
  }
  const settlement = order.settlement ?? { providerSentAt: null, clientReceivedAt: null };
  const field = actor === 'provider' ? 'providerSentAt' : 'clientReceivedAt';
  if (settlement[field] != null) throw new Error('Эта сторона уже подтвердила расчёт.');
  settlement[field] = now;
  order.settlement = settlement;
  if (settlement.providerSentAt != null && settlement.clientReceivedAt != null) {
    order.status = 'completed';
    order.completedAt = now;
    if (order.collateralReservedUSDT > 0 && order.collateralReleasedAt == null) {
      state.collateral.reservedUSDT = roundCurrency(Math.max(0, state.collateral.reservedUSDT - order.collateralReservedUSDT), 'USDT');
      order.collateralReleasedAt = now;
    }
    notify(state, 'settlement', 'Обмен завершён', 'Обе стороны подтвердили расчёт. Демонстрационное обеспечение освобождено.', order.id, now);
  } else {
    notify(state, 'settlement', actor === 'provider' ? 'Провайдер подтвердил отправку' : 'Клиент подтвердил получение', 'Ожидаем подтверждение второй стороны демо-сделки.', order.id, now);
  }
  return order;
}

export function providerMetrics(state) {
  const providerOrders = state.orders.filter((order) => acceptedProviderQuote(order));
  const completed = providerOrders.filter((order) => order.status === 'completed');
  const active = providerOrders.filter((order) => order.status === 'agreed');
  const income = (orders) => roundCurrency(orders.reduce((sum, order) => sum + (acceptedProviderQuote(order).incomeUSDT ?? 0), 0), 'USDT');
  const collateralTotalUSDT = state.collateral?.totalUSDT ?? 10000;
  const collateralReservedUSDT = state.collateral?.reservedUSDT ?? 0;
  return {
    completedCount: completed.length, earnedUSDT: income(completed), pendingIncomeUSDT: income(active), activeCount: active.length,
    collateralTotalUSDT, collateralReservedUSDT,
    collateralAvailableUSDT: Math.max(0, roundCurrency(collateralTotalUSDT - collateralReservedUSDT, 'USDT')),
  };
}

export function migrateState(state) {
  if (!state || !Array.isArray(state.orders) || !Array.isArray(state.directions)) return seedState();
  state.notifications ??= [];
  for (const item of [...state.orders, ...state.directions]) {
    for (const side of ['give', 'receive']) {
      if (item[side]?.method === 'cash' && typeof item[side].address !== 'string') item[side].address = '';
    }
  }
  for (const order of state.orders) {
    order.quotes ??= [];
    for (const quote of order.quotes) {
      quote.incomeUSDT ??= 0;
      quote.inputMode ??= 'amount';
      quote.rate ??= quote.amount / order.amount;
      quote.effectiveRate ??= quote.amount / order.amount;
    }
    const quote = acceptedProviderQuote(order);
    if (quote && order.status === 'agreed') {
      order.settlement ??= { providerSentAt: null, clientReceivedAt: null };
      order.collateralReservedUSDT ??= amountFor(quote.amount, order.receive.currency, 'USDT');
    }
  }
  const cancelledIds = new Set();
  for (const order of state.orders) {
    if (!sameCurrency(order) || !['searching', 'matched'].includes(order.status)) continue;
    order.status = 'cancelled';
    order.invalidReason = 'same-currency';
    for (const quote of order.quotes) if (quote.status === 'pending') quote.status = 'declined';
    cancelledIds.add(order.id);
    delete order.matchedOrderId;
    delete order.matchedReceive;
  }
  for (const order of state.orders) {
    if (order.status !== 'matched' || !cancelledIds.has(order.matchedOrderId)) continue;
    order.status = 'searching';
    delete order.matchedOrderId;
    delete order.matchedReceive;
  }
  for (const direction of state.directions) {
    if (!sameCurrency(direction)) continue;
    direction.active = false;
    direction.invalidReason = 'same-currency';
  }
  const reservedUSDT = roundCurrency(state.orders.reduce((sum, order) => sum + (order.status === 'agreed' && acceptedProviderQuote(order) ? order.collateralReservedUSDT ?? 0 : 0), 0), 'USDT');
  state.collateral = { totalUSDT: state.collateral?.totalUSDT ?? 10000, reservedUSDT };
  state.version = 2;
  return state;
}

export function cancelOrder(state, orderId) {
  const order = getOrder(state, orderId);
  if (!['searching', 'matched'].includes(order.status)) throw new Error('Завершённую или отменённую заявку нельзя отменить повторно.');
  if (order.matchedOrderId) {
    const match = state.orders.find((item) => item.id === order.matchedOrderId);
    if (match?.status === 'matched' && match.matchedOrderId === order.id) {
      match.status = 'searching';
      delete match.matchedOrderId;
      delete match.matchedReceive;
    }
  }
  order.status = 'cancelled';
  delete order.matchedOrderId;
  delete order.matchedReceive;
  for (const quote of order.quotes) if (quote.status === 'pending') quote.status = 'declined';
  notify(state, 'cancel', 'Заявка отменена', 'Поиск остановлен, зарезервированная встречная заявка освобождена.', order.id);
  for (const waiting of state.orders) {
    if (waiting.owner !== 'me' || waiting.status !== 'searching') continue;
    const match = findMatch(state, waiting);
    if (!match) continue;
    reserveMatch(waiting, match);
    notify(state, 'match', 'Встречная заявка найдена', 'Условия совпали. Подтвердите обмен в своей заявке.', waiting.id);
  }
  return order;
}

export function addDirection(state, input) {
  const sides = endpoints(input);
  if (sides.give.method !== 'cash' && sides.receive.method !== 'cash') throw new Error('Добавьте наличные с одной из сторон направления.');
  const min = number(input.min, 'Минимальная сумма');
  const max = number(input.max, 'Максимальная сумма');
  const available = number(input.available, 'Доступный объём', true);
  if (min > max) throw new Error('Минимальная сумма не может превышать максимальную.');
  const direction = { id: makeId('dir'), ...sides, min, max, available, active: input.active !== false };
  state.directions.push(direction);
  return direction;
}

export function toggleDirection(state, id) {
  const direction = state.directions.find((item) => item.id === id);
  if (!direction) throw new Error('Направление не найдено.');
  if (!direction.active) requireDifferentCurrencies(direction);
  direction.active = !direction.active;
  return direction;
}

export function seedState() {
  const now = Date.now();
  const rub = { currency: 'RUB', method: 'bank', bank: 'tbank' };
  const amd = { currency: 'AMD', method: 'cash', city: 'Ереван', address: 'Демо: Северный проспект, 6' };
  const usdt = { currency: 'USDT', method: 'crypto', network: 'TRC20' };
  const eur = { currency: 'EUR', method: 'bank', bank: 'revolut' };
  const order = (id, owner, give, receive, amount, minutes) => ({
    id, owner, give: { ...give }, receive: { ...receive }, amount,
    minReceive: amountFor(amount, give.currency, receive.currency),
    partial: false, status: 'searching', createdAt: now - minutes * 60000, quotes: [],
  });
  const completedOrder = (id, give, receive, amount, incomeUSDT, directionId, minutes) => {
    const result = order(id, 'me', give, receive, amount, minutes);
    const completedAt = now - (minutes - 10) * 60000;
    const quote = { id: `quote-${id}`, directionId, amount: result.minReceive, rate: result.minReceive / amount, effectiveRate: result.minReceive / amount, inputMode: 'amount', incomeUSDT, expiresAt: completedAt, status: 'accepted' };
    return { ...result, status: 'completed', acceptedQuoteId: quote.id, quotes: [quote], agreedAt: now - (minutes - 2) * 60000, completedAt, settlement: { providerSentAt: completedAt - 60000, clientReceivedAt: completedAt }, collateralReservedUSDT: amountFor(quote.amount, receive.currency, 'USDT'), collateralReleasedAt: completedAt };
  };
  return {
    version: 2,
    collateral: { totalUSDT: 10000, reservedUSDT: 0 },
    orders: [
      order('HS-1042', 'me', rub, amd, 250000, 24),
      order('HS-1041', 'me', usdt, eur, 2500, 42),
      { ...order('HS-1038', 'peer', amd, rub, amountFor(100000, 'RUB', 'AMD'), 5), minReceive: 100000 },
      order('HS-1037', 'peer', usdt, amd, 1500, 3),
      order('HS-1036', 'peer', { ...rub, bank: 'sber' }, amd, 180000, 7),
      order('HS-1035', 'peer', { currency: 'USD', method: 'bank', bank: 'revolut' }, { currency: 'EUR', method: 'cash', city: 'Ереван', address: 'Демо: улица Туманяна, 8' }, 3200, 11),
      order('HS-1034', 'peer', usdt, { currency: 'USD', method: 'cash', city: 'Тбилиси', address: 'Демо: проспект Руставели, 12' }, 2400, 17),
      order('HS-1033', 'peer', rub, amd, 120000, 19),
      completedOrder('HS-1020', rub, amd, 95000, 18.5, 'dir-amd-rub', 1440),
      completedOrder('HS-1019', usdt, amd, 2000, 22, 'dir-amd-usdt', 2880),
      completedOrder('HS-1018', rub, amd, 142500, 12.75, 'dir-amd-rub', 4320),
    ],
    directions: [
      { id: 'dir-amd-rub', give: { ...amd }, receive: { ...rub }, min: 100000, max: 3000000, available: 5200000, active: true },
      { id: 'dir-amd-usdt', give: { ...amd }, receive: { ...usdt }, min: 100000, max: 3900000, available: 7600000, active: true },
      { id: 'dir-amd-sber', give: { ...amd }, receive: { ...rub, bank: 'sber' }, min: 100000, max: 2000000, available: 2800000, active: true },
      { id: 'dir-eur-revolut', give: { currency: 'EUR', method: 'cash', city: 'Ереван', address: 'Демо: улица Туманяна, 8' }, receive: { currency: 'USD', method: 'bank', bank: 'revolut' }, min: 500, max: 10000, available: 18000, active: true },
      { id: 'dir-usd-usdt', give: { currency: 'USD', method: 'cash', city: 'Тбилиси', address: 'Демо: проспект Руставели, 12' }, receive: { ...usdt }, min: 500, max: 15000, available: 22000, active: false },
    ],
    notifications: [],
  };
}
