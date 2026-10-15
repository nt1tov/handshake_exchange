import { vaultMetrics } from './vault.js';

const copy = {
  ru: {
    title: 'Доходный vault', subtitle: 'Отдельное размещение USDT из свободного обеспечения.', demo: 'Демо',
    heading: 'Часть капитала — в vault', description: 'Размещённые USDT исключаются из лимита мгновенных сделок. Уже зарезервированное обеспечение остаётся за клиентами.',
    enable: 'Включить опцию', disable: 'Отключить опцию', enabled: 'Размещения включены', disabled: 'Новые размещения выключены',
    deposited: 'Размещено в vault', pending: 'Ожидает вывода', available: 'Доступно для сделок',
    yield: 'Доходность', variable: 'Переменная', earnings: 'Начисления', disconnected: 'Не подключено',
    demoNote: 'Это локальный сценарий. Mantle Vault и кошельки не подключены, доход не начисляется, реальные USDT не переводятся.',
    amount: 'Сумма размещения, USDT', review: 'Проверить размещение', amountHelp: 'Только свободное обеспечение. После подтверждения лимит сделок уменьшится на эту сумму.',
    positions: 'Размещения', empty: 'Пока нет размещений', emptyText: 'Включите опцию и выберите сумму, которую готовы исключить из лимита сделок.',
    active: 'В vault', withdrawalPending: 'Вывод запрошен', withdrawn: 'Возвращено',
    withdraw: 'Запросить вывод', confirmReturn: 'Подтвердить возврат · демо', returnNote: 'Запрос ещё не возвращает обеспечение. В демо возврат подтверждается отдельным действием.',
    created: 'Создано', source: 'О Mantle Vault на Bybit', sourceNote: 'Справочный пример доходного vault. Условия реальных продуктов отличаются; доходность меняется, вывод может занимать время.',
    invalid: 'Данные размещений требуют проверки. Доступное обеспечение заблокировано до проверки.',
    open: 'Открыть vault', summary: 'Доходный vault · USDT', summaryText: 'Размещения и ожидающие выводы уменьшают свободное обеспечение.',
    before: 'Лимит сделок сейчас', after: 'После подтверждения', locked: 'Останется в vault', confirm: 'Подтвердить размещение · демо', cancel: 'Назад',
    enableTitle: 'Включить демо-vault?', enableText: 'Включение разрешит новые размещения. Деньги останутся свободными, пока вы отдельно не выберете и не подтвердите сумму.',
    enableConfirm: 'Включить опцию', disableTitle: 'Отключить новые размещения?', disableText: 'Существующие размещения и запросы вывода сохранятся. Для возврата каждой суммы нужен отдельный вывод.', disableConfirm: 'Отключить опцию',
    depositTitle: 'Проверить размещение', depositText: 'Эти USDT станут недоступны для новых сделок до подтверждённого возврата из vault.', depositLabel: 'В vault',
    withdrawTitle: 'Запросить вывод?', withdrawText: 'Средства останутся заблокированными. Лимит сделок не увеличится, пока вы явно не подтвердите возврат в демо.', withdrawConfirm: 'Создать запрос · демо',
    returnTitle: 'Подтвердить демо-возврат?', returnText: 'В демо эта кнопка возвращает сумму в свободное обеспечение. Реальный перевод или получение средств не проверяются.', returnConfirm: 'Подтвердить возврат · демо',
  },
  en: {
    title: 'Yield vault', subtitle: 'A separate USDT allocation from free collateral.', demo: 'Demo',
    heading: 'Allocate part of your capital', description: 'USDT placed in the vault is excluded from the limit for immediate trades. Collateral already reserved for clients stays reserved.',
    enable: 'Enable option', disable: 'Disable option', enabled: 'Deposits enabled', disabled: 'New deposits disabled',
    deposited: 'Deposited in vault', pending: 'Withdrawal pending', available: 'Available for trades',
    yield: 'Yield', variable: 'Variable', earnings: 'Earnings', disconnected: 'Not connected',
    demoNote: 'This is a local simulation. Mantle Vault and wallets are not connected, no yield accrues and no real USDT is transferred.',
    amount: 'Deposit amount, USDT', review: 'Review deposit', amountHelp: 'Free collateral only. Confirming this deposit reduces your trade limit by the same amount.',
    positions: 'Deposits', empty: 'No deposits yet', emptyText: 'Enable the option and choose the amount to exclude from your trade limit.',
    active: 'In vault', withdrawalPending: 'Withdrawal requested', withdrawn: 'Returned',
    withdraw: 'Request withdrawal', confirmReturn: 'Confirm return · demo', returnNote: 'Requesting withdrawal does not restore collateral yet. Confirm its return with a separate demo action.',
    created: 'Created', source: 'About Mantle Vault on Bybit', sourceNote: 'A reference example of a yield vault. Real product terms differ; yield varies and withdrawals may take time.',
    invalid: 'Deposit data needs review. Available collateral is blocked until it is checked.',
    open: 'Open vault', summary: 'Yield vault · USDT', summaryText: 'Deposits and pending withdrawals reduce free collateral.',
    before: 'Current trade limit', after: 'After confirmation', locked: 'Remaining in vault', confirm: 'Confirm deposit · demo', cancel: 'Back',
    enableTitle: 'Enable the demo vault?', enableText: 'This enables new deposits. Funds stay available until you separately choose and confirm a deposit amount.',
    enableConfirm: 'Enable option', disableTitle: 'Disable new deposits?', disableText: 'Existing deposits and withdrawal requests remain. Each amount needs a separate withdrawal to be returned.', disableConfirm: 'Disable option',
    depositTitle: 'Review deposit', depositText: 'This USDT will be unavailable for new trades until its return from the vault is confirmed.', depositLabel: 'To vault',
    withdrawTitle: 'Request withdrawal?', withdrawText: 'Funds stay locked. The trade limit will not increase until you explicitly confirm their return in this demo.', withdrawConfirm: 'Create request · demo',
    returnTitle: 'Confirm demo return?', returnText: 'In this demo, this button returns the amount to free collateral. No actual transfer or receipt is verified.', returnConfirm: 'Confirm return · demo',
  },
};

function helpers(options = {}) {
  const language = typeof options.language === 'function' ? options.language() : options.language;
  const locale = language === 'en' ? 'en' : 'ru';
  return {
    text: copy[locale], locale,
    esc: options.esc || (value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char])),
    fmt: options.fmt || (value => new Intl.NumberFormat(locale, { maximumFractionDigits: 6 }).format(value)),
    icon: options.icon || (() => ''),
  };
}

function money(value, h) { return `${h.esc(h.fmt(value))} <small>USDT</small>`; }

export function vaultSummaryCard(state, options = {}) {
  const h = helpers(options), t = h.text, m = vaultMetrics(state);
  return `<section class="card vault-summary" data-no-i18n><div><span class="eyebrow">${t.summary}</span><h2>${money(m.depositedUSDT, h)}</h2><p>${t.summaryText}</p><span class="vault-summary-limit">${t.available}: ${money(m.availableUSDT, h)}</span></div><button class="outline-button" data-action="vault-open">${t.open}${h.icon('arrow', 16)}</button></section>`;
}

export function vaultPage(state, options = {}) {
  const h = helpers(options), t = h.text, m = vaultMetrics(state);
  const enabled = state.vault?.enabled === true;
  const positions = Array.isArray(state.vault?.deposits) ? state.vault.deposits.filter(position => position && typeof position === 'object' && !Array.isArray(position)) : [];
  const disabled = !enabled || m.availableUSDT <= 0 || m.invalidState;
  const cards = positions.map(position => {
    const status = position.status === 'withdrawal-pending' ? t.withdrawalPending : position.status === 'withdrawn' ? t.withdrawn : t.active;
    const timestamp = new Date(Number(position.createdAt));
    const date = Number.isFinite(timestamp.getTime()) ? new Intl.DateTimeFormat(h.locale, { day: 'numeric', month: 'short', year: 'numeric' }).format(timestamp) : '—';
    const action = position.status === 'active' ? `<button class="outline-button" data-action="vault-withdraw-review" data-id="${h.esc(position.id)}">${t.withdraw}</button>`
      : position.status === 'withdrawal-pending' ? `<button class="outline-button" data-action="vault-confirm-withdrawal-review" data-id="${h.esc(position.id)}">${t.confirmReturn}</button>` : '';
    return `<article class="card vault-position"><div class="vault-position-main"><strong>${money(position.amountUSDT, h)}</strong><span class="vault-position-status ${position.status === 'withdrawal-pending' ? 'is-pending' : ''}">${status}</span></div><p>${t.created}: ${h.esc(date)}</p>${position.status === 'withdrawal-pending' ? `<p class="vault-withdraw-note">${t.returnNote}</p>` : ''}${action}</article>`;
  }).join('');
  return `<div class="vault-page" data-no-i18n><div class="vault-header"><div><div class="eyebrow">USDT · ${t.demo}</div><h1>${t.title}</h1><p>${t.subtitle}</p></div><span class="demo-tag">${t.demo}</span></div>
    <section class="card vault-overview"><div class="vault-overview-head"><div><h2>${t.heading}</h2><p>${t.description}</p></div><button class="vault-toggle" type="button" role="switch" aria-checked="${enabled}" aria-label="${enabled ? t.disable : t.enable}" data-action="${enabled ? 'vault-disable-review' : 'vault-enable-review'}"><span aria-hidden="true" class="vault-toggle-track ${enabled ? 'is-on' : ''}"></span><span>${enabled ? t.enabled : t.disabled}</span></button></div>
    <div class="vault-metrics">${[[t.deposited, m.depositedUSDT], [t.pending, m.withdrawalPendingUSDT], [t.available, m.availableUSDT]].map(([label, value]) => `<div><span>${label}</span><strong>${money(value, h)}</strong></div>`).join('')}</div>
    <div class="vault-yield"><div><span>${t.yield}</span><strong>${t.variable}</strong></div><div><span>${t.earnings}</span><strong>${t.disconnected}</strong></div></div>
    <p class="vault-demo-notice">${t.demoNote}</p>${m.invalidState ? `<p class="error-message" role="alert">${t.invalid}</p>` : ''}
    <form id="vault-deposit-form" class="vault-deposit-form"><div><label for="vault-amount">${t.amount}</label><input id="vault-amount" name="amount" class="input-field" type="text" inputmode="decimal" autocomplete="off" placeholder="0" aria-describedby="vault-amount-help" required ${disabled ? 'disabled' : ''}><p id="vault-amount-help">${t.amountHelp}</p></div><button class="primary-button" type="submit" ${disabled ? 'disabled' : ''}>${t.review}${h.icon('arrow', 17)}</button></form></section>
    <div class="section-head"><h2>${t.positions}</h2></div><div class="vault-positions">${cards || `<div class="empty-state"><h3>${t.empty}</h3><p>${t.emptyText}</p></div>`}</div>
    <aside class="vault-source"><p>${t.sourceNote}</p><a href="https://www.bybit.com/en/earn/mantle-vault/" target="_blank" rel="noopener noreferrer">${t.source} ↗</a></aside></div>`;
}

export function vaultModal(state, config, options = {}) {
  const h = helpers(options), t = h.text, m = vaultMetrics(state);
  const position = Array.isArray(state.vault?.deposits) ? state.vault.deposits.find(item => item?.id === config.depositId) : null;
  const amount = config.mode === 'deposit' ? Number(config.amount) : position?.amountUSDT ?? 0;
  const modes = {
    enable: [t.enableTitle, t.enableText, t.enableConfirm, 'vault-enable-confirm'],
    disable: [t.disableTitle, t.disableText, t.disableConfirm, 'vault-disable-confirm'],
    deposit: [t.depositTitle, t.depositText, t.confirm, 'vault-deposit-confirm'],
    withdraw: [t.withdrawTitle, t.withdrawText, t.withdrawConfirm, 'vault-withdraw-confirm'],
    'confirm-withdrawal': [t.returnTitle, t.returnText, t.returnConfirm, 'vault-confirm-withdrawal'],
  };
  const mode = modes[config.mode];
  if (!mode) throw new Error('Неизвестное действие vault.');
  if (['withdraw', 'confirm-withdrawal'].includes(config.mode) && !position) throw new Error('Размещение в vault не найдено.');
  if (config.mode === 'withdraw' && position.status !== 'active') throw new Error('Запрос на вывод уже создан или размещение закрыто.');
  if (config.mode === 'confirm-withdrawal' && position.status !== 'withdrawal-pending') throw new Error('Подтвердить можно только ожидающий демо-вывод.');
  if (config.mode === 'deposit' && (!Number.isFinite(amount) || amount <= 0 || amount > m.availableUSDT)) throw new Error('Недостаточно свободного обеспечения для размещения в vault.');
  const returned = config.mode === 'confirm-withdrawal' ? vaultMetrics({ ...state, vault: { ...state.vault, deposits: state.vault.deposits.map(item => item?.id === position.id ? { ...item, status: 'withdrawn' } : item) } }) : null;
  const after = config.mode === 'deposit' ? Math.max(0, m.availableUSDT - amount)
    : returned ? returned.availableUSDT : m.availableUSDT;
  const locked = config.mode === 'deposit' ? m.depositedUSDT + amount
    : returned ? returned.depositedUSDT : m.depositedUSDT;
  return {
    title: mode[0], subtitle: t.demo,
    body: `<div class="vault-review" data-no-i18n><p>${mode[1]}</p><dl>${amount > 0 ? `<div><dt>${config.mode === 'deposit' ? t.depositLabel : t.withdraw}</dt><dd>${money(amount, h)}</dd></div>` : ''}<div><dt>${t.before}</dt><dd>${money(m.availableUSDT, h)}</dd></div><div class="vault-review-after"><dt>${t.after}</dt><dd>${money(after, h)}</dd></div><div><dt>${t.locked}</dt><dd>${money(locked, h)}</dd></div></dl><p class="vault-demo-notice">${t.demoNote}</p><div class="button-row"><button class="outline-button" data-action="close-modal">${t.cancel}</button><button class="primary-button" data-action="${mode[3]}" ${config.depositId ? `data-id="${h.esc(config.depositId)}"` : ''}>${mode[2]}</button></div></div>`,
  };
}
