import test from 'node:test';
import assert from 'node:assert/strict';
import { BANKS, COUNTRIES, banksFor, bankCountry, availableBankCountries } from '../dist/bank-catalog.js';

test('catalog retains saved bank IDs while offering only the selected services', () => {
  for (const id of ['tbank', 'sber', 'alfa', 'raiffeisen', 'ameria', 'acba', 'idbank', 'revolut', 'wise', 'bog', 'tbc']) assert.ok(BANKS.some(bank => bank.id === id));
  assert.deepEqual(banksFor('RUB', 'RU').map(bank => bank.id), ['tbank', 'alfa', 'sber', 'yandexpay', 'raiffeisen']);
  assert.deepEqual(banksFor('EUR', 'EU').map(bank => bank.id), ['revolut']);
  assert.ok(BANKS.find(bank => bank.id === 'wise').legacy);
  assert.ok(!banksFor('GEL').some(bank => bank.id === 'wise'));
});

test('each country has five local-currency choices except the Europe MVP', () => {
  for (const country of COUNTRIES) {
    const banks = banksFor(country.primaryCurrency, country.code);
    assert.equal(banks.length, country.code === 'EU' ? 1 : 5, country.code);
    assert.ok(banks.every(bank => bank.country === country.code && !bank.legacy));
  }
  assert.equal(new Set(BANKS.map(bank => bank.id)).size, BANKS.length);
  assert.ok(BANKS.every(bank => COUNTRIES.some(country => country.code === bank.country)));
});

test('currency-specific country lists never offer empty groups or crypto banks', () => {
  assert.deepEqual(availableBankCountries('AED').map(country => country.code), ['AE']);
  assert.deepEqual(availableBankCountries('GEL').map(country => country.code), ['GE']);
  assert.deepEqual(availableBankCountries('EUR').map(country => country.code), ['EU', 'GE']);
  assert.deepEqual(availableBankCountries('KZT').map(country => country.code), ['KZ']);
  assert.deepEqual(availableBankCountries('USDT'), []);
  assert.deepEqual(banksFor('USD', 'RU'), []);
  assert.deepEqual(banksFor('RUB', 'UNKNOWN'), []);
});

test('bank currency sets match the product constraints and Kaspi Gold stays tenge-only', () => {
  const sets = { RU: ['RUB'], AM: ['AMD', 'USD'], EU: ['EUR', 'USD'], GE: ['GEL', 'USD', 'EUR'], AE: ['AED', 'USD'], KZ: ['KZT', 'USD'] };
  for (const bank of BANKS.filter(bank => !bank.legacy)) {
    assert.deepEqual(bank.currencies, bank.id === 'kaspi' ? ['KZT'] : sets[bank.country], bank.id);
  }
  assert.deepEqual(banksFor('KZT', 'KZ').map(bank => bank.id), ['halyk', 'kaspi', 'bcc', 'forte', 'alatau']);
  assert.deepEqual(banksFor('USD', 'KZ').map(bank => bank.id), ['halyk', 'bcc', 'forte', 'alatau']);
  assert.equal(BANKS.find(bank => bank.id === 'alatau').name, 'Alatau City Bank');
});

test('bank identity wins over stale country fields, including legacy records', () => {
  assert.equal(bankCountry({ method: 'bank', bank: 'tbc', currency: 'USD', country: 'RU' }), 'GE');
  assert.equal(bankCountry({ method: 'bank', bank: 'wise', currency: 'GEL' }), 'EU');
  assert.equal(bankCountry({ method: 'bank', currency: 'EUR', country: 'EU' }), 'EU');
  assert.equal(bankCountry({ method: 'bank', currency: 'AED', country: 'RU' }), 'AE');
  assert.equal(bankCountry({ method: 'crypto', bank: 'tbc', currency: 'USDT' }), '');
  assert.equal(bankCountry(null), '');
});
