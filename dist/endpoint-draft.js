import { BANKS, CITIES, CURRENCIES, NETWORKS } from './domain.js';

const cryptoCurrencies = new Set(['USDT', 'USDC']);
const methods = ['bank', 'cash', 'crypto'];
const networksFor = code => code === 'USDC' ? ['ERC20', 'Solana'] : NETWORKS;
const isSupported = (code, method) => method === 'crypto'
  ? cryptoCurrencies.has(code)
  : CURRENCIES.some(currency => currency.code === code) && !cryptoCurrencies.has(code)
    && (method === 'cash' || BANKS.some(bank => bank.currencies.includes(code)));

function oppositeSide(side) {
  if (!['give', 'receive'].includes(side)) throw new Error('Неизвестная сторона обмена.');
  return side === 'give' ? 'receive' : 'give';
}

export function availableCurrencies(draft, side) {
  const opposite = oppositeSide(side);
  return CURRENCIES.filter(currency => currency.code !== draft[opposite]?.currency);
}

export function updateEndpoint(draft, side, field, value, city = 'Ереван') {
  const opposite = oppositeSide(side);
  if (!draft[side] || !draft[opposite]) throw new Error('Заполните обе стороны обмена.');
  if (!['currency', 'method', 'bank', 'city', 'network', 'address'].includes(field)) throw new Error('Неизвестное поле направления обмена.');
  if (field === 'currency' && !CURRENCIES.some(currency => currency.code === value)) throw new Error('Выберите поддерживаемую валюту.');
  if (field === 'method' && !methods.includes(value)) throw new Error('Выберите способ передачи денег.');
  const previous = draft[side];
  const next = { ...previous, [field]: value };
  if (!methods.includes(next.method)) next.method = cryptoCurrencies.has(next.currency) ? 'crypto' : 'bank';
  if (field === 'currency') {
    if (cryptoCurrencies.has(value)) next.method = 'crypto';
    else if (next.method === 'crypto') next.method = 'bank';
  }
  const choices = availableCurrencies(draft, side).filter(currency => isSupported(currency.code, next.method));
  if (!choices.some(currency => currency.code === next.currency)) {
    next.currency = choices.some(currency => currency.code === previous.currency) ? previous.currency : choices[0]?.code;
  }
  if (!next.currency) throw new Error('Нет доступной валюты для этого способа расчёта.');
  if (next.method === 'bank' && !BANKS.some(bank => bank.id === next.bank && bank.currencies.includes(next.currency))) {
    next.bank = BANKS.find(bank => bank.currencies.includes(next.currency)).id;
  }
  if (next.method === 'crypto' && !networksFor(next.currency).includes(next.network)) next.network = networksFor(next.currency)[0];
  if (next.method === 'cash' && !CITIES.includes(next.city)) next.city = CITIES.includes(city) ? city : CITIES[0];
  if (previous.city !== next.city) next.address = '';
  draft[side] = next;
  return next;
}
