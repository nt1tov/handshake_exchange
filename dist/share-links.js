import { BANKS, CITIES, CURRENCIES, NETWORKS, orderExecution } from './domain.js';

export const PUBLIC_REQUEST_ROOT = 'https://nt1tov.github.io/handshake_exchange/';
const MAX_INPUT_LENGTH = 4096;
const MAX_AMOUNT = 1_000_000_000;
const methodCodes = { bank: 'b', cash: 'c', crypto: 'x' };
const methods = { b: 'bank', c: 'cash', x: 'crypto' };
const statusCodes = { open: 'o', reserved: 'r', 'in-progress': 'p', completed: 'd', cancelled: 'c' };
const statuses = Object.fromEntries(Object.entries(statusCodes).map(([name, code]) => [code, name]));
const orderStatuses = { searching: 'open', matched: 'reserved', agreed: 'in-progress', completed: 'completed', cancelled: 'cancelled' };
const isObject = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const utf8 = new TextEncoder();
const invalid = () => new Error('Некорректная ссылка на заявку.');

function requestId(value) {
  if (typeof value !== 'string' || value.length > 80 || !/^[\p{L}\p{N}_-]+$/u.test(value) || value !== value.normalize('NFC')) throw invalid();
  return value;
}

function amount(value, currency) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0 || value > MAX_AMOUNT) throw invalid();
  const [digits, exponent = '0'] = String(value).toLowerCase().split('e');
  const decimals = Math.max(0, (digits.split('.')[1]?.length || 0) - Number(exponent));
  if (decimals > (['USDT', 'USDC'].includes(currency) ? 6 : 2)) throw invalid();
  return value;
}

function address(value) {
  if (typeof value !== 'string' || value.length > 160 || /[<>\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/u.test(value)) throw invalid();
  return value.trim();
}

function endpoint(input, includeAddress = false) {
  if (!isObject(input) || !CURRENCIES.some(item => item.code === input.currency) || !Object.hasOwn(methodCodes, input.method)) throw invalid();
  const result = { currency: input.currency, method: input.method };
  if (input.method === 'bank') {
    if (!BANKS.some(bank => bank.id === input.bank && bank.currencies.includes(input.currency))) throw invalid();
    result.bank = input.bank;
  } else if (input.method === 'crypto') {
    const networks = input.currency === 'USDC' ? ['ERC20', 'Solana'] : NETWORKS;
    if (!['USDT', 'USDC'].includes(input.currency) || !networks.includes(input.network)) throw invalid();
    result.network = input.network;
  } else {
    if (['USDT', 'USDC'].includes(input.currency) || !CITIES.includes(input.city)) throw invalid();
    result.city = input.city;
    result.address = includeAddress && input.address !== undefined ? address(input.address) : '';
  }
  return result;
}

function packEndpoint(end) {
  const packed = [end.currency, methodCodes[end.method], end.bank || end.network || end.city];
  if (end.method === 'cash' && end.address) packed.push(end.address);
  return packed;
}

function unpackEndpoint(packed) {
  if (!Array.isArray(packed) || ![3, 4].includes(packed.length) || !Object.hasOwn(methods, packed[1])) throw invalid();
  const method = methods[packed[1]];
  if (method !== 'cash' && packed.length !== 3) throw invalid();
  const detail = method === 'bank' ? 'bank' : method === 'crypto' ? 'network' : 'city';
  return endpoint({ currency: packed[0], method, [detail]: packed[2], ...(packed.length === 4 ? { address: packed[3] } : {}) }, true);
}

function publicRecord(input) {
  if (!isObject(input) || typeof input.partial !== 'boolean' || !Object.hasOwn(statusCodes, input.snapshotStatus)) throw invalid();
  const give = endpoint(input.give, true);
  const receive = endpoint(input.receive, true);
  if (give.currency === receive.currency) throw invalid();
  const result = {
    id: requestId(input.id), give, receive,
    amount: amount(input.amount, give.currency), minReceive: amount(input.minReceive, receive.currency),
    partial: input.partial, snapshotStatus: input.snapshotStatus,
  };
  if (input.createdAt !== undefined) {
    if (!Number.isSafeInteger(input.createdAt) || input.createdAt < 0 || input.createdAt > 8_640_000_000_000_000) throw invalid();
    result.createdAt = input.createdAt;
  }
  return result;
}

function payload(record) {
  return {
    v: 1, i: record.id, g: packEndpoint(record.give), r: packEndpoint(record.receive),
    a: record.amount, m: record.minReceive, p: record.partial ? 1 : 0, s: statusCodes[record.snapshotStatus],
    ...(record.createdAt !== undefined ? { t: record.createdAt } : {}),
  };
}

function encode(value) {
  const bytes = utf8.encode(value);
  return btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

function decode(value) {
  if (!/^[A-Za-z0-9_-]+$/.test(value) || value.length > 3000 || value.length % 4 === 1) throw invalid();
  const binary = atob(value.replaceAll('-', '+').replaceAll('_', '/') + '='.repeat((4 - value.length % 4) % 4));
  const decoded = new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(binary, char => char.charCodeAt(0)));
  if (encode(decoded) !== value) throw invalid();
  return decoded;
}

// An unkeyed checksum detects damaged snapshots. It is not a signature or proof
// of identity: anyone can construct a new public snapshot with a valid checksum.
function checksum(text) {
  let hash = 2166136261;
  for (const byte of utf8.encode(text)) hash = Math.imul(hash ^ byte, 16777619) >>> 0;
  return hash.toString(16).padStart(8, '0');
}

export function buildRequestLink(order, { baseUrl = PUBLIC_REQUEST_ROOT, includeAddress = false, now } = {}) {
  if (!isObject(order) || !Object.hasOwn(orderStatuses, order.status)) throw invalid();
  const execution = orderExecution(order);
  const record = publicRecord({
    id: order.id, give: endpoint(order.give, includeAddress === true), receive: endpoint(order.receive, includeAddress === true),
    amount: execution.giveAmount, minReceive: execution.receiveAmount, partial: order.partial === true,
    snapshotStatus: orderStatuses[order.status], createdAt: order.createdAt ?? now,
  });
  const base = new URL(baseUrl);
  if (!['https:', 'http:'].includes(base.protocol) || base.username || base.password) throw invalid();
  base.search = '';
  base.hash = '';
  if (!base.pathname.endsWith('/')) base.pathname += '/';
  const terms = payload(record);
  const token = encode(JSON.stringify({ ...terms, h: checksum(JSON.stringify(terms)) }));
  const link = `${base.href}#/exchange/${encodeURIComponent(record.id)}?request=${token}`;
  if (link.length > MAX_INPUT_LENGTH) throw invalid();
  return link;
}

export function parseRequestLink(hashOrURL) {
  try {
    if (typeof hashOrURL !== 'string' || hashOrURL.length > MAX_INPUT_LENGTH) return null;
    let hash = hashOrURL;
    if (!hash.startsWith('#')) {
      const url = new URL(hashOrURL);
      if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null;
      hash = url.hash;
    }
    const match = /^#\/exchange\/([^/?#]+)\?request=([A-Za-z0-9_-]+)$/.exec(hash);
    if (!match) return null;
    const id = requestId(decodeURIComponent(match[1]));
    const raw = JSON.parse(decode(match[2]));
    if (!isObject(raw) || raw.v !== 1 || raw.i !== id || ![0, 1].includes(raw.p) || !Object.hasOwn(statuses, raw.s)) return null;
    const keys = ['v', 'i', 'g', 'r', 'a', 'm', 'p', 's', 'h', ...(Object.hasOwn(raw, 't') ? ['t'] : [])];
    if (Object.keys(raw).length !== keys.length || Object.keys(raw).some(key => !keys.includes(key))) return null;
    const record = publicRecord({
      id, give: unpackEndpoint(raw.g), receive: unpackEndpoint(raw.r),
      amount: raw.a, minReceive: raw.m, partial: raw.p === 1, snapshotStatus: statuses[raw.s],
      ...(Object.hasOwn(raw, 't') ? { createdAt: raw.t } : {}),
    });
    const canonical = payload(record);
    if (raw.h !== checksum(JSON.stringify(canonical))) return null;
    return record;
  } catch {
    return null;
  }
}

// Canonical public terms provide an exact, collision-free comparison key. This
// does not establish ownership or authenticate an order with the same ID.
export function requestFingerprint(record) {
  const terms = payload(publicRecord(record));
  delete terms.t;
  return JSON.stringify(terms);
}
