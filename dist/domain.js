import { BANKS } from './bank-catalog.js';
import { migrateVault, vaultMetrics } from './vault.js';
import { calculateClientPricing } from './client-pricing.js';
export { BANKS } from './bank-catalog.js';

export const CURRENCIES = [
  { code: 'RUB', name: 'Российский рубль', symbol: '₽', color: '#3868ed', rateUSD: 95 },
  { code: 'AMD', name: 'Армянский драм', symbol: '֏', color: '#af703f', rateUSD: 390 },
  { code: 'USDT', name: 'Tether', symbol: '₮', color: '#26a17b', rateUSD: 1 },
  { code: 'EUR', name: 'Евро', symbol: '€', color: '#5a61c7', rateUSD: 0.92 },
  { code: 'USD', name: 'Доллар США', symbol: '$', color: '#5c896d', rateUSD: 1 },
  { code: 'GEL', name: 'Грузинский лари', symbol: '₾', color: '#9165b1', rateUSD: 2.72 },
  { code: 'USDC', name: 'USD Coin', symbol: '$', color: '#2775ca', rateUSD: 1 },
  { code: 'AED', name: 'Дирхам ОАЭ', symbol: 'د.إ', color: '#438e7a', rateUSD: 3.6725 },
  { code: 'KZT', name: 'Казахстанский тенге', symbol: '₸', color: '#398aa6', rateUSD: 500 },
];

export const CITIES = ['Ереван', 'Москва', 'Тбилиси', 'Санкт-Петербург', 'Дубай', 'Алматы', 'Астана'];
export const NETWORKS = ['TRC20', 'ERC20', 'TON', 'Solana'];

const cryptoCurrencies = new Set(['USDT', 'USDC']);
const networksByCurrency = { USDT: NETWORKS, USDC: ['ERC20', 'Solana'] };
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
      result.country = bank.country;
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

function invalidBankCurrency(item) {
  return [item?.give, item?.receive].some(side => side?.method === 'bank'
    && !BANKS.some(bank => bank.id === side.bank && bank.currencies.includes(side.currency)));
}

function requireSupportedBanks(item) {
  if (invalidBankCurrency(item)) throw new Error('Банк больше не поддерживает валюту этой заявки. Создайте новую заявку.');
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

export function referenceRate(giveCurrency, receiveCurrency) {
  return currency(receiveCurrency).rateUSD / currency(giveCurrency).rateUSD;
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
  return new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

function currencyStep(code) {
  return cryptoCurrencies.has(code) ? 0.000001 : 0.01;
}

function directedRound(amount, code, up = false) {
  const factor = 1 / currencyStep(code);
  const scaled = amount * factor;
  const epsilon = Number.EPSILON * Math.max(1, Math.abs(scaled)) * 4;
  return (up ? Math.ceil(scaled - epsilon) : Math.floor(scaled + epsilon)) / factor;
}

function minimumAtRate(order, amount, minimum) {
  if (order.pricingMode !== 'manual' || amount <= 0) return minimum;
  return Math.max(minimum, calculateClientPricing({ ...order, amount }).minReceive);
}

function splitExecution(order, value) {
  const giveAmount = number(roundCurrency(number(value, 'Сумма отправки'), order.give.currency), 'Сумма отправки');
  if (giveAmount > order.amount) throw new Error('Часть обмена не может превышать сумму заявки.');
  if (giveAmount < order.amount && order.partial !== true) throw new Error('Клиент разрешил только обмен всей суммы.');
  const proportionalMinimum = giveAmount === order.amount ? order.minReceive
    : directedRound(order.minReceive * (giveAmount / order.amount), order.receive.currency, true);
  const minReceive = minimumAtRate(order, giveAmount, proportionalMinimum);
  const remainingAmount = roundCurrency(order.amount - giveAmount, order.give.currency);
  const remainingMinReceive = minimumAtRate(order, remainingAmount, Math.max(0, roundCurrency(order.minReceive - minReceive, order.receive.currency)));
  if (minReceive <= 0 || (remainingAmount > 0 && remainingMinReceive <= 0)) {
    throw new Error('Для такой части слишком мал остаток заявки. Выберите другой объём.');
  }
  return { giveAmount, minReceive, remainingAmount, remainingMinReceive };
}

function executionFits(order, giveAmount, receiveAmount) {
  const split = splitExecution(order, giveAmount);
  if (!Number.isFinite(receiveAmount) || receiveAmount + currencyStep(order.receive.currency) / 1000 < split.minReceive) {
    throw new Error('Объём обмена ниже пропорционального минимума заявки.');
  }
  return split;
}

function matchExecution(order, candidate) {
  if (candidate.id === order.id || candidate.owner === order.owner || candidate.status !== 'searching'
    || sameCurrency(candidate) || invalidBankCurrency(candidate) || !sameEndpoint(order.give, candidate.receive) || !sameEndpoint(order.receive, candidate.give)) return null;
  try {
    const candidateMinimum = minimumAtRate(candidate, candidate.amount, candidate.minReceive);
    let giveAmount = order.amount;
    let receiveAmount = candidate.amount;
    if (order.partial === true) giveAmount = Math.min(order.amount, candidateMinimum);
    if (giveAmount < candidateMinimum) {
      if (candidate.partial !== true) return null;
      receiveAmount = directedRound(candidate.amount * (giveAmount / candidateMinimum), candidate.give.currency);
    }
    executionFits(order, giveAmount, receiveAmount);
    executionFits(candidate, receiveAmount, giveAmount);
    return { giveAmount, receiveAmount };
  } catch {
    return null;
  }
}

export function findMatch(state, order) {
  if (order.status !== 'searching' || sameCurrency(order) || invalidBankCurrency(order)) return null;
  return state.orders.map(candidate => ({ candidate, execution: matchExecution(order, candidate) }))
    .filter(item => item.execution)
    .sort((first, second) => second.execution.receiveAmount / second.execution.giveAmount - first.execution.receiveAmount / first.execution.giveAmount
      || second.execution.receiveAmount - first.execution.receiveAmount
      || first.execution.giveAmount - second.execution.giveAmount
      || first.candidate.createdAt - second.candidate.createdAt)[0]?.candidate || null;
}

function reserveMatch(order, match) {
  const execution = matchExecution(order, match);
  if (!execution) throw new Error('Встречная заявка больше не соответствует условиям.');
  order.status = match.status = 'matched';
  order.matchedOrderId = match.id;
  order.matchedGive = execution.giveAmount;
  order.matchedReceive = execution.receiveAmount;
  match.matchedOrderId = order.id;
  match.matchedGive = execution.receiveAmount;
  match.matchedReceive = execution.giveAmount;
  for (const item of [order, match]) {
    for (const quote of item.quotes) if (quote.status === 'pending') quote.status = 'declined';
  }
}

function rematchSearching(state, now = Date.now()) {
  for (const waiting of state.orders) {
    if (waiting.owner !== 'me' || waiting.status !== 'searching') continue;
    const match = findMatch(state, waiting);
    if (!match) continue;
    reserveMatch(waiting, match);
    notify(state, 'match', 'Встречная заявка найдена', 'Условия совпали. Подтвердите обмен в своей заявке.', waiting.id, now);
  }
}

function applySplit(state, order, split, now) {
  if (split.remainingAmount <= 0) return null;
  const rootOrderId = order.rootOrderId || order.id;
  const remainder = {
    id: makeId('HS', now), owner: order.owner, give: { ...order.give }, receive: { ...order.receive },
    amount: split.remainingAmount, minReceive: split.remainingMinReceive,
    partial: true, status: 'searching', createdAt: now, quotes: [], rootOrderId, parentOrderId: order.id,
    ...(order.pricingMode ? { pricingMode: order.pricingMode } : {}),
    ...(order.pricingMode === 'manual' ? { manualRate: order.manualRate } : {}),
  };
  order.rootOrderId = rootOrderId;
  order.amount = split.giveAmount;
  order.minReceive = split.minReceive;
  order.remainderOrderId = remainder.id;
  state.orders.unshift(remainder);
  return remainder;
}

export function orderExecution(order) {
  const quote = acceptedProviderQuote(order);
  if (quote) return { giveAmount: quote.giveAmount ?? order.amount, receiveAmount: quote.amount };
  if (['matched', 'agreed', 'completed'].includes(order.status) && order.matchedOrderId) {
    return { giveAmount: order.matchedGive ?? order.amount, receiveAmount: order.matchedReceive ?? order.minReceive };
  }
  return { giveAmount: order.amount, receiveAmount: order.minReceive };
}

export function createOrder(state, input, now = Date.now()) {
  const sides = endpoints(input);
  const pricing = input.pricingMode === undefined ? null : calculateClientPricing({ ...input, ...sides }, { referenceRate: referenceRate(sides.give.currency, sides.receive.currency) });
  const amount = pricing?.amount ?? number(roundCurrency(number(input.amount, 'Сумма отправки'), sides.give.currency), 'Сумма отправки');
  const minReceive = pricing?.minReceive ?? number(roundCurrency(number(input.minReceive ?? amountFor(amount, sides.give.currency, sides.receive.currency), 'Минимальная сумма получения'), sides.receive.currency), 'Минимальная сумма получения');
  const order = {
    id: makeId('HS', now), owner: 'me', ...sides, amount, minReceive,
    partial: input.partial === true, status: 'searching', createdAt: now, quotes: [],
    ...(pricing ? { pricingMode: pricing.pricingMode } : {}),
    ...(pricing?.pricingMode === 'manual' ? { manualRate: pricing.manualRate } : {}),
  };
  let match;
  if (input.matchTargetId !== undefined) {
    match = state.orders.find(candidate => candidate.id === input.matchTargetId);
    if (!match || !matchExecution(order, match)) throw new Error('Заявка по ссылке больше не подходит под выбранные условия.');
  } else {
    match = findMatch(state, order);
  }
  if (match) reserveMatch(order, match);
  state.orders.unshift(order);
  notify(state, match ? 'match' : 'order', match ? 'Встречная заявка найдена' : 'Заявка опубликована', match ? 'Условия совпали. Подтвердите обмен в своей заявке.' : 'Ищем встречную заявку. Провайдеры наличных могут предложить свою цену.', order.id, now);
  return order;
}

export function acceptMatch(state, orderId, now = Date.now()) {
  const order = getOrder(state, orderId);
  requireDifferentCurrencies(order);
  requireSupportedBanks(order);
  if (order.status !== 'matched') throw new Error('У этой заявки нет активного совпадения.');
  const match = getOrder(state, order.matchedOrderId);
  requireDifferentCurrencies(match);
  requireSupportedBanks(match);
  if (match.status !== 'matched' || match.matchedOrderId !== order.id
    || !sameEndpoint(order.give, match.receive) || !sameEndpoint(order.receive, match.give)) {
    throw new Error('Встречная заявка больше недоступна.');
  }
  const giveAmount = order.matchedGive ?? order.amount;
  const receiveAmount = order.matchedReceive ?? match.amount;
  if (giveAmount !== (match.matchedReceive ?? order.amount) || receiveAmount !== (match.matchedGive ?? match.amount)) {
    throw new Error('Зарезервированные суммы встречных заявок не совпадают.');
  }
  const ownSplit = executionFits(order, giveAmount, receiveAmount);
  const peerSplit = executionFits(match, receiveAmount, giveAmount);
  order.status = match.status = 'agreed';
  order.agreedAt = match.agreedAt = now;
  applySplit(state, order, ownSplit, now);
  applySplit(state, match, peerSplit, now);
  for (const item of [order, match]) {
    for (const quote of item.quotes) if (quote.status === 'pending') quote.status = 'declined';
  }
  notify(state, 'agreement', 'Условия обмена согласованы', 'Демо-сделка зафиксирована. Реальное движение денег не выполняется.', order.id, now);
  rematchSearching(state, now);
  return order;
}

function directionEndpointsFit(direction, order) {
  return Boolean(direction?.active && order.status === 'searching' && !sameCurrency(direction) && !sameCurrency(order)
    && !invalidBankCurrency(direction) && !invalidBankCurrency(order)
    && sameEndpoint(direction.give, order.receive) && sameEndpoint(direction.receive, order.give));
}

export function isDirectionCompatible(direction, order) {
  if (!directionEndpointsFit(direction, order)) return false;
  const capacity = Math.min(direction.max, direction.available);
  if (!Number.isFinite(capacity) || capacity <= 0 || direction.min > capacity) return false;
  try {
    const minimum = minimumAtRate(order, order.amount, order.minReceive);
    if (minimum <= capacity) return true;
    if (order.partial !== true) return false;
    const giveAmount = directedRound(order.amount * (capacity / minimum), order.give.currency);
    return splitExecution(order, giveAmount).minReceive <= capacity;
  } catch {
    return false;
  }
}

function canQuoteAmount(direction, order, amount) {
  const tolerance = currencyStep(order.receive.currency) / 1000;
  return directionEndpointsFit(direction, order)
    && Number.isFinite(amount)
    && amount + tolerance >= direction.min
    && amount <= direction.max + tolerance
    && amount <= direction.available + tolerance;
}

export function submitQuote(state, orderId, input, now = Date.now()) {
  const order = getOrder(state, orderId);
  requireDifferentCurrencies(order);
  requireSupportedBanks(order);
  requireSearching(order);
  if (order.give.method !== 'cash' && order.receive.method !== 'cash') throw new Error('Отклики провайдера доступны для заявок с наличными.');
  const values = input && typeof input === 'object' && !Array.isArray(input) ? input : { amount: input };
  const inputMode = values.inputMode ?? 'amount';
  if (!['amount', 'rate'].includes(inputMode)) throw new Error('Выберите ввод суммы или курса.');
  const split = splitExecution(order, values.giveAmount === undefined ? order.amount : values.giveAmount);
  const enteredRate = inputMode === 'rate' ? number(values.rate, 'Курс') : null;
  const rawAmount = inputMode === 'rate' ? number(split.giveAmount * enteredRate, 'Сумма предложения') : number(values.amount, 'Сумма предложения');
  const quoteAmount = number(roundCurrency(rawAmount, order.receive.currency), 'Сумма предложения');
  const incomeUSDT = number(values.incomeUSDT ?? 0, 'Доход в USDT', true);
  if (quoteAmount + currencyStep(order.receive.currency) / 1000 < split.minReceive) throw new Error('Предложение ниже минимальной суммы, указанной клиентом для выбранной части.');
  const direction = state.directions.find((item) => canQuoteAmount(item, order, quoteAmount));
  if (!direction) throw new Error('Нет активного направления с подходящими условиями и достаточным остатком.');
  const quote = {
    id: makeId('quote', now), directionId: direction.id, amount: quoteAmount, giveAmount: split.giveAmount,
    rate: enteredRate ?? quoteAmount / split.giveAmount, effectiveRate: quoteAmount / split.giveAmount,
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
  requireSupportedBanks(order);
  requireSearching(order);
  const quote = order.quotes.find((item) => item.id === quoteId);
  if (!quote || quote.status !== 'pending') throw new Error('Предложение больше недоступно.');
  if (quote.expiresAt <= now) throw new Error('Срок действия цены истёк. Запросите новое предложение.');
  const split = executionFits(order, quote.giveAmount ?? order.amount, quote.amount);
  const direction = state.directions.find((item) => item.id === quote.directionId);
  requireDifferentCurrencies(direction);
  requireSupportedBanks(direction);
  if (!canQuoteAmount(direction, order, quote.amount)) throw new Error('Объём провайдера больше недоступен. Запросите новое предложение.');
  const collateral = state.collateral ?? { totalUSDT: 10000, reservedUSDT: 0 };
  const requiredUSDT = amountFor(quote.amount, order.receive.currency, 'USDT');
  if (requiredUSDT > vaultMetrics(state).availableUSDT + currencyStep('USDT') / 1000) throw new Error('Недостаточно свободного демо-обеспечения провайдера.');
  state.collateral = collateral;
  collateral.reservedUSDT = roundCurrency(collateral.reservedUSDT + requiredUSDT, 'USDT');
  direction.available = Number((direction.available - quote.amount).toFixed(6));
  order.status = 'agreed';
  order.acceptedQuoteId = quote.id;
  order.agreedAt = now;
  order.collateralReservedUSDT = requiredUSDT;
  order.settlement = { providerSentAt: null, clientReceivedAt: null };
  for (const item of order.quotes) item.status = item.id === quote.id ? 'accepted' : 'declined';
  applySplit(state, order, split, now);
  notify(state, 'agreement', 'Предложение принято', 'Условия демо-сделки зафиксированы, объём зарезервирован.', order.id, now);
  rematchSearching(state, now);
  return order;
}

function acceptedProviderQuote(order) {
  return order.acceptedQuoteId ? order.quotes.find((quote) => quote.id === order.acceptedQuoteId && quote.status === 'accepted') : null;
}

export const PROBLEM_REASONS = ['not-received', 'wrong-amount', 'wrong-details', 'other'];

export function reportProblem(state, orderId, input, now = Date.now()) {
  const order = getOrder(state, orderId);
  if (order.status !== 'agreed') throw new Error('Сообщить о проблеме можно только по согласованной незавершённой сделке.');
  const peer = state.orders.find(item => item.id === order.matchedOrderId);
  if (order.problem?.status === 'open' || peer?.problem?.status === 'open') throw new Error('Проблема по этой сделке уже зафиксирована.');
  if (!PROBLEM_REASONS.includes(input?.reason)) throw new Error('Выберите причину проблемы.');
  const comment = typeof input.comment === 'string' ? input.comment.trim() : '';
  if (comment.length < 10 || comment.length > 1000) throw new Error('Опишите проблему: от 10 до 1000 символов.');
  order.problem = { id: makeId('problem', now), status: 'open', type: input.reason, comment, createdAt: now };
  const noticeOrder = order.owner === 'me' ? order : peer?.owner === 'me' ? peer : order;
  notify(state, 'problem', 'Проблема зафиксирована в демо', 'Подтверждение расчёта остановлено. Запись сохранена в этом браузере; обращение в реальную поддержку не отправлялось.', noticeOrder.id, now);
  return order;
}

export function confirmSettlement(state, orderId, actor, now = Date.now()) {
  const order = getOrder(state, orderId);
  if (!['provider', 'client'].includes(actor)) throw new Error('Выберите сторону подтверждения: клиент или провайдер.');
  if (order.status !== 'agreed') throw new Error('Подтверждение доступно только для согласованной незавершённой сделки.');
  const linkedPeer = state.orders.find(item => item.id === order.matchedOrderId);
  if (order.problem?.status === 'open' || linkedPeer?.problem?.status === 'open') throw new Error('Расчёт остановлен: по сделке открыта проблема.');
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
  const vault = vaultMetrics(state);
  return {
    completedCount: completed.length, earnedUSDT: income(completed), pendingIncomeUSDT: income(active), activeCount: active.length,
    collateralTotalUSDT, collateralReservedUSDT,
    collateralVaultLockedUSDT: vault.depositedUSDT,
    collateralAvailableUSDT: vault.availableUSDT,
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
    order.partial = order.partial === true;
    if (order.matchedOrderId && ['matched', 'agreed', 'completed'].includes(order.status)) order.matchedGive ??= order.amount;
    for (const quote of order.quotes) {
      quote.giveAmount ??= order.amount;
      quote.incomeUSDT ??= 0;
      quote.inputMode ??= 'amount';
      quote.rate ??= quote.amount / quote.giveAmount;
      quote.effectiveRate ??= quote.amount / quote.giveAmount;
    }
    const quote = acceptedProviderQuote(order);
    if (quote && order.status === 'agreed') {
      order.settlement ??= { providerSentAt: null, clientReceivedAt: null };
      order.collateralReservedUSDT ??= amountFor(quote.amount, order.receive.currency, 'USDT');
    }
  }
  const cancelledIds = new Set();
  for (const order of state.orders) {
    if ((!sameCurrency(order) && !invalidBankCurrency(order)) || !['searching', 'matched'].includes(order.status)) continue;
    order.status = 'cancelled';
    order.invalidReason = sameCurrency(order) ? 'same-currency' : 'unsupported-bank-currency';
    for (const quote of order.quotes) if (quote.status === 'pending') quote.status = 'declined';
    cancelledIds.add(order.id);
    delete order.matchedOrderId;
    delete order.matchedGive;
    delete order.matchedReceive;
  }
  for (const order of state.orders) {
    if (order.status !== 'matched' || !cancelledIds.has(order.matchedOrderId)) continue;
    order.status = 'searching';
    delete order.matchedOrderId;
    delete order.matchedGive;
    delete order.matchedReceive;
  }
  for (const direction of state.directions) {
    if (!sameCurrency(direction) && !invalidBankCurrency(direction)) continue;
    direction.active = false;
    direction.invalidReason = sameCurrency(direction) ? 'same-currency' : 'unsupported-bank-currency';
  }
  const reservedUSDT = roundCurrency(state.orders.reduce((sum, order) => sum + (order.status === 'agreed' && acceptedProviderQuote(order) ? order.collateralReservedUSDT ?? 0 : 0), 0), 'USDT');
  state.collateral = { totalUSDT: state.collateral?.totalUSDT ?? 10000, reservedUSDT };
  migrateVault(state);
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
      delete match.matchedGive;
      delete match.matchedReceive;
    }
  }
  order.status = 'cancelled';
  delete order.matchedOrderId;
  delete order.matchedGive;
  delete order.matchedReceive;
  for (const quote of order.quotes) if (quote.status === 'pending') quote.status = 'declined';
  notify(state, 'cancel', 'Заявка отменена', 'Поиск остановлен, зарезервированная встречная заявка освобождена.', order.id);
  rematchSearching(state);
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
  if (!direction.active) {
    requireDifferentCurrencies(direction);
    requireSupportedBanks(direction);
  }
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
    const quote = { id: `quote-${id}`, directionId, amount: result.minReceive, giveAmount: amount, rate: result.minReceive / amount, effectiveRate: result.minReceive / amount, inputMode: 'amount', incomeUSDT, expiresAt: completedAt, status: 'accepted' };
    return { ...result, status: 'completed', acceptedQuoteId: quote.id, quotes: [quote], agreedAt: now - (minutes - 2) * 60000, completedAt, settlement: { providerSentAt: completedAt - 60000, clientReceivedAt: completedAt }, collateralReservedUSDT: amountFor(quote.amount, receive.currency, 'USDT'), collateralReleasedAt: completedAt };
  };
  return {
    version: 2,
    collateral: { totalUSDT: 10000, reservedUSDT: 0 },
    vault: { version: 1, enabled: false, deposits: [] },
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
