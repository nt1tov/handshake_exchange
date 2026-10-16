import { CURRENCIES, BANKS, CITIES, NETWORKS, seedState, migrateState, createOrder, acceptMatch, submitQuote, acceptQuote, cancelOrder, addDirection, toggleDirection, isDirectionCompatible, amountFor, referenceRate, confirmSettlement, providerMetrics, orderExecution, reportProblem } from './domain.js';
import { buildRequestLink, parseRequestLink } from './share-links.js';
import { createQRCode } from './qr-code.js';
import { shareDialog, sharedRequestPage } from './sharing-ui.js';
import { createSharedReply } from './shared-reply.js';
import { setVaultEnabled, depositVault, requestVaultWithdrawal, confirmVaultWithdrawal } from './vault.js';
import { vaultPage, vaultSummaryCard, vaultModal } from './vault-ui.js';
import { createOrderCard } from './share-card.js';
import { serviceContent } from './service-content.js';
import { currencyPairArt } from './currency-art.js';
import { homePage } from './home-page.js?v=20261016-access';
import { headerCityLogo, startCityRotation } from './brand-story.js?v=20261016-access';
import { startCurrencyOrbits } from './currency-orbits.js?v=20261016-access';
import { formatMoney } from './money-format.js';
import { calculateClientPricing, rateDisplay } from './client-pricing.js';
import { ACCESS_STORAGE_KEY, createAccessState, loadAccessState, redeemInvite, completeAccount, completeVerificationStep, submitVerification, demoReview, restartVerification, accessSummary, canTrade } from './access-model.js';
import { renderAccessPage, accessStatusLabel } from './access-ui.js';
import { availableCurrencies, updateEndpoint } from './endpoint-draft.js';
import { COUNTRIES, bankCountry } from './bank-catalog.js';
import { paymentFields, createDemoPaymentDetails, setPaymentDetails } from './payment-details.js';

import { LANGUAGES, translate, localize, formatNumber, parseNumber, formatTime } from './i18n.js?v=20261016-access';
import { getPreferences, setPreferences, initializePreferences } from './preferences.js';

initializePreferences();
const language = () => getPreferences().language;
const t = value => translate(value, language());

const STORAGE_KEY = 'handshake-demo-v1';
const $ = (selector) => document.querySelector(selector);
const esc = (value = '') => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const paths = {
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>',
  moon: '<path d="M20.5 13A9 9 0 0 1 11 3.5 9 9 0 1 0 20.5 13Z"/>',
  monitor: '<rect x="3" y="3" width="18" height="13" rx="2"/><path d="M12 16v5m-4 0h8"/>',
  link: '<path d="m10 13 4-4m-6 6-2 2a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0m2 2 2-2a4 4 0 0 1 6 6l-4 4a4 4 0 0 1-6 0"/>',
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
const fmtAmount = amount => formatMoney(amount,language());
const money = (amount, code) => `${fmtAmount(amount,code)} ${symbol(code)}`;
const parseAmount = value => parseNumber(value, language());
function fitAmounts() { document.querySelectorAll('.amount-input').forEach(el=>el.classList.toggle('long-amount',el.value.length>11)); }
const networkOptions = code => code === 'USDC' ? ['ERC20', 'Solana'] : NETWORKS;
const options = (items, selected, valueFn = v => v, labelFn = v => v) => items.map(item => `<option value="${esc(valueFn(item))}" ${valueFn(item) === selected ? 'selected' : ''}>${esc(labelFn(item))}</option>`).join('');
let storageAvailable = true;
let state;
try { const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)); state = [1,2].includes(saved?.version) && Array.isArray(saved.orders) && Array.isArray(saved.directions) && Array.isArray(saved.notifications) ? migrateState(saved) : seedState(); } catch { state = seedState(); }
let access;
try {access=loadAccessState(localStorage.getItem(ACCESS_STORAGE_KEY));}catch{access=createAccessState();}
let accessError='';
function refreshAccess(){render();const heading=$('.access-main h2');if(heading){heading.tabIndex=-1;heading.focus();}}
function persistAccess(){try{localStorage.setItem(ACCESS_STORAGE_KEY,JSON.stringify(access));}catch{toast(language()==='en'?'Progress is saved for this visit only.':'Прогресс сохранён только на время этого посещения.',true);}}
const ui = { mode: 'client', page: 'home', history: 'all', mobile: false, modal: null, location: 'Ереван', filterCurrency: 'all', filterCity: 'all', filterMin: '', filterMax: '', onlyCompatible: true };
let composer = { give: {currency:'RUB', method:'bank', bank:'tbank'}, receive: {currency:'AMD', method:'cash',city:'Ереван'}, pricingMode:'auto',partial:false, amount:100000, minReceive:amountFor(100000,'RUB','AMD') };
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
  const country = bankCountry(end);
  const selectableBanks = BANKS.filter(b=>!b.legacy&&b.country===country);
  if(bank?.legacy&&!selectableBanks.some(b=>b.id===bank.id))selectableBanks.push(bank);
  const selector = end.method==='bank'
    ? `<select class="context-select" aria-label="${side==='give'?'Банк отправления':'Банк получения'}" data-endpoint="${side}" data-field="bank" data-scope="${scope}"><optgroup label="Банки">${options(selectableBanks.filter(b=>b.kind==='bank'),end.bank,b=>b.id,b=>b.name)}</optgroup><optgroup label="Платёжные сервисы">${options(selectableBanks.filter(b=>b.kind==='fintech'),end.bank,b=>b.id,b=>b.name)}</optgroup></select>`
    : `<select class="context-select" aria-label="${end.method==='cash'?'Город':'Сеть'} ${side==='give'?'отправления':'получения'}" data-endpoint="${side}" data-field="${end.method==='cash'?'city':'network'}" data-scope="${scope}">${options(end.method==='cash'?CITIES:networkOptions(end.currency),end.method==='cash'?end.city:end.network)}</select>`;
  return `<div class="endpoint-card"><div class="endpoint-top"><span class="field-label">${side==='give'?'Отдаёте':'Получаете'}</span>${side==='receive'&&isComposer?`<span class="endpoint-help">${composer.pricingMode==='manual'||composer.sharedRequest?'Не меньше этой суммы':language()==='en'?'Estimated amount':'Ориентировочно'}</span>`:''}</div><div class="amount-line">${isComposer?`<input class="amount-input" type="text" inputmode="decimal" autocomplete="off" aria-label="${side==='give'?'Сумма отправления':'Минимальная сумма получения'}" id="${side==='give'?'give-amount':'receive-amount'}" ${side==='receive'?'readonly':''} value="${fmtAmount(side==='give'?composer.amount:composer.minReceive,end.currency)}">`:`<span class="subtle">${side==='give'?'Средства провайдера':'Средства клиента'}</span>`}<div class="currency-wrap">${coin(end.currency)}<select class="currency-select" aria-label="${side==='give'?'Валюта отправления':'Валюта получения'}" data-endpoint="${side}" data-field="currency" data-scope="${scope}">${options(availableCurrencies(draft,side),end.currency,c=>c.code,c=>c.code)}</select></div></div><div class="method-tabs" role="group" aria-label="Способ ${side==='give'?'отправления':'получения'}">${[['bank','Банк'],['cash','Наличные'],['crypto','Крипта']].map(([key,label])=>`<button type="button" class="method-tab ${end.method===key?'active':''}" data-action="method" data-scope="${scope}" data-side="${side}" data-method="${key}" aria-pressed="${end.method===key}">${icon(key,14)}${label}</button>`).join('')}</div>${end.method==='bank'?`<label class="bank-country"><span class="field-label">Страна банка</span><select class="context-select" aria-label="${side==='give'?'Страна банка отправления':'Страна банка получения'}" data-endpoint="${side}" data-field="country" data-scope="${scope}">${options(COUNTRIES,country,c=>c.code,c=>c.name)}</select></label>`:''}<div class="context-row"><span class="context-icon ${end.method}" ${end.method==='bank'?`style="background:${bank?.color||'#eee'}22;color:${bank?.color||'#999'}"`:''}>${end.method==='bank'?esc(t(bank?.name||'Банк')[0]):icon(end.method==='cash'?'pin':'crypto',14)}</span>${selector}${end.method==='cash'?'<span class="endpoint-help">Лично</span>':''}</div>${end.method==='cash'?`<label class="address-field"><span class="field-label">Район или ориентир</span><input class="input-field" aria-label="${side==='give'?'Адрес передачи наличных':'Адрес получения наличных'}" data-cash-address="${side}" data-scope="${scope}" placeholder="Например, Кентрон, площадь Республики" value="${esc(end.address||'')}" minlength="3" maxlength="160" required><span class="endpoint-help">Достаточно примерного адреса. Точку встречи согласуете позже.</span></label>`:''}</div>`;
}
const ownOrders = () => state.orders.filter(o=>o.owner==='me');
const activeOrders = () => ownOrders().filter(o=>['searching','matched','agreed'].includes(o.status));
const validQuotes = order => order.quotes.filter(q=>q.status==='pending'&&q.expiresAt>Date.now());
function status(order) { return {searching:['searching','Открыта','clock'],matched:['matched','Открыта','check'],agreed:['agreed','В процессе','clock'],completed:['completed','Состоялась','check'],cancelled:['cancelled','Отменена','close']}[order.status] || ['searching','Открыта','clock']; }
const statusTag = order => {const [key,label,name]=status(order);return `<span class="order-status ${key}">${icon(name,11)}${label}</span>`;};
const shortId = id => id.length>12?`HS-${id.slice(-6).toUpperCase()}`:id;
function orderRow(order) { const execution=orderExecution(order); return `<button class="order-row" data-action="order" data-id="${esc(order.id)}"><span class="order-pair"><span class="paired-icons">${coin(order.give.currency)}${coin(order.receive.currency)}</span><span><span class="order-title">${money(execution.giveAmount,order.give.currency)} ${icon('arrow',12)} ${money(execution.receiveAmount,order.receive.currency)}</span><span class="order-subtitle">${esc(endpointText(order.give))} <span aria-hidden="true">→</span> ${esc(endpointText(order.receive))}</span></span></span><span class="order-right">${statusTag(order)}<span class="order-meta">${esc(shortId(order.id))}${order.partial?' · Частями':''}${order.problem?.status==='open'?' · Есть проблема':''}</span>${icon('chevron',14)}</span></button>`; }
const empty = (title,text,action='',label='') => `<div class="empty-state">${icon('orders',28)}<h3>${esc(title)}</h3><p>${esc(text)}</p>${action?`<button class="outline-button" data-action="${action}">${esc(label)}</button>`:''}</div>`;
function preferenceChoices(kind) {
  const en=language()==='en',preferences=getPreferences();
  const choices=kind==='language'?LANGUAGES.map(item=>[item.code,item.label,'globe']):[['light',en?'Light':'Светлая','sun'],['dark',en?'Dark':'Тёмная','moon'],['auto',en?'System':'Авто','monitor']];
  return `<div class="preference-choices" data-no-i18n>${choices.map(([value,label,name])=>`<button class="preference-choice ${preferences[kind]===value?'selected':''}" data-action="set-${kind}" data-value="${value}" aria-pressed="${preferences[kind]===value}">${icon(name,20)}<span>${label}</span>${preferences[kind]===value?icon('check',18):''}</button>`).join('')}${kind==='theme'?`<p class="inset-notice">${en?'System theme follows your device settings.':'Автоматическая тема следует настройке устройства.'}</p>`:''}</div>`;
}
const vaultHelpers=()=>({esc,icon,language:language(),fmt:value=>fmtAmount(value,'USDT')});
const sharingHelpers=()=>({esc,icon,language:language(),formatAmount:fmtAmount});
function sharedComposerNote() {
  if(!composer.sharedRequest)return '';
  const en=language()==='en';
  return `<div class="shared-composer-note" data-no-i18n><strong>${en?'Reply to request':'Отклик на заявку'} ${esc(shortId(composer.sharedRequest.id))}</strong><p>${en?'The terms are reversed for you. This demo creates a local match; the sender will not be notified.':'Условия развёрнуты для вас. В демо создаётся локальное совпадение; отправитель не получит уведомление.'}</p><button class="text-button" data-action="clear-shared-reply">${en?'Create a regular request':'Создать обычную заявку'}</button></div>`;
}
function sidebar() {
  const provider=ui.mode==='provider';
  const nav = [['home','home','Главная',''],...(provider ? [['feed','orders','Входящие заявки',state.orders.filter(o=>state.directions.some(d=>isDirectionCompatible(d,o))).length],['directions','wallet','Моя ликвидность',''],['vault','lock','Доходный vault',''],['responses','orders','Мои предложения',''],['statistics','grid','Сделки и доход','']] : [['exchange','exchange','Обмен',''],['orders','orders','Мои заявки',activeOrders().length],['history','history','История','']])];
  return `<div class="mobile-scrim ${ui.mobile?'visible':''}" data-action="menu"></div><aside class="sidebar ${ui.mobile?'mobile-open':''}">${headerCityLogo(language())}<div class="sidebar-caption">${provider?'Рабочее пространство':'Личный кабинет'}</div><nav class="nav-list" aria-label="Основная навигация">${nav.map(([page,name,label,count])=>`<button class="nav-item ${ui.page===page?'active':''}" data-action="navigate" data-page="${page}" ${ui.page===page?'aria-current="page"':''}>${icon(name,18)}${label}${count?`<span class="count">${count}</span>`:''}</button>`).join('')}</nav><div class="sidebar-bottom"><button class="provider-switch" data-action="mode">${icon(provider?'exchange':'briefcase',19)}<span>${provider?'Режим клиента':'Кабинет провайдера'}<small>${provider?'Вернуться к обмену':'Предлагайте свои условия'}</small></span>${icon('chevron',13)}</button><div class="side-bottom-links"><button class="text-button" data-action="help">${icon('help',15)}Поддержка</button><span>·</span><button class="text-button" data-action="about">О проекте</button></div><div class="side-footer"><span>© Handshake, 2026</span></div></div></aside>`;
}
const pageTitles = {access:'Доступ и проверка',home:'Главная',exchange:'Обмен',orders:'Мои заявки',history:'История',feed:'Входящие заявки',directions:'Моя ликвидность',responses:'Мои предложения',statistics:'Сделки и доход',vault:'Доходный vault',shared:'Заявка по ссылке'};
function header() { return `<header class="topbar"><button class="icon-button mobile-menu" data-action="menu" aria-label="Открыть меню">${icon('menu')}</button><div class="header-city-compact">${headerCityLogo(language(),{variant:'compact'})}</div><div class="breadcrumb"><span>${ui.page==='home'?'Handshake':ui.mode==='provider'?'Кабинет провайдера':'Личный кабинет'}</span>${icon('chevron',10)}<strong>${pageTitles[ui.page]}</strong>${ui.mode==='provider'?'<span class="mode-label">Демо-роль</span>':''}</div><div class="top-actions"><button class="appearance-button header-preference" data-action="language" aria-label="Язык интерфейса" title="Язык интерфейса">${icon('globe',20)}</button><button class="appearance-button header-preference" data-action="theme" aria-label="Оформление" title="Оформление">${icon({light:'sun',dark:'moon',auto:'monitor'}[getPreferences().theme],20)}</button><button class="location-button" data-action="location">${icon('pin',14)}${ui.location}${icon('down',11)}</button><span class="separator"></span><button class="icon-button" data-action="notifications" aria-label="Уведомления">${icon('bell',19)}${state.notifications.some(n=>!n.read&&(!n.orderId||state.orders.some(o=>o.id===n.orderId&&o.owner==='me')))?'<i class="notification-dot"></i>':''}</button><button class="profile-button" data-action="profile" aria-label="${accessSummary(access).registered?'Мой профиль':language()==='en'?'Sign in by invitation':'Войти по приглашению'}"><span class="avatar" aria-hidden="true">${icon('user',20)}</span><span>${accessSummary(access).registered?'Мой профиль':language()==='en'?'Sign in':'Войти'}</span>${icon('down',12)}</button></div></header>`; }
const demoTag = '<span class="demo-tag"><i></i>Демо-режим</span>';
function intro(title,subtitle,eyebrow='ОБМЕН ПО ВАШИМ ПРАВИЛАМ',action='') {return `<div class="intro"><div><div class="eyebrow">${eyebrow}</div><h1>${title}</h1><p>${subtitle}</p></div>${action||demoTag}</div>`;}
function displayRate(rate,give,receive){
  if(!Number.isFinite(rate)||rate<=0)return '—';
  const {base,quote}=rateDisplay(rate);
  return `${fmtAmount(base)} ${give} = ${fmtAmount(quote)} ${receive}`;
}
function pricingControl(){
  if(composer.sharedRequest)return '';
  const en=language()==='en',manual=composer.pricingMode==='manual';
  const rate=composer.manualRate??referenceRate(composer.give.currency,composer.receive.currency);
  const base=composer.rateBase||rateDisplay(referenceRate(composer.give.currency,composer.receive.currency)).base;
  return `<section class="pricing-choice" data-no-i18n><div class="pricing-choice-head"><div><strong>${manual?(en?'My exchange rate':'Свой курс'):(en?'Best available rate':'Лучший курс автоматически')}</strong></div><button type="button" class="switch ${manual?'on':''}" role="switch" aria-checked="${manual}" aria-label="${en?'Set my exchange rate':'Задать свой курс'}" aria-describedby="pricing-hint" data-action="pricing-toggle"></button></div><p id="pricing-hint">${manual?(en?'We will look for this rate or better. A stricter rate may take longer to match.':'Будем искать этот курс или лучше. Более строгие условия могут увеличить время поиска.'):(en?'We compare compatible requests and select the best rate available in the demo. You confirm the final amounts before exchanging.':'Сравним совместимые заявки и выберем лучший доступный курс в демо. Итоговые суммы вы подтвердите до обмена.')}</p>${manual?`<label class="pricing-input-row"><span>${fmtAmount(base)} ${composer.give.currency} =</span><input id="client-rate" class="input-field" type="text" inputmode="decimal" autocomplete="off" aria-label="${en?'My exchange rate':'Свой курс'}" value="${Number.isFinite(rate)?fmtRate(rate*base):''}" required><span>${composer.receive.currency}</span></label>`:''}</section>`;
}
function fillModeControl() {
  return `<section class="fill-choice" aria-label="Способ исполнения заявки"><div class="fill-choice-head"><div><strong>${composer.partial?'Можно частями':'Только целиком'}</strong></div><button type="button" id="partial-toggle" class="switch ${composer.partial?'on':''}" role="switch" aria-checked="${composer.partial}" aria-label="Разрешить обмен частями" aria-describedby="partial-hint" data-action="partial-toggle"></button></div><p id="partial-hint">Разрешите обмен частями: заявку смогут закрыть несколько участников. Так подходящий обмен может найтись быстрее.</p></section>`;
}
function flowTimeline(order) {
  const current={searching:0,matched:0,agreed:1,completed:2,cancelled:3}[order.status]??0;
  const labels=current===3?['Открыта','Отменена']:['Открыта','В процессе','Состоялась'];
  return `<ol class="deal-timeline" aria-label="Этапы сделки">${labels.map((label,index)=>{const selected=current===3?index===1:index===current;return `<li class="${selected?'current':index<current?'passed':''}" ${selected?'aria-current="step"':''}>${icon(selected?'clock':index<current?'check':'chevron',12)}${label}</li>`;}).join('')}</ol>`;
}
function partialNote(order) {
  const execution=orderExecution(order);
  const remaining=order.amount-execution.giveAmount;
  if(order.status==='matched'&&remaining>0.000001)return `<div class="part-note"><strong>Нашлась часть заявки</strong><p>Сейчас обменяете ${money(execution.giveAmount,order.give.currency)}. Остаток ${money(remaining,order.give.currency)} продолжит поиск после подтверждения условий.</p></div>`;
  if(order.partial&&['searching','matched'].includes(order.status))return '<p class="part-note">Можно частями. Каждый обмен подтверждается отдельно; остаток продолжает поиск.</p>';
  return '';
}
function relatedOrders(order) {
  const root=order.rootOrderId||order.id;
  const related=state.orders.filter(item=>item.id!==order.id&&item.owner===order.owner&&(item.rootOrderId||item.id)===root);
  if(!related.length)return '';
  return `<section class="related-orders"><h3>Другие части заявки</h3>${related.map(item=>`<button class="related-order" data-action="order" data-id="${esc(item.id)}"><span>${esc(shortId(item.id))} · ${money(item.amount,item.give.currency)}</span>${statusTag(item)}</button>`).join('')}</section>`;
}
const problemReasons=[['not-received','Средства не пришли'],['wrong-amount','Получена другая сумма'],['wrong-details','Проблема с реквизитами'],['other','Другая проблема']];
function openProblem(order) {
  return order.problem?.status==='open'?order.problem:state.orders.find(item=>item.id===order.matchedOrderId)?.problem?.status==='open'?state.orders.find(item=>item.id===order.matchedOrderId).problem:null;
}
function problemPanel(problem) {
  return `<section class="problem-panel"><strong>Сообщено о проблеме</strong><p>${esc(problemReasons.find(([key])=>key===problem.type)?.[1]||'Другая проблема')} · ${esc(shortId(problem.id))}</p><blockquote data-no-i18n>${esc(problem.comment)}</blockquote><p>Завершение сделки приостановлено. Обеспечение остаётся заблокированным, если оно было зарезервировано.</p><p class="inset-notice">Демо: обращение сохранено только в этом браузере. В поддержку оно не отправлено.</p></section>`;
}
function paymentPanel(order) {
  const sendSide=ui.mode==='provider'&&order.acceptedQuoteId?'receive':'give';
  const sides=sendSide==='give'?['give','receive']:['receive','give'];
  return `<section class="payment-panel"><h3>Реквизиты обмена</h3><p class="inset-notice">Доступны после согласования условий. На карточку для чата реквизиты не попадают.</p><div class="payment-grid">${sides.map(side=>{const end=order[side],saved=order.paymentDetails?.[side];return `<article class="payment-card"><span>${side===sendSide?'Куда отправляете':'Куда получаете'} · ${end.currency}</span><strong>${esc(endpointText(end))}</strong>${saved?`<dl>${paymentFields(end).filter(field=>saved.values[field.key]).map(field=>`<dt>${esc(field.label)}</dt><dd data-no-i18n>${esc(saved.values[field.key])}</dd>`).join('')}</dl>`:'<p class="inset-notice">Реквизиты ещё не указаны</p>'}${order.status==='agreed'?`<button class="text-button" data-action="payment" data-side="${side}" data-id="${esc(order.id)}">${saved?'Изменить демо-реквизиты':'Указать демо-реквизиты'} ${icon('chevron',13)}</button>`:''}</article>`;}).join('')}</div></section>`;
}
function paymentModal(order,side) {
  if(!order||!['give','receive'].includes(side))return '';
  const end=order[side],saved=order.paymentDetails?.[side]?.values||{};
  return modalShell('Реквизиты обмена',`${esc(endpointText(end))} · ${end.currency}`,`<div class="info-box"><strong>Используйте тестовые данные</strong>В демо принимаются только значения с префиксом DEMO-. Не вводите настоящие реквизиты. Кнопка ниже заполнит пример.</div><form id="payment-form" class="payment-form">${paymentFields(end).map(field=>`<label class="field-label" for="payment-${field.key}">${esc(field.label)}${field.required?'':' · Необязательно'}</label><input class="input-field" id="payment-${field.key}" name="payment-${field.key}" type="text" inputmode="${esc(field.inputMode||'text')}" maxlength="${field.maxLength||160}" autocomplete="off" placeholder="${esc(field.placeholder||'')}" value="${esc(saved[field.key]||'')}" ${field.required?'required':''}>`).join('')}<div class="button-row"><button class="outline-button" type="button" data-action="payment-example">Заполнить примером</button><button class="primary-button" type="submit">Сохранить реквизиты ${icon('check',15)}</button></div></form>`);
}
function problemModal(order) {
  return modalShell('Сообщить о проблеме',`${esc(shortId(order.id))} · ${order.give.currency} → ${order.receive.currency}`,`<p class="inset-notice">Опишите, что произошло. Не добавляйте паспортные данные, номера карт или пароли.</p><form id="problem-form" class="problem-form"><label class="field-label" for="problem-reason">Что случилось?</label><select class="select-field" id="problem-reason">${options(problemReasons,'not-received',item=>item[0],item=>item[1])}</select><label class="field-label" for="problem-comment">Описание проблемы</label><textarea class="input-field" id="problem-comment" minlength="10" maxlength="1000" required placeholder="Например: перевод отмечен выполненным, но средства ещё не поступили."></textarea><p class="inset-notice">Минимум 10 символов. Демо сохранит обращение в браузере и приостановит завершение сделки.</p><div class="button-row"><button type="button" class="outline-button" data-action="order" data-id="${esc(order.id)}">Вернуться к сделке</button><button class="primary-button" type="submit">Сохранить обращение</button></div></form>`);
}

function exchangePage() {
  return `${intro('Найдите прямой обмен','Задайте сумму, валюты и удобный способ расчёта.')}<div class="exchange-layout"><section class="card exchange-card" aria-label="Конструктор обмена"><div class="card-top"><h2>Новый обмен</h2><span class="card-label"><i class="online-dot"></i>Клиенты + провайдеры</span></div>${sharedComposerNote()}<form id="exchange-form">${endpointEditor(composer.give,'give')}<div class="swap-row"><button class="swap-button" type="button" data-action="swap" aria-label="Поменять направление обмена">${icon('exchange',16)}</button></div>${endpointEditor(composer.receive,'receive')}<div class="rate-row"><span>${icon('info',12)}<span id="reference-rate">${displayRate(referenceRate(composer.give.currency,composer.receive.currency),composer.give.currency,composer.receive.currency)}</span></span><span>Демонстрационный курс</span></div>${pricingControl()}${fillModeControl()}<button class="primary-button full" type="submit"><span>Найти обмен</span>${icon('arrow',17)}</button><div class="form-note">${icon('lock',11)}Реквизиты не нужны для создания заявки</div><div id="composer-error"></div></form></section><aside class="guide-column"><div class="guide-card"><h2>Ваша заявка.<br>Идеальное совпадение.</h2><p>Без поиска по чатам и бесконечного сравнения обменников.</p>${currencyPairArt(composer.give.currency,composer.receive.currency)}<ol class="steps"><li><span class="step-num">1</span><div><strong>Задайте условия</strong><p>Что, сколько и как хотите обменять.</p></div></li><li><span class="step-num">2</span><div><strong>Мы найдём совпадение</strong><p>Встречные заявки подбираются автоматически.</p></div></li><li><span class="step-num">3</span><div><strong>Подтвердите обмен</strong><p>Для наличных также предложат свою цену.</p></div></li></ol></div><div class="trust-card"><span class="trust-icon">${icon('shield',20)}</span><div><strong>Ваши данные — под контролем</strong><p>Проверка клиентов и провайдеров</p></div><button class="icon-button" data-action="kyc" aria-label="О проверке личности">${icon('chevron',14)}</button></div></aside></div><div class="section-head"><h2>Мои заявки <span class="count-inline">${activeOrders().length}</span></h2><button class="text-button" data-action="navigate" data-page="orders">Все заявки ${icon('arrow',13)}</button></div><div class="order-list">${activeOrders().slice(0,3).map(orderRow).join('')||empty('Пока нет активных заявок','Создайте первый обмен в форме выше.')}</div>`;
}
function ordersPage(history=false) {
  let orders=history?ownOrders():activeOrders();
  if(history&&ui.history!=='all') orders=orders.filter(o=>ui.history==='open'?['searching','matched'].includes(o.status):o.status===ui.history);
  return `${intro(history?'История сделок':'Ваши заявки',history?'Все заявки и сделки: от поиска до расчёта.':'Открытые заявки и обмены в процессе.',history?'ВСЁ ПОД РУКОЙ':'МОИ ОБМЕНЫ',`<button class="primary-button" data-action="new-order">${icon('plus',15)}Новый обмен</button>`)}${history?`<div class="history-tabs">${[['all','Все'],['open','Открыта'],['agreed','В процессе'],['completed','Состоялась'],['cancelled','Отменена']].map(([id,label])=>`<button class="history-tab ${ui.history===id?'active':''}" data-action="history-filter" data-value="${id}">${label}</button>`).join('')}</div>`:''}<div class="order-list">${orders.map(orderRow).join('')||empty(history?'История пока пуста':'Активных заявок пока нет',history?'Здесь появятся ваши заявки и сделки.':'Создайте заявку — мы подберём встречный обмен.','new-order','Создать заявку')}</div>`;
}
function providerOrders() {
  return state.orders.filter(o=>o.give.currency!==o.receive.currency&&o.status==='searching'&&(o.give.method==='cash'||o.receive.method==='cash')).filter(o=>ui.filterCurrency==='all'||o.give.currency===ui.filterCurrency||o.receive.currency===ui.filterCurrency).filter(o=>ui.filterCity==='all'||o.give.city===ui.filterCity||o.receive.city===ui.filterCity).filter(o=>!ui.onlyCompatible||state.directions.some(d=>isDirectionCompatible(d,o))).filter(o=>!ui.filterMin||o.amount>=parseAmount(ui.filterMin)).filter(o=>!ui.filterMax||o.amount<=parseAmount(ui.filterMax));
}
function requestCard(order) {
  const compatible=state.directions.some(d=>isDirectionCompatible(d,order));
  const quote=validQuotes(order).at(-1);
  return `<article class="card request-card"><div class="request-heading"><span class="request-id">${esc(shortId(order.id))} ${order.owner==='me'?'· Ваша клиентская заявка':''}</span><span class="chip">${icon('clock',11)}${quote?'Есть ваш отклик':'Новая заявка'}</span></div><div class="request-amounts"><div class="request-side"><div class="field-label">Клиент отдаёт</div><strong>${money(order.amount,order.give.currency)}</strong><p>${esc(endpointText(order.give))}</p></div>${icon('arrow',19)}<div class="request-side"><div class="field-label">Хочет получить от</div><strong>${money(order.minReceive,order.receive.currency)}</strong><p>${esc(endpointText(order.receive))}</p></div></div>${cashLocations(order)}<div class="request-chips"><span class="chip">${icon('pin',12)}${esc(order.receive.city||order.give.city)}</span><span class="chip">${icon('cash',12)}Обмен с наличными</span><span class="chip">${order.partial?'Можно частями':'Только целиком'}</span></div><button class="primary-button ${compatible?'':'dark-button'}" data-action="${compatible?'quote':'setup-direction'}" data-id="${esc(order.id)}">${compatible?(quote?'Обновить предложение':'Предложить свою цену'):'Добавить подходящее направление'}${icon('arrow',14)}</button>${quote?`<p class="quote-history-note">Вы предложили ${money(quote.amount,order.receive.currency)} · до ${time(quote.expiresAt)}</p>`:''}</article>`;
}
function time(timestamp) {return formatTime(timestamp,language());}
function notificationMessage(notice) {
  return notice.message.replace(/([0-9][0-9\s\u00a0\u202f]*(?:,\d+)?) ([A-Z]{3,4})(?=[.\s]|$)/g,(_,amount,code)=>`${fmtAmount(parseNumber(amount,'ru'))} ${code}`);
}
function feedPage() {
  const orders=providerOrders();
  const active=state.directions.filter(d=>d.active).length;
  const quotes=state.orders.flatMap(o=>validQuotes(o)).length;
  return `${intro('Хороший обмен начинается здесь.','Подходящие заявки уже у вас. Предложите клиенту свои условия.','КАБИНЕТ ПРОВАЙДЕРА')}<div class="stats-strip"><div class="card stat-card"><p>Подходящих заявок</p><strong>${state.orders.filter(o=>state.directions.some(d=>isDirectionCompatible(d,o))).length}</strong><small>По активным направлениям</small></div><div class="card stat-card"><p>Активных направлений</p><strong>${active.toString().padStart(2,'0')}</strong><small>Наличные, банки и крипта</small></div><div class="card stat-card"><p>Предложений в ожидании</p><strong>${quotes.toString().padStart(2,'0')}</strong><small>Цена действует 5 минут</small></div></div><div class="card filters"><div class="filter-field"><label for="filter-currency">Валюта заявки</label><select class="select-field" id="filter-currency" data-filter="filterCurrency"><option value="all">Все валюты</option>${options(CURRENCIES,ui.filterCurrency,c=>c.code,c=>c.code)}</select></div><div class="filter-field"><label for="filter-city">Город наличных</label><select class="select-field" id="filter-city" data-filter="filterCity"><option value="all">Все города</option>${options(CITIES,ui.filterCity)}</select></div><div class="filter-field"><label for="filter-min">Клиент отдаёт, от</label><input class="input-field" id="filter-min" inputmode="decimal" placeholder="Любая сумма" data-filter="filterMin" value="${esc(ui.filterMin)}"></div><div class="filter-field"><label for="filter-max">До</label><input class="input-field" id="filter-max" inputmode="decimal" placeholder="Без лимита" data-filter="filterMax" value="${esc(ui.filterMax)}"></div><label class="filter-toggle"><input type="checkbox" data-filter="onlyCompatible" ${ui.onlyCompatible?'checked':''}>Мои направления</label></div><div class="provider-summary">${icon('info',13)}Суммы фильтра — в отдаваемой клиентом валюте. Имя провайдера скрыто до оформления.</div><div class="section-head"><h2>Входящие заявки <span class="count-inline">${orders.length}</span></h2><button class="text-button" data-action="reset-filters">Сбросить фильтры</button></div><div class="feed-grid">${orders.map(requestCard).join('')}</div>${orders.length?'':empty('Подходящих заявок пока нет','Измените фильтры или добавьте новое направление, чтобы получать больше заявок.','add-direction','Добавить направление')}`;
}
function directionsPage() {
  return `${intro('Каждому направлению — свои условия.','Укажите, что готовы отдать, что принять и в каком объёме.','МОЯ ЛИКВИДНОСТЬ',`<button class="primary-button" data-action="add-direction">${icon('plus',15)}Добавить</button>`)}<div class="info-box"><strong>Вы управляете предложением. Мы подбираем заявки.</strong>Активные направления определяют входящие запросы. Цена устанавливается в отклике на конкретную заявку; остаток уменьшается после принятия предложения.</div>${vaultSummaryCard(state,vaultHelpers())}<div class="section-head"><h2>Пулы ликвидности <span class="count-inline">${state.directions.length}</span></h2></div><div class="pool-grid">${state.directions.map((d,index)=>`<article class="card pool-card ${d.active?'':'is-paused'}" aria-label="${esc(t('Пул'))} ${index+1}: ${d.give.currency} → ${d.receive.currency}"><div class="pool-header"><span class="pool-number">Пул · ${String(index+1).padStart(2,'0')}</span><span class="pool-status ${d.active?'is-active':''}"><i></i>${d.active?'Активен':'На паузе'}</span><button class="switch ${d.active?'on':''}" role="switch" aria-checked="${d.active}" aria-label="${d.active?'Приостановить':'Включить'} направление ${d.give.currency} → ${d.receive.currency} · Пул ${index+1}" data-action="toggle-direction" data-id="${esc(d.id)}" ${d.invalidReason==='same-currency'?'disabled':''}></button></div>${currencyPairArt(d.give.currency,d.receive.currency,{compact:true})}<div class="pool-endpoints"><p>${icon(d.give.method,13)}<span>${esc(endpointText(d.give))}</span></p><p>${icon(d.receive.method,13)}<span>${esc(endpointText(d.receive))}</span></p></div>${cashLocations(d)}${d.invalidReason==='same-currency'?'<p class="pool-invalid-note">Выберите разные валюты: создайте новый пул с другим активом.</p>':''}<div class="pool-balance"><span>Доступно в пуле</span><strong>${fmtAmount(d.available,d.give.currency)} <small>${d.give.currency}</small></strong></div><div class="pool-limits"><span>Лимит одной сделки</span><strong>${fmtAmount(d.min,d.give.currency)} – ${fmtAmount(d.max,d.give.currency)} ${d.give.currency}</strong></div></article>`).join('')}</div><p class="inset-notice">В демо остатки заданы отдельно для каждого направления. Это не банковские балансы и не подтверждённые резервы.</p>`;
}
function responsesPage() {
  const orders=state.orders.filter(o=>o.quotes.length);
  return `${intro('Ваши предложения','Следите за откликами, сроком действия цены и принятыми условиями.','КАБИНЕТ ПРОВАЙДЕРА')}<div class="order-list">${orders.map(o=>`<article class="card request-card"><div class="request-heading"><span class="request-id">${esc(shortId(o.id))} · ${o.give.currency} → ${o.receive.currency}</span>${statusTag(o)}</div>${o.quotes.map(q=>`<div class="quote-row"><div><strong>${money(q.amount,o.receive.currency)}</strong><p>${q.status==='accepted'?'Предложение принято':q.status==='declined'?'Закрыто':q.expiresAt<=Date.now()?'Срок цены истёк':`Ожидает ответа · до ${time(q.expiresAt)}`}</p></div>${q.status==='pending'&&q.expiresAt>Date.now()?icon('clock',18):icon(q.status==='accepted'?'check':'close',18)}</div>`).join('')}${o.acceptedQuoteId&&['agreed','completed'].includes(o.status)?settlementPanel(o,'provider'):''}${o.status==='searching'?`<button class="outline-button" data-action="quote" data-id="${esc(o.id)}">Предложить новую цену</button>`:''}</article>`).join('')||empty('Вы ещё не отправляли предложений','Выберите подходящую заявку и предложите сумму, которую получит клиент.','open-feed','Перейти к заявкам')}</div>`;
}
function settlementPanel(order,actor) {
  if(order.status==='completed') return `<div class="info-box success"><strong>Сделка состоялась</strong>Исполнение подтверждено. Сделка учтена в истории.</div>`;
  const providerTrade=Boolean(order.acceptedQuoteId),problem=openProblem(order);
  const sent=Boolean(order.settlement?.providerSentAt),received=Boolean(order.settlement?.clientReceivedAt);
  return `<div class="settlement-panel"><h3>Исполнение обмена</h3>${providerTrade?`<div class="settlement-step ${sent?'done':''}">${icon(sent?'check':'clock',16)}${sent?'Провайдер подтвердил перевод':'Ждём перевод провайдера'}</div><div class="settlement-step ${received?'done':''}">${icon(received?'check':'clock',16)}${received?'Клиент подтвердил получение':'Ждём подтверждение клиента'}</div>`:'<p>Прямой обмен между клиентами · комиссия Handshake 0%</p>'}<p class="inset-notice">Подтверждайте только выполненный перевод или полученные средства. В прототипе это демонстрация этапов сделки.</p>${problem?problemPanel(problem):`<div class="settlement-actions">${actor==='provider'&&!sent&&providerTrade?`<button class="primary-button" data-action="confirm-settlement" data-actor="provider" data-id="${esc(order.id)}">Перевод выполнен ${icon('check',15)}</button>`:actor==='client'&&!received?`<button class="primary-button" data-action="confirm-settlement" data-actor="client" data-id="${esc(order.id)}">Подтвердить получение ${icon('check',15)}</button>`:''}<button class="outline-button" data-action="report-problem" data-id="${esc(order.id)}">${icon('help',15)}Сообщить о проблеме</button></div>`}${ui.modal?.type==='order'?'':`<button class="text-button" data-action="order" data-id="${esc(order.id)}">Реквизиты и детали ${icon('chevron',13)}</button>`}</div>`;
}
function statisticsPage() {
  const m=providerMetrics(state);
  const deals=state.orders.filter(o=>o.acceptedQuoteId&&['agreed','completed'].includes(o.status)).sort((a,b)=>(b.completedAt||b.agreedAt)-(a.completedAt||a.agreedAt));
  return `${intro('Сделки, которые приносят доход.','Завершённые обмены, заработок и обеспечение — в одном месте.','СДЕЛКИ И ДОХОД')}<div class="metrics-grid"><article class="card metric-card"><span>Завершено сделок</span><strong>${fmt(m.completedCount)}</strong><small>За всё время</small></article><article class="card metric-card metric-highlight"><span>Заработано</span><strong>${fmtAmount(m.earnedUSDT,'USDT')} <small>USDT</small></strong><small>По завершённым сделкам</small></article><article class="card metric-card"><span>Сделок в расчёте</span><strong>${fmt(m.activeCount)}</strong><small>Ожидают двух подтверждений</small></article><article class="card metric-card"><span>Ожидаемый доход</span><strong>${fmtAmount(m.pendingIncomeUSDT,'USDT')} <small>USDT</small></strong><small>После завершения расчётов</small></article></div><section class="card collateral-card"><div><span class="eyebrow">ОБЕСПЕЧЕНИЕ ПРОВАЙДЕРА</span><h2>${fmtAmount(m.collateralTotalUSDT,'USDT')} <span class="subtle">USDT</span></h2><p>Обеспечение ограничивает объём незавершённых сделок.</p><button class="text-button" data-action="terms">Как работает защита ${icon('arrow',13)}</button></div><div class="collateral-detail"><div><span>Заблокировано</span><strong>${fmtAmount(m.collateralReservedUSDT,'USDT')} USDT</strong></div><div class="collateral-bar" role="meter" aria-label="Заблокированное обеспечение" aria-valuemin="0" aria-valuemax="${m.collateralTotalUSDT}" aria-valuenow="${m.collateralReservedUSDT}"><i style="width:${Math.min(100,m.collateralReservedUSDT/Math.max(1,m.collateralTotalUSDT)*100)}%"></i></div><div class="collateral-vault-note" data-no-i18n><span>${language()==='en'?'Locked in vault':'Заблокировано в vault'}</span><strong>${fmtAmount(m.collateralVaultLockedUSDT,'USDT')} USDT</strong></div><div><span>Доступно для новых сделок</span><strong>${fmtAmount(m.collateralAvailableUSDT,'USDT')} USDT</strong></div></div></section><p class="inset-notice">Доход указывает провайдер при отклике. Он уже включён в цену и не равен обороту. Обеспечение и расчёты в демо условные.</p><div class="section-head"><h2>История сделок <span class="count-inline">${deals.length}</span></h2><span class="card-label">За всё время</span></div><div class="deals-list">${deals.map(order=>{const quote=order.quotes.find(q=>q.id===order.acceptedQuoteId);return `<article class="card deal-card"><div class="request-heading"><span class="request-id">${esc(shortId(order.id))} · ${new Intl.DateTimeFormat(language(),{day:'numeric',month:'short'}).format(new Date(order.completedAt||order.agreedAt))}</span>${statusTag(order)}</div><div class="deal-main"><div><strong>${money(order.amount,order.give.currency)} → ${money(quote.amount,order.receive.currency)}</strong><p>${esc(endpointText(order.give))} → ${esc(endpointText(order.receive))}</p>${cashLocations(order)}</div><div class="deal-income"><small>${order.status==='completed'?'Заработано':'Ожидаемый доход'}</small><strong>+${fmtAmount(quote.incomeUSDT||0,'USDT')} USDT</strong></div></div>${order.status==='agreed'?settlementPanel(order,'provider'):''}</article>`;}).join('')||empty('Пока нет согласованных сделок','Принятые клиентами предложения появятся здесь.','open-feed','Перейти к заявкам')}</div>`;
}
const fmtRate=value=>Number.isFinite(value)?new Intl.NumberFormat(language(),{maximumFractionDigits:8,useGrouping:false}).format(value):'';
function quoteModal(order) {
  const isRate=quoteDraft.inputMode==='rate';
  const giveAmount=quoteDraft.giveAmount??order.amount;
  if(isRate&&Number.isFinite(quoteDraft.rate)){quoteDraft.rate=Number(quoteDraft.rate.toFixed(8));const scale=['USDT','USDC'].includes(order.receive.currency)?1e6:100;quoteDraft.amount=Math.round(giveAmount*quoteDraft.rate*scale)/scale;}
  return modalShell('Предложить свою цену',`Заявка ${esc(shortId(order.id))} · клиент не увидит ваш профиль`,`${pairDetail(order)}<form id="quote-form">${order.partial?`<label class="field-label" for="quote-give">Часть заявки, ${order.give.currency}</label><input class="input-field" id="quote-give" inputmode="decimal" value="${fmtAmount(giveAmount,order.give.currency)}" required><p class="partial-quote-note">Можно предложить обмен на часть суммы. Остаток продолжит поиск.</p>`:''}<div class="quote-mode" role="group" aria-label="Способ задания цены">${[['amount','Итоговая сумма'],['rate','Курс обмена']].map(([mode,label])=>`<button type="button" data-action="quote-mode" data-mode="${mode}" aria-pressed="${quoteDraft.inputMode===mode}" class="${quoteDraft.inputMode===mode?'active':''}">${label}</button>`).join('')}</div><label class="field-label" for="quote-value">${isRate?`Курс: 1 ${order.give.currency} = … ${order.receive.currency}`:`Клиент получит, ${order.receive.currency}`}</label><input class="input-field quote-value" id="quote-value" inputmode="decimal" value="${isRate?fmtRate(quoteDraft.rate):fmtAmount(quoteDraft.amount,order.receive.currency)}" required><div class="quote-calculation" id="quote-calculation" aria-live="polite">${quoteSummary(order)}</div><label class="field-label" for="quote-income">Ваш доход, USDT</label><input class="input-field" id="quote-income" inputmode="decimal" value="${fmtAmount(quoteDraft.incomeUSDT,'USDT')}" required><p class="inset-notice">Включён в итоговую цену. Используется только для вашей статистики и не виден клиенту.</p><div class="info-box"><strong>Цена действует 5 минут</strong>Укажите итоговую сумму с учётом всех ваших комиссий. Объём и обеспечение резервируются после принятия клиентом.</div><button class="primary-button" type="submit">Отправить предложение ${icon('arrow',15)}</button></form>`);
}
function quoteSummary(order) {return `<span>${t('Клиент получит')}</span><strong>${Number.isFinite(quoteDraft.amount)?money(quoteDraft.amount,order.receive.currency):'—'}</strong><small>${t('Клиент отдаст')}: ${Number.isFinite(quoteDraft.giveAmount)?money(quoteDraft.giveAmount,order.give.currency):'—'} · ${displayRate(quoteDraft.rate,order.give.currency,order.receive.currency)}</small>`;}
function updateQuoteSummary(order) {const el=$('#quote-calculation');if(el)el.innerHTML=quoteSummary(order);}
function shareModal(order) {
  shareDraft.url=buildRequestLink(order,{includeAddress:shareDraft.includeAddress});
  shareDraft.qr=createQRCode(shareDraft.url);
  shareDraft.hasAddress=[order.give,order.receive].some(end=>end.method==='cash'&&end.address);
  const view=shareDialog(parseRequestLink(shareDraft.url),shareDraft,sharingHelpers());
  return modalShell(view.title,view.subtitle,view.body,true);
}
async function refreshShareCard() {
  const generation=++shareGeneration,id=ui.modal?.id;
  if(ui.modal?.type!=='share')return;
  try {const card=await createOrderCard(state.orders.find(o=>o.id===id),{language:language(),includeAddress:shareDraft.includeAddress,requestUrl:shareDraft.url});if(generation!==shareGeneration||ui.modal?.type!=='share'||ui.modal.id!==id)return;shareDraft.card=card;renderModal();}
  catch(error){if(generation===shareGeneration&&ui.modal?.type==='share')modalError(error);}
}
async function copyRequestLink() {
  try{await navigator.clipboard.writeText(shareDraft.url);toast('Ссылка скопирована');}
  catch{$('#request-link')?.select();toast('Скопируйте ссылку из поля выше.',true);}
}
async function nativeShareLink() {
  if(!navigator.share)return copyRequestLink();
  try{await navigator.share({title:'Handshake',url:shareDraft.url});}catch(error){if(error.name!=='AbortError')copyRequestLink();}
}
function localSharedOrder() {return state.orders.find(order=>order.owner==='me'&&(order.id===ui.sharedRequest?.id||order.replyToRequestId===ui.sharedRequest?.id));}
function readSharedRoute() {
  if(location.hash.startsWith('#/exchange/')){ui.sharedRequest=parseRequestLink(location.hash);ui.page='shared';ui.mode='client';ui.mobile=false;closeModal();}
  else if(ui.page==='shared')ui.page='home';
}
window.addEventListener('hashchange',()=>{readSharedRoute();render();window.scrollTo({top:0});});
function syncSidebar() { const sidebar=$('.sidebar'); if(sidebar) sidebar.inert=window.innerWidth<=700&&!ui.mobile; }
window.addEventListener('resize',syncSidebar);
let stopCityRotation = () => {};
let stopCurrencyOrbits = () => {};
function render() {
  stopCityRotation();
  stopCurrencyOrbits();
  const content=ui.page==='access'?renderAccessPage(access,{language:language(),role:ui.mode,icon,esc,error:accessError}):ui.page==='shared'?sharedRequestPage(ui.sharedRequest,sharingHelpers(),localSharedOrder()):ui.page==='vault'?vaultPage(state,vaultHelpers()):ui.page==='home'?homePage(language()):ui.page==='exchange'?exchangePage():ui.page==='orders'?ordersPage():ui.page==='history'?ordersPage(true):ui.page==='feed'?feedPage():ui.page==='directions'?directionsPage():ui.page==='statistics'?statisticsPage():responsesPage();
  $('#app').innerHTML=`${sidebar()}<div class="workspace">${header()}<main class="content">${content}<footer class="page-footer"><span>${icon('lock',10)}Демо: данные хранятся только в этом браузере</span><span>Сделки и курсы демонстрационные</span><button data-action="terms">Как работает Handshake ${icon('arrow',10)}</button></footer></main></div>`;
  localize($('#app'),language());
  stopCityRotation=startCityRotation($('#app'));
  stopCurrencyOrbits=startCurrencyOrbits($('#app'));
  document.title=t('Handshake — обмен по вашим правилам');
  document.querySelector('meta[name=description]').content=t('Handshake — обмен по вашим правилам. Создайте заявку, найдите встречный обмен или получите предложение наличных.');
  fitAmounts();
  syncSidebar();
  $('#app').inert=Boolean(ui.modal);
}
function modalShell(title,subtitle,body,wide=false) { return `<div class="modal-backdrop" data-action="backdrop"><section class="modal ${wide?'wide':''}" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div class="modal-head"><div><h2 id="modal-title">${title}</h2>${subtitle?`<p>${subtitle}</p>`:''}</div><button class="icon-button" data-action="close-modal" aria-label="Закрыть">${icon('close',19)}</button></div>${body}<div id="modal-error"></div></section></div>`; }
function pairDetail(order) { const execution=orderExecution(order); return `<div class="detail-pair"><div><strong>${fmtAmount(execution.giveAmount,order.give.currency)} <small>${order.give.currency}</small></strong><p>${esc(endpointText(order.give))}</p></div>${icon('arrow',19)}<div><strong>${fmtAmount(execution.receiveAmount,order.receive.currency)} <small>${order.receive.currency}</small></strong><p>${esc(endpointText(order.receive))}</p></div></div>${cashLocations(order)}`; }
function orderModal(order) {
  let body=pairDetail(order)+statusTag(order)+flowTimeline(order)+partialNote(order);
  if(order.status==='matched') body+=`<div class="info-box success"><strong>Встречная заявка найдена автоматически</strong>Совпали валюты, суммы и способы расчёта. Встречная заявка зарезервирована за вами. Провайдер в этом обмене не участвует.</div><button class="primary-button" data-action="accept-match" data-id="${esc(order.id)}">Подтвердить условия ${icon('check',15)}</button>`;
  if(order.status==='searching') {
    body+=`<div class="info-box"><strong>Ищем встречную заявку</strong>${order.give.method==='cash'||order.receive.method==='cash'?'Провайдеры наличных также могут предложить свою цену. Вы увидите итоговую сумму без каталога обменников.':'Подберём заявку другого клиента с обратным направлением и совместимыми условиями.'}</div>`;
    const quotes=order.quotes.filter(q=>q.status==='pending').sort((a,b)=>b.amount/(b.giveAmount||order.amount)-a.amount/(a.giveAmount||order.amount));
    if(quotes.length) body+=`<h3>Предложения наличных</h3>${quotes.map(q=>`<div class="quote-row"><div><strong>${money(q.giveAmount||order.amount,order.give.currency)} → ${money(q.amount,order.receive.currency)}</strong><p>${q.expiresAt>Date.now()?`Цена до ${time(q.expiresAt)} · итоговая сумма`:'Срок действия истёк'}</p></div><button class="primary-button" data-action="accept-quote" data-id="${esc(order.id)}" data-quote-id="${esc(q.id)}" ${q.expiresAt<=Date.now()?'disabled':''}>Выбрать</button></div>`).join('')}`;
    else body+=`<p class="inset-notice">${order.give.method==='cash'||order.receive.method==='cash'?'Чтобы проверить отклик, переключитесь в кабинет провайдера и найдите эту заявку.':'Новые совпадения появятся при добавлении совместимой заявки в демо.'}</p>`;
  }
  if(['agreed','completed'].includes(order.status)) body+=paymentPanel(order)+settlementPanel(order,ui.mode==='provider'&&order.acceptedQuoteId?'provider':'client');
  body+=relatedOrders(order);
  if(order.status==='cancelled') body+='<div class="info-box">Поиск по этой заявке остановлен. Вы можете создать новый обмен с другими условиями.</div>';
  if(['searching','matched'].includes(order.status)) body+=`<div class="button-row"><button class="outline-button" data-action="close-modal">Вернуться к заявкам</button><button class="outline-button danger-button" data-action="cancel-confirm" data-id="${esc(order.id)}">Отменить заявку</button></div>`;
  body+=`<button class="outline-button share-order-button" data-action="share-order" data-id="${esc(order.id)}">${icon('arrow',15)}Поделиться заявкой</button>`;
  return modalShell('Заявка на обмен',esc(shortId(order.id)),body);
}
function renderModal() {
  if(!ui.modal) { $('#overlay-root').innerHTML=''; document.body.style.overflow=''; $('#app').inert=false; return; }
  $('#app').inert=true;
  const {type,id}=ui.modal;
  let html='';
  if(type==='order') { const order=state.orders.find(o=>o.id===id); if(!order) return closeModal(); html=orderModal(order); }
  if(type==='quote') html=quoteModal(state.orders.find(o=>o.id===id));
  if(type==='payment') html=paymentModal(state.orders.find(o=>o.id===id),ui.modal.side);
  if(type==='problem') html=problemModal(state.orders.find(o=>o.id===id));
  if(type==='share') html=shareModal(state.orders.find(o=>o.id===id));
  if(type==='direction') html=modalShell('Новое направление','Настройте условия, чтобы получать подходящие заявки.',`<form id="direction-form">${endpointEditor(directionDraft.give,'give','direction')}${endpointEditor(directionDraft.receive,'receive','direction')}<div class="form-grid"><div><label class="field-label" for="direction-min">Минимум, ${directionDraft.give.currency}</label><input class="input-field" id="direction-min" name="min" inputmode="decimal" data-draft-field="min" value="${fmtAmount(directionDraft.min)}" required></div><div><label class="field-label" for="direction-max">Максимум, ${directionDraft.give.currency}</label><input class="input-field" id="direction-max" name="max" inputmode="decimal" data-draft-field="max" value="${fmtAmount(directionDraft.max)}" required></div><div class="span-2"><label class="field-label" for="direction-available">Доступный объём, ${directionDraft.give.currency}</label><input class="input-field" id="direction-available" name="available" inputmode="decimal" data-draft-field="available" value="${fmtAmount(directionDraft.available)}" required></div></div><p class="inset-notice">Хотя бы одна сторона — наличные. Суммы лимитов задаются в валюте, которую отдаёт провайдер.</p><button class="primary-button" type="submit">Добавить направление ${icon('plus',15)}</button></form>`);
  if(type==='notifications') {
    const notices=state.notifications.filter(n=>!n.orderId||state.orders.some(o=>o.id===n.orderId&&o.owner==='me'));
    html=modalShell('Уведомления','Совпадения, предложения и изменения ваших заявок.',notices.length?notices.slice(0,20).map(n=>`<button class="notification-item" data-action="notification-order" data-id="${esc(n.orderId||'')}">${icon(n.type==='quote'?'cash':n.type==='match'?'spark':'bell',18)}<span><strong>${esc(n.title)}</strong><p>${esc(notificationMessage(n))}</p><p>${time(n.createdAt)}</p></span></button>`).join(''):empty('Всё спокойно','Здесь появятся уведомления о ваших обменах.'));
  }
  if(type==='kyc') html=modalShell('Проверка личности','Клиенты и провайдеры проходят KYC.',serviceContent('kyc'));
  if(type==='language'||type==='theme')html=modalShell(type==='language'?t('Язык интерфейса'):t('Оформление'),'',preferenceChoices(type));
  if(type==='vault'){const view=vaultModal(state,ui.modal,vaultHelpers());html=modalShell(view.title,view.subtitle,view.body);}
  if(type==='profile') html=modalShell('Мой профиль','Демонстрационный аккаунт',`<div class="trust-card"><span class="avatar" aria-hidden="true">${icon('user',24)}</span><div><strong data-no-i18n>${esc(accessSummary(access).alias||'Demo')}</strong><p>Роль: ${ui.mode==='client'?'клиент':'провайдер наличных'}</p></div></div><p class="access-profile-status" data-no-i18n>${esc(accessStatusLabel(access,language()))}</p><div class="info-box">Данные сохраняются локально в этом браузере. Между устройствами и аккаунтами они не синхронизируются.</div><div class="button-row"><button class="outline-button" data-action="kyc">${icon('shield',15)}${language()==='en'?'Verification status':'Статус проверки'}</button><button class="outline-button" data-action="notifications">${icon('bell',15)}Уведомления</button><button class="outline-button" data-action="reset-confirm">Начать демо заново</button></div>`);
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
function navigate(page) {closeModal();if(!['home','shared','access'].includes(page)&&!canTrade(access)){ui.accessReturn={page,mode:ui.mode};page='access';}accessError='';if(location.hash.startsWith('#/exchange/'))history.replaceState(null,'',location.pathname+location.search);if(page==='home')ui.mode='client';ui.page=page;ui.mobile=false;render();window.scrollTo({top:0,behavior:'smooth'});}
function modalError(error) {const target=$('#modal-error');if(target)target.innerHTML=`<div class="error-message" role="alert">${esc(t(error.message||error))}</div>`;else toast(error.message||error,true);}
function newDirection(order) { directionDraft=order?{give:{...order.receive},receive:{...order.give},min:Math.max(1,Math.floor(order.minReceive/2)),max:Math.ceil(order.minReceive*2),available:Math.ceil(order.minReceive*5)}:{give:{currency:'AMD',method:'cash',city:ui.location},receive:{currency:'USDT',method:'crypto',network:'TRC20'},min:100000,max:3000000,available:5000000};openModal('direction'); }
function recomputeComposer(resetRate=false) {
  if(composer.sharedRequest){composer.minReceive=composer.amount*composer.sharedRequest.amount/composer.sharedRequest.minReceive;return;}
  const reference=referenceRate(composer.give.currency,composer.receive.currency);
  if(resetRate){composer.rateBase=rateDisplay(reference).base;composer.manualRate=Number((reference*composer.rateBase).toFixed(2))/composer.rateBase;}
  try{const price=calculateClientPricing({...composer,minReceive:undefined},{referenceRate:reference});composer.minReceive=price.minReceive;}
  catch{composer.minReceive=NaN;}
}
document.addEventListener('click',event=>{
  const el=event.target.closest('[data-action]');if(!el)return;
  const action=el.dataset.action,id=el.dataset.id;
  if(el.tagName==='A') event.preventDefault();
  try {
    if(action==='access-demo-invite'){const input=$('[name=invite]');if(input){input.value='HANDSHAKE-DEMO';input.focus();}return;}
    if(action==='access-submit-review'){access=submitVerification(access);persistAccess();refreshAccess();return;}
    if(action==='access-demo-review'){access=demoReview(access,el.dataset.result);persistAccess();refreshAccess();return;}
    if(action==='access-restart-verification'){access=restartVerification(access);accessError='';persistAccess();refreshAccess();return;}
    if(action==='access-continue'){if(!canTrade(access))return;const next=ui.accessReturn;ui.mode=next?.mode||accessSummary(access).role;delete ui.accessReturn;navigate(next?.page||(ui.mode==='provider'?'feed':'exchange'));return;}
    if(action==='kyc-info'){openModal('kyc');return;}
    if(action==='kyc'||(action==='profile'&&!accessSummary(access).registered)){navigate('access');return;}
    const gatedActions=['quote','payment','report-problem','confirm-settlement','accept-match','accept-quote','cancel-order','toggle-direction','add-direction','setup-direction','vault-enable-review','vault-disable-review','vault-withdraw-review','vault-confirm-withdrawal-review','vault-enable-confirm','vault-disable-confirm','vault-deposit-confirm','vault-withdraw-confirm','vault-confirm-withdrawal'];
    if(gatedActions.includes(action)&&!canTrade(access)){navigate(ui.mode==='provider'?'feed':'exchange');return;}
    if(action==='navigate')navigate(el.dataset.page);
    else if(action==='home')navigate('home');
    else if(action==='new-order'){if(composer.sharedRequest){delete composer.sharedRequest;composer.pricingMode='auto';delete composer.manualRate;recomputeComposer();}ui.mode='client';navigate('exchange');$('#give-amount')?.focus();}
    else if(action==='open-feed'){ui.mode='provider';navigate('feed');}
    else if(action==='menu'){ui.mobile=!ui.mobile;render();}
    else if(action==='mode'){ui.mode=ui.mode==='client'?'provider':'client';navigate(ui.mode==='client'?'exchange':'feed');}
    else if(action==='method'){
      const draft=el.dataset.scope==='direction'?directionDraft:composer;
      const previousPair=draft.give.currency+'/'+draft.receive.currency;
      updateEndpoint(draft,el.dataset.side,'method',el.dataset.method,ui.location);
      if(el.dataset.scope==='direction')renderModal();else{recomputeComposer(previousPair!==draft.give.currency+'/'+draft.receive.currency);render();}
    }
    else if(action==='swap'){if(!Number.isFinite(composer.amount)||composer.amount<=0||!Number.isFinite(composer.minReceive)||composer.minReceive<=0||(composer.pricingMode==='manual'&&(!Number.isFinite(composer.manualRate)||composer.manualRate<=0)))throw new Error(language()==='en'?'Enter a positive amount and rate before swapping.':'Перед сменой направления укажите положительную сумму и курс.');delete composer.sharedRequest;[composer.give,composer.receive]=[composer.receive,composer.give];[composer.amount,composer.minReceive]=[composer.minReceive,composer.amount];composer.manualRate=Number.isFinite(composer.manualRate)&&composer.manualRate>0?1/composer.manualRate:referenceRate(composer.give.currency,composer.receive.currency);composer.rateBase=rateDisplay(composer.manualRate).base;recomputeComposer();render();}
    else if(action==='pricing-toggle'){composer.pricingMode=composer.pricingMode==='manual'?'auto':'manual';if(composer.pricingMode==='manual'){const rate=Number.isFinite(composer.manualRate)&&composer.manualRate>0?composer.manualRate:referenceRate(composer.give.currency,composer.receive.currency);composer.rateBase=rateDisplay(rate).base;if(!Number.isFinite(composer.manualRate)||composer.manualRate<=0)composer.manualRate=Number((rate*composer.rateBase).toFixed(2))/composer.rateBase;}recomputeComposer();render();$('[data-action=pricing-toggle]')?.focus();}
    else if(action==='order'||action==='cancel-confirm')openModal(action,id);
    else if(action==='quote'){const order=state.orders.find(o=>o.id===id);const previous=validQuotes(order).at(-1);quoteDraft={giveAmount:previous?.giveAmount||order.amount,inputMode:previous?.inputMode||'amount',amount:previous?.amount||order.minReceive,rate:previous?.rate||order.minReceive/order.amount,incomeUSDT:previous?.incomeUSDT||0};openModal('quote',id);}
    else if(action==='partial-toggle'){composer.partial=!composer.partial;render();$('#partial-toggle')?.focus();if(composer.partial)toast('Частичный обмен включён: заявку могут закрыть несколько участников.');}
    else if(action==='payment'){focusReturn=document.activeElement;ui.modal={type:'payment',id,side:el.dataset.side};renderModal();queueMicrotask(()=>$('.modal .icon-button')?.focus());}
    else if(action==='payment-example'){const order=state.orders.find(o=>o.id===ui.modal.id);const values=createDemoPaymentDetails(order[ui.modal.side]);for(const [key,value] of Object.entries(values))document.querySelector(`[name="payment-${key}"]`).value=value;}
    else if(action==='report-problem')openModal('problem',id);
    else if(action==='quote-mode'){quoteDraft.inputMode=el.dataset.mode;renderModal();}
    else if(action==='confirm-settlement'){confirmSettlement(state,id,el.dataset.actor);persist();render();renderModal();toast('Подтверждение сохранено');}
    else if(action==='share-order'){shareDraft={includeAddress:false,card:null};openModal('share',id);refreshShareCard();}
    else if(action==='copy-request-link')copyRequestLink();
    else if(action==='native-share-link')nativeShareLink();
    else if(action==='respond-shared'){
      const request=ui.sharedRequest;if(!request||request.snapshotStatus!=='open')throw new Error('Не удалось открыть заявку из ссылки.');
      composer={give:{...request.receive},receive:{...request.give},amount:request.minReceive,minReceive:request.amount,partial:request.partial,sharedRequest:request};ui.mode='client';navigate('exchange');
    }
    else if(action==='clear-shared-reply'){delete composer.sharedRequest;composer.pricingMode='auto';delete composer.manualRate;recomputeComposer();render();}
    else if(action==='set-language'||action==='set-theme'){closeModal();setPreferences({[action==='set-language'?'language':'theme']:el.dataset.value});}
    else if(action==='vault-open'){ui.mode='provider';navigate('vault');}
    else if(['vault-enable-review','vault-disable-review','vault-withdraw-review','vault-confirm-withdrawal-review'].includes(action)){
      const mode={'vault-enable-review':'enable','vault-disable-review':'disable','vault-withdraw-review':'withdraw','vault-confirm-withdrawal-review':'confirm-withdrawal'}[action];
      const config={type:'vault',mode,depositId:id};vaultModal(state,config,vaultHelpers());focusReturn=document.activeElement;ui.modal=config;renderModal();queueMicrotask(()=>$('.modal .icon-button')?.focus());
    }
    else if(['vault-enable-confirm','vault-disable-confirm','vault-deposit-confirm','vault-withdraw-confirm','vault-confirm-withdrawal'].includes(action)){
      let message='Настройка vault обновлена';
      if(action==='vault-enable-confirm')setVaultEnabled(state,true);
      if(action==='vault-disable-confirm')setVaultEnabled(state,false);
      if(action==='vault-deposit-confirm'){depositVault(state,ui.modal.amount);message='USDT заблокированы в демо-vault';}
      if(action==='vault-withdraw-confirm'){requestVaultWithdrawal(state,id);message='Запрос на вывод сохранён';}
      if(action==='vault-confirm-withdrawal'){confirmVaultWithdrawal(state,id);message='Вывод завершён в демо';}
      persist();closeModal();render();toast(message);
    }
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
    else if(['kyc','profile','reset-confirm','help','about','terms','location','language','theme'].includes(action))openModal(action);
    else if(action==='save-location'){ui.location=$('#user-city').value;for(const end of [composer.give,composer.receive])if(end.method==='cash'){if(end.city!==ui.location)end.address='';end.city=ui.location;};closeModal();render();toast('Город обновлён');}
    else if(action==='reset-demo'){state=seedState();access=createAccessState();persist();persistAccess();ui.mode='client';navigate('home');toast('Демонстрационные данные восстановлены');}
  }catch(error){if(ui.page==='access'){accessError=error;render();}else modalError(error);}
});
document.addEventListener('input',event=>{
  const el=event.target;
  if(el.dataset.cashAddress){const draft=el.dataset.scope==='direction'?directionDraft:composer;draft[el.dataset.cashAddress].address=el.value;}
  if(el.id==='quote-value'){const order=state.orders.find(o=>o.id===ui.modal?.id);const value=parseAmount(el.value);if(quoteDraft.inputMode==='rate'){quoteDraft.rate=value;quoteDraft.amount=Number.isFinite(value)?Math.round(quoteDraft.giveAmount*value*(order.receive.method==='crypto'?1e6:100))/(order.receive.method==='crypto'?1e6:100):NaN;}else{quoteDraft.amount=value;quoteDraft.rate=value/quoteDraft.giveAmount;}updateQuoteSummary(order);}
  if(el.id==='quote-give'){const order=state.orders.find(o=>o.id===ui.modal?.id);quoteDraft.giveAmount=parseAmount(el.value);const scale=['USDT','USDC'].includes(order.receive.currency)?1e6:100;quoteDraft.amount=Math.round(quoteDraft.giveAmount*quoteDraft.rate*scale)/scale;if(quoteDraft.inputMode==='amount')$('#quote-value').value=Number.isFinite(quoteDraft.amount)?fmtAmount(quoteDraft.amount,order.receive.currency):'';updateQuoteSummary(order);}
  if(el.id==='quote-income')quoteDraft.incomeUSDT=parseAmount(el.value);
  if(el.id==='give-amount'){
    composer.amount=parseAmount(el.value);
    if(Number.isFinite(composer.amount)&&composer.amount>=0){recomputeComposer();$('#receive-amount').value=fmtAmount(composer.minReceive,composer.receive.currency);}
  }
  if(el.id==='client-rate'){composer.manualRate=parseAmount(el.value)/(composer.rateBase||1);recomputeComposer();$('#receive-amount').value=fmtAmount(composer.minReceive);fitAmounts();}
  if(el.id==='give-amount'||el.id==='receive-amount')fitAmounts();
  if(el.dataset.draftField) directionDraft[el.dataset.draftField]=parseAmount(el.value);
  if(el.dataset.filter&&el.type!=='checkbox')ui[el.dataset.filter]=el.value;
});
document.addEventListener('change',event=>{
  const el=event.target;
  if(el.id==='share-address'){shareDraft.includeAddress=el.checked;shareDraft.card=null;renderModal();refreshShareCard();return;}
  if(el.dataset.preference) { setPreferences({[el.dataset.preference]:el.value}); return; }
  if(el.dataset.endpoint){
    const draft=el.dataset.scope==='direction'?directionDraft:composer;
    const previousPair=draft.give.currency+'/'+draft.receive.currency;
    try { updateEndpoint(draft,el.dataset.endpoint,el.dataset.field,el.value,ui.location); }
    catch(error) { if(el.dataset.scope==='direction')renderModal();else render();toast(error.message,true);return; }
    if(el.dataset.scope==='direction')renderModal();else{recomputeComposer(previousPair!==draft.give.currency+'/'+draft.receive.currency);render();}
  }
  if(el.dataset.filter){ui[el.dataset.filter]=el.type==='checkbox'?el.checked:el.value;render();}
});
document.addEventListener('submit',event=>{
  event.preventDefault();
  try{
    const form=event.target;
    if(form.id.startsWith('access-')){
      if(form.id==='access-invite-form')access=redeemInvite(access,form.elements.namedItem('invite').value);
      if(form.id==='access-account-form'){const role=form.elements.namedItem('role').value;access=completeAccount(access,{alias:form.elements.namedItem('alias').value,role});if(ui.accessReturn&&ui.accessReturn.mode!==role&&!composer.sharedRequest)ui.accessReturn={page:role==='provider'?'feed':'exchange',mode:role};ui.mode=role;}
      if(form.id==='access-verification-form')access=completeVerificationStep(access,form.dataset.step,{confirmed:form.elements.namedItem('confirmed').checked});
      accessError='';persistAccess();refreshAccess();return;
    }
    if(!canTrade(access)){navigate(ui.mode==='provider'?'feed':'exchange');return;}
    if(event.target.id==='exchange-form'){
      if(!composer.sharedRequest)Object.assign(composer,calculateClientPricing({...composer,minReceive:undefined},{referenceRate:referenceRate(composer.give.currency,composer.receive.currency)}));
      const order=composer.sharedRequest?createSharedReply(state,composer.sharedRequest,composer):createOrder(state,composer);if(composer.sharedRequest){delete composer.sharedRequest;composer.pricingMode='auto';delete composer.manualRate;recomputeComposer();}persist();render();openModal('order',order.id);toast(order.status==='matched'?'Нашли встречную заявку — условия совпали':'Заявка создана. Ищем подходящий обмен');
    }
    if(event.target.id==='vault-deposit-form'){
      const config={type:'vault',mode:'deposit',amount:parseAmount($('#vault-amount').value)};vaultModal(state,config,vaultHelpers());focusReturn=document.activeElement;ui.modal=config;renderModal();queueMicrotask(()=>$('.modal .icon-button')?.focus());
    }
    if(event.target.id==='quote-form'){
      // Input events retain exact draft values; display rounding must not alter terms.
      submitQuote(state,ui.modal.id,quoteDraft);persist();closeModal();render();toast('Предложение отправлено клиенту');
    }
    if(event.target.id==='payment-form'){const order=state.orders.find(o=>o.id===ui.modal.id);const values=Object.fromEntries(paymentFields(order[ui.modal.side]).map(field=>[field.key,event.target.elements.namedItem(`payment-${field.key}`).value]));setPaymentDetails(state,order.id,ui.modal.side,values);persist();openModal('order',order.id);toast('Тестовые реквизиты сохранены');}
    if(event.target.id==='problem-form'){const id=ui.modal.id;reportProblem(state,id,{reason:$('#problem-reason').value,comment:$('#problem-comment').value});persist();render();openModal('order',id);toast('Проблема сохранена в демо. Завершение сделки приостановлено.');}
    if(event.target.id==='direction-form'){
      addDirection(state,directionDraft);persist();closeModal();ui.page='directions';render();toast('Направление добавлено');
    }
  }catch(error){if(event.target.id.startsWith('access-')){accessError=error;render();}else if(event.target.id==='exchange-form')$('#composer-error').innerHTML=`<div class="error-message" role="alert">${esc(t(error.message))}</div>`;else modalError(error);}
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
    render();renderModal();
  }
});
// Synchronize browser tabs without interrupting an in-progress form.
window.addEventListener('storage',event=>{if(event.key===ACCESS_STORAGE_KEY){access=loadAccessState(event.newValue);if(!canTrade(access)&&!['home','access','shared'].includes(ui.page)){navigate(ui.page);}else{render();renderModal();}return;}if(event.key===STORAGE_KEY&&event.newValue){try{const next=JSON.parse(event.newValue);if([1,2].includes(next.version)&&Array.isArray(next.orders)&&Array.isArray(next.directions)&&Array.isArray(next.notifications)){state=migrateState(next);if(ui.modal?.type==='vault'){closeModal();render();toast(language()==='en'?'Collateral changed in another tab. Review the amount again.':'Обеспечение изменилось в другой вкладке. Проверьте сумму заново.',true);return;}if(!ui.modal){render();toast('Данные обновлены в другой вкладке');}}}catch{}}});
setInterval(()=>{
  if(ui.modal?.type==='order'&&!$('.modal input:focus')){
    const expired=[...document.querySelectorAll('[data-action="accept-quote"]')].some(el=>{const order=state.orders.find(o=>o.id===el.dataset.id);return !el.disabled&&order?.quotes.find(q=>q.id===el.dataset.quoteId)?.expiresAt<=Date.now();});
    if(expired)renderModal();
  }
},1000);
readSharedRoute();
render();
