export const PREFERENCES_STORAGE_KEY = 'handshake-preferences-v1';

const defaults = Object.freeze({ language: 'ru', theme: 'auto' });
const languages = new Set(['ru', 'en']);
const themes = new Set(['light', 'dark', 'auto']);
let preferences;
let mediaQuery;
let initialized = false;

export function normalizePreferences(input) {
  const value = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  return {
    language: languages.has(value.language) ? value.language : defaults.language,
    theme: themes.has(value.theme) ? value.theme : defaults.theme,
  };
}

export function resolveTheme(preference, systemDark = false) {
  return preference === 'dark' || (preference !== 'light' && systemDark) ? 'dark' : 'light';
}

function parsePreferences(value) {
  try { return normalizePreferences(JSON.parse(value)); }
  catch { return normalizePreferences(null); }
}

function readPreferences() {
  try { return parsePreferences(globalThis.localStorage?.getItem(PREFERENCES_STORAGE_KEY)); }
  catch { return normalizePreferences(null); }
}

function getMediaQuery() {
  if (!mediaQuery) {
    try { mediaQuery = globalThis.matchMedia?.('(prefers-color-scheme: dark)'); }
    catch { /* A restricted browser can deny access to environment settings. */ }
  }
  return mediaQuery;
}

export function getPreferences() {
  preferences ??= readPreferences();
  return { ...preferences };
}

function applyPreferences() {
  const document = globalThis.document;
  if (!document?.documentElement) return;
  const selected = getPreferences();
  const theme = resolveTheme(selected.theme, Boolean(getMediaQuery()?.matches));
  document.documentElement.lang = selected.language;
  document.documentElement.dataset.theme = theme;
  document.documentElement.dataset.themePreference = selected.theme;
  document.documentElement.style.colorScheme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#17191f' : '#f7f8fa');
}

function notify(previous) {
  if (previous.language === preferences.language && previous.theme === preferences.theme) return;
  const Event = globalThis.CustomEvent;
  if (globalThis.document?.dispatchEvent && Event) {
    globalThis.document.dispatchEvent(new Event('preferenceschange', {
      detail: { previous: { ...previous }, preferences: getPreferences() },
    }));
  }
}

export function setPreferences(patch) {
  const previous = getPreferences();
  const update = patch && typeof patch === 'object' && !Array.isArray(patch) ? patch : {};
  preferences = normalizePreferences({ ...previous, ...update });
  try { globalThis.localStorage?.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(preferences)); }
  catch { /* Keep the selection for this session when storage is unavailable. */ }
  applyPreferences();
  notify(previous);
  return getPreferences();
}

export function initializePreferences() {
  getPreferences();
  applyPreferences();
  if (initialized || !globalThis.document) return getPreferences();
  initialized = true;
  const media = getMediaQuery();
  const onSystemThemeChange = () => {
    if (getPreferences().theme === 'auto') applyPreferences();
  };
  if (media?.addEventListener) media.addEventListener('change', onSystemThemeChange);
  else media?.addListener?.(onSystemThemeChange);
  globalThis.addEventListener?.('storage', event => {
    if (event.key !== PREFERENCES_STORAGE_KEY && event.key !== null) return;
    try {
      if (event.storageArea && event.storageArea !== globalThis.localStorage) return;
    } catch { return; }
    const previous = getPreferences();
    preferences = event.key === null ? normalizePreferences(null) : parsePreferences(event.newValue);
    applyPreferences();
    notify(previous);
  });
  return getPreferences();
}
