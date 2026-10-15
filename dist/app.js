import { CURRENCIES, BANKS, CITIES, NETWORKS, seedState, migrateState, createOrder, acceptMatch, submitQuote, acceptQuote, cancelOrder, addDirection, toggleDirection, isDirectionCompatible, amountFor, confirmSettlement, providerMetrics } from './domain.js';
import { createOrderCard } from './share-card.js';
import { serviceContent } from './service-content.js';
import { currencyPairArt } from './currency-art.js';
import { homePage } from './home-page.js';
import { availableCurrencies, updateEndpoint } from './endpoint-draft.js';

import { LANGUAGES, translate, localize, formatNumber, parseNumber, formatTime } from './i18n.js';
import { getPreferences, setPreferences, initializePreferences } from './preferences.js';

initializePreferences();
const language = () => getPreferences().language;
const t = value => translate(value, language());

const STORAGE_KEY = 'handshake-demo-v1';
const $ = (selector) => document.querySelector(selector);
const esc = (value = '') => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const paths = {
  home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z"/>',
  exchange: '<path d="M4 7h15m-4-4 4 4-4 4M20 17H5m4 4-4-4 4-4"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>',
  orders: '<rect x="5" y="3" width="14" height="18" rx="3"/><path d="M9 8h6M9 12h6M9 16h3"/>',
  history: '<path d="M3 11a9 9 0 1 1 2.5 7M3 4v7h7M12 7v5l3 2"/>',
  arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
  chevron: '<path d="m9 5 7 7-7 7"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  bank: '<path d="m3 8 9-5 9 5H3m2 12h14M6 9v8m6-8v8m6-8v8"/>',
  cash: '<rect x="3" y="5" width="18" height="14" rx="3"/><circle cx="12" cy="12" r="3"/><path d="M6 8h1M17 16h1"/>',
  crypto: '<path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z"/><path d="m4 7.5 8 5 8-5m-8 5V21"/>',
  pin: '<path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2.5"/>',
  bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
  shield: '<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z"/><path d="m8 12 3 3 5-6"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 4v3"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v.1"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  briefcase: '<rect x="3" y="7" width="18" height="14" rx="3"/><path d="M8 7V4h8v3M3 12a20 20 0 0 0 18 0m-11 2h2"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 1 1 4 3c-1 0-1 1-1 2m0 3v.1"/>',
  globe: '<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/>',
  spark: '<path d="m12 2 2.8 7.2L22 12l-7.2 2.8L12 22l-2.8-7.2L2 12l7.2-2.8L12 2Z"/>',
  filter: '<path d="M4 7h16M7 12h10M10 17h4"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  wallet: '<path d="M20 8V5a2 2 0 0 0-2-2H6a3 3 0 0 0 0 6h15v11H6a3 3 0 0 1-3-3V6"/><path d="M21 12h-5v5h5m-3-2.5h.1"/>'
};
const icon = (name, size = 18) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.exchange}</svg>`;
const currency = code => CURRENCIES.find(c => c.code === code);
const coin = code => `<span class="currency-icon ${esc(code.toLowerCase())}" aria-hidden="true">${esc(currency(code)?.symbol || code)}</span>`;
const fmt = value => formatNumber(value, language());
const symbol = code => currency(code)?.symbol || code;
const fmtAmount = (amount, code) => new Intl.NumberFormat(language(),{maximumFractionDigits:['USDT','USDC'].includes(code)?6:2}).format(amount);
const money = (amount, code) => `${fmtAmount(amount,code)} ${symbol(code)}`;
const parseAmount = value => parseNumber(value, language());
const networkOptions = code => code === 'USDC' ? ['ERC20', 'Solana'] : NETWORKS;
const options = (items, selected, valueFn = v => v, labelFn = v => v) => items.map(item => `<option value="${esc(valueFn(item))}" ${valueFn(item) === selected ? 'selected' : ''}>${esc(labelFn(item))}</option>`).join('');
let storageAvailable = true;
let state;
try { const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)); state = [1,2].includes(saved?.version) && Array.isArray(saved.orders) && Array.isArray(saved.directions) && Array.isArray(saved.notifications) ? migrateState(saved) : seedState(); } catch { state = seedState(); }
const ui = { mode: 'client', page: 'home', history: 'all', mobile: false, modal: null, location: 'Ереван', filterCurrency: 'all', filterCity: 'all', filterMin: '', filterMax: '', onlyCompatible: true };
let composer = { give: {currency:'RUB', method:'bank', bank:'tbank'}, receive: {currency:'AMD', method:'cash',city:'Ереван'}, amount:100000, minReceive:amountFor(100000,'RUB','AMD') };
let directionDraft = {give:{currency:'AMD',method:'cash',city:'Ереван'},receive:{currency:'USDT',method:'crypto',network:'TRC20'},min:100000,max:3000000,available:5000000};
let toastTimer;
let quoteDraft = {inputMode:'amount',amount:0,rate:0,incomeUSDT:0};
let shareDraft = {includeAddress:false,card:null};
let shareGeneration = 0;
let currentToast=null;
let focusReturn = null;
function persist() { try { localStorage.setItem(STORAGE_KEY,JSON.stringify(state)); } catch { if(storageAvailable) toast('Хранилище браузера недоступно. Изменения сохранятся только до перезагрузки.',true); storageAvailable=false; } }
function toast(message, error=false) { currentToast={message,error}; clearTimeout(toastTimer); $('#toast-root').innerHTML=`<div class="toast ${error?'error':''}" role="status">${icon(error?'info':'check',17)}${esc(t(message))}</div>`; toastTimer=setTimeout(()=>{ $('#toast-root').innerHTML=''; currentToast=null; },5000); }
function endpointText(end) { if(end.method==='cash') return `Наличные · ${end.city}`; if(end.method==='crypto') return `${end.currency} · ${end.network}`; return BANKS.find(b=>b.id===end.bank)?.name || 'Банковский перевод'; }
function cashLocations(order) { return [order.give,order.receive].filter(end=>end.method==='cash').map(end=>`<p class="cash-location">${icon('pin',13)}<span>${esc(end.city)} · ${esc(end.address || 'Ориентир нужно уточнить')}</span></p>`).join(''); }
function endpointEditor(end, side, scope='composer') {
  const isComposer=scope==='composer';
  const draft=isComposer?composer:directionDraft;
  const bank = BANKS.find(b=>b.id===end.bank);
  const selector = end.method==='bank'
    ? `<select class="context-select" aria-label="${side==='give'?'Банк отправления':'Банк получения'}" data-endpoint="${side}" data-field="bank" data-scope="${scope}"><optgroup label="Банки">${options(BANKS.filter(b=>b.kind==='bank'&&b.currencies.includes(end.currency)),end.bank,b=>b.id,b=>b.name)}</optgroup><optgroup label="Платёжные сервисы">${options(BANKS.filter(b=>b.kind==='fintech'&&b.currencies.includes(end.currency)),end.bank,b=>b.id,b=>b.name)}</optgroup></select>`
    : `<select class="context-select" aria-label="${end.method==='cash'?'Город':'Сеть'} ${side==='give'?'отправления':'получения'}" data-endpoint="${side}" data-field="${end.method==='cash'?'city':'network'}" data-scope="${scope}">${options(end.method==='cash'?CITIES:networkOptions(end.currency),end.method==='cash'?end.city:end.network)}</select>`;
  return `<div class="endpoint-card"><div class="endpoint-top"><span class="field-label">${side==='give'?'Отдаёте':'Получаете'}</span>${side==='receive'&&isComposer?'<span class="endpoint-help">Не меньше этой суммы</span>':''}</div><div class="amount-line">${isComposer?`<input class="amount-input" type="text" inputmode="decimal" autocomplete="off" aria-label="${side==='give'?'Сумма отправления':'Минимальная сумма получения'}" id="${side==='give'?'give-amount':'receive-amount'}" value="${fmtAmount(side==='give'?composer.amount:composer.minReceive,end.currency)}">`:`<span class="subtle">${side==='give'?'Средства провайдера':'Средства клиента'}</span>`}<div class="currency-wrap">${coin(end.currency)}<select class="currency-select" aria-label="${side==='give'?'Валюта отправления':'Валюта получения'}" data-endpoint="${side}" data-field="currency" data-scope="${scope}">${options(availableCurrencies(draft,side),end.currency,c=>c.code,c=>c.code)}</select></div></div><div class="method-tabs" role="group" aria-label="Способ ${side==='give'?'отправления':'получения'}">${[['bank','Банк'],['cash','Наличные'],['crypto','Крипта']].map(([key,label])=>`<button type="button" class="method-tab ${end.method===key?'active':''}" data-action="method" data-scope="${scope}" data-side="${side}" data-method="${key}" aria-pressed="${end.method===key}">${icon(key,14)}${label}</button>`).join('')}</div><div class="context-row"><span class="context-icon ${end.method}" ${end.method==='bank'?`style="background:${bank?.color||'#eee'}22;color:${bank?.color||'#999'}"`:''}>${end.method==='bank'?esc(t(bank?.name||'Банк')[0]):icon(end.method==='cash'?'pin':'crypto',14)}</span>${selector}${end.method==='cash'?'<span class="endpoint-help">Лично</span>':''}</div>${end.method==='cash'?`<label class="address-field"><span class="field-label">Район или ориентир</span><input class="input-field" aria-label="${side==='give'?'Адрес передачи наличных':'Адрес получения наличных'}" data-cash-address="${side}" data-scope="${scope}" placeholder="Например, Кентрон, площадь Республики" value="${esc(end.address||'')}" minlength="3" maxlength="160" required><span class="endpoint-help">Достаточно примерного адреса. Точку встречи согласуете позже.</span></label>`:''}</div>`;
}
const ownOrders = () => state.orders.filter(o=>o.owner==='me');
const activeOrders = () => ownOrders().filter(o=>['searching','matched'].includes(o.status));
const validQuotes = order => order.quotes.filter(q=>q.status==='pending'&&q.expiresAt>Date.now());
function status(order) { if(order.status==='searching'&&validQuotes(order).length) return ['quoted','Есть предложение','spark']; return {searching:['searching','Ищем совпадение','clock'],matched:['matched','Совпадение найдено','check'],agreed:['agreed','Условия согласованы','check'],completed:['completed','Сделка завершена','check'],cancelled:['cancelled','Отменена','close']}[order.status] || ['searching','В работе','clock']; }
const statusTag = order => {const [key,label,name]=status(order);return `<span class="order-status ${key}">${icon(name,11)}${label}</span>`;};
const shortId = id => id.length>12?`HS-${id.slice(-6).toUpperCase()}`:id;
function orderRow(order) { return `<button class="order-row" data-action="order" data-id="${esc(order.id)}"><span class="order-pair"><span class="paired-icons">${coin(order.give.currency)}${coin(order.receive.currency)}</span><span><span class="order-title">${money(order.amount,order.give.currency)} ${icon('arrow',12)} ${money(order.quotes.find(q=>q.status==='accepted')?.amount||order.matchedReceive||order.minReceive,order.receive.currency)}</span><span class="order-subtitle">${esc(endpointText(order.give))} <span aria-hidden="true">→</span> ${esc(endpointText(order.receive))}</span></span></span><span class="order-right">${statusTag(order)}<span class="order-meta">${esc(shortId(order.id))}</span>${icon('chevron',14)}</span></button>`; }
const empty = (title,text,action='',label='') => `<div class="empty-state">${icon('orders',28)}<h3>${esc(title)}</h3><p>${esc(text)}</p>${action?`<button class="outline-button" data-action="${action}">${esc(label)}</button>`:''}</div>`;
function preferenceSelects() {
  const preferences=getPreferences();
  return `<div class="settings-grid"><label class="preference-select-wrap"><span class="field-label">Язык интерфейса</span><span class="preference-select-line">${icon('globe',14)}<select class="select-field" id="settings-language" aria-label="Язык интерфейса" data-preference="language">${options(LANGUAGES,preferences.language,item=>item.code,item=>item.label)}</select></span></label><label class="preference-select-wrap"><span class="field-label">Оформление</span><span class="preference-select-line">${icon('spark',14)}<select class="select-field" id="settings-theme" aria-label="Оформление" data-preference="theme">${options([{value:'light',label:'Светлая'},{value:'dark',label:'Тёмная'},{value:'auto',label:'Авто'}],preferences.theme,item=>item.value,item=>item.label)}</select></span></label></div>`;
}
function sidebar() {
  const provider=ui.mode==='provider';
  const nav = [['home','home','Главная',''],...(provider ? [['feed','orders','Входящие заявки',state.orders.filter(o=>state.directions.some(d=>isDirectionCompatible(d,o))).length],['directions','wallet','Моя ликвидность',''],['responses','orders','Мои предложения',''],['statistics','grid','Сделки и доход','']] : [['exchange','exchange','Обмен',''],['orders','orders','Мои заявки',activeOrders().length],['history','history','История','']])];
  return `<div class="mobile-scrim ${ui.mobile?'visible':''}" data-action="menu"></div><aside class="sidebar ${ui.mobile?'mobile-open':''}"><a class="brand" href="#" data-action="home" aria-label="Handshake — главная"><img src="./favicon.svg" alt="">handshake<span class="brand-period">.</span></a><div class="sidebar-caption">${provider?'Рабочее пространство':'Личный кабинет'}</div><nav class="nav-list" aria-label="Основная навигация">${nav.map(([page,name,label,count])=>`<button class="nav-item ${ui.page===page?'active':''}" data-action="navigate" data-page="${page}" ${ui.page===page?'aria-current="page"':''}>${icon(name,18)}${label}${count?`<span class="count">${count}</span>`:''}</button>`).join('')}</nav><div class="sidebar-bottom"><button class="provider-switch" data-action="mode">${icon(provider?'exchange':'briefcase',19)}<span>${provider?'Режим клиента':'Кабинет провайдера'}<small>${provider?'Вернуться к обмену':'Предлагайте свои условия'}</small></span>${icon('chevron',13)}</button><div class="side-bottom-links"><button class="text-button" data-action="help">${icon('help',15)}Поддержка</button><span>·</span><button class="text-button" data-action="about">О проекте</button></div><div class="side-footer"><span>© Handshake, 2026</span></div></div></aside>`;
}
const pageTitles = {home:'Главная',exchange:'Обмен',orders:'Мои заявки',history:'История',feed:'Входящие заявки',directions:'Моя ликвидность',responses:'Мои предложения',statistics:'Сделки и доход'};
function header() { return `<header class="topbar"><button class="icon-button mobile-menu" data-action="menu" aria-label="Открыть меню">${icon('menu')}</button><div class="breadcrumb"><span>${ui.page==='home'?'Handshake':ui.mode==='provider'?'Кабинет провайдера':'Личный кабинет'}</span>${icon('chevron',10)}<strong>${pageTitles[ui.page]}</strong>${ui.mode==='provider'?'<span class="mode-label">Демо-роль</span>':''}</div><div class="top-actions"><button class="appearance-button" data-action="preferences" aria-label="Изменить язык и тему" title="Язык и оформление">${icon('globe',15)}<span>${language().toUpperCase()}</span></button><button class="location-button" data-action="location">${icon('pin',14)}${ui.location}${icon('down',11)}</button><span class="separator"></span><button class="icon-button" data-action="notifications" aria-label="Уведомления">${icon('bell',19)}${state.notifications.some(n=>!n.read&&(!n.orderId||state.orders.some(o=>o.id===n.orderId&&o.owner==='me')))?'<i class="notification-dot"></i>':''}</button><button class="profile-button" data-action="profile"><span class="avatar">НТ</span><span>Мой профиль</span>${icon('down',12)}</button></div></header>`; }
const demoTag = '<span class="demo-tag"><i></i>Демо-режим</span>';
function intro(title,subtitle,eyebrow='ОБМЕН ПО ВАШИМ ПРАВИЛАМ',action='') {return `<div class="intro"><div><div class="eyebrow">${eyebrow}</div><h1>${title}</h1><p>${subtitle}</p></div>${action||demoTag}</div>`;}
function exchangePage() {
  return `${intro('Договориться проще.','Создайте заявку. Мы найдём того, с кем ваши условия совпадут.')}<div class="exchange-layout"><section class="card exchange-card" aria-label="Конструктор обмена"><div class="card-top"><h2>Новый обмен</h2><span class="card-label"><i class="online-dot"></i>Клиенты + провайдеры</span></div><form id="exchange-form">${endpointEditor(composer.give,'give')}<div class="swap-row"><button class="swap-button" type="button" data-action="swap" aria-label="Поменять направление обмена">${icon('exchange',16)}</button></div>${endpointEditor(composer.receive,'receive')}<div class="rate-row"><span>${icon('info',12)}<span id="reference-rate">1 ${composer.give.currency} ≈ ${fmt(amountFor(1,composer.give.currency,composer.receive.currency))} ${composer.receive.currency}</span></span><span>Демонстрационный курс</span></div><button class="primary-button full" type="submit"><span>Найти обмен</span>${icon('arrow',17)}</button><div class="form-note">${icon('lock',11)}Реквизиты не нужны для создания заявки</div><div id="composer-error"></div></form></section><aside class="guide-column"><div class="guide-card"><h2>Ваша заявка.<br>Идеальное совпадение.</h2><p>Без поиска по чатам и бесконечного сравнения обменников.</p>${currencyPairArt(composer.give.currency,composer.receive.currency)}<ol class="steps"><li><span class="step-num">1</span><div><strong>Задайте условия</strong><p>Что, сколько и как хотите обменять.</p></div></li><li><span class="step-num">2</span><div><strong>Мы найдём совпадение</strong><p>Встречные заявки подбираются автоматически.</p></div></li><li><span class="step-num">3</span><div><strong>Подтвердите обмен</strong><p>Для наличных также предложат свою цену.</p></div></li></ol></div><div class="trust-card"><span class="trust-icon">${icon('shield',20)}</span><div><strong>Ваши данные — под контролем</strong><p>Проверка зависит от условий сделки</p></div><button class="icon-button" data-action="kyc" aria-label="О проверке личности">${icon('chevron',14)}</button></div></aside></div><div class="section-head"><h2>Мои заявки <span class="count-inline">${activeOrders().length}</span></h2><button class="text-button" data-action="navigate" data-page="orders">Все заявки ${icon('arrow',13)}</button></div><div class="order-list">${activeOrders().slice(0,3).map(orderRow).join('')||empty('Пока нет активных заявок','Создайте первый обмен в форме выше.')}</div>`;
}
function ordersPage(history=false) {
  let orders=ownOrders().filter(o=>history?['agreed','completed','cancelled'].includes(o.status):['searching','matched'].includes(o.status));
  if(history&&ui.history!=='all') orders=orders.filter(o=>o.status===ui.history);
  return `${intro(history?'История договорённостей':'Ваши заявки',history?'Согласованные условия и отменённые заявки в одном месте.':'Совпадения находятся автоматически. Предложения наличных приходят сюда.',history?'ВСЁ ПОД РУКОЙ':'ОБМЕН В ПРОЦЕССЕ',`<button class="primary-button" data-action="new-order">${icon('plus',15)}Новый обмен</button>`)}${history?`<div class="history-tabs">${[['all','Все'],['agreed','Согласованные'],['completed','Завершённые'],['cancelled','Отменённые']].map(([id,label])=>`<button class="history-tab ${ui.history===id?'active':''}" data-action="history-filter" data-value="${id}">${label}</button>`).join('')}</div>`:''}<div class="order-list">${orders.map(orderRow).join('')||empty(history?'История пока пуста':'Активных заявок пока нет',history?'Здесь появятся заявки после согласования условий или отмены.':'Создайте заявку — мы подберём встречный обмен.','new-order','Создать заявку')}</div>`;
}
function providerOrders() {
  return state.orders.filter(o=>o.give.currency!==o.receive.currency&&o.status==='searching'&&(o.give.method==='cash'||o.receive.method==='cash')).filter(o=>ui.filterCurrency==='all'||o.give.currency===ui.filterCurrency||o.receive.currency===ui.filterCurrency).filter(o=>ui.filterCity==='all'||o.give.city===ui.filterCity||o.receive.city===ui.filterCity).filter(o=>!ui.onlyCompatible||state.directions.some(d=>isDirectionCompatible(d,o))).filter(o=>!ui.filterMin||o.amount>=parseAmount(ui.filterMin)).filter(o=>!ui.filterMax||o.amount<=parseAmount(ui.filterMax));
}
function requestCard(order) {
  const compatible=state.directions.some(d=>isDirectionCompatible(d,order));
  const quote=validQuotes(order).at(-1);
  return `<article class="card request-card"><div class="request-heading"><span class="request-id">${esc(shortId(order.id))} ${order.owner==='me'?'· Ваша клиентская заявка':''}</span><span class="chip">${icon('clock',11)}${quote?'Есть ваш отклик':'Новая заявка'}</span></div><div class="request-amounts"><div class="request-side"><div class="field-label">Клиент отдаёт</div><strong>${money(order.amount,order.give.currency)}</strong><p>${esc(endpointText(order.give))}</p></div>${icon('arrow',19)}<div class="request-side"><div class="field-label">Хочет получить от</div><strong>${money(order.minReceive,order.receive.currency)}</strong><p>${esc(endpointText(order.receive))}</p></div></div>${cashLocations(order)}<div class="request-chips"><span class="chip">${icon('pin',12)}${esc(order.receive.city||order.give.city)}</span><span class="chip">${icon('cash',12)}Обмен с наличными</span><span class="chip">Вся сумма</span></div><button class="primary-button ${compatible?'':'dark-button'}" data-action="${compatible?'quote':'setup-direction'}" data-id="${esc(order.id)}">${compatible?(quote?'Обновить предложение':'Предложить свою цену'):'Добавить подходящее направление'}${icon('arrow',14)}</button>${quote?`<p class="quote-history-note">Вы предложили ${money(quote.amount,order.receive.currency)} · до ${time(quote.expiresAt)}</p>`:''}</article>`;
}
function time(timestamp) {return formatTime(timestamp,language());}
function notificationMessage(notice) {
  return notice.message.replace(/([0-9][0-9\s\u00a0\u202f]*(?:,\d+)?) ([A-Z]{3,4})(?=[.\s]|$)/g,(_,amount,code)=>`${fmt(parseNumber(amount,'ru'))} ${code}`);
}
function feedPage() {
  const orders=providerOrders();
  const active=state.directions.filter(d=>d.active).length;
  const quotes=state.orders.flatMap(o=>validQuotes(o)).length;
  return `${intro('Хороший обмен начинается здесь.','Подходящие заявки уже у вас. Предложите клиенту свои условия.','КАБИНЕТ ПРОВАЙДЕРА')}<div class="stats-strip"><div class="card stat-card"><p>Подходящих заявок</p><strong>${state.orders.filter(o=>state.directions.some(d=>isDirectionCompatible(d,o))).length}</strong><small>По активным направлениям</small></div><div class="card stat-card"><p>Активных направлений</p><strong>${active.toString().padStart(2,'0')}</strong><small>Наличные, банки и крипта</small></div><div class="card stat-card"><p>Предложений в ожидании</p><strong>${quotes.toString().padStart(2,'0')}</strong><small>Цена действует 5 минут</small></div></div><div class="card filters"><div class="filter-field"><label for="filter-currency">Валюта заявки</label><select class="select-field" id="filter-currency" data-filter="filterCurrency"><option value="all">Все валюты</option>${options(CURRENCIES,ui.filterCurrency,c=>c.code,c=>c.code)}</select></div><div class="filter-field"><label for="filter-city">Город наличных</label><select class="select-field" id="filter-city" data-filter="filterCity"><option value="all">Все города</option>${options(CITIES,ui.filterCity)}</select></div><div class="filter-field"><label for="filter-min">Клиент отдаёт, от</label><input class="input-field" id="filter-min" inputmode="decimal" placeholder="Любая сумма" data-filter="filterMin" value="${esc(ui.filterMin)}"></div><div class="filter-field"><label for="filter-max">До</label><input class="input-field" id="filter-max" inputmode="decimal" placeholder="Без лимита" data-filter="filterMax" value="${esc(ui.filterMax)}"></div><label class="filter-toggle"><input type="checkbox" data-filter="onlyCompatible" ${ui.onlyCompatible?'checked':''}>Мои направления</label></div><div class="provider-summary">${icon('info',13)}Суммы фильтра — в отдаваемой клиентом валюте. Имя провайдера скрыто до оформления.</div><div class="section-head"><h2>Входящие заявки <span class="count-inline">${orders.length}</span></h2><button class="text-button" data-action="reset-filters">Сбросить фильтры</button></div><div class="feed-grid">${orders.map(requestCard).join('')}</div>${orders.length?'':empty('Подходящих заявок пока нет','Измените фильтры или добавьте новое направление, чтобы получать больше заявок.','add-direction','Добавить направление')}`;
}
function directionsPage() {
  return `${intro('Каждому направлению — свои условия.','Укажите, что готовы отдать, что принять и в каком объёме.','МОЯ ЛИКВИДНОСТЬ',`<button class="primary-button" data-action="add-direction">${icon('plus',15)}Добавить</button>`)}<div class="info-box"><strong>Вы управляете предложением. Мы подбираем заявки.</strong>Активные направления определяют входящие запросы. Цена устанавливается в отклике на конкретную заявку; остаток уменьшается после принятия предложения.</div><div class="section-head"><h2>Пулы ликвидности <span class="count-inline">${state.directions.length}</span></h2></div><div class="pool-grid">${state.directions.map((d,index)=>`<article class="card pool-card ${d.active?'':'is-paused'}" aria-label="${esc(t('Пул'))} ${index+1}: ${d.give.currency} → ${d.receive.currency}"><div class="pool-header"><span class="pool-number">Пул · ${String(index+1).padStart(2,'0')}</span><span class="pool-status ${d.active?'is-active':''}"><i></i>${d.active?'Активен':'На паузе'}</span><button class="switch ${d.active?'on':''}" role="switch" aria-checked="${d.active}" aria-label="${d.active?'Приостановить':'Включить'} направление ${d.give.currency} → ${d.receive.currency} · Пул ${index+1}" data-action="toggle-direction" data-id="${esc(d.id)}" ${d.invalidReason==='same-currency'?'disabled':''}></button></div>${currencyPairArt(d.give.currency,d.receive.currency,{compact:true})}<div class="pool-endpoints"><p>${icon(d.give.method,13)}<span>${esc(endpointText(d.give))}</span></p><p>${icon(d.receive.method,13)}<span>${esc(endpointText(d.receive))}</span></p></div>${cashLocations(d)}${d.invalidReason==='same-currency'?'<p class="pool-invalid-note">Выберите разные валюты: создайте новый пул с другим активом.</p>':''}<div class="pool-balance"><span>Доступно в пуле</span><strong>${fmtAmount(d.available,d.give.currency)} <small>${d.give.currency}</small></strong></div><div class="pool-limits"><span>Лимит одной сделки</span><strong>${fmtAmount(d.min,d.give.currency)} – ${fmtAmount(d.max,d.give.currency)} ${d.give.currency}</strong></div></article>`).join('')}</div><p class="inset-notice">В демо остатки заданы отдельно для каждого направления. Это не банковские балансы и не подтверждённые резервы.</p>`;
}
function responsesPage() {
  const orders=state.orders.filter(o=>o.quotes.length);
  return `${intro('Ваши предложения','Следите за откликами, сроком действия цены и принятыми условиями.','КАБИНЕТ ПРОВАЙДЕРА')}<div class="order-list">${orders.map(o=>`<article class="card request-card"><div class="request-heading"><span class="request-id">${esc(shortId(o.id))} · ${o.give.currency} → ${o.receive.currency}</span>${statusTag(o)}</div>${o.quotes.map(q=>`<div class="quote-row"><div><strong>${money(q.amount,o.receive.currency)}</strong><p>${q.status==='accepted'?'Предложение принято':q.status==='declined'?'Закрыто':q.expiresAt<=Date.now()?'Срок цены истёк':`Ожидает ответа · до ${time(q.expiresAt)}`}</p></div>${q.status==='pending'&&q.expiresAt>Date.now()?icon('clock',18):icon(q.status==='accepted'?'check':'close',18)}</div>`).join('')}${o.acceptedQuoteId&&['agreed','completed'].includes(o.status)?settlementPanel(o,'provider'):''}${o.status==='searching'?`<button class="outline-button" data-action="quote" data-id="${esc(o.id)}">Предложить новую цену</button>`:''}</article>`).join('')||empty('Вы ещё не отправляли предложений','Выберите подходящую заявку и предложите сумму, которую получит клиент.','open-feed','Перейти к заявкам')}</div>`;
}
function settlementPanel(order,actor) {
  if(order.status==='completed') return `<div class="info-box success"><strong>Обмен завершён</strong>Исполнение подтверждено. Сделка учтена в истории.</div>`;
  const providerTrade=Boolean(order.acceptedQuoteId);
  const sent=Boolean(order.settlement?.providerSentAt),received=Boolean(order.settlement?.clientReceivedAt);
  return `<div class="settlement-panel"><h3>Исполнение обмена</h3>${providerTrade?`<div class="settlement-step ${sent?'done':''}">${icon(sent?'check':'clock',16)}${sent?'Провайдер подтвердил перевод':'Ждём перевод провайдера'}</div><div class="settlement-step ${received?'done':''}">${icon(received?'check':'clock',16)}${received?'Клиент подтвердил получение':'Ждём подтверждение клиента'}</div>`:'<p>Прямой обмен между клиентами · комиссия Handshake 0%</p>'}<p class="inset-notice">Подтверждайте только выполненный перевод или полученные средства. В прототипе это демонстрация этапов сделки.</p>${actor==='provider'&&!sent?`<button class="primary-button" data-action="confirm-settlement" data-actor="provider" data-id="${esc(order.id)}">Перевод выполнен ${icon('check',15)}</button>`:actor==='client'&&!received?`<button class="primary-button" data-action="confirm-settlement" data-actor="client" data-id="${esc(order.id)}">Подтвердить получение ${icon('check',15)}</button>`:''}</div>`;
}
function statisticsPage() {
  const m=providerMetrics(state);
  const deals=state.orders.filter(o=>o.acceptedQuoteId&&['agreed','completed'].includes(o.status)).sort((a,b)=>(b.completedAt||b.agreedAt)-(a.completedAt||a.agreedAt));
  return `${intro('Сделки, которые приносят доход.','Завершённые обмены, заработок и обеспечение — в одном месте.','СДЕЛКИ И ДОХОД')}<div class="metrics-grid"><article class="card metric-card"><span>Завершено сделок</span><strong>${fmt(m.completedCount)}</strong><small>За всё время</small></article><article class="card metric-card metric-highlight"><span>Заработано</span><strong>${fmtAmount(m.earnedUSDT,'USDT')} <small>USDT</small></strong><small>По завершённым сделкам</small></article><article class="card metric-card"><span>Сделок в расчёте</span><strong>${fmt(m.activeCount)}</strong><small>Ожидают двух подтверждений</small></article><article class="card metric-card"><span>Ожидаемый доход</span><strong>${fmtAmount(m.pendingIncomeUSDT,'USDT')} <small>USDT</small></strong><small>После завершения расчётов</small></article></div><section class="card collateral-card"><div><span class="eyebrow">ОБЕСПЕЧЕНИЕ ПРОВАЙДЕРА</span><h2>${fmtAmount(m.collateralTotalUSDT,'USDT')} <span class="subtle">USDT</span></h2><p>Обеспечение ограничивает объём незавершённых сделок.</p><button class="text-button" data-action="terms">Как работает защита ${icon('arrow',13)}</button></div><div class="collateral-detail"><div><span>Заблокировано</span><strong>${fmtAmount(m.collateralReservedUSDT,'USDT')} USDT</strong></div><div class="collateral-bar" role="meter" aria-label="Заблокированное обеспечение" aria-valuemin="0" aria-valuemax="${m.collateralTotalUSDT}" aria-valuenow="${m.collateralReservedUSDT}"><i style="width:${Math.min(100,m.collateralReservedUSDT/Math.max(1,m.collateralTotalUSDT)*100)}%"></i></div><div><span>Доступно для новых сделок</span><strong>${fmtAmount(m.collateralAvailableUSDT,'USDT')} USDT</strong></div></div></section><p class="inset-notice">Доход указывает провайдер при отклике. Он уже включён в цену и не равен обороту. Обеспечение и расчёты в демо условные.</p><div class="section-head"><h2>История сделок <span class="count-inline">${deals.length}</span></h2><span class="card-label">За всё время</span></div><div class="deals-list">${deals.map(order=>{const quote=order.quotes.find(q=>q.id===order.acceptedQuoteId);return `<article class="card deal-card"><div class="request-heading"><span class="request-id">${esc(shortId(order.id))} · ${new Intl.DateTimeFormat(language(),{day:'numeric',month:'short'}).format(new Date(order.completedAt||order.agreedAt))}</span>${statusTag(order)}</div><div class="deal-main"><div><strong>${money(order.amount,order.give.currency)} → ${money(quote.amount,order.receive.currency)}</strong><p>${esc(endpointText(order.give))} → ${esc(endpointText(order.receive))}</p>${cashLocations(order)}</div><div class="deal-income"><small>${order.status==='completed'?'Заработано':'Ожидаемый доход'}</small><strong>+${fmtAmount(quote.incomeUSDT||0,'USDT')} USDT</strong></div></div>${order.status==='agreed'?settlementPanel(order,'provider'):''}</article>`;}).join('')||empty('Пока нет согласованных сделок','Принятые клиентами предложения появятся здесь.','open-feed','Перейти к заявкам')}</div>`;
}
const fmtRate=value=>Number.isFinite(value)?new Intl.NumberFormat(language(),{maximumFractionDigits:8,useGrouping:false}).format(value):'';
function quoteModal(order) {
  const isRate=quoteDraft.inputMode==='rate';
  if(isRate&&Number.isFinite(quoteDraft.rate)){quoteDraft.rate=Number(quoteDraft.rate.toFixed(8));const scale=['USDT','USDC'].includes(order.receive.currency)?1e6:100;quoteDraft.amount=Math.round(order.amount*quoteDraft.rate*scale)/scale;}
  return modalShell('Предложить свою цену',`Заявка ${esc(shortId(order.id))} · клиент не увидит ваш профиль`,`${pairDetail(order)}<form id="quote-form"><div class="quote-mode" role="group" aria-label="Способ задания цены">${[['amount','Итоговая сумма'],['rate','Курс обмена']].map(([mode,label])=>`<button type="button" data-action="quote-mode" data-mode="${mode}" aria-pressed="${quoteDraft.inputMode===mode}" class="${quoteDraft.inputMode===mode?'active':''}">${label}</button>`).join('')}</div><label class="field-label" for="quote-value">${isRate?`Курс: 1 ${order.give.currency} = … ${order.receive.currency}`:`Клиент получит, ${order.receive.currency}`}</label><input class="input-field quote-value" id="quote-value" inputmode="decimal" value="${isRate?fmtRate(quoteDraft.rate):fmtAmount(quoteDraft.amount,order.receive.currency)}" required><div class="quote-calculation" id="quote-calculation" aria-live="polite">${quoteSummary(order)}</div><label class="field-label" for="quote-income">Ваш доход, USDT</label><input class="input-field" id="quote-income" inputmode="decimal" value="${fmtAmount(quoteDraft.incomeUSDT,'USDT')}" required><p class="inset-notice">Включён в итоговую цену. Используется только для вашей статистики и не виден клиенту.</p><div class="info-box"><strong>Цена действует 5 минут</strong>Укажите итоговую сумму с учётом всех ваших комиссий. Объём и обеспечение резервируются после принятия клиентом.</div><button class="primary-button" type="submit">Отправить предложение ${icon('arrow',15)}</button></form>`);
}
function quoteSummary(order) {return `<span>${t('Клиент получит')}</span><strong>${Number.isFinite(quoteDraft.amount)?money(quoteDraft.amount,order.receive.currency):'—'}</strong><small>1 ${order.give.currency} = ${fmtRate(quoteDraft.rate)||'—'} ${order.receive.currency}</small>`;}
function updateQuoteSummary(order) {const el=$('#quote-calculation');if(el)el.innerHTML=quoteSummary(order);}
function shareModal(order) {
  const hasAddress=[order.give,order.receive].some(end=>end.method==='cash'&&end.address);
  return modalShell('Карточка для чата','Заявка хранится в вашем браузере. Отправьте изображение в любой чат.',`<div class="share-preview">${shareDraft.card?`<img class="share-preview-image" src="${shareDraft.card.dataUrl}" alt="${esc(t('Карточка заявки на обмен'))}">`:`<p class="share-loading" role="status">Готовим карточку…</p>`}</div>${hasAddress?`<label class="share-address-toggle"><input type="checkbox" id="share-address" ${shareDraft.includeAddress?'checked':''}><span>Добавить район или ориентир на карточку</span></label>`:''}<p class="inset-notice">Без имени, реквизитов и KYC-данных. Карточка фиксирует условия на момент создания.</p><div class="share-actions"><button class="primary-button" data-action="native-share" ${!shareDraft.card?'disabled':''}>Поделиться PNG ${icon('arrow',15)}</button>${shareDraft.card?`<a class="outline-button" href="${shareDraft.card.dataUrl}" download="${esc(shareDraft.card.filename)}">Скачать PNG</a>`:'<button class="outline-button" disabled>Скачать PNG</button>'}</div>${shareDraft.card?`<label class="field-label" for="share-caption">Текст к карточке</label><textarea id="share-caption" class="share-caption" readonly data-no-i18n>${esc(shareDraft.card.caption)}</textarea><button class="text-button" data-action="copy-caption">Скопировать текст</button>`:''}`,true);
}
async function refreshShareCard() {
  const generation=++shareGeneration;
  const id=ui.modal?.id;
  if(ui.modal?.type!=='share')return;
  try {const card=await createOrderCard(state.orders.find(o=>o.id===id),{language:language(),includeAddress:shareDraft.includeAddress});if(generation!==shareGeneration||ui.modal?.type!=='share'||ui.modal.id!==id)return;shareDraft.card=card;renderModal();}
  catch(error){if(generation===shareGeneration&&ui.modal?.type==='share'){const target=$('.share-loading');if(target)target.textContent=t('Не удалось создать карточку. Откройте её ещё раз.');modalError(error);}}
}
function downloadCard(card=shareDraft.card) {if(!card)return;const url=URL.createObjectURL(card.blob);const link=document.createElement('a');link.href=url;link.download=card.filename;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
async function shareCard() {
  if(!shareDraft.card)return;
  const card=shareDraft.card;
  const {blob,filename,caption}=card;
  const files=[new File([blob],filename,{type:'image/png'})];
  if(!navigator.canShare?.({files})||!navigator.share){downloadCard();toast('PNG скачан. Прикрепите его к сообщению в чате.');return;}
  try{await navigator.share({files,title:'Handshake',text:caption});}catch(error){if(error.name!=='AbortError'){downloadCard(card);toast('Откройте скачанный PNG и отправьте его в чат.');}}
}
async function copyCaption() {try{await navigator.clipboard.writeText(shareDraft.card.caption);toast('Текст скопирован');}catch{$('#share-caption')?.select();toast('Выделите и скопируйте текст карточки.',true);}}
function syncSidebar() { const sidebar=$('.sidebar'); if(sidebar) sidebar.inert=window.innerWidth<=700&&!ui.mobile; }
window.addEventListener('resize',syncSidebar);
function render() {
  const content=ui.page==='home'?homePage(language()):ui.page==='exchange'?exchangePage():ui.page==='orders'?ordersPage():ui.page==='history'?ordersPage(true):ui.page==='feed'?feedPage():ui.page==='directions'?directionsPage():ui.page==='statistics'?statisticsPage():responsesPage();
  $('#app').innerHTML=`${sidebar()}<div class="workspace">${header()}<main class="content">${content}<footer class="page-footer"><span>${icon('lock',10)}Демо: данные хранятся только в этом браузере</span><span>Сделки и курсы демонстрационные</span><button data-action="terms">Как работает Handshake ${icon('arrow',10)}</button></footer></main></div>`;
  localize($('#app'),language());
  document.title=t('Handshake — обмен по вашим правилам');
  document.querySelector('meta[name=description]').content=t('Handshake — обмен по вашим правилам. Создайте заявку, найдите встречный обмен или получите предложение наличных.');
  syncSidebar();
  $('#app').inert=Boolean(ui.modal);
}
function modalShell(title,subtitle,body,wide=false) { return `<div class="modal-backdrop" data-action="backdrop"><section class="modal ${wide?'wide':''}" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div class="modal-head"><div><h2 id="modal-title">${title}</h2>${subtitle?`<p>${subtitle}</p>`:''}</div><button class="icon-button" data-action="close-modal" aria-label="Закрыть">${icon('close',19)}</button></div>${body}<div id="modal-error"></div></section></div>`; }
function pairDetail(order) { const accepted=order.quotes.find(q=>q.status==='accepted'); return `<div class="detail-pair"><div><strong>${money(order.amount,order.give.currency)}</strong><p>${esc(endpointText(order.give))}</p></div>${icon('arrow',19)}<div><strong>${money(accepted?.amount||order.matchedReceive||order.minReceive,order.receive.currency)}</strong><p>${esc(endpointText(order.receive))}</p></div></div>${cashLocations(order)}`; }
function orderModal(order) {
  let body=pairDetail(order)+statusTag(order);
  if(order.status==='matched') body+=`<div class="info-box success"><strong>Встречная заявка найдена автоматически</strong>Совпали валюты, суммы и способы расчёта. Встречная заявка зарезервирована за вами. Провайдер в этом обмене не участвует.</div><button class="primary-button" data-action="accept-match" data-id="${esc(order.id)}">Подтвердить условия ${icon('check',15)}</button>`;
  if(order.status==='searching') {
    body+=`<div class="info-box"><strong>Ищем встречную заявку</strong>${order.give.method==='cash'||order.receive.method==='cash'?'Провайдеры наличных также могут предложить свою цену. Вы увидите итоговую сумму без каталога обменников.':'Подберём заявку другого клиента с обратным направлением и совместимыми условиями.'}</div>`;
    const quotes=order.quotes.filter(q=>q.status==='pending').sort((a,b)=>b.amount-a.amount);
    if(quotes.length) body+=`<h3>Предложения наличных</h3>${quotes.map(q=>`<div class="quote-row"><div><strong>${money(q.amount,order.receive.currency)}</strong><p>${q.expiresAt>Date.now()?`Цена до ${time(q.expiresAt)} · итоговая сумма`:'Срок действия истёк'}</p></div><button class="primary-button" data-action="accept-quote" data-id="${esc(order.id)}" data-quote-id="${esc(q.id)}" ${q.expiresAt<=Date.now()?'disabled':''}>Выбрать</button></div>`).join('')}`;
    else body+=`<p class="inset-notice">${order.give.method==='cash'||order.receive.method==='cash'?'Чтобы проверить отклик, переключитесь в кабинет провайдера и найдите эту заявку.':'Новые совпадения появятся при добавлении совместимой заявки в демо.'}</p>`;
  }
  if(['agreed','completed'].includes(order.status)) body+=settlementPanel(order,'client');
  if(order.status==='cancelled') body+='<div class="info-box">Поиск по этой заявке остановлен. Вы можете создать новый обмен с другими условиями.</div>';
  if(['searching','matched'].includes(order.status)) body+=`<div class="button-row"><button class="outline-button" data-action="close-modal">Вернуться к заявкам</button><button class="outline-button danger-button" data-action="cancel-confirm" data-id="${esc(order.id)}">Отменить заявку</button></div>`;
  body+=`<button class="outline-button share-order-button" data-action="share-order" data-id="${esc(order.id)}">${icon('arrow',15)}Карточка для чата</button>`;
  return modalShell('Заявка на обмен',esc(shortId(order.id)),body);
}
function renderModal() {
  if(!ui.modal) { $('#overlay-root').innerHTML=''; document.body.style.overflow=''; $('#app').inert=false; return; }
  $('#app').inert=true;
  const {type,id}=ui.modal;
  let html='';
  if(type==='order') { const order=state.orders.find(o=>o.id===id); if(!order) return closeModal(); html=orderModal(order); }
  if(type==='quote') html=quoteModal(state.orders.find(o=>o.id===id));
  if(type==='share') html=shareModal(state.orders.find(o=>o.id===id));
  if(type==='direction') html=modalShell('Новое направление','Настройте условия, чтобы получать подходящие заявки.',`<form id="direction-form">${endpointEditor(directionDraft.give,'give','direction')}${endpointEditor(directionDraft.receive,'receive','direction')}<div class="form-grid"><div><label class="field-label" for="direction-min">Минимум, ${directionDraft.give.currency}</label><input class="input-field" id="direction-min" name="min" inputmode="decimal" data-draft-field="min" value="${fmt(directionDraft.min)}" required></div><div><label class="field-label" for="direction-max">Максимум, ${directionDraft.give.currency}</label><input class="input-field" id="direction-max" name="max" inputmode="decimal" data-draft-field="max" value="${fmt(directionDraft.max)}" required></div><div class="span-2"><label class="field-label" for="direction-available">Доступный объём, ${directionDraft.give.currency}</label><input class="input-field" id="direction-available" name="available" inputmode="decimal" data-draft-field="available" value="${fmt(directionDraft.available)}" required></div></div><p class="inset-notice">Хотя бы одна сторона — наличные. Суммы лимитов задаются в валюте, которую отдаёт провайдер.</p><button class="primary-button" type="submit">Добавить направление ${icon('plus',15)}</button></form>`);
  if(type==='notifications') {
    const notices=state.notifications.filter(n=>!n.orderId||state.orders.some(o=>o.id===n.orderId&&o.owner==='me'));
    html=modalShell('Уведомления','Совпадения, предложения и изменения ваших заявок.',notices.length?notices.slice(0,20).map(n=>`<button class="notification-item" data-action="notification-order" data-id="${esc(n.orderId||'')}">${icon(n.type==='quote'?'cash':n.type==='match'?'spark':'bell',18)}<span><strong>${esc(n.title)}</strong><p>${esc(notificationMessage(n))}</p><p>${time(n.createdAt)}</p></span></button>`).join(''):empty('Всё спокойно','Здесь появятся уведомления о ваших обменах.'));
  }
  if(type==='kyc') html=modalShell('Проверка личности','Клиенты и провайдеры проходят KYC.',serviceContent('kyc'));
  if(type==='preferences') html=modalShell('Язык и оформление','Выберите язык интерфейса и цветовую тему.',`${preferenceSelects()}<div class="info-box">Автоматическая тема следует настройке устройства.</div><p class="inset-notice">Настройки сохраняются в этом браузере.</p><button class="primary-button" data-action="close-modal">Готово ${icon('check',15)}</button>`);
  if(type==='profile') html=modalShell('Мой профиль','Демонстрационный аккаунт',`<div class="trust-card"><span class="avatar">НТ</span><div><strong>Тестовый пользователь</strong><p>Роль: ${ui.mode==='client'?'клиент':'провайдер наличных'}</p></div></div><div class="info-box">Данные сохраняются локально в этом браузере. Между устройствами и аккаунтами они не синхронизируются.</div><div class="button-row"><button class="outline-button" data-action="kyc">${icon('shield',15)}О проверке</button><button class="outline-button" data-action="reset-confirm">Начать демо заново</button></div>`);
  if(type==='reset-confirm') html=modalShell('Сбросить демоверсию?','',`<p class="subtle" style="line-height:1.8">Созданные в этом браузере заявки, направления и предложения будут удалены. Начальные примеры восстановятся.</p><div class="button-row"><button class="outline-button" data-action="close-modal">Оставить данные</button><button class="primary-button" data-action="reset-demo">Сбросить демо</button></div>`);
  if(type==='cancel-confirm') html=modalShell('Отменить заявку?','',`<p class="subtle" style="line-height:1.8">Подбор остановится, предложения закроются, а встречная заявка станет доступна другим клиентам.</p><div class="button-row"><button class="outline-button" data-action="order" data-id="${esc(id)}">Продолжить обмен</button><button class="primary-button" data-action="cancel-order" data-id="${esc(id)}">Отменить заявку</button></div>`);
  if(type==='location') html=modalShell('Ваш город','Будет использован для новых обменов наличными.',`<label class="field-label" for="user-city">Город</label><select class="select-field" id="user-city">${options(CITIES,ui.location)}</select><button class="primary-button" data-action="save-location">Сохранить ${icon('check',15)}</button>`);
  if(['help','about','terms'].includes(type)) html=modalShell({help:'Центр поддержки',about:'О Handshake',terms:'Как устроена защита сделки'}[type],'Обмен по вашим правилам',serviceContent(type));
  $('#overlay-root').innerHTML=html;
  localize($('#overlay-root'),language());
  document.body.style.overflow='hidden';
}
function openModal(type,id) { focusReturn=document.activeElement; ui.modal={type,id}; renderModal(); queueMicrotask(()=>$('.modal .icon-button')?.focus()); }
function closeModal() {ui.modal=null;renderModal();if(focusReturn?.isConnected)focusReturn.focus();}
function navigate(page) {closeModal();if(page==='home')ui.mode='client';ui.page=page;ui.mobile=false;render();window.scrollTo({top:0,behavior:'smooth'});}
function modalError(error) {const target=$('#modal-error');if(target)target.innerHTML=`<div class="error-message" role="alert">${esc(t(error.message||error))}</div>`;else toast(error.message||error,true);}
function newDirection(order) { directionDraft=order?{give:{...order.receive},receive:{...order.give},min:Math.max(1,Math.floor(order.minReceive/2)),max:Math.ceil(order.minReceive*2),available:Math.ceil(order.minReceive*5)}:{give:{currency:'AMD',method:'cash',city:ui.location},receive:{currency:'USDT',method:'crypto',network:'TRC20'},min:100000,max:3000000,available:5000000};openModal('direction'); }
function recomputeComposer() {composer.minReceive=amountFor(Number.isFinite(composer.amount)&&composer.amount>=0?composer.amount:0,composer.give.currency,composer.receive.currency);}
document.addEventListener('click',event=>{
  const el=event.target.closest('[data-action]');if(!el)return;
  const action=el.dataset.action,id=el.dataset.id;
  if(el.tagName==='A') event.preventDefault();
  try {
    if(action==='navigate')navigate(el.dataset.page);
    else if(action==='home')navigate('home');
    else if(action==='new-order'){ui.mode='client';navigate('exchange');$('#give-amount')?.focus();}
    else if(action==='open-feed'){ui.mode='provider';navigate('feed');}
    else if(action==='menu'){ui.mobile=!ui.mobile;render();}
    else if(action==='mode'){ui.mode=ui.mode==='client'?'provider':'client';navigate(ui.mode==='client'?'exchange':'feed');}
    else if(action==='method'){
      const draft=el.dataset.scope==='direction'?directionDraft:composer;
      updateEndpoint(draft,el.dataset.side,'method',el.dataset.method,ui.location);
      if(el.dataset.scope==='direction')renderModal();else{recomputeComposer();render();}
    }
    else if(action==='swap'){[composer.give,composer.receive]=[composer.receive,composer.give];[composer.amount,composer.minReceive]=[composer.minReceive,composer.amount];render();}
    else if(action==='order'||action==='cancel-confirm')openModal(action,id);
    else if(action==='quote'){const order=state.orders.find(o=>o.id===id);const previous=validQuotes(order).at(-1);quoteDraft={inputMode:previous?.inputMode||'amount',amount:previous?.amount||order.minReceive,rate:previous?.rate||order.minReceive/order.amount,incomeUSDT:previous?.incomeUSDT||0};openModal('quote',id);}
    else if(action==='quote-mode'){quoteDraft.inputMode=el.dataset.mode;renderModal();}
    else if(action==='confirm-settlement'){confirmSettlement(state,id,el.dataset.actor);persist();render();renderModal();toast('Подтверждение сохранено');}
    else if(action==='share-order'){shareDraft={includeAddress:false,card:null};openModal('share',id);refreshShareCard();}
    else if(action==='download-card')downloadCard();
    else if(action==='native-share')shareCard();
    else if(action==='copy-caption')copyCaption();
    else if(action==='notification-order'){ui.mode='client';ui.page='orders';render();if(id)openModal('order',id);}
    else if(action==='close-modal')closeModal();
    else if(action==='backdrop'&&event.target===el)closeModal();
    else if(action==='accept-match'){acceptMatch(state,id);persist();render();renderModal();toast('Условия обмена согласованы');}
    else if(action==='accept-quote'){acceptQuote(state,id,el.dataset.quoteId);persist();render();renderModal();toast('Предложение принято. Условия зафиксированы');}
    else if(action==='cancel-order'){cancelOrder(state,id);persist();closeModal();render();toast('Заявка отменена');}
    else if(action==='toggle-direction'){toggleDirection(state,id);persist();render();}
    else if(action==='add-direction')newDirection();
    else if(action==='setup-direction')newDirection(state.orders.find(o=>o.id===id));
    else if(action==='reset-filters'){Object.assign(ui,{filterCurrency:'all',filterCity:'all',filterMin:'',filterMax:'',onlyCompatible:true});render();}
    else if(action==='history-filter'){ui.history=el.dataset.value;render();}
    else if(action==='notifications'){state.notifications.forEach(n=>n.read=true);persist();render();openModal('notifications');}
    else if(['kyc','profile','reset-confirm','help','about','terms','location','preferences'].includes(action))openModal(action);
    else if(action==='save-location'){ui.location=$('#user-city').value;for(const end of [composer.give,composer.receive])if(end.method==='cash'){if(end.city!==ui.location)end.address='';end.city=ui.location;};closeModal();render();toast('Город обновлён');}
    else if(action==='reset-demo'){state=seedState();persist();ui.mode='client';navigate('exchange');toast('Демонстрационные данные восстановлены');}
  }catch(error){modalError(error);}
});
document.addEventListener('input',event=>{
  const el=event.target;
  if(el.dataset.cashAddress){const draft=el.dataset.scope==='direction'?directionDraft:composer;draft[el.dataset.cashAddress].address=el.value;}
  if(el.id==='quote-value'){const order=state.orders.find(o=>o.id===ui.modal?.id);const value=parseAmount(el.value);if(quoteDraft.inputMode==='rate'){quoteDraft.rate=value;quoteDraft.amount=Number.isFinite(value)?Math.round(order.amount*value*(order.receive.method==='crypto'?1e6:100))/(order.receive.method==='crypto'?1e6:100):NaN;}else{quoteDraft.amount=value;quoteDraft.rate=value/order.amount;}updateQuoteSummary(order);}
  if(el.id==='quote-income')quoteDraft.incomeUSDT=parseAmount(el.value);
  if(el.id==='give-amount'){
    composer.amount=parseAmount(el.value);
    if(Number.isFinite(composer.amount)&&composer.amount>=0){recomputeComposer();$('#receive-amount').value=fmtAmount(composer.minReceive,composer.receive.currency);}
  }
  if(el.id==='receive-amount')composer.minReceive=parseAmount(el.value);
  if(el.dataset.draftField) directionDraft[el.dataset.draftField]=parseAmount(el.value);
  if(el.dataset.filter&&el.type!=='checkbox')ui[el.dataset.filter]=el.value;
});
document.addEventListener('change',event=>{
  const el=event.target;
  if(el.id==='share-address'){shareDraft.includeAddress=el.checked;shareDraft.card=null;renderModal();refreshShareCard();return;}
  if(el.dataset.preference) { setPreferences({[el.dataset.preference]:el.value}); return; }
  if(el.dataset.endpoint){
    const draft=el.dataset.scope==='direction'?directionDraft:composer;
    updateEndpoint(draft,el.dataset.endpoint,el.dataset.field,el.value,ui.location);
    if(el.dataset.scope==='direction')renderModal();else{recomputeComposer();render();}
  }
  if(el.dataset.filter){ui[el.dataset.filter]=el.type==='checkbox'?el.checked:el.value;render();}
});
document.addEventListener('submit',event=>{
  event.preventDefault();
  try{
    if(event.target.id==='exchange-form'){
      composer.amount=parseAmount($('#give-amount').value);composer.minReceive=parseAmount($('#receive-amount').value);
      const order=createOrder(state,composer);persist();render();openModal('order',order.id);toast(order.status==='matched'?'Нашли встречную заявку — условия совпали':'Заявка создана. Ищем подходящий обмен');
    }
    if(event.target.id==='quote-form'){
      quoteDraft[quoteDraft.inputMode==='rate'?'rate':'amount']=parseAmount($('#quote-value').value);
      quoteDraft.incomeUSDT=parseAmount($('#quote-income').value);
      submitQuote(state,ui.modal.id,quoteDraft);persist();closeModal();render();toast('Предложение отправлено клиенту');
    }
    if(event.target.id==='direction-form'){
      addDirection(state,directionDraft);persist();closeModal();ui.page='directions';render();toast('Направление добавлено');
    }
  }catch(error){if(event.target.id==='exchange-form')$('#composer-error').innerHTML=`<div class="error-message" role="alert">${esc(t(error.message))}</div>`;else modalError(error);}
});
document.addEventListener('keydown',event=>{
  if(event.key==='Escape'){if(ui.modal)closeModal();else if(ui.mobile){ui.mobile=false;render();}}
  if(event.key==='Tab'&&ui.modal){const nodes=[...document.querySelectorAll('.modal button:not([disabled]),.modal input,.modal select,.modal textarea,.modal summary,.modal a[href]')];const first=nodes[0],last=nodes.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}}
});
document.addEventListener('preferenceschange',event=>{
  const {previous,preferences}=event.detail;
  if(previous.language!==preferences.language){
    if(ui.modal?.type==='share'){shareDraft.card=null;queueMicrotask(refreshShareCard);}
    for(const key of ['filterMin','filterMax']) if(ui[key]) { const value=parseNumber(ui[key],previous.language); if(Number.isFinite(value))ui[key]=formatNumber(value,preferences.language); }
    const focusPreference=document.activeElement?.dataset.preference;
    render();renderModal();
    if(currentToast)toast(currentToast.message,currentToast.error);
    const target=ui.modal?$('#overlay-root'):$('#app');
    if(focusPreference)target.querySelector(`[data-preference="${focusPreference}"]`)?.focus();
  }else{
    document.querySelectorAll('[data-preference]').forEach(el=>{el.value=preferences[el.dataset.preference];});
  }
});
// Synchronize browser tabs without interrupting an in-progress form.
window.addEventListener('storage',event=>{if(event.key===STORAGE_KEY&&event.newValue){try{const next=JSON.parse(event.newValue);if([1,2].includes(next.version)&&Array.isArray(next.orders)&&Array.isArray(next.directions)&&Array.isArray(next.notifications)){state=migrateState(next);if(!ui.modal){render();toast('Данные обновлены в другой вкладке');}}}catch{}}});
setInterval(()=>{
  if(ui.modal?.type==='order'&&!$('.modal input:focus')){
    const expired=[...document.querySelectorAll('[data-action="accept-quote"]')].some(el=>{const order=state.orders.find(o=>o.id===el.dataset.id);return !el.disabled&&order?.quotes.find(q=>q.id===el.dataset.quoteId)?.expiresAt<=Date.now();});
    if(expired)renderModal();
  }
},1000);
render();
