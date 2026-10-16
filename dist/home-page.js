import { brandStory } from './brand-story.js?v=20261016-wiki';
import { currencyOrbits } from './currency-orbits.js?v=20261016-orbits2';

const copy = {
  ru: {
    eyebrow: 'Сервис поиска прямых обменов',
    title: 'Обмен через рукопожатие',
    description: 'Встречные заявки клиентов и предложения провайдеров — в одном месте. Выберите, что и как обменять. Мы поможем найти подходящие условия.',
    create: 'Создать заявку',
    provider: 'Кабинет провайдера',
    demo: 'Интерактивный прототип',
    demoNote: 'Можно попробовать обмен. Реальные деньги не переводятся.',
    factsLabel: 'Принципы Handshake',
    facts: [
      { value: '0%', title: 'За прямой обмен', text: 'Без комиссии Handshake между клиентами. Сборы банка или сети могут сохраняться.' },
      { value: '₽ · € · ₮', title: 'Ваш способ расчёта', text: 'Банк, наличные или крипта. С подходящим городом, платёжным сервисом и сетью.' },
      { value: 'KYC', title: 'Проверка обеих сторон', text: 'Для клиентов и провайдеров предусмотрена проверка. В прототипе KYC ещё не подключён.' },
    ],
  },
  en: {
    eyebrow: 'Find direct exchanges',
    title: 'Exchange with a handshake',
    description: 'Matching client requests and provider offers, all in one place. Choose what to exchange and how. We’ll help you find terms that fit.',
    create: 'Create a request',
    provider: 'Provider workspace',
    demo: 'Interactive prototype',
    demoNote: 'Try an exchange. No real money is transferred.',
    factsLabel: 'Handshake principles',
    facts: [
      { value: '0%', title: 'For direct exchanges', text: 'No Handshake fee between clients. Bank or network fees may still apply.' },
      { value: '₽ · € · ₮', title: 'Your payment method', text: 'Bank, cash or crypto. With the right city, payment service and network.' },
      { value: 'KYC', title: 'Verification for both sides', text: 'Verification is planned for clients and providers. KYC is not connected in the prototype yet.' },
    ],
  },
};

export function homePage(language = 'ru') {
  const text = copy[language] || copy.ru;
  return `<div class="home-page" data-no-i18n>
    <section class="home-hero" aria-labelledby="home-title">
      <div class="home-hero-copy"><div class="eyebrow">${text.eyebrow}</div><h1 id="home-title">${text.title}</h1><p class="home-lead">${text.description}</p><div class="home-actions"><button type="button" class="primary-button" data-action="new-order">${text.create}<span aria-hidden="true">↗</span></button><button type="button" class="outline-button" data-action="open-feed">${text.provider}</button></div><div class="home-demo"><span class="demo-tag"><i></i>${text.demo}</span><span>${text.demoNote}</span></div></div>
      ${currencyOrbits()}
    </section>
    ${brandStory(language)}
    <section class="home-facts" aria-label="${text.factsLabel}">${text.facts.map(fact => `<article class="home-fact"><span class="home-fact-value" aria-hidden="true">${fact.value}</span><div><h2>${fact.title}</h2><p>${fact.text}</p></div></article>`).join('')}</section>
  </div>`;
}
