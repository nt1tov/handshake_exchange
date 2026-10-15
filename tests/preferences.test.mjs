import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { normalizePreferences, resolveTheme } from '../dist/preferences.js';

test('preferences accept supported choices and normalize malformed values', () => {
  for (const value of [undefined, null, false, [], 'dark', 42, { theme: 'sepia', language: 'hy' }]) {
    assert.deepEqual(normalizePreferences(value), { language: 'ru', theme: 'auto' });
  }
  assert.deepEqual(normalizePreferences({ language: 'en', theme: 'dark', unexpected: true }), { language: 'en', theme: 'dark' });
  assert.equal(resolveTheme('light', true), 'light');
  assert.equal(resolveTheme('dark', false), 'dark');
  assert.equal(resolveTheme('auto', true), 'dark');
  assert.equal(resolveTheme('auto', false), 'light');
});

let importNumber = 0;
async function withBrowser(options, run) {
  const saved = new Map();
  const events = [];
  const listeners = new Map();
  const mediaListeners = [];
  let stored = options.stored ?? null;
  const root = { dataset: {}, style: {}, lang: '' };
  const meta = { content: '', setAttribute(name, value) { this[name] = value; } };
  const media = { matches: Boolean(options.dark), addEventListener(type, listener) { if (type === 'change') mediaListeners.push(listener); } };
  const storage = {
    getItem() { if (options.denied) throw new Error('Storage denied'); return stored; },
    setItem(key, value) { if (options.denied) throw new Error('Storage denied'); stored = value; },
  };
  const globals = {
    localStorage: storage,
    document: { documentElement: root, querySelector: () => meta, dispatchEvent: event => events.push(event) },
    CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options.detail; } },
    matchMedia: () => media,
    addEventListener: (type, listener) => listeners.set(type, listener),
  };
  for (const [name, value] of Object.entries(globals)) {
    saved.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
  }
  try {
    const api = await import(`../dist/preferences.js?test=${++importNumber}`);
    await run({
      api, root, meta, events,
      readStorage: () => stored,
      changeSystem: dark => { media.matches = dark; mediaListeners.forEach(listener => listener({ matches: dark })); },
      storageEvent: (newValue, key = api.PREFERENCES_STORAGE_KEY) => listeners.get('storage')?.({ key, newValue, storageArea: storage }),
      mediaListeners,
    });
  } finally {
    for (const [name, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    }
  }
}

test('malformed persisted JSON falls back to Russian and system theme', async () => {
  await withBrowser({ stored: '{broken', dark: true }, ({ api, root, meta }) => {
    assert.deepEqual(api.initializePreferences(), { language: 'ru', theme: 'auto' });
    assert.equal(root.lang, 'ru');
    assert.deepEqual(root.dataset, { theme: 'dark', themePreference: 'auto' });
    assert.equal(root.style.colorScheme, 'dark');
    assert.equal(meta.content, '#17191f');
  });
});

test('auto follows OS changes and explicit choices stay fixed', async () => {
  await withBrowser({ dark: false }, ({ api, root, changeSystem, mediaListeners }) => {
    api.initializePreferences();
    api.initializePreferences();
    assert.equal(mediaListeners.length, 1);
    assert.equal(root.dataset.theme, 'light');
    changeSystem(true);
    assert.equal(root.dataset.theme, 'dark');
    api.setPreferences({ theme: 'light' });
    changeSystem(false);
    changeSystem(true);
    assert.equal(root.dataset.theme, 'light');
    api.setPreferences({ theme: 'dark' });
    changeSystem(false);
    assert.equal(root.dataset.theme, 'dark');
    api.setPreferences({ theme: 'auto' });
    assert.equal(root.dataset.theme, 'light');
  });
});

test('partial updates persist, emit copied values, and update document language', async () => {
  await withBrowser({ stored: '{"language":"en","theme":"dark"}' }, ({ api, root, events, readStorage }) => {
    api.initializePreferences();
    const copy = api.getPreferences();
    copy.language = 'ru';
    assert.equal(api.getPreferences().language, 'en');
    api.setPreferences({ theme: 'light' });
    assert.deepEqual(JSON.parse(readStorage()), { language: 'en', theme: 'light' });
    assert.equal(root.lang, 'en');
    assert.equal(events.length, 1);
    assert.equal(events[0].type, 'preferenceschange');
    assert.deepEqual(events[0].detail, { previous: { language: 'en', theme: 'dark' }, preferences: { language: 'en', theme: 'light' } });
    events[0].detail.preferences.language = 'ru';
    assert.equal(api.getPreferences().language, 'en');
    api.setPreferences({ theme: 'light' });
    assert.equal(events.length, 1);
  });
});

test('denied storage still permits changing language and theme for the session', async () => {
  await withBrowser({ denied: true, dark: false }, ({ api, root }) => {
    api.initializePreferences();
    assert.deepEqual(api.setPreferences({ theme: 'dark', language: 'en' }), { theme: 'dark', language: 'en' });
    assert.equal(root.dataset.theme, 'dark');
    assert.equal(root.lang, 'en');
  });
});

test('other tabs synchronize validated preferences and clearing storage restores defaults', async () => {
  await withBrowser({ dark: true }, ({ api, root, storageEvent }) => {
    api.initializePreferences();
    storageEvent('{"language":"en","theme":"light"}');
    assert.equal(root.lang, 'en');
    assert.equal(root.dataset.theme, 'light');
    storageEvent('{"language":"ru","theme":"dark"}', 'unrelated');
    assert.equal(root.lang, 'en');
    storageEvent('{"language":"hy","theme":"invalid"}');
    assert.deepEqual(api.getPreferences(), { language: 'ru', theme: 'auto' });
    assert.equal(root.dataset.theme, 'dark');
    storageEvent('{broken');
    assert.deepEqual(api.getPreferences(), { language: 'ru', theme: 'auto' });
    api.setPreferences({ language: 'en', theme: 'light' });
    storageEvent(null, null);
    assert.deepEqual(api.getPreferences(), { language: 'ru', theme: 'auto' });
  });
});

test('early theme script uses saved choices and survives restricted browser APIs', async () => {
  const source = await readFile(new URL('../dist/theme-boot.js', import.meta.url), 'utf8');
  for (const scenario of [
    { stored: '{"language":"en","theme":"light"}', dark: true, language: 'en', theme: 'light', preference: 'light' },
    { stored: '{"language":"en","theme":"dark"}', dark: false, language: 'en', theme: 'dark', preference: 'dark' },
    { stored: '{broken', dark: true, language: 'ru', theme: 'dark', preference: 'auto' },
    { denied: true, language: 'ru', theme: 'light', preference: 'auto' },
  ]) {
    const root = { dataset: {}, style: {} };
    vm.runInNewContext(source, {
      localStorage: { getItem: () => { if (scenario.denied) throw new Error('Denied'); return scenario.stored; } },
      window: { matchMedia: () => { if (scenario.denied) throw new Error('Denied'); return { matches: scenario.dark }; } },
      document: { documentElement: root, querySelector: () => ({ setAttribute() {} }) },
    });
    assert.equal(root.lang, scenario.language);
    assert.equal(root.dataset.theme, scenario.theme);
    assert.equal(root.dataset.themePreference, scenario.preference);
  }
});
