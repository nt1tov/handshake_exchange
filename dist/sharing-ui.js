import { BANKS } from './bank-catalog.js';

const copy = {
  ru: {
    title:'Поделиться заявкой', subtitle:'Ссылка открывает эту заявку. QR ведёт на ту же страницу.',
    link:'Уникальная ссылка', copy:'Скопировать ссылку', share:'Отправить ссылку', open:'Открыть заявку',
    qr:'QR-код заявки', qrNote:'Отсканируйте, чтобы открыть обмен', image:'Карточка-картинка', download:'Скачать PNG',
    address:'Добавить район или ориентир', privacy:'Реквизиты, KYC и обращения в поддержку не включаются в ссылку или QR.',
    demo:'В демо ссылка содержит снимок условий. Статус между устройствами не синхронизируется.',
    request:'ЗАЯВКА НА ОБМЕН', heading:'Обмен по ссылке', sends:'Автор отдаёт', receives:'Автор получает',
    minimum:'Автор хочет получить от', reply:'Создать встречную заявку', own:'Открыть мою заявку',
    closed:'Эта заявка была недоступна для отклика на момент создания ссылки.',
    caution:'Перед обменом уточните актуальность у отправителя. В прототипе реальные переводы не выполняются.',
    partial:'Можно частями', full:'Только целиком', snapshot:'Статус в момент создания ссылки',
    statuses:{open:'Открыта',reserved:'Ожидает подтверждения', 'in-progress':'В процессе',completed:'Состоялась',cancelled:'Отменена'},
    cash:'Наличные', network:'Сеть', bank:'Банковский перевод', demoLabel:'Демонстрационная заявка',
    invalidTitle:'Не удалось открыть заявку', invalidBody:'Ссылка неполная, повреждена или использует неподдерживаемые условия. Попросите отправителя создать новую ссылку.',
    home:'На главную', loading:'Готовим изображение…', terms:'Условия обмена', selfNote:'В этом браузере сохранена ваша заявка с этим номером.',
  },
  en: {
    title:'Share request', subtitle:'The link opens this request. The QR code leads to the same page.',
    link:'Unique link', copy:'Copy link', share:'Send link', open:'Open request',
    qr:'Request QR code', qrNote:'Scan to open the exchange', image:'Image card', download:'Download PNG',
    address:'Include the district or landmark', privacy:'Payment details, KYC and support reports are never included in the link or QR code.',
    demo:'In this demo the link contains a snapshot of the terms. Status does not sync across devices.',
    request:'EXCHANGE REQUEST', heading:'Exchange via link', sends:'The author sends', receives:'The author receives',
    minimum:'The author wants at least', reply:'Create a matching request', own:'Open my request',
    closed:'This request was unavailable for replies when the link was created.',
    caution:'Check availability with the sender before exchanging. The prototype does not make real transfers.',
    partial:'Partial fills allowed', full:'Full amount only', snapshot:'Status when the link was created',
    statuses:{open:'Open',reserved:'Awaiting confirmation','in-progress':'In progress',completed:'Completed',cancelled:'Cancelled'},
    cash:'Cash', network:'Network', bank:'Bank transfer', demoLabel:'Demo request',
    invalidTitle:'Could not open the request', invalidBody:'The link is incomplete, damaged or uses unsupported terms. Ask the sender to create a new link.',
    home:'Back to home', loading:'Preparing the image…', terms:'Exchange terms', selfNote:'A request with this number is saved as yours in this browser.',
  },
};

const cities = {'Ереван':'Yerevan','Москва':'Moscow','Тбилиси':'Tbilisi','Санкт-Петербург':'Saint Petersburg','Дубай':'Dubai','Алматы':'Almaty','Астана':'Astana'};
const bankNames = {tbank:'T-Bank',alfa:'Alfa-Bank',sber:'Sber',raiffeisen:'Raiffeisen',yandexpay:'Yandex Pay',bcc:'Bank CenterCredit'};
function endpointText(endpoint, lang, text) {
  if(endpoint.method==='cash')return `${text.cash} · ${lang==='en'?cities[endpoint.city]||endpoint.city:endpoint.city}`;
  if(endpoint.method==='crypto')return `${text.network} ${endpoint.network}`;
  const bank=BANKS.find(item=>item.id===endpoint.bank);
  return (lang==='en'?bankNames[bank?.id]:null)||bank?.name||text.bank;
}
function termsCard(record, {esc,formatAmount,language='ru'}) {
  const lang=language==='en'?'en':'ru',text=copy[lang];
  return `<div class="public-terms" aria-label="${text.terms}">${['give','receive'].map(side=>{const end=record[side];return `<div class="public-side ${side}"><span>${side==='give'?text.sends:record.snapshotStatus==='open'?text.minimum:text.receives}</span><strong>${formatAmount(side==='give'?record.amount:record.minReceive,end.currency)} <small>${esc(end.currency)}</small></strong><p>${esc(endpointText(end,lang,text))}</p>${end.method==='cash'&&end.address?`<p class="public-address">${esc(end.address)}</p>`:''}</div>`;}).join('<span class="public-arrow" aria-hidden="true">→</span>')}</div>`;
}

export function shareDialog(record, draft, helpers) {
  const text=copy[helpers.language==='en'?'en':'ru'],{esc,icon}=helpers;
  return {title:text.title,subtitle:text.subtitle,body:`<div data-no-i18n class="share-link-dialog"><div class="share-link-overview"><div>${termsCard(record,helpers)}<span class="chip">${record.partial?text.partial:text.full}</span></div><figure class="request-qr"><img src="${draft.qr}" alt="${text.qr}" width="216" height="216"><figcaption>${text.qrNote}</figcaption></figure></div><label class="field-label" for="request-link">${text.link}</label><input class="input-field request-link" id="request-link" readonly value="${esc(draft.url)}" dir="ltr" autocomplete="off"><div class="share-actions"><button class="primary-button" data-action="copy-request-link">${icon('link',16)}${text.copy}</button><button class="outline-button" data-action="native-share-link">${text.share}${icon('arrow',16)}</button><a class="text-button" href="${esc(draft.url)}" target="_blank" rel="noopener">${text.open} ↗</a></div>${draft.hasAddress?`<label class="share-address-toggle"><input type="checkbox" id="share-address" ${draft.includeAddress?'checked':''}><span>${text.address}</span></label>`:''}<p class="inset-notice">${text.privacy}</p><p class="share-snapshot-note">${text.demo}</p><details class="share-image-details"><summary>${text.image}</summary>${draft.card?`<div class="share-preview"><img class="share-preview-image" src="${draft.card.dataUrl}" alt="${text.image}"></div><a class="outline-button" href="${draft.card.dataUrl}" download="${esc(draft.card.filename)}">${text.download}</a>`:`<p class="inset-notice">${text.loading}</p>`}</details></div>`};
}

export function sharedRequestPage(record, helpers, localOrder) {
  const text=copy[helpers.language==='en'?'en':'ru'],{esc,icon}=helpers;
  if(!record)return `<section class="public-request invalid-request" data-no-i18n><span class="public-brand">🤝 handshake.</span><h1>${text.invalidTitle}</h1><p>${text.invalidBody}</p><button class="primary-button" data-action="home">${text.home}</button></section>`;
  return `<section class="public-request" data-no-i18n><div class="public-request-head"><div><span class="eyebrow">${text.request}</span><h1>${text.heading}</h1></div><span class="demo-tag">${text.demoLabel}</span></div><article class="card public-request-card"><div class="public-request-id"><span>🤝 handshake.</span><code>${esc(record.id)}</code></div>${termsCard(record,helpers)}<div class="public-request-meta"><span class="chip">${record.partial?text.partial:text.full}</span><span>${text.snapshot}: <strong>${text.statuses[record.snapshotStatus]}</strong></span></div>${localOrder?`<p class="inset-notice">${text.selfNote}</p><button class="primary-button full" data-action="order" data-id="${esc(localOrder.id)}">${text.own} ${icon('arrow',16)}</button>`:record.snapshotStatus==='open'?`<button class="primary-button full" data-action="respond-shared">${text.reply}${icon('arrow',16)}</button>`:`<p class="info-box">${text.closed}</p>`}<p class="share-snapshot-note">${text.demo}</p><p class="inset-notice">${text.caution}</p></article></section>`;
}
