export const COUNTRIES = [
  { code: 'RU', name: 'Россия', nameEn: 'Russia', primaryCurrency: 'RUB' },
  { code: 'AM', name: 'Армения', nameEn: 'Armenia', primaryCurrency: 'AMD' },
  { code: 'EU', name: 'Европа', nameEn: 'Europe', primaryCurrency: 'EUR' },
  { code: 'GE', name: 'Грузия', nameEn: 'Georgia', primaryCurrency: 'GEL' },
  { code: 'AE', name: 'ОАЭ', nameEn: 'UAE', primaryCurrency: 'AED' },
];

// A curated payment-method catalog, not an asset ranking or a bank integration.
export const BANKS = [
  { id: 'tbank', name: 'Т-Банк', currencies: ['RUB'], country: 'RU', kind: 'bank', color: '#f5cf35' },
  { id: 'alfa', name: 'Альфа-Банк', currencies: ['RUB'], country: 'RU', kind: 'bank', color: '#e95252' },
  { id: 'sber', name: 'Сбер', currencies: ['RUB'], country: 'RU', kind: 'bank', color: '#2aaa4e' },
  { id: 'yandexpay', name: 'Яндекс Пэй', currencies: ['RUB'], country: 'RU', kind: 'fintech', color: '#ef4337' },
  { id: 'raiffeisen', name: 'Райффайзен', currencies: ['RUB'], country: 'RU', kind: 'bank', color: '#e4cc34' },
  { id: 'ameria', name: 'Ameriabank', currencies: ['AMD', 'USD', 'EUR'], country: 'AM', kind: 'bank', color: '#5f9d3c' },
  { id: 'ardshin', name: 'Ardshinbank', currencies: ['AMD', 'USD', 'EUR'], country: 'AM', kind: 'bank', color: '#25497e' },
  { id: 'evoca', name: 'Evocabank', currencies: ['AMD', 'USD', 'EUR'], country: 'AM', kind: 'bank', color: '#6948b2' },
  { id: 'acba', name: 'ACBA', currencies: ['AMD', 'USD', 'EUR'], country: 'AM', kind: 'bank', color: '#267b5e' },
  { id: 'idbank', name: 'IDBank', currencies: ['AMD', 'USD', 'EUR'], country: 'AM', kind: 'bank', color: '#eb764b' },
  { id: 'revolut', name: 'Revolut', currencies: ['EUR', 'USD'], country: 'EU', kind: 'fintech', color: '#292d39' },
  { id: 'tbc', name: 'TBC Bank', currencies: ['GEL', 'USD', 'EUR'], country: 'GE', kind: 'bank', color: '#48a6da' },
  { id: 'bog', name: 'Bank of Georgia', currencies: ['GEL', 'USD', 'EUR'], country: 'GE', kind: 'bank', color: '#f18a41' },
  { id: 'liberty', name: 'Liberty Bank', currencies: ['GEL', 'USD', 'EUR'], country: 'GE', kind: 'bank', color: '#d82c49' },
  { id: 'basis', name: 'Basisbank', currencies: ['GEL', 'USD', 'EUR'], country: 'GE', kind: 'bank', color: '#236cbd' },
  { id: 'credo', name: 'Credo Bank', currencies: ['GEL', 'USD', 'EUR'], country: 'GE', kind: 'bank', color: '#d62335' },
  { id: 'enbd', name: 'Emirates NBD', currencies: ['AED', 'USD'], country: 'AE', kind: 'bank', color: '#1b4480' },
  { id: 'fab', name: 'First Abu Dhabi Bank', currencies: ['AED'], country: 'AE', kind: 'bank', color: '#16569b' },
  { id: 'adcb', name: 'ADCB', currencies: ['AED'], country: 'AE', kind: 'bank', color: '#b92830' },
  { id: 'dib', name: 'Dubai Islamic Bank', currencies: ['AED'], country: 'AE', kind: 'bank', color: '#26704b' },
  { id: 'mashreq', name: 'Mashreq', currencies: ['AED'], country: 'AE', kind: 'bank', color: '#ee742b' },
  { id: 'wise', name: 'Wise', currencies: ['EUR', 'USD', 'GEL'], country: 'EU', kind: 'fintech', color: '#9acd66', legacy: true },
];

export function banksFor(currency, country) {
  return BANKS.filter(bank => !bank.legacy && bank.currencies.includes(currency) && (country === undefined || bank.country === country));
}

export function availableBankCountries(currency) {
  return COUNTRIES.filter(country => banksFor(currency, country.code).length > 0);
}

export function bankCountry(endpoint) {
  if (endpoint?.method !== 'bank') return '';
  const known = BANKS.find(bank => bank.id === endpoint.bank);
  if (known) return known.country;
  if (banksFor(endpoint.currency, endpoint.country).length && COUNTRIES.some(country => country.code === endpoint.country)) return endpoint.country;
  return availableBankCountries(endpoint.currency)[0]?.code || '';
}
