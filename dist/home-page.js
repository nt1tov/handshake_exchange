import { brandStory, aboutArtwork } from './brand-story.js?v=20261016-home-showcase';
import { currencyOrbits } from './currency-orbits.js?v=20261016-orbits2';

const copy = {
  ru: {
    eyebrow: 'Сервис поиска прямых обменов',
    title: 'Обмен через рукопожатие',
    description: 'Находим встречные заявки и предложения провайдеров для вашего обмена.',
    create: 'Создать заявку',
    demo: 'Демо · без реальных переводов',
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
    description: 'Find matching requests and provider offers for your currency exchange.',
    create: 'Create a request',
    demo: 'Demo · no real transfers',
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
    <section class="home-hero home-showcase" aria-labelledby="home-title">
      ${currencyOrbits()}
      <div class="home-hero-copy"><div class="eyebrow">${text.eyebrow}</div><h1 id="home-title">${text.title}</h1><p class="home-lead">${text.description}</p><div class="home-actions"><button type="button" class="primary-button" data-action="new-order">${text.create}<span aria-hidden="true">↗</span></button></div><div class="home-demo">${text.demo}</div></div>
      ${aboutArtwork(language)}
    </section>
    ${brandStory(language)}
    <section class="home-facts" aria-label="${text.factsLabel}">${text.facts.map(fact => `<article class="home-fact"><span class="home-fact-value" aria-hidden="true">${fact.value}</span><div><h2>${fact.title}</h2><p>${fact.text}</p></div></article>`).join('')}</section>
  </div>`;
}
