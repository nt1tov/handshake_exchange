import test from 'node:test';
import assert from 'node:assert/strict';
import { CURRENCIES } from '../dist/domain.js';
import { startCurrencyOrbits } from '../dist/currency-orbits.js';

function environment(t) {
  let now = 0, nextId = 0, onResize, onIntersection, animationStarts = 0;
  const timers = new Map(), originals = new Map(), listeners = new Map();
  const replace = (key, value) => {
    originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  };
  const schedule = (callback, delay) => {
    const id = ++nextId;
    timers.set(id, { at: now + delay, callback });
    return id;
  };
  const flush = async () => { for (let index = 0; index < 12; index++) await Promise.resolve(); };
  replace('setTimeout', schedule);
  replace('clearTimeout', id => timers.delete(id));
  replace('requestAnimationFrame', callback => schedule(() => callback(now), 16));
  replace('cancelAnimationFrame', id => timers.delete(id));
  replace('window', { matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }) });
  replace('document', {
    hidden: false,
    addEventListener(type, listener) { listeners.set(type, listener); },
    removeEventListener(type) { listeners.delete(type); },
  });
  replace('IntersectionObserver', class {
    constructor(callback) { onIntersection = callback; }
    observe() { onIntersection([{ isIntersecting: true }]); }
    disconnect() {}
  });
  replace('ResizeObserver', class {
    constructor(callback) { onResize = callback; }
    observe() { onResize(); }
    disconnect() {}
  });
  // This shuffle order made find(item => item.code === queue.shift())
  // exhaust the queue without finding a currency on its very first run.
  const originalRandom = Math.random;
  Math.random = () => 0;
  const cards = ['RUB', 'USD', 'EUR', 'USDT'].map(currency => {
    const glyph = { textContent: '' }, code = { textContent: currency };
    return {
      dataset: { currency },
      querySelector(selector) { return selector === '.currency-orbits__glyph' ? glyph : code; },
      animate(_frames, options) {
        animationStarts++;
        let settled = false, rejectFinished, timer;
        const finished = new Promise((resolve, reject) => {
          rejectFinished = reject;
          timer = schedule(() => { settled = true; resolve(); }, options.duration);
        });
        return {
          finished,
          cancel() {
            timers.delete(timer);
            if (!settled) { settled = true; rejectFinished(new DOMException('Cancelled', 'AbortError')); }
          },
        };
      },
    };
  });
  const satellites = cards.map(card => ({ style: {}, querySelector: () => card }));
  const art = { clientWidth: 300, clientHeight: 273, querySelectorAll: () => satellites };
  let cleanup = startCurrencyOrbits({ querySelector: () => art });
  async function advance(milliseconds) {
    const end = now + milliseconds;
    while (true) {
      let selected;
      for (const entry of timers) {
        if (entry[1].at <= end && (!selected || entry[1].at < selected[1].at)) selected = entry;
      }
      if (!selected) break;
      now = selected[1].at;
      timers.delete(selected[0]);
      selected[1].callback();
      await flush();
    }
    now = end;
    await flush();
  }
  const stop = async () => { cleanup(); cleanup = () => {}; await flush(); };
  t.after(async () => {
    await stop();
    Math.random = originalRandom;
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  });
  return {
    advance, stop, cards, satellites, timers,
    codes: () => cards.map(card => card.dataset.currency),
    animationStarts: () => animationStarts,
    resize(width = art.clientWidth, height = art.clientHeight) {
      art.clientWidth = width;
      art.clientHeight = height;
      onResize();
    },
    setHidden(hidden) { document.hidden = hidden; listeners.get('visibilitychange')?.(); },
  };
}

test('currency rotation consumes one queued code and reaches every supported currency', async t => {
  const env = environment(t);
  const seen = new Set(env.codes());
  const originalPosition = env.satellites[0].style.left;
  for (let elapsed = 0; elapsed < 20000; elapsed += 100) {
    await env.advance(100);
    for (const code of env.codes()) seen.add(code);
    assert.equal(new Set(env.codes()).size, 4, 'visible cards keep distinct currencies');
  }
  assert.deepEqual([...seen].sort(), CURRENCIES.map(currency => currency.code).sort());
  assert.ok(env.animationStarts() >= 10, 'currency transitions continue after the first queue');
  assert.notEqual(env.satellites[0].style.left, originalPosition, 'orbital movement also continues');
});

for (const changeDimensions of [false, true]) {
  test(`resize callbacks do not postpone or cancel currency changes (${changeDimensions ? 'changing' : 'unchanged'} dimensions)`, async t => {
    const env = environment(t);
    for (let elapsed = 0; elapsed < 10000; elapsed += 100) {
      await env.advance(100);
      env.resize(changeDimensions && elapsed % 200 === 0 ? 301 : 300);
    }
    assert.equal(env.animationStarts(), 6, 'three complete transitions survive callbacks every 100 ms');
    assert.deepEqual(env.codes(), ['GEL', 'USDC', 'AED', 'USDT']);
  });
}

test('hidden pages pause, then resume, and cleanup leaves no animation work scheduled', async t => {
  const env = environment(t);
  await env.advance(2700);
  env.setHidden(true);
  await env.advance(5000);
  assert.deepEqual(env.codes(), ['RUB', 'USD', 'EUR', 'USDT']);
  assert.equal(env.timers.size, 0);
  env.setHidden(false);
  await env.advance(3200);
  assert.notDeepEqual(env.codes(), ['RUB', 'USD', 'EUR', 'USDT']);
  await env.stop();
  assert.equal(env.timers.size, 0);
});
