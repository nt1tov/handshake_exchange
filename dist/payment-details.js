import { BANKS, CURRENCIES, CITIES, NETWORKS } from './domain.js';

// This prototype accepts deliberately invalid DEMO payment identifiers only.
// The module neither validates real payment destinations nor performs transfers.
const cryptoCurrencies = new Set(['USDT', 'USDC']);
const demoTextPattern = 'DEMO-.{2,115}';

function snapshotEndpoint(endpoint) {
  if (!endpoint || typeof endpoint !== 'object' || !CURRENCIES.some(item => item.code === endpoint.currency)) {
    throw new Error('Неизвестная валюта реквизитов.');
  }
  const snapshot = { method: endpoint.method, currency: endpoint.currency };
  if (endpoint.method === 'bank') {
    const bank = BANKS.find(item => item.id === endpoint.bank);
    if (!bank || !bank.currencies.includes(endpoint.currency)) throw new Error('Банк не поддерживает валюту реквизитов.');
    return { ...snapshot, bank: bank.id };
  }
  if (endpoint.method === 'crypto') {
    const networks = endpoint.currency === 'USDC' ? ['ERC20', 'Solana'] : NETWORKS;
    if (!cryptoCurrencies.has(endpoint.currency) || !networks.includes(endpoint.network)) {
      throw new Error('Сеть не поддерживает валюту реквизитов.');
    }
    return { ...snapshot, network: endpoint.network };
  }
  if (endpoint.method === 'cash') {
    if (cryptoCurrencies.has(endpoint.currency) || !CITIES.includes(endpoint.city)) {
      throw new Error('Проверьте валюту и город передачи наличных.');
    }
    return { ...snapshot, city: endpoint.city };
  }
  throw new Error('Неизвестный способ расчёта для реквизитов.');
}

function field(key, label, example, options = {}) {
  return {
    key, label, placeholder: example, example, required: true,
    type: 'text', inputMode: 'text', autocomplete: 'off', maxLength: 120,
    pattern: demoTextPattern, ...options,
  };
}

export function paymentFields(endpoint) {
  const end = snapshotEndpoint(endpoint);
  if (end.method === 'bank') {
    const country = BANKS.find(bank => bank.id === end.bank).country;
    const usesIban = ['GE', 'AE'].includes(country);
    const accountPrefix = usesIban ? `DEMO-${country}-IBAN-` : `DEMO-${country || 'BANK'}-ACCOUNT-`;
    const accountLabel = usesIban ? 'IBAN (демо)' : ['RU', 'AM'].includes(country) ? 'Номер счёта (демо)' : 'IBAN / номер счёта (демо)';
    return [
      field('holder', 'Получатель (демо)', 'DEMO-Recipient'),
      field('account', accountLabel, `${accountPrefix}0001`, { maxLength: 70, pattern: `${accountPrefix}[A-Z0-9\\-]{4,40}` }),
    ];
  }
  if (end.method === 'crypto') {
    const walletPrefix = `DEMO-${end.network.toUpperCase()}-WALLET-`;
    return [
      field('wallet', 'Адрес кошелька (демо)', `${walletPrefix}0001`, { maxLength: 80, pattern: `${walletPrefix}[A-Z0-9\\-]{4,40}` }),
      field('memo', 'Memo / комментарий (демо, необязательно)', 'DEMO-MEMO-0001', { required: false, maxLength: 70, pattern: 'DEMO-MEMO-[A-Z0-9\\-]{4,40}' }),
    ];
  }
  return [
    field('meetingPlace', 'Точное место встречи (демо)', 'DEMO-meeting point 1'),
    field('meetingTime', 'Время встречи (демо)', 'DEMO-tomorrow, 14:00'),
  ];
}

export function createDemoPaymentDetails(endpoint) {
  return Object.fromEntries(paymentFields(endpoint).map(item => [item.key, item.example]));
}

export function validatePaymentDetails(endpoint, values) {
  const fields = paymentFields(endpoint);
  if (!values || typeof values !== 'object' || Array.isArray(values)) throw new Error('Заполните демонстрационные реквизиты.');
  const clean = {};
  for (const item of fields) {
    const raw = Object.hasOwn(values, item.key) ? values[item.key] : '';
    if (raw !== undefined && raw !== null && typeof raw !== 'string') throw new Error(`${item.label}: введите текст.`);
    const value = (raw || '').trim();
    if (!value) {
      if (item.required) throw new Error(`${item.label}: заполните поле.`);
      continue;
    }
    if (value.length > item.maxLength) throw new Error(`${item.label}: значение слишком длинное.`);
    if (/[<>\u0000-\u001f\u007f-\u009f]/u.test(value) || !new RegExp(`^(?:${item.pattern})$`, 'u').test(value)) {
      throw new Error(`${item.label}: используйте демо-образец для выбранного способа расчёта.`);
    }
    clean[item.key] = value;
  }
  return clean;
}

export function setPaymentDetails(state, orderId, side, values, now = Date.now()) {
  if (!['give', 'receive'].includes(side)) throw new Error('Выберите сторону реквизитов: отправка или получение.');
  const order = state?.orders?.find(item => item.id === orderId);
  if (!order) throw new Error('Заявка не найдена.');
  if (order.status !== 'agreed') throw new Error('Реквизиты доступны только после согласования условий и до завершения сделки.');
  if (!Number.isFinite(now) || now < 0) throw new Error('Некорректное время сохранения реквизитов.');
  const endpoint = snapshotEndpoint(order[side]);
  const cleanValues = validatePaymentDetails(endpoint, values);
  let peer;
  const opposite = side === 'give' ? 'receive' : 'give';
  if (order.matchedOrderId && !order.acceptedQuoteId) {
    peer = state.orders.find(item => item.id === order.matchedOrderId);
    if (!peer || peer.status !== 'agreed' || peer.matchedOrderId !== order.id || peer.acceptedQuoteId) {
      throw new Error('Встречная сделка недоступна для обмена реквизитами.');
    }
    const peerEndpoint = snapshotEndpoint(peer[opposite]);
    if (JSON.stringify(endpoint) !== JSON.stringify(peerEndpoint)) {
      throw new Error('Способы расчёта встречных заявок не совпадают.');
    }
  }
  const record = { endpoint, values: cleanValues, savedAt: now };
  order.paymentDetails = { ...order.paymentDetails, [side]: record };
  if (peer) {
    peer.paymentDetails = {
      ...peer.paymentDetails,
      [opposite]: { endpoint: { ...endpoint }, values: { ...cleanValues }, savedAt: now },
    };
  }
  return record;
}
