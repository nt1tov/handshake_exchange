import { BANKS, CITIES, CURRENCIES, NETWORKS } from './domain.js';
import { formatNumber } from './i18n.js';

const copy = {
  ru: {
    request: 'ЗАЯВКА НА ОБМЕН', give: 'ОТДАЮ', receive: 'ПОЛУЧАЮ', minimum: 'ПОЛУЧАЮ ОТ',
    giveCaption: 'Отдаю', receiveCaption: 'Получаю', minimumCaption: 'Получаю от',
    bank: 'Банковский перевод', cash: 'Наличные', crypto: 'Криптовалюта', network: 'Сеть',
    geography: 'ГЕОГРАФИЯ ОБМЕНА', online: 'Онлайн · банковский или криптоперевод',
    meeting: 'МЕСТО ВСТРЕЧИ', giveAddress: 'Передача', receiveAddress: 'Получение',
    status: 'Статус', snapshot: 'Снимок', city: 'Город',
    note: 'Условия на момент создания карточки. Актуальность уточняйте перед обменом.',
    unavailable: 'Не указано', unknown: 'В работе',
    statuses: { searching: 'Ищем встречный обмен', matched: 'Совпадение найдено', agreed: 'Условия согласованы', cancelled: 'Заявка отменена', completed: 'Обмен завершён' },
  },
  en: {
    request: 'EXCHANGE REQUEST', give: 'I GIVE', receive: 'I RECEIVE', minimum: 'I RECEIVE AT LEAST',
    giveCaption: 'I give', receiveCaption: 'I receive', minimumCaption: 'I receive at least',
    bank: 'Bank transfer', cash: 'Cash', crypto: 'Crypto', network: 'Network',
    geography: 'EXCHANGE LOCATION', online: 'Online · bank or crypto transfer',
    meeting: 'MEETING POINT', giveAddress: 'Giving', receiveAddress: 'Receiving',
    status: 'Status', snapshot: 'Snapshot', city: 'City',
    note: 'Terms when this card was created. Confirm availability before exchanging.',
    unavailable: 'Not specified', unknown: 'In progress',
    statuses: { searching: 'Looking for a match', matched: 'Match found', agreed: 'Terms agreed', cancelled: 'Request cancelled', completed: 'Exchange completed' },
  },
};

const englishCities = { 'Ереван': 'Yerevan', 'Москва': 'Moscow', 'Тбилиси': 'Tbilisi', 'Санкт-Петербург': 'Saint Petersburg', 'Дубай': 'Dubai' };
const englishBanks = { tbank: 'T-Bank', sber: 'Sber', alfa: 'Alfa-Bank', raiffeisen: 'Raiffeisen' };
const clean = (value, maximum = 240) => typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, maximum) : '';
const positive = value => (typeof value === 'number' || typeof value === 'string') && Number.isFinite(Number(value)) && Number(value) > 0 ? Number(value) : null;

function cardEndpoint(endpoint, amount, language, includeAddress) {
  const text = copy[language];
  const source = endpoint && typeof endpoint === 'object' ? endpoint : {};
  const currency = CURRENCIES.some(item => item.code === source.currency) ? source.currency : '—';
  const method = ['bank', 'cash', 'crypto'].includes(source.method) ? source.method : '';
  const city = method === 'cash' && CITIES.includes(source.city) ? (language === 'en' ? englishCities[source.city] || source.city : source.city) : '';
  let detail = text.unavailable;
  if (method === 'bank') {
    const bank = BANKS.find(item => item.id === source.bank);
    if (bank) detail = language === 'en' ? englishBanks[bank.id] || bank.name : bank.name;
  } else if (method === 'cash') detail = city || text.unavailable;
  else if (method === 'crypto' && NETWORKS.includes(source.network)) detail = `${text.network} ${source.network}`;
  const validAmount = positive(amount);
  const amountText = validAmount === null ? '—' : ['USDT', 'USDC'].includes(currency)
    ? new Intl.NumberFormat(language === 'en' ? 'en-US' : 'ru-RU', { maximumFractionDigits: 6 }).format(validAmount)
    : formatNumber(validAmount, language);
  return {
    amount: validAmount, amountText,
    currency, method, methodLabel: text[method] || text.unavailable, detail, city,
    address: includeAddress && method === 'cash' ? clean(source.address) : '',
  };
}

// This object is the entire sharing boundary: only these selected fields are rendered.
export function buildCardData(order, { language = 'ru', includeAddress = false, now = Date.now() } = {}) {
  const lang = language === 'en' ? 'en' : 'ru';
  const text = copy[lang];
  const source = order && typeof order === 'object' ? order : {};
  const accepted = Array.isArray(source.quotes) ? source.quotes.find(quote => quote?.status === 'accepted' && (!source.acceptedQuoteId || quote.id === source.acceptedQuoteId) && positive(quote.amount) !== null) : undefined;
  const matchedAmount = ['matched', 'agreed', 'completed'].includes(source.status) ? positive(source.matchedReceive) : null;
  const fixedAmount = positive(accepted?.amount) ?? matchedAmount;
  const give = cardEndpoint(source.give, source.amount, lang, includeAddress === true);
  const receive = cardEndpoint(source.receive, fixedAmount ?? source.minReceive, lang, includeAddress === true);
  const id = typeof source.id === 'string' && /^[a-zA-Z0-9_-]{1,80}$/.test(source.id) ? source.id : 'HS';
  const statusKey = Object.hasOwn(text.statuses, source.status) ? source.status : 'unknown';
  const status = text.statuses[statusKey] || text.unknown;
  const timestamp = Number.isFinite(now) && Number.isFinite(new Date(now).getTime()) ? now : Date.now();
  const snapshot = new Intl.DateTimeFormat(lang === 'en' ? 'en-GB' : 'ru-RU', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(timestamp);
  const cities = [...new Set([give.city, receive.city].filter(Boolean))];
  const addresses = [
    ...(give.address ? [{ label: text.giveAddress, city: give.city, value: give.address }] : []),
    ...(receive.address ? [{ label: text.receiveAddress, city: receive.city, value: receive.address }] : []),
  ];
  const caption = [
    `Handshake · ${id}`,
    `${text.giveCaption}: ${give.amountText} ${give.currency} · ${give.methodLabel} · ${give.detail}`,
    `${fixedAmount === null ? text.minimumCaption : text.receiveCaption}: ${receive.amountText} ${receive.currency} · ${receive.methodLabel} · ${receive.detail}`,
    ...(cities.length ? [`${text.city}: ${cities.join(' / ')}`] : []),
    ...addresses.map(item => `${item.label}${item.city ? ` · ${item.city}` : ''}: ${item.value}`),
    `${text.status}: ${status}`,
    `${text.snapshot}: ${snapshot}`,
    text.note,
  ].join('\n');
  return { language: lang, id, give, receive, minimum: fixedAmount === null, statusKey, status, snapshot, cities, addresses, caption };
}

const palette = { background: '#16191f', panel: '#222730', receive: '#302b3b', border: '#39404b', purpleBorder: '#635176', ink: '#f4f5f1', muted: '#acb4c1', purple: '#c7b0ef', lime: '#ccf288' };
const fontFamily = '"Golos Text", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

function font(context, size, weight = 400) { context.font = `${weight} ${size}px ${fontFamily}`; }
function roundRect(context, x, y, width, height, radius, fill, stroke) {
  const r = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + width, y, x + width, y + height, r);
  context.arcTo(x + width, y + height, x, y + height, r);
  context.arcTo(x, y + height, x, y, r);
  context.arcTo(x, y, x + width, y, r);
  context.closePath();
  if (fill) { context.fillStyle = fill; context.fill(); }
  if (stroke) { context.strokeStyle = stroke; context.lineWidth = 1.5; context.stroke(); }
}

function write(context, value, x, y, size = 24, color = palette.ink, weight = 400, maxWidth) {
  let actualSize = size;
  font(context, actualSize, weight);
  while (maxWidth && context.measureText(value).width > maxWidth && actualSize > 16) font(context, --actualSize, weight);
  context.fillStyle = color;
  if (maxWidth) context.fillText(value, x, y, maxWidth);
  else context.fillText(value, x, y);
}

function lines(context, value, width, size = 20, weight = 400) {
  font(context, size, weight);
  const output = [];
  let line = '';
  for (const character of Array.from(value)) {
    if (line && context.measureText(line + character).width > width) {
      const split = line.lastIndexOf(' ');
      if (split > line.length / 2) {
        output.push(line.slice(0, split));
        line = line.slice(split + 1) + character;
      } else { output.push(line); line = character; }
    } else line += character;
  }
  if (line) output.push(line.trim());
  return output;
}

function logo(context, x, y, size) {
  context.save();
  context.translate(x, y);
  context.scale(size / 48, size / 48);
  roundRect(context, 0, 0, 48, 48, 15, '#c9f36b');
  context.font = '30px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
  context.fillStyle = '#24301d';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText('🤝', 24, 25);
  context.restore();
}

function methodIcon(context, method, x, y) {
  context.save();
  context.translate(x, y);
  context.strokeStyle = palette.muted;
  context.lineWidth = 2;
  context.lineJoin = 'round';
  context.lineCap = 'round';
  if (method === 'cash') {
    roundRect(context, 0, 3, 26, 18, 4, null, palette.muted);
    context.beginPath(); context.arc(13, 12, 4, 0, Math.PI * 2); context.stroke();
  } else if (method === 'bank') {
    context.beginPath(); context.moveTo(0, 7); context.lineTo(13, 0); context.lineTo(26, 7); context.closePath();
    for (const px of [4, 13, 22]) { context.moveTo(px, 11); context.lineTo(px, 21); }
    context.moveTo(0, 25); context.lineTo(26, 25); context.stroke();
  } else {
    context.beginPath(); context.arc(13, 13, 12, 0, Math.PI * 2); context.stroke();
    context.moveTo(7, 9); context.lineTo(19, 9); context.moveTo(13, 9); context.lineTo(13, 20); context.stroke();
    context.beginPath(); context.ellipse(13, 13, 7, 2, 0, 0, Math.PI * 2); context.stroke();
  }
  context.restore();
}

function arrow(context, x, y) {
  context.beginPath(); context.arc(x, y, 31, 0, Math.PI * 2); context.fillStyle = palette.lime; context.fill();
  context.strokeStyle = '#29331d'; context.lineWidth = 3.5; context.lineCap = 'round'; context.lineJoin = 'round';
  context.beginPath(); context.moveTo(x - 12, y); context.lineTo(x + 12, y); context.lineTo(x + 4, y - 8); context.moveTo(x + 12, y); context.lineTo(x + 4, y + 8); context.stroke();
}

function endpointPanel(context, endpoint, label, x, y, receiving) {
  roundRect(context, x, y, 512, 246, 22, receiving ? palette.receive : palette.panel, receiving ? palette.purpleBorder : palette.border);
  write(context, label, x + 28, y + 43, 17, palette.muted, 550, 332);
  roundRect(context, x + 390, y + 20, 94, 38, 12, receiving ? '#493b59' : '#333c2d');
  font(context, 18, 600);
  const width = context.measureText(endpoint.currency).width;
  write(context, endpoint.currency, x + 437 - width / 2, y + 46, 18, receiving ? palette.purple : palette.lime, 600);
  write(context, endpoint.amountText, x + 28, y + 123, 62, palette.ink, 550, 456);
  context.beginPath(); context.moveTo(x + 28, y + 151); context.lineTo(x + 484, y + 151); context.strokeStyle = receiving ? '#51435f' : palette.border; context.lineWidth = 1; context.stroke();
  methodIcon(context, endpoint.method, x + 29, y + 176);
  write(context, endpoint.methodLabel, x + 69, y + 195, 21, palette.ink, 450, 410);
  write(context, endpoint.detail, x + 69, y + 224, 18, palette.muted, 400, 410);
}

export async function createOrderCard(order, options = {}) {
  const data = buildCardData(order, options);
  const text = copy[data.language];
  if (!globalThis.document?.createElement) throw new Error('Card generation needs a browser.');
  await globalThis.document.fonts?.ready;
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas is unavailable.');
  const addressRows = data.addresses.map(item => ({ label: `${item.label}${item.city ? ` · ${item.city}` : ''}`, lines: lines(context, item.value, 1028, 20) }));
  const addressHeight = addressRows.length ? 54 + addressRows.reduce((sum, item) => sum + 31 + item.lines.length * 29 + 14, 0) : 0;
  canvas.width = 1200;
  canvas.height = 760 + addressHeight;
  context.textBaseline = 'alphabetic';
  context.fillStyle = palette.background;
  context.fillRect(0, 0, canvas.width, canvas.height);

  const glow = context.createRadialGradient(1080, 35, 10, 1080, 35, 560);
  glow.addColorStop(0, '#44325588'); glow.addColorStop(1, '#16191f00');
  context.fillStyle = glow; context.fillRect(0, 0, canvas.width, canvas.height);
  logo(context, 56, 52, 56);
  write(context, 'handshake', 127, 93, 38, palette.ink, 650);
  font(context, 38, 650);
  write(context, '.', 127 + context.measureText('handshake').width, 93, 38, palette.lime, 650);
  write(context, text.request, 56, 169, 18, palette.muted, 550);
  font(context, 17, 500);
  const statusWidth = context.measureText(data.status).width + 50;
  const statusX = 1144 - statusWidth;
  const statusColor = data.statusKey === 'cancelled' ? palette.muted : palette.lime;
  roundRect(context, statusX, 136, statusWidth, 45, 22, '#272f25', '#3b4931');
  context.beginPath(); context.arc(statusX + 21, 159, 4, 0, Math.PI * 2); context.fillStyle = statusColor; context.fill();
  write(context, data.status, statusX + 34, 165, 17, statusColor, 500);

  endpointPanel(context, data.give, text.give, 56, 211, false);
  endpointPanel(context, data.receive, data.minimum ? text.minimum : text.receive, 632, 211, true);
  arrow(context, 600, 334);

  write(context, text.geography, 56, 513, 15, palette.muted, 550);
  write(context, data.cities.length ? data.cities.join('  /  ') : text.online, 56, 552, 28, palette.ink, 500, 1088);
  if (addressRows.length) {
    let y = 599;
    write(context, text.meeting, 56, y, 15, palette.purple, 550);
    y += 34;
    for (const row of addressRows) {
      write(context, row.label, 56, y, 17, palette.muted, 500);
      y += 29;
      for (const line of row.lines) { write(context, line, 56, y, 20, palette.ink); y += 29; }
      y += 16;
    }
  }

  const footerY = canvas.height - 130;
  context.beginPath(); context.moveTo(56, footerY); context.lineTo(1144, footerY); context.strokeStyle = palette.border; context.lineWidth = 1; context.stroke();
  write(context, data.id, 56, footerY + 41, 17, palette.ink, 500, 500);
  const snapshot = `${text.snapshot} · ${data.snapshot}`;
  font(context, 16, 400);
  write(context, snapshot, 1144 - context.measureText(snapshot).width, footerY + 41, 16, palette.muted);
  write(context, text.note, 56, footerY + 84, 16, palette.muted, 400, 1088);

  const blob = await new Promise((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('PNG export failed.')), 'image/png'));
  return { blob, filename: `handshake-${data.id}-${data.language}.png`, caption: data.caption, dataUrl: canvas.toDataURL('image/png'), width: canvas.width, height: canvas.height };
}
