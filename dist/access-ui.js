import { loadAccessState, accessSummary, DEMO_ALIASES, DEMO_INVITE } from './access-model.js';

const copy = {
  ru: {
    eyebrow: 'ДОСТУП ПО ПРИГЛАШЕНИЮ', title: 'Доступ в Handshake', subtitle: 'Приглашение, профиль и проверка — один понятный путь для клиента и провайдера.',
    demo: 'Демонстрационный сценарий', demoNote: 'Всё происходит в этом браузере. Реальная регистрация и сервис KYC не подключены. Используйте только готовые образцы: паспорта, фото, email и пароли здесь не нужны.',
    invite: 'Приглашение', account: 'Профиль', verification: 'Проверка', step: 'Шаг', done: 'Готово',
    inviteTitle: 'Ваше приглашение в Handshake', inviteDescription: 'Открытой регистрации пока нет. Начните с кода приглашения.', code: 'Код приглашения', codeHelp: 'В демо принимается только тестовый код ниже.', redeem: 'Проверить приглашение', demoCode: 'Тестовое приглашение', fillInvite: 'Подставить код',
    invalidInvite: 'Код не найден. Для этого демо используйте HANDSHAKE-DEMO.', expiredInvite: 'Срок этого тестового приглашения истёк. Используйте действующий демо-код.', usedInvite: 'Это тестовое приглашение уже использовано. Попробуйте действующий демо-код.',
    accountTitle: 'Как вас представить?', accountDescription: 'Выберите вымышленный псевдоним. Персональные данные и пароль не запрашиваются.', alias: 'Демо-псевдоним', aliasHelp: 'Готовый псевдоним нужен только для этого браузера.', role: 'С чего начнёте?', client: 'Я обмениваю', provider: 'Я предлагаю ликвидность', clientDescription: 'Создавать заявки и находить встречный обмен.', providerDescription: 'Настраивать пулы и предлагать свои условия.', roleHelp: 'Роль можно переключать. Проверка обязательна для обеих.', create: 'Создать демо-профиль',
    identity: 'Образец личности', document: 'Образец документа', selfie: 'Образец селфи', review: 'Результат проверки',
    identityTitle: 'Начнём с тестовой личности', identityDescription: 'В реальном KYC на этом шаге запрашивают данные участника. Здесь используется один вымышленный образец.', sampleIdentity: 'Тестовый участник', sampleId: 'Идентификатор образца', sampleIdValue: 'DEMO-PERSON-01', sampleKind: 'Тип записи', sampleKindValue: 'Вымышленный образец', identityConfirm: 'Использовать тестовую личность без реальных данных',
    documentTitle: 'Проверим образец документа', documentDescription: 'Это демонстрационная карточка, а не удостоверение личности. Настоящие документы не загружаются и не сохраняются.', documentLabel: 'Демонстрационный документ', sampleOnly: 'ОБРАЗЕЦ · НЕ ДОКУМЕНТ', documentConfirm: 'Подтвердить проверку готового образца документа',
    selfieTitle: 'Сопоставим тестовый образец', selfieDescription: 'В реальном сервисе может потребоваться проверка присутствия. Здесь нет камеры, фотографии или распознавания лица.', selfieLabel: 'Схематичный тестовый образец, без фотографии', selfieConfirm: 'Подтвердить демо-сопоставление с тестовой личностью',
    next: 'Продолжить', reviewTitle: 'Образцы готовы к проверке', reviewDescription: 'Три шага пройдены. Отправка ниже переводит локальный сценарий в статус «На проверке»; данные никуда не уходят.', submit: 'Отправить на демо-проверку',
    pendingTitle: 'Демо-проверка на рассмотрении', pendingDescription: 'Сервис KYC не подключён. Выберите результат симуляции, чтобы посмотреть следующий экран.', approve: 'Демо: подтвердить проверку', otherScenarios: 'Другие результаты симуляции', requestChanges: 'Демо: запросить уточнение', reject: 'Демо: отклонить',
    actionTitle: 'Нужно повторить образец документа', actionDescription: 'Симуляция запроса уточнения: пройдите ещё раз шаги документа и селфи. Не загружайте настоящий документ.',
    rejectedTitle: 'Демо-проверка отклонена', rejectedDescription: 'Вы выбрали этот результат симуляции. Доступ к обменам пока закрыт; можно повторить сценарий с готовыми образцами.', retry: 'Повторить демо-проверку',
    verifiedTitle: 'Можно переходить к обмену', verifiedDescription: 'Демо-профиль готов. В этом браузере вам доступны заявки клиента и кабинет провайдера.', verifiedNote: 'Это результат симуляции. Он не подтверждает реальную личность и не даёт допуск к настоящим финансовым операциям.', continue: 'Перейти к обменам',
    verificationInfo: 'Как устроена проверка', sideTitle: 'Один профиль. Две стороны обмена.', sideText: 'Клиенты и провайдеры проходят одинаковый базовый путь. В реальном сервисе объём проверки будет зависеть от роли и направления.', privacyTitle: 'Без настоящих документов', privacyText: 'Только вымышленные образцы. Никакой съёмки, загрузки файлов или отправки в сторонний сервис.', localTitle: 'Сохраняется локально', localText: 'Шаги и псевдоним остаются в этом браузере. Это не защищённый вход в аккаунт и не синхронизация между устройствами.',
    not_started: 'Не начата', in_progress: 'Заполняется', in_review: 'На проверке · демо', verified: 'Демо-проверка пройдена', action_required: 'Нужно уточнение', rejected: 'Отклонена · демо', guest: 'Гость',
  },
  en: {
    verificationInfo: 'How verification works', eyebrow: 'BY INVITATION', title: 'Access to Handshake', subtitle: 'An invitation, a profile and verification — one clear path for clients and providers.',
    demo: 'Demo walkthrough', demoNote: 'Everything happens in this browser. Real registration and KYC are not connected. Use the supplied samples only: no passports, photos, email addresses or passwords are needed.',
    invite: 'Invitation', account: 'Profile', verification: 'Verification', step: 'Step', done: 'Done',
    inviteTitle: 'Your invitation to Handshake', inviteDescription: 'Public registration is not open. Start with an invitation code.', code: 'Invitation code', codeHelp: 'This demo accepts only the test code below.', redeem: 'Check invitation', demoCode: 'Test invitation', fillInvite: 'Use this code',
    invalidInvite: 'Code not found. Use HANDSHAKE-DEMO for this walkthrough.', expiredInvite: 'This test invitation has expired. Use the active demo code.', usedInvite: 'This test invitation has already been used. Try the active demo code.',
    accountTitle: 'How should we introduce you?', accountDescription: 'Choose a fictional alias. No personal details or password are requested.', alias: 'Demo alias', aliasHelp: 'This preset alias is used only in this browser.', role: 'Where would you like to start?', client: 'I want to exchange', provider: 'I provide liquidity', clientDescription: 'Create requests and find matching exchanges.', providerDescription: 'Set up pools and offer your terms.', roleHelp: 'You can switch roles. Both require verification.', create: 'Create demo profile',
    identity: 'Sample identity', document: 'Sample document', selfie: 'Sample selfie', review: 'Verification result',
    identityTitle: 'Start with a sample identity', identityDescription: 'Real KYC would request participant details at this step. Here, we use one fictional sample.', sampleIdentity: 'Test participant', sampleId: 'Sample identifier', sampleIdValue: 'DEMO-PERSON-01', sampleKind: 'Record type', sampleKindValue: 'Fictional sample', identityConfirm: 'Use the sample identity without real personal data',
    documentTitle: 'Check the sample document', documentDescription: 'This is a demo card, not an identity document. Real documents are neither uploaded nor saved.', documentLabel: 'Demo document', sampleOnly: 'SAMPLE · NOT A DOCUMENT', documentConfirm: 'Confirm the supplied document sample check',
    selfieTitle: 'Match the test sample', selfieDescription: 'A real service may require a liveness check. This walkthrough uses no camera, photograph or facial recognition.', selfieLabel: 'A schematic test sample without a photograph', selfieConfirm: 'Confirm the demo match with the sample identity',
    next: 'Continue', reviewTitle: 'Samples are ready for review', reviewDescription: 'All three steps are complete. Submitting below moves this local walkthrough to “Under review”; no data is sent anywhere.', submit: 'Submit for demo review',
    pendingTitle: 'Demo verification is under review', pendingDescription: 'No KYC service is connected. Choose a simulated result to see the next screen.', approve: 'Demo: approve verification', otherScenarios: 'Other simulated results', requestChanges: 'Demo: request changes', reject: 'Demo: reject',
    actionTitle: 'Repeat the document sample check', actionDescription: 'This simulates a request for clarification. Repeat the document and selfie steps. Do not upload a real document.',
    rejectedTitle: 'Demo verification rejected', rejectedDescription: 'You selected this simulated outcome. Exchanges remain unavailable; you can repeat the walkthrough using the supplied samples.', retry: 'Restart demo verification',
    verifiedTitle: 'You can start exchanging', verifiedDescription: 'Your demo profile is ready. Client requests and the provider workspace are now available in this browser.', verifiedNote: 'This is a simulated result. It does not verify a real identity or grant access to real financial transactions.', continue: 'Go to exchanges',
    sideTitle: 'One profile. Both sides of an exchange.', sideText: 'Clients and providers follow the same basic path. In a real service, verification requirements would depend on the role and exchange route.', privacyTitle: 'No real documents', privacyText: 'Fictional samples only. No camera, file uploads or submission to an external service.', localTitle: 'Saved locally', localText: 'Your steps and alias stay in this browser. This is neither secure account authentication nor cross-device synchronization.',
    not_started: 'Not started', in_progress: 'In progress', in_review: 'Under review · demo', verified: 'Demo verification complete', action_required: 'Changes required', rejected: 'Rejected · demo', guest: 'Guest',
  },
};

const errors = {
  invalid_time: ['Некорректное время действия. Обновите демо-страницу.', 'Invalid action time. Refresh the demo page.'],
  invite_already_redeemed: ['Приглашение уже принято в этом браузере. Продолжите создание профиля.', 'The invitation has already been accepted in this browser. Continue setting up your profile.'],
  invite_required: ['Сначала примите действующее демо-приглашение.', 'Accept a valid demo invitation first.'],
  account_exists: ['Демо-профиль уже создан.', 'The demo profile already exists.'],
  alias_required: ['Выберите один из готовых демо-псевдонимов.', 'Choose one of the preset demo aliases.'],
  role_required: ['Выберите начальную роль: клиент или провайдер.', 'Choose an initial role: client or provider.'],
  account_required: ['Сначала создайте демо-профиль по приглашению.', 'Create an invited demo profile first.'],
  verification_locked: ['Этот шаг сейчас недоступен. Продолжите с текущего статуса проверки.', 'This step is unavailable. Continue from the current verification status.'],
  step_out_of_order: ['Пройдите шаги проверки по порядку.', 'Complete the verification steps in order.'],
  sample_confirmation_required: ['Подтвердите использование тестового образца.', 'Confirm use of the test sample.'],
  samples_incomplete: ['Сначала пройдите все три шага с образцами.', 'Complete all three sample steps first.'],
  review_not_pending: ['Результат можно выбрать только после отправки на демо-проверку.', 'Choose a result only after submitting for demo review.'],
  invalid_review_result: ['Выберите доступный результат демо-проверки.', 'Choose a supported demo review result.'],
  restart_not_allowed: ['Повторный запуск доступен после отклонения демо-проверки.', 'Restart is available after demo verification is rejected.'],
  restart_demo: ['Начните демонстрационный сценарий заново.', 'Start the demo walkthrough again.'],
};

const languageFor = value => (typeof value === 'function' ? value() : value) === 'en' ? 'en' : 'ru';
const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
export function accessErrorMessage(error, language = 'ru') {
  const pair = errors[typeof error === 'string' ? error : error?.code];
  return pair ? pair[languageFor(language) === 'en' ? 1 : 0] : languageFor(language) === 'en' ? 'Could not complete this demo step.' : 'Не удалось выполнить этот шаг демо.';
}
export function accessStatusLabel(state, language = 'ru') {
  const summary = accessSummary(state), text = copy[languageFor(language)];
  return summary.registered ? text[summary.verificationStatus] : text.guest;
}

function progress(summary, t) {
  const current = summary.step === 'invite' ? 0 : summary.step === 'account' ? 1 : 2;
  return `<ol class="access-progress" aria-label="${t.step}">${['invite', 'account', 'verification'].map((key, index) => `<li class="${index < current || summary.verified ? 'is-done' : index === current ? 'is-current' : ''}" ${index === current && !summary.verified ? 'aria-current="step"' : ''}><span class="access-progress-number" aria-hidden="true">${index < current || summary.verified ? '✓' : index + 1}</span><span>${t[key]}</span></li>`).join('')}</ol>`;
}

function inviteForm(state, t) {
  const message = { invalid: t.invalidInvite, expired: t.expiredInvite, used: t.usedInvite }[state.invite.status];
  return `<h2>${t.inviteTitle}</h2><p class="access-description">${t.inviteDescription}</p><form id="access-invite-form" class="access-form"><label for="access-invite">${t.code}</label><input id="access-invite" name="invite" class="input-field" type="text" maxlength="40" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="HANDSHAKE-…" aria-describedby="access-invite-help${message ? ' access-invite-status' : ''}" ${message ? 'aria-invalid="true"' : ''} required><p id="access-invite-help" class="access-field-help">${t.codeHelp}</p>${message ? `<p id="access-invite-status" class="access-error" role="alert">${message}</p>` : ''}<button class="primary-button" type="submit">${t.redeem}<span aria-hidden="true">→</span></button></form><div class="access-demo-code"><div><span>${t.demoCode}</span><code>${DEMO_INVITE}</code></div><button class="text-button" type="button" data-action="access-demo-invite">${t.fillInvite}</button></div>`;
}

function accountForm(t,selectedRole='client') {
  return `<h2>${t.accountTitle}</h2><p class="access-description">${t.accountDescription}</p><form id="access-account-form" class="access-form"><label for="access-alias">${t.alias}</label><select id="access-alias" name="alias" class="select-field" aria-describedby="access-alias-help">${DEMO_ALIASES.map(alias => `<option value="${alias}">${alias}</option>`).join('')}</select><p id="access-alias-help" class="access-field-help">${t.aliasHelp}</p><fieldset class="access-role-options"><legend>${t.role}</legend>${[['client', t.client, t.clientDescription], ['provider', t.provider, t.providerDescription]].map(([role, label, description], index) => `<label class="access-role-option"><input type="radio" name="role" value="${role}" ${role === selectedRole ? 'checked' : ''}><span><strong>${label}</strong><small>${description}</small></span></label>`).join('')}</fieldset><p class="access-field-help">${t.roleHelp}</p><button class="primary-button" type="submit">${t.create}<span aria-hidden="true">→</span></button></form>`;
}

function sample(step, t) {
  if (step === 'identity') return `<div class="access-identity-sample"><span class="access-demo-avatar" aria-hidden="true">D</span><div><strong>${t.sampleIdentity}</strong><span>DEMO</span></div><dl><div><dt>${t.sampleId}</dt><dd>${t.sampleIdValue}</dd></div><div><dt>${t.sampleKind}</dt><dd>${t.sampleKindValue}</dd></div></dl></div>`;
  if (step === 'document') return `<div class="access-document-sample" role="img" aria-label="${t.documentLabel}"><span class="access-sample-top">HANDSHAKE / DEMO</span><span class="access-sample-person" aria-hidden="true"></span><div class="access-sample-lines" aria-hidden="true"><i></i><i></i><i></i></div><strong>${t.sampleOnly}</strong><span class="access-sample-id">DEMO-PERSON-01</span></div>`;
  return `<div class="access-selfie-sample" role="img" aria-label="${t.selfieLabel}"><div class="access-face-frame"><span class="access-sample-person" aria-hidden="true"></span></div><span>${t.sampleOnly}</span></div>`;
}

function sampleChecklist(state, t) {
  return `<ul class="access-checklist">${['identity', 'document', 'selfie'].map(step => `<li><span aria-hidden="true">${state.verification.checks[step] ? '✓' : '○'}</span>${t[step]}</li>`).join('')}</ul>`;
}

function verificationBody(state, t) {
  const verification = state.verification;
  if (verification.status === 'verified') return `<div class="access-result is-success"><span class="access-result-symbol" aria-hidden="true">✓</span><span class="access-status">${t.verified}</span><h2>${t.verifiedTitle}</h2><p class="access-description">${t.verifiedDescription}</p><p class="access-result-note">${t.verifiedNote}</p><button class="primary-button" data-action="access-continue">${t.continue}<span aria-hidden="true">→</span></button></div>`;
  if (verification.status === 'rejected') return `<div class="access-result"><span class="access-result-symbol" aria-hidden="true">×</span><span class="access-status">${t.rejected}</span><h2>${t.rejectedTitle}</h2><p class="access-description">${t.rejectedDescription}</p><button class="primary-button" data-action="access-restart-verification">${t.retry}</button></div>`;
  if (verification.status === 'in_review') return `<span class="access-status">${t.in_review}</span><h2>${t.pendingTitle}</h2><p class="access-description">${t.pendingDescription}</p>${sampleChecklist(state, t)}<div class="access-review-actions"><button class="primary-button" data-action="access-demo-review" data-result="verified">${t.approve}</button><details><summary>${t.otherScenarios}</summary><div class="button-row"><button class="outline-button" data-action="access-demo-review" data-result="action_required">${t.requestChanges}</button><button class="outline-button" data-action="access-demo-review" data-result="rejected">${t.reject}</button></div></details></div>`;
  if (verification.step === 'review') return `<h2>${t.reviewTitle}</h2><p class="access-description">${t.reviewDescription}</p>${sampleChecklist(state, t)}<button class="primary-button" data-action="access-submit-review">${t.submit}<span aria-hidden="true">→</span></button>`;
  const step = verification.step;
  return `${verification.status === 'action_required' ? `<div class="access-action-note" role="status"><strong>${t.actionTitle}</strong><p>${t.actionDescription}</p></div>` : ''}<div class="access-kyc-steps" aria-label="${t.verification}">${['identity', 'document', 'selfie'].map((key, index) => `<span class="${key === step ? 'is-current' : verification.checks[key] ? 'is-done' : ''}" ${key === step ? 'aria-current="step"' : ''}>${index + 1}. ${t[key]}</span>`).join('')}</div><h2>${t[`${step}Title`]}</h2><p class="access-description">${t[`${step}Description`]}</p>${sample(step, t)}<form id="access-verification-form" class="access-form" data-step="${step}"><label class="access-sample-confirm"><input type="checkbox" name="confirmed" required><span>${t[`${step}Confirm`]}</span></label><button class="primary-button" type="submit">${t.next}<span aria-hidden="true">→</span></button></form>`;
}

export function renderAccessPage(raw, options = {}) {
  const state = loadAccessState(raw), summary = accessSummary(state), language = languageFor(options.language), t = copy[language];
  const error = options.error ? accessErrorMessage(options.error, language) : '';
  const body = summary.step === 'invite' ? inviteForm(state, t) : summary.step === 'account' ? accountForm(t,options.role==='provider'?'provider':'client') : verificationBody(state, t);
  return `<div class="access-page" data-no-i18n><header class="access-header"><div><div class="eyebrow">${t.eyebrow}</div><h1>${t.title}</h1><p>${t.subtitle}</p></div><span class="demo-tag">${t.demo}</span></header>${progress(summary, t)}<div class="access-layout"><section class="card access-main" aria-label="${summary.step === 'invite' ? t.invite : summary.step === 'account' ? t.account : t.verification}">${body}${error ? `<p class="access-error" role="alert">${escape(error)}</p>` : ''}</section><aside class="access-aside"><section class="access-about"><span class="access-handshake" aria-hidden="true">🤝</span><h2>${t.sideTitle}</h2><p>${t.sideText}</p><button type="button" class="text-button" data-action="kyc-info">${t.verificationInfo}</button></section><section class="access-aside-note"><h3>${t.privacyTitle}</h3><p>${t.privacyText}</p></section><section class="access-aside-note"><h3>${t.localTitle}</h3><p>${t.localText}</p></section></aside></div><p class="access-demo-notice">${t.demoNote}</p></div>`;
}
