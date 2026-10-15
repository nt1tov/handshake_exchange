import { translations } from './translations.js?v=20261015-vault';

export const LANGUAGES = [
  { code: 'ru', label: 'Русский', locale: 'ru-RU' },
  { code: 'en', label: 'English', locale: 'en-US' },
];
export const localeFor = language => LANGUAGES.find(item => item.code === language)?.locale || 'ru-RU';
const normalize = value => value.replace(/\s+/g, ' ').trim();
const escapeRegex = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const dictionaries = new Map();
function dictionary(language) {
  if (!dictionaries.has(language)) {
    const entries = Object.entries(translations[language] || {}).map(([key, value]) => [normalize(key), value]);
    const map = new Map(entries);
    const keys = [...map.keys()].filter(Boolean).sort((a, b) => b.length - a.length);
    dictionaries.set(language, { map, pattern: keys.length ? new RegExp(`(?<![\\p{L}\\p{N}])(?:${keys.map(escapeRegex).join('|')})(?![\\p{L}\\p{N}])`, 'gu') : null });
  }
  return dictionaries.get(language);
}

// Source-language phrases are message keys. Only presentation text is translated;
// endpoint IDs, bank IDs, city values and saved orders remain language independent.
export function translate(value, language = 'ru') {
  const source = String(value ?? '');
  if (language === 'ru' || !translations[language]) return source;
  const { map, pattern } = dictionary(language);
  const text = normalize(source);
  const translated = map.get(text) ?? (pattern ? text.replace(pattern, match => map.get(match)) : text);
  return source.replace(source.trim(), translated);
}

export function localize(root, language = 'ru') {
  if (!root) return;
  const document = root.ownerDocument;
  const walker = document.createTreeWalker(root, 4);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  for (const node of nodes) {
    if (node.parentElement?.closest('[data-no-i18n],script,style,svg')) continue;
    if (node.textContent.trim()) node.textContent = translate(node.textContent, language);
  }
  for (const element of root.querySelectorAll('[aria-label],[title],[placeholder],optgroup[label]')) {
    if (element.closest('[data-no-i18n]')) continue;
    for (const name of ['aria-label', 'title', 'placeholder', 'label']) {
      if (element.hasAttribute(name)) element.setAttribute(name, translate(element.getAttribute(name), language));
    }
  }
}

export function formatNumber(value, language = 'ru') {
  const number = Number(value);
  return Number.isFinite(number) ? new Intl.NumberFormat(localeFor(language), { maximumFractionDigits: 2 }).format(number) : '—';
}

export function parseNumber(value, language = 'ru') {
  if (typeof value === 'number') return Number.isFinite(value) ? value : NaN;
  const source = String(value ?? '').trim().replace(/[\s\u00a0\u202f]/g, '');
  if (!source) return NaN;
  if (language === 'en') {
    // Reject malformed grouping rather than silently changing an amount.
    if (!/^[+-]?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d*)?$/.test(source)) return NaN;
    const parsed = Number(source.replace(/,/g, ''));
    return Number.isFinite(parsed) ? parsed : NaN;
  }
  if (!/^[+-]?\d+(?:[,.]\d*)?$/.test(source)) return NaN;
  const parsed = Number(source.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : NaN;
}

export function formatTime(timestamp, language = 'ru') {
  return new Intl.DateTimeFormat(localeFor(language), { hour: '2-digit', minute: '2-digit', hour12: false }).format(timestamp);
}
