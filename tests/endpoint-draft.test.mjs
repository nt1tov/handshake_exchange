import test from 'node:test';
import assert from 'node:assert/strict';
import { CURRENCIES, CITIES, NETWORKS } from '../dist/domain.js';
import { BANKS, COUNTRIES, banksFor, bankCountry } from '../dist/bank-catalog.js';
import { availableCurrencies, updateEndpoint } from '../dist/endpoint-draft.js';

const fresh = () => ({
  give: { currency: 'RUB', method: 'bank', bank: 'tbank' },
  receive: { currency: 'AMD', method: 'cash', city: 'Ереван', address: 'Демо: площадь Республики' },
});
const endpoint = code => ['USDT', 'USDC'].includes(code)
  ? { currency: code, method: 'crypto', network: code === 'USDT' ? 'TRC20' : 'ERC20' }
  : { currency: code, method: 'bank', bank: BANKS.find(bank => bank.currencies.includes(code)).id };

function assertValid(draft) {
  assert.notEqual(draft.give.currency, draft.receive.currency);
  for (const side of ['give', 'receive']) {
    const end = draft[side];
    if (end.method === 'crypto') {
      assert.ok(['USDT', 'USDC'].includes(end.currency));
      assert.ok((end.currency === 'USDC' ? ['ERC20', 'Solana'] : NETWORKS).includes(end.network));
    } else {
      assert.ok(!['USDT', 'USDC'].includes(end.currency));
      if (end.method === 'bank') {
        assert.ok(BANKS.some(bank => bank.id === end.bank && bank.currencies.includes(end.currency)));
        if (end.country) assert.equal(end.country, bankCountry(end));
      }
      if (end.method === 'cash') assert.ok(CITIES.includes(end.city));
    }
  }
}

test('currency menus follow the explicit method and bank before and after swapping', () => {
  const draft = fresh();
  assert.deepEqual(availableCurrencies(draft, 'give').map(item => item.code), ['RUB']);
  const cashCurrencies = CURRENCIES.filter(item => !['RUB', 'USDT', 'USDC'].includes(item.code)).map(item => item.code);
  assert.deepEqual(availableCurrencies(draft, 'receive').map(item => item.code), cashCurrencies);
  [draft.give, draft.receive] = [draft.receive, draft.give];
  assert.deepEqual(availableCurrencies(draft, 'give').map(item => item.code), cashCurrencies);
  assert.deepEqual(availableCurrencies(draft, 'receive').map(item => item.code), ['RUB']);
  assertValid(draft);
});

test('method auto-selection avoids the counterpart and preserves its entire endpoint', () => {
  const draft = { give: endpoint('USDT'), receive: endpoint('RUB') };
  const opposite = structuredClone(draft.give);
  updateEndpoint(draft, 'receive', 'method', 'crypto');
  assert.equal(draft.receive.currency, 'USDC');
  assert.equal(draft.receive.network, 'ERC20');
  assert.deepEqual(draft.give, opposite);
  updateEndpoint(draft, 'give', 'method', 'cash', 'Дубай');
  assert.equal(draft.give.currency, 'RUB');
  assert.equal(draft.give.city, 'Дубай');
  assertValid(draft);
});

test('unavailable currency rejects atomically instead of replacing the bank or method', () => {
  const draft = fresh();
  const before = structuredClone(draft);
  for (const code of ['AMD', 'USD', 'USDT', 'USDC']) assert.throws(() => updateEndpoint(draft, 'give', 'currency', code), /доступную/);
  assert.throws(() => updateEndpoint(draft, 'receive', 'currency', 'USDT'), /доступную/);
  assert.deepEqual(draft, before);
  updateEndpoint(draft, 'receive', 'method', 'crypto');
  assert.equal(draft.receive.currency, 'USDT');
  assert.deepEqual(availableCurrencies(draft, 'receive').map(item => item.code), ['USDT', 'USDC']);
  assertValid(draft);
});

test('method switches preserve a supported old asset and normalize bank or network only when necessary', () => {
  const draft = fresh();
  updateEndpoint(draft, 'receive', 'method', 'bank');
  assert.equal(draft.receive.currency, 'AMD');
  assert.equal(draft.receive.bank, 'ameria');
  updateEndpoint(draft, 'receive', 'bank', 'acba');
  assert.equal(draft.receive.bank, 'acba');
  updateEndpoint(draft, 'receive', 'method', 'crypto');
  updateEndpoint(draft, 'receive', 'network', 'TRC20');
  updateEndpoint(draft, 'receive', 'currency', 'USDC');
  assert.equal(draft.receive.network, 'ERC20');
  assertValid(draft);
});

test('cash address survives unchanged city and is cleared when the city changes', () => {
  const draft = fresh();
  updateEndpoint(draft, 'receive', 'city', 'Ереван');
  assert.equal(draft.receive.address, 'Демо: площадь Республики');
  updateEndpoint(draft, 'receive', 'method', 'bank');
  updateEndpoint(draft, 'receive', 'method', 'cash');
  assert.equal(draft.receive.address, 'Демо: площадь Республики');
  updateEndpoint(draft, 'receive', 'city', 'Дубай');
  assert.equal(draft.receive.address, '');
  assert.equal(draft.receive.city, 'Дубай');
});

test('all initial currency pairs support explicit methods and only accept listed currencies without changing the bank', () => {
  for (const give of CURRENCIES) for (const receive of CURRENCIES) {
    if (give.code === receive.code) continue;
    for (const side of ['give', 'receive']) {
      const opposite = side === 'give' ? 'receive' : 'give';
      for (const method of ['bank', 'cash', 'crypto']) {
        const draft = { give: endpoint(give.code), receive: endpoint(receive.code) };
        const unchanged = structuredClone(draft[opposite]);
        updateEndpoint(draft, side, 'method', method);
        assert.equal(draft[side].method, method);
        assert.deepEqual(draft[opposite], unchanged);
        assertValid(draft);
      }
      for (const selection of CURRENCIES) {
        const draft = { give: endpoint(give.code), receive: endpoint(receive.code) };
        const before = structuredClone(draft);
        const listed = availableCurrencies(draft, side).some(item => item.code === selection.code);
        if (listed) {
          updateEndpoint(draft, side, 'currency', selection.code);
          assert.equal(draft[side].currency, selection.code);
          assert.equal(draft[side].bank, before[side].bank);
          assert.equal(draft[side].country, before[side].country);
          assert.equal(draft[side].method, before[side].method);
        } else {
          assert.throws(() => updateEndpoint(draft, side, 'currency', selection.code));
          assert.deepEqual(draft, before);
        }
        assert.deepEqual(draft[opposite], before[opposite]);
        assertValid(draft);
      }
    }
  }
});

test('updates are atomic for invalid fields and do not mutate aliased counterpart objects', () => {
  const draft = fresh();
  const before = JSON.stringify(draft);
  assert.throws(() => updateEndpoint(draft, 'give', 'currency', 'BTC'), /валюту/);
  assert.throws(() => updateEndpoint(draft, 'give', 'method', 'unknown'), /способ/);
  assert.equal(JSON.stringify(draft), before);
  const shared = endpoint('RUB');
  const legacy = { give: shared, receive: shared };
  updateEndpoint(legacy, 'give', 'method', 'bank');
  assert.equal(legacy.receive, shared);
  assert.equal(legacy.receive.currency, 'RUB');
  assert.notEqual(legacy.give.currency, 'RUB');
  assertValid(legacy);
});

test('country changes keep compatible currency and select the first bank in the chosen country', () => {
  const draft = { give: { currency: 'USD', method: 'bank', bank: 'acba', country: 'AM' }, receive: endpoint('USDT') };
  const opposite = structuredClone(draft.receive);
  updateEndpoint(draft, 'give', 'country', 'GE');
  assert.equal(draft.give.currency, 'USD');
  assert.equal(draft.give.country, 'GE');
  assert.equal(draft.give.bank, banksFor('USD', 'GE')[0].id);
  updateEndpoint(draft, 'give', 'bank', 'credo');
  assert.equal(draft.give.country, 'GE');
  assert.equal(draft.give.bank, 'credo');
  updateEndpoint(draft, 'give', 'country', 'EU');
  assert.equal(draft.give.bank, 'revolut');
  assert.deepEqual(draft.receive, opposite);
  assertValid(draft);
});

test('country changes can select their local asset without duplicating the counterpart currency', () => {
  const draft = fresh();
  updateEndpoint(draft, 'give', 'country', 'GE');
  assert.equal(draft.give.currency, 'GEL');
  assert.equal(draft.give.country, 'GE');
  updateEndpoint(draft, 'give', 'country', 'AM');
  assert.notEqual(draft.give.currency, 'AMD');
  assert.equal(draft.give.country, 'AM');
  assert.ok(banksFor(draft.give.currency, 'AM').some(bank => bank.id === draft.give.bank));
  assertValid(draft);
});

test('currency changes keep exactly the selected bank and country', () => {
  const draft = { give: { currency: 'USD', method: 'bank', bank: 'credo', country: 'GE' }, receive: endpoint('USDT') };
  updateEndpoint(draft, 'give', 'currency', 'EUR');
  assert.equal(draft.give.country, 'GE');
  assert.equal(draft.give.bank, 'credo');
  const before = structuredClone(draft);
  assert.throws(() => updateEndpoint(draft, 'give', 'currency', 'RUB'));
  assert.throws(() => updateEndpoint(draft, 'give', 'currency', 'AED'));
  assert.deepEqual(draft, before);
  assertValid(draft);
});

test('every bank offers only its explicit currencies minus the counterpart asset', () => {
  for (const bank of BANKS) for (const opposite of CURRENCIES) {
    const draft = { give: { method: 'bank', bank: bank.id, country: bank.country, currency: bank.currencies[0] }, receive: endpoint(opposite.code) };
    assert.deepEqual(availableCurrencies(draft, 'give').map(item => item.code), CURRENCIES.filter(item => item.code !== opposite.code && bank.currencies.includes(item.code)).map(item => item.code), `${bank.id}/${opposite.code}`);
  }
  const unknown = { give: { method: 'bank', currency: 'USD', bank: 'unknown' }, receive: endpoint('RUB') };
  assert.deepEqual(availableCurrencies(unknown, 'give'), []);
});

test('bank selection may change currency but cannot consume the opposite asset', () => {
  const draft = { give: { currency: 'USD', method: 'bank', bank: 'halyk', country: 'KZ' }, receive: endpoint('USDT') };
  updateEndpoint(draft, 'give', 'bank', 'kaspi');
  assert.deepEqual(draft.give, { currency: 'KZT', method: 'bank', bank: 'kaspi', country: 'KZ' });
  assert.deepEqual(availableCurrencies(draft, 'give').map(item => item.code), ['KZT']);
  updateEndpoint(draft, 'give', 'bank', 'bcc');
  updateEndpoint(draft, 'give', 'currency', 'USD');
  assert.equal(draft.give.bank, 'bcc');
  draft.receive = { currency: 'KZT', method: 'cash', city: 'Алматы', address: 'Демо: центр' };
  const before = structuredClone(draft);
  assert.throws(() => updateEndpoint(draft, 'give', 'bank', 'kaspi'), /Нет доступной валюты/);
  assert.deepEqual(draft, before);
});

test('country and method transitions use the full catalog rather than the old bank menu', () => {
  const draft = fresh();
  assert.deepEqual(availableCurrencies(draft, 'give').map(item => item.code), ['RUB']);
  updateEndpoint(draft, 'give', 'country', 'KZ');
  assert.equal(draft.give.currency, 'KZT');
  assert.equal(draft.give.bank, 'halyk');
  updateEndpoint(draft, 'give', 'method', 'crypto');
  assert.equal(draft.give.currency, 'USDT');
  updateEndpoint(draft, 'give', 'method', 'cash', 'Астана');
  assert.equal(draft.give.method, 'cash');
  assert.equal(draft.give.city, 'Астана');
  assert.ok(!['USDT', 'USDC', 'AMD'].includes(draft.give.currency));
  assertValid(draft);
});

test('country metadata exists only on bank drafts and legacy bank IDs leave new selections', () => {
  const draft = { give: { currency: 'EUR', method: 'bank', bank: 'wise', country: 'EU' }, receive: endpoint('USDT') };
  updateEndpoint(draft, 'give', 'method', 'bank');
  assert.equal(draft.give.bank, 'revolut');
  updateEndpoint(draft, 'give', 'method', 'cash');
  assert.ok(!Object.hasOwn(draft.give, 'country'));
  updateEndpoint(draft, 'give', 'method', 'crypto');
  assert.ok(!Object.hasOwn(draft.give, 'country'));
  updateEndpoint(draft, 'give', 'method', 'bank');
  assert.equal(draft.give.country, bankCountry(draft.give));
  assertValid(draft);
});

test('impossible and invalid country selections fail atomically', () => {
  const draft = { give: endpoint('USD'), receive: endpoint('RUB') };
  const before = structuredClone(draft);
  assert.throws(() => updateEndpoint(draft, 'give', 'country', 'RU'), /Нет доступной валюты/);
  assert.throws(() => updateEndpoint(draft, 'give', 'country', 'XX'), /страну/);
  assert.throws(() => updateEndpoint(draft, 'give', 'bank', 'wise'), /доступный банк/);
  assert.deepEqual(draft, before);
});

test('all country transitions preserve valid bank-country pairs and protect the other side', () => {
  for (const give of CURRENCIES.filter(currency => banksFor(currency.code).length)) {
    for (const receive of CURRENCIES) {
      if (give.code === receive.code) continue;
      for (const country of COUNTRIES) {
        const draft = { give: endpoint(give.code), receive: endpoint(receive.code) };
        const before = structuredClone(draft);
        const possible = CURRENCIES.some(currency => currency.code !== receive.code && banksFor(currency.code, country.code).length);
        if (!possible) {
          assert.throws(() => updateEndpoint(draft, 'give', 'country', country.code));
          assert.deepEqual(draft, before);
        } else {
          updateEndpoint(draft, 'give', 'country', country.code);
          assert.equal(draft.give.country, country.code);
          assert.deepEqual(draft.receive, before.receive);
          assertValid(draft);
        }
      }
    }
  }
});
