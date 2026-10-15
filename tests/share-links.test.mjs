import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { buildRequestLink, parseRequestLink, requestFingerprint, PUBLIC_REQUEST_ROOT } from '../dist/share-links.js';
import { createQRCode } from '../dist/qr-code.js';

const now = Date.UTC(2026, 9, 15, 10, 30);
const order = (overrides = {}) => ({
  id: 'HS-Заявка-42', status: 'searching', amount: 12.345678, minReceive: 4800.01,
  give: { currency: 'USDT', method: 'crypto', network: 'TRC20' },
  receive: { currency: 'AMD', method: 'cash', city: 'Ереван', address: 'Северный проспект, у кафе' },
  quotes: [], partial: true, createdAt: now, ...overrides,
});
function rawPayload(link) { return JSON.parse(Buffer.from(link.split('?request=')[1], 'base64url').toString('utf8')); }
function changedLink(link, change, recalculate = false) {
  const raw = rawPayload(link);
  change(raw);
  if (recalculate) {
    const { h, ...unsigned } = raw;
    let sum = 2166136261;
    for (const byte of Buffer.from(JSON.stringify(unsigned))) sum = Math.imul(sum ^ byte, 16777619) >>> 0;
    raw.h = sum.toString(16).padStart(8, '0');
  }
  return `${link.split('?request=')[0]}?request=${Buffer.from(JSON.stringify(raw)).toString('base64url')}`;
}

test('public snapshots round-trip Unicode IDs without creator storage', () => {
  const source = order();
  const before = JSON.stringify(source);
  const link = buildRequestLink(source);
  assert.ok(link.startsWith(`${PUBLIC_REQUEST_ROOT}#/exchange/HS-%D0`));
  assert.ok(link.length < 1000);
  assert.equal(buildRequestLink(source), link);
  const parsed = parseRequestLink(link);
  assert.deepEqual(parsed, { id: source.id, give: source.give,
    receive: { currency: 'AMD', method: 'cash', city: 'Ереван', address: '' },
    amount: source.amount, minReceive: source.minReceive, partial: true, snapshotStatus: 'open', createdAt: now });
  assert.deepEqual(parseRequestLink(new URL(link).hash), parsed);
  assert.equal(JSON.stringify(source), before);
});

test('privacy allowlist excludes identities, documents, settlement and addresses by default', () => {
  const source = order({ owner: 'PRIVATE_OWNER', provider: 'PRIVATE_PROVIDER', kyc: 'PRIVATE_KYC',
    paymentDetails: { give: { values: { wallet: 'PRIVATE_WALLET' } } }, problem: { comment: 'PRIVATE_PROBLEM' },
    settlement: 'PRIVATE_SETTLEMENT', contact: 'PRIVATE_CONTACT',
    receive: { ...order().receive, address: 'PRIVATE_LANDMARK', holder: 'PRIVATE_HOLDER' },
    give: { ...order().give, address: 'PRIVATE_WALLET', memo: 'PRIVATE_MEMO' },
    quotes: [{ id: 'PRIVATE_QUOTE', providerId: 'PRIVATE_ID', amount: 5000, status: 'pending' }],
  });
  for (const includeAddress of [undefined, false, 'true', 1]) {
    const result = JSON.stringify(rawPayload(buildRequestLink(source, { includeAddress })));
    assert.ok(!result.includes('PRIVATE_'));
  }
  const opted = parseRequestLink(buildRequestLink(source, { includeAddress: true }));
  assert.equal(opted.receive.address, 'PRIVATE_LANDMARK');
  assert.ok(!JSON.stringify(opted).includes('PRIVATE_WALLET'));
});

test('snapshot status and executed partial quantities preserve unavailable states', () => {
  for (const [status, snapshotStatus] of [['searching', 'open'], ['matched', 'reserved'], ['agreed', 'in-progress'], ['completed', 'completed'], ['cancelled', 'cancelled']]) {
    assert.equal(parseRequestLink(buildRequestLink(order({ status }))).snapshotStatus, snapshotStatus);
  }
  const matched = parseRequestLink(buildRequestLink(order({ status: 'matched', matchedOrderId: 'peer', matchedGive: 5, matchedReceive: 2000 })));
  assert.equal(matched.amount, 5);
  assert.equal(matched.minReceive, 2000);
  const agreed = parseRequestLink(buildRequestLink(order({ status: 'agreed', acceptedQuoteId: 'q1',
    quotes: [{ id: 'q1', status: 'accepted', giveAmount: 3, amount: 1250, providerName: 'PRIVATE_PROVIDER' }] })));
  assert.equal(agreed.amount, 3);
  assert.equal(agreed.minReceive, 1250);
  assert.ok(!JSON.stringify(agreed).includes('PRIVATE_PROVIDER'));
});

test('base paths remain intact and timestamps do not change implicitly', () => {
  const source = order({ createdAt: undefined });
  const baseUrl = 'https://example.com/nested/app?old=yes#old';
  assert.ok(buildRequestLink(source, { baseUrl }).startsWith('https://example.com/nested/app/#/exchange/'));
  assert.equal(parseRequestLink(buildRequestLink(source)).createdAt, undefined);
  assert.equal(parseRequestLink(buildRequestLink(source, { now })).createdAt, now);
  assert.equal(parseRequestLink(buildRequestLink(order(), { now: now + 1 })).createdAt, now);
  for (const baseUrl of ['javascript:alert(1)', 'https://user:secret@example.com/', 'file:///tmp/']) assert.throws(() => buildRequestLink(source, { baseUrl }));
});

test('fingerprints compare actual terms and ignore timestamps or private extras', () => {
  const record = parseRequestLink(buildRequestLink(order()));
  assert.equal(requestFingerprint(record), requestFingerprint({ ...record, createdAt: now + 1, provider: 'private' }));
  for (const overrides of [{ amount: 10 }, { partial: false }, { snapshotStatus: 'reserved' }, { id: 'other' }]) {
    assert.notEqual(requestFingerprint(record), requestFingerprint({ ...record, ...overrides }));
  }
});

test('corrupted, mismatched, malformed and unsupported schemas fail closed', () => {
  const link = buildRequestLink(order());
  for (const invalid of [null, '', '#/exchange/HS', '#/exchange/HS?request=***', `${link}&x=1`, `${link}&request=bad`, `${link}#extra`,
    link.replace('/HS-', '/other-'), '#/exchange/%ZZ?request=abc', `javascript:${link}`, 'x'.repeat(5000),
    changedLink(link, raw => { raw.a += 1; }),
    changedLink(link, raw => { raw.v = 2; }, true),
    changedLink(link, raw => { raw.owner = 'me'; }, true),
    changedLink(link, raw => { raw.p = '1'; }, true),
    changedLink(link, raw => { raw.s = '__proto__'; }, true),
    changedLink(link, raw => { raw.a = -1; }, true),
    changedLink(link, raw => { raw.a = '100'; }, true),
    changedLink(link, raw => { raw.a = 0.0000001; }, true),
    changedLink(link, raw => { raw.m = 1.001; }, true),
    changedLink(link, raw => { raw.t = -1; }, true),
    changedLink(link, raw => { raw.r = ['AMD', 'c', 'Ереван', '<img src=x onerror=alert(1)>']; }, true),
    changedLink(link, raw => { raw.g = ['USDT', 'x', 'INVALID']; }, true),
    changedLink(link, raw => { raw.g = ['RUB', 'b', 'ameria']; }, true),
    changedLink(link, raw => { raw.r = ['AMD', 'c', 'unknown']; }, true),
    changedLink(link, raw => { raw.g = ['USDC', 'x', 'TRC20']; }, true),
  ]) assert.equal(parseRequestLink(invalid), null, String(invalid).slice(0, 140));
});

test('builders reject unsafe IDs, endpoints and invalid amount precision', () => {
  for (const id of ['', 'a'.repeat(81), 'user@example.com', '<script>', 'has space', 'slash/id', 'e\u0301']) assert.throws(() => buildRequestLink(order({ id })));
  for (const amount of [0, -1, Infinity, NaN, 1_000_000_001, 0.0000001, '100']) assert.throws(() => buildRequestLink(order({ amount })));
  assert.doesNotThrow(() => buildRequestLink(order({ amount: 0.000001 })));
  assert.throws(() => buildRequestLink(order({ give: { currency: 'AMD', method: 'cash', city: 'Ереван' } })));
  assert.throws(() => buildRequestLink(order({ receive: { ...order().receive, address: 'x'.repeat(161) } }), { includeAddress: true }));
});

function rasterizeQR(dataURL) {
  const svg = decodeURIComponent(dataURL.split(',').slice(1).join(','));
  const size = Number(/viewBox="0 0 (\d+) \d+"/.exec(svg)[1]);
  const pixels = new Uint8ClampedArray(size * size * 4).fill(255);
  // Rasterize the vendor's axis-aligned module rectangles, not a QR encoder.
  for (const [, xText, yText, widthText, heightText] of svg.matchAll(/M(\d+),(\d+)l(\d+),0 0,(\d+) -\d+,0 0,-\d+z /g)) {
    const x = Number(xText), y = Number(yText), width = Number(widthText), height = Number(heightText);
    for (let row = y; row < y + height; row++) for (let col = x; col < x + width; col++) {
      const offset = (row * size + col) * 4;
      pixels[offset] = pixels[offset + 1] = pixels[offset + 2] = 0;
    }
  }
  return { svg, size, pixels };
}

test('QR output is a local SVG with a white quiet zone and no embedded URL markup', () => {
  const link = buildRequestLink(order());
  const image = createQRCode(link);
  assert.ok(image.startsWith('data:image/svg+xml;charset=utf-8,'));
  const { svg, size, pixels } = rasterizeQR(image);
  assert.ok(svg.includes('fill="white"'));
  assert.ok(!svg.includes('https://'));
  assert.ok(pixels.some(value => value === 0));
  for (let row = 0; row < 16; row++) assert.ok(pixels.slice(row * size * 4, (row + 1) * size * 4).every(value => value === 255));
  for (const invalid of ['', 'javascript:alert(1)', 'https://x/ пробел', 'https://x/' + 'a'.repeat(2001)]) assert.throws(() => createQRCode(invalid));
});

test('independent jsQR decoder reads the complete shared URL from exported SVG pixels', { skip: !process.env.HANDSHAKE_QR_DECODER }, () => {
  const decoder = createRequire(import.meta.url)(process.env.HANDSHAKE_QR_DECODER);
  for (const source of [order(), order({ id: 'HS-long-QR', receive: { ...order().receive, address: 'Демонстрационный ориентир, рядом с центральным входом и большим фонтаном' } })]) {
    const link = buildRequestLink(source, { includeAddress: true });
    const { size, pixels } = rasterizeQR(createQRCode(link));
    const decoded = decoder(pixels, size, size);
    assert.ok(decoded, 'QR must be independently decodable');
    assert.equal(decoded.data, link);
    assert.deepEqual(parseRequestLink(decoded.data), parseRequestLink(link));
  }
});
