const stories = {
  ru: {
    eyebrow: 'ПОЧЕМУ HANDSHAKE',
    title: 'Доверие начинается с рукопожатия.',
    history: 'Задолго до цифровых переводов люди передавали деньги посреднику в одном городе, а получатель забирал их у его партнёра в другом. В системе хавала такие расчёты опирались на доверие и договорённости между участниками.',
    today: 'Нам близка эта идея связи между людьми. Handshake помогает найти встречную заявку или предложение провайдера, сравнить итоговые суммы и договориться об обмене — с понятными правилами и прозрачными условиями.',
    firstCity: 'Один город',
    secondCity: 'Другой город',
    source: 'Об истории хавалы — Википедия',
    sourceUrl: 'https://ru.wikipedia.org/wiki/Хавала',
    about: 'Больше о Handshake',
  },
  en: {
    eyebrow: 'WHY HANDSHAKE',
    title: 'Trust begins with a handshake.',
    history: 'Long before digital transfers, people could give money to a broker in one city while the recipient collected it from the broker’s partner in another. In hawala, these arrangements relied on trust between participants.',
    today: 'That human connection inspires Handshake: find a matching request or a provider’s offer, compare the final amounts and agree on an exchange, with clear rules and transparent terms.',
    firstCity: 'One city',
    secondCity: 'Another city',
    source: 'The history of hawala — Wikipedia',
    sourceUrl: 'https://en.wikipedia.org/wiki/Hawala',
    about: 'More about Handshake',
  },
};

export function brandStory(language = 'ru') {
  const story = stories[language] || stories.ru;
  return `<section class="brand-story" aria-labelledby="brand-story-title" data-no-i18n>
    <div class="brand-story-route" aria-hidden="true"><span>${story.firstCity}</span><span class="brand-story-arrow">→</span><span class="brand-story-wordmark">handshake.</span><span class="brand-story-arrow">→</span><span>${story.secondCity}</span></div>
    <div class="brand-story-copy"><span class="eyebrow">${story.eyebrow}</span><h2 id="brand-story-title">${story.title}</h2><p>${story.history}</p><p>${story.today}</p><div class="brand-story-links"><a href="${story.sourceUrl}" target="_blank" rel="noopener noreferrer">${story.source}</a><button type="button" class="text-button" data-action="about">${story.about}</button></div></div>
  </section>`;
}
