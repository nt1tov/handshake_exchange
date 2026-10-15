import { CURRENCIES } from './domain.js';

const escape = value => String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
const safeCurrency = value => CURRENCIES.find(item => typeof value === 'string' && item.code === value.trim().toUpperCase()) || { code: '—', symbol: '—' };

export function currencyPairArt(giveCode, receiveCode, { compact = false } = {}) {
  const give = safeCurrency(giveCode);
  const receive = safeCurrency(receiveCode);
  return `<div class="currency-art${compact ? ' currency-art--compact' : ''}" role="img" aria-label="Отдаёте ${escape(give.code)}, получаете ${escape(receive.code)}"><div class="currency-art__stage" aria-hidden="true"><span class="currency-art__orbit"></span><span class="currency-art__orbit currency-art__orbit--second"></span><span class="currency-art__spark currency-art__spark--first">✦</span><span class="currency-art__spark currency-art__spark--second">✦</span><div class="currency-art__side currency-art__side--give"><div class="currency-art__coin"><span class="currency-art__symbol" data-no-i18n>${escape(give.symbol)}</span><span class="currency-art__code" data-no-i18n>${escape(give.code)}</span></div><span class="currency-art__label">Отдаёте</span></div><div class="currency-art__arrow"><svg width="30" height="22" viewBox="0 0 30 22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 11h23m-7-7 7 7-7 7"/></svg></div><div class="currency-art__side currency-art__side--receive"><div class="currency-art__coin"><span class="currency-art__symbol" data-no-i18n>${escape(receive.symbol)}</span><span class="currency-art__code" data-no-i18n>${escape(receive.code)}</span></div><span class="currency-art__label">Получаете</span></div></div></div>`;
}
