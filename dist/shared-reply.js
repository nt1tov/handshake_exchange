import { createOrder } from './domain.js';
import { requestFingerprint } from './share-links.js';

function publicEndpoint(endpoint) {
  const result = { currency: endpoint.currency, method: endpoint.method };
  if (endpoint.method === 'bank') result.bank = endpoint.bank;
  else if (endpoint.method === 'crypto') result.network = endpoint.network;
  else {
    result.city = endpoint.city;
    result.address = (endpoint.address || '').trim();
  }
  return result;
}

function publicTerms(snapshot) {
  return {
    id: snapshot.id,
    give: publicEndpoint(snapshot.give), receive: publicEndpoint(snapshot.receive),
    amount: snapshot.amount, minReceive: snapshot.minReceive, partial: snapshot.partial,
    snapshotStatus: 'open',
    ...(snapshot.createdAt !== undefined ? { createdAt: snapshot.createdAt } : {}),
  };
}

export function createSharedReply(state, snapshot, input, now = Date.now()) {
  if (!snapshot || snapshot.snapshotStatus !== 'open') throw new Error('Отклик доступен только на открытую заявку по ссылке.');
  const fingerprint = requestFingerprint(snapshot);
  const terms = publicTerms(snapshot);
  if (!Number.isSafeInteger(now) || now < 0) throw new Error('Некорректное время отклика.');

  const next = structuredClone(state);
  const existing = next.orders.filter(order => order.id === terms.id || order.sourceRequestId === terms.id);
  if (existing.some(order => order.owner === 'me')) throw new Error('Нельзя откликнуться на свою заявку.');
  if (existing.length > 1) throw new Error('В браузере уже есть конфликтующие записи этой заявки.');
  let peer = existing[0];
  if (peer) {
    if (peer.status !== 'searching') throw new Error('Заявка по ссылке уже зарезервирована или закрыта в этом браузере.');
    const currentFingerprint = requestFingerprint({
      id: peer.sourceRequestId || peer.id, give: peer.give, receive: peer.receive,
      amount: peer.amount, minReceive: peer.minReceive, partial: peer.partial === true, snapshotStatus: 'open',
    });
    if (currentFingerprint !== fingerprint || (peer.sourceRequestFingerprint && peer.sourceRequestFingerprint !== fingerprint)) {
      throw new Error('Условия заявки по ссылке отличаются от сохранённых.');
    }
  } else {
    peer = {
      id: terms.id, owner: 'shared', give: terms.give, receive: terms.receive,
      amount: terms.amount, minReceive: terms.minReceive, partial: terms.partial,
      status: 'searching', createdAt: terms.createdAt ?? now, quotes: [],
    };
    next.orders.push(peer);
  }
  peer.sourceRequestId = terms.id;
  peer.sourceRequestFingerprint = fingerprint;
  const reply = createOrder(next, { ...input, matchTargetId: peer.id }, now);
  reply.replyToRequestId = terms.id;
  Object.assign(state, next);
  return reply;
}
