import { CITIES, CURRENCIES, NETWORKS } from './domain.js';
import { BANKS, COUNTRIES, banksFor, bankCountry } from './bank-catalog.js';

const cryptoCurrencies = new Set(['USDT', 'USDC']);
const methods = ['bank', 'cash', 'crypto'];
const networksFor = code => code === 'USDC' ? ['ERC20', 'Solana'] : NETWORKS;
const isSupported = (code, method) => method === 'crypto'
  ? cryptoCurrencies.has(code)
  : CURRENCIES.some(currency => currency.code === code) && !cryptoCurrencies.has(code)
    && (method === 'cash' || banksFor(code).length > 0);

function oppositeSide(side) {
  if (!['give', 'receive'].includes(side)) throw new Error('Неизвестная сторона обмена.');
  return side === 'give' ? 'receive' : 'give';
}

export function availableCurrencies(draft, side) {
  const opposite = oppositeSide(side);
  const end = draft[side];
  const bank = BANKS.find(item => item.id === end?.bank);
  return CURRENCIES.filter(currency => currency.code !== draft[opposite]?.currency
    && (end?.method === 'bank' ? bank?.currencies.includes(currency.code)
      : end?.method === 'crypto' ? cryptoCurrencies.has(currency.code)
        : end?.method === 'cash' && !cryptoCurrencies.has(currency.code)));
}

export function updateEndpoint(draft, side, field, value, city = 'Ереван') {
  const opposite = oppositeSide(side);
  if (!draft[side] || !draft[opposite]) throw new Error('Заполните обе стороны обмена.');
  if (!['currency', 'method', 'bank', 'country', 'city', 'network', 'address'].includes(field)) throw new Error('Неизвестное поле направления обмена.');
  if (field === 'currency' && !CURRENCIES.some(currency => currency.code === value)) throw new Error('Выберите поддерживаемую валюту.');
  if (field === 'method' && !methods.includes(value)) throw new Error('Выберите способ передачи денег.');
  if (field === 'country' && !COUNTRIES.some(country => country.code === value)) throw new Error('Выберите поддерживаемую страну банка.');
  const selectedBank = field === 'bank' ? BANKS.find(bank => bank.id === value && !bank.legacy) : null;
  if (field === 'bank' && !selectedBank) throw new Error('Выберите доступный банк.');
  const previous = draft[side];
  const next = { ...previous, [field]: value };
  if (field === 'currency') {
    if (!availableCurrencies(draft, side).some(currency => currency.code === value)) {
      throw new Error('Выберите валюту, доступную для выбранного способа расчёта.');
    }
    if (next.method === 'crypto' && !networksFor(value).includes(next.network)) next.network = networksFor(value)[0];
    draft[side] = next;
    return next;
  }
  if (!methods.includes(next.method)) throw new Error('Выберите способ передачи денег.');
  if (['country', 'bank'].includes(field) && next.method !== 'bank') throw new Error('Страна и банк доступны только для банковского перевода.');
  const explicitCountry = field === 'country' ? value : selectedBank?.country;
  let choices = CURRENCIES.filter(currency => currency.code !== draft[opposite].currency && isSupported(currency.code, next.method));
  if (explicitCountry) choices = choices.filter(currency => banksFor(currency.code, explicitCountry).length > 0 && (!selectedBank || selectedBank.currencies.includes(currency.code)));
  if (!choices.some(currency => currency.code === next.currency)) {
    const localCurrency = COUNTRIES.find(country => country.code === explicitCountry)?.primaryCurrency;
    next.currency = choices.some(currency => currency.code === localCurrency) ? localCurrency
      : choices.some(currency => currency.code === previous.currency) ? previous.currency : choices[0]?.code;
  }
  if (!next.currency) throw new Error('Нет доступной валюты для этого способа расчёта.');
  if (next.method === 'bank') {
    const currentBank = banksFor(next.currency).find(bank => bank.id === next.bank);
    const preferredCountry = explicitCountry || bankCountry(previous);
    const country = banksFor(next.currency, preferredCountry).length ? preferredCountry : currentBank?.country || banksFor(next.currency)[0]?.country;
    const compatible = banksFor(next.currency, country);
    const keepBank = field !== 'country' && compatible.some(bank => bank.id === next.bank);
    next.bank = keepBank ? next.bank : compatible[0].id;
    next.country = country;
  } else {
    delete next.country;
  }
  if (next.method === 'crypto' && !networksFor(next.currency).includes(next.network)) next.network = networksFor(next.currency)[0];
  if (next.method === 'cash' && !CITIES.includes(next.city)) next.city = CITIES.includes(city) ? city : CITIES[0];
  if (previous.city !== next.city) next.address = '';
  draft[side] = next;
  return next;
}
