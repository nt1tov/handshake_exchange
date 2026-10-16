import { CITIES } from './domain.js';

const europeanCities = ['Париж', 'Барселона', 'Берлин', 'Лондон', 'Цюрих'];
const routeCities = [...new Set([...CITIES, ...europeanCities])];
const englishCities = {
  'Ереван':'Yerevan', 'Москва':'Moscow', 'Тбилиси':'Tbilisi', 'Санкт-Петербург':'Saint Petersburg',
  'Дубай':'Dubai', 'Алматы':'Almaty', 'Астана':'Astana', 'Париж':'Paris',
  'Барселона':'Barcelona', 'Берлин':'Berlin', 'Лондон':'London', 'Цюрих':'Zurich',
};
const cityLabel = (city, language) => language === 'en' ? englishCities[city] || city : city;
function nextCityPair(previous = []) {
  const choices = routeCities.filter(city => !previous.includes(city));
  return Array.from({length:2}, () => choices.splice(Math.floor(Math.random() * choices.length), 1)[0]);
}

const stories = {
  ru: {
    eyebrow: 'ПОЧЕМУ HANDSHAKE',
    title: 'Доверие начинается с рукопожатия.',
    history: 'Задолго до цифровых переводов люди передавали деньги посреднику в одном городе, а получатель забирал их у его партнёра в другом. Такие расчёты опирались на доверие и договорённости между участниками.',
    today: 'Нам близка эта идея связи между людьми. Handshake помогает найти встречную заявку или предложение провайдера, сравнить итоговые суммы и договориться об обмене — с понятными правилами и прозрачными условиями.',
    source: 'Википедия',
    sourceTitle: 'История переводов между городами',
    sourceDescription: 'Как люди переводили деньги между городами через сеть посредников.',
    sourceAction: 'Читать статью',
    imageAlt: 'Рудольф Эрнст — «Меняла»: обмен денег за столом',
    imageCredit: 'Р. Эрнст, «Меняла» · Wikimedia Commons',
    sourceUrl: 'https://ru.wikipedia.org/wiki/Хавала',
    about: 'Больше о Handshake',
  },
  en: {
    eyebrow: 'WHY HANDSHAKE',
    title: 'Trust begins with a handshake.',
    history: 'Long before digital transfers, people could give money to a broker in one city while the recipient collected it from the broker’s partner in another. These arrangements relied on trust between participants.',
    today: 'That human connection inspires Handshake: find a matching request or a provider’s offer, compare the final amounts and agree on an exchange, with clear rules and transparent terms.',
    source: 'Wikipedia',
    sourceTitle: 'A history of money transfers',
    sourceDescription: 'How people sent money between cities through a network of brokers.',
    sourceAction: 'Read the article',
    imageAlt: 'The Money Changer by Rudolf Ernst: exchanging money at a table',
    imageCredit: 'R. Ernst, The Money Changer · Wikimedia Commons',
    sourceUrl: 'https://en.wikipedia.org/wiki/Hawala',
    about: 'More about Handshake',
  },
};

export function brandStory(language = 'ru') {
  const story = stories[language] || stories.ru;
  return `<section class="brand-story" aria-labelledby="brand-story-title" data-no-i18n>
    <div class="brand-story-copy"><span class="eyebrow">${story.eyebrow}</span><h2 id="brand-story-title">${story.title}</h2><p>${story.history}</p><p>${story.today}</p><div class="brand-story-links"><button type="button" class="text-button" data-action="about">${story.about} <span aria-hidden="true">→</span></button></div></div>
    <figure class="wiki-preview">
      <a class="wiki-preview__link" href="${story.sourceUrl}" target="_blank" rel="noopener noreferrer">
        <div class="wiki-preview__art"><img src="./assets/money-changer.jpg" width="1000" height="1254" loading="lazy" decoding="async" alt="${story.imageAlt}"></div>
        <div class="wiki-preview__body">
          <span class="wiki-preview__source"><span class="wiki-preview__mark" aria-hidden="true">W</span>${story.source}<span class="wiki-preview__external" aria-hidden="true">↗</span></span>
          <h3>${story.sourceTitle}</h3><p>${story.sourceDescription}</p>
          <span class="wiki-preview__action">${story.sourceAction}<span aria-hidden="true">→</span></span>
        </div>
      </a>
      <figcaption><a href="https://commons.wikimedia.org/wiki/File:Ernst_Rudolf_The_Money_Changer.jpg" target="_blank" rel="noopener noreferrer">${story.imageCredit}</a></figcaption>
    </figure>
  </section>`;
}

export function headerCityLogo(language = 'ru', { variant = 'sidebar' } = {}) {
  const pair = nextCityPair();
  const mode = variant === 'compact' ? 'compact' : 'sidebar';
  const city = index => `<span class="header-city-logo__city" aria-hidden="true"><span data-story-city="${pair[index]}">${cityLabel(pair[index], language)}</span></span>`;
  return `<a class="brand header-city-logo header-city-logo--${mode}" href="#" data-action="home" aria-label="${language === 'en' ? 'Handshake — home' : 'Handshake — главная'}" data-no-i18n data-city-language="${language === 'en' ? 'en' : 'ru'}">${city(0)}<span class="header-city-logo__brand" aria-hidden="true"><img src="./favicon.svg" alt=""><span>handshake<span class="brand-period">.</span></span></span>${city(1)}</a>`;
}

function rotateCities(route) {
  const slots = [...route.querySelectorAll('[data-story-city]')];
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let disposed = false, visible = false, timer;
  const animations = new Set();
  const stop = () => {
    clearTimeout(timer);
    for (const animation of animations) animation.cancel();
    animations.clear();
  };
  const canRotate = () => !disposed && visible && !document.hidden && !motion.matches;
  const animate = async (slot, frames, options) => {
    const animation = slot.animate(frames, options);
    animations.add(animation);
    try { await animation.finished; }
    finally { animations.delete(animation); animation.cancel(); }
  };
  const schedule = () => {
    clearTimeout(timer);
    if (canRotate()) timer = setTimeout(rotate, 3400);
  };
  async function rotate() {
    if (!canRotate()) return;
    const pair = nextCityPair(slots.map(slot => slot.dataset.storyCity));
    try {
      await Promise.all(slots.map(async (slot, index) => {
        await animate(slot, [{opacity:1, transform:'translateY(0)'}, {opacity:0, transform:'translateY(-10px)'}], {duration:240, delay:index*140, easing:'ease-in', fill:'forwards'});
        if (!canRotate()) return;
        slot.dataset.storyCity = pair[index];
        slot.textContent = cityLabel(pair[index], route.dataset.cityLanguage);
        await animate(slot, [{opacity:0, transform:'translateY(10px)'}, {opacity:1, transform:'translateY(0)'}], {duration:420, easing:'cubic-bezier(.2,.7,.2,1)', fill:'both'});
      }));
    } catch (error) {
      if (error.name !== 'AbortError') throw error;
    } finally { schedule(); }
  }
  const update = () => { stop(); schedule(); };
  const observer = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    update();
  }, {threshold:0.15});
  observer.observe(route);
  motion.addEventListener('change', update);
  document.addEventListener('visibilitychange', update);
  return () => {
    disposed = true;
    stop();
    observer.disconnect();
    motion.removeEventListener('change', update);
    document.removeEventListener('visibilitychange', update);
  };
}

export function startCityRotation(root) {
  const cleanups = [...root.querySelectorAll('.header-city-logo')].map(rotateCities);
  return () => cleanups.forEach(cleanup => cleanup());
}
