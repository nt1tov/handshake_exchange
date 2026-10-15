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
    history: 'Задолго до цифровых переводов люди передавали деньги посреднику в одном городе, а получатель забирал их у его партнёра в другом. В системе хавала такие расчёты опирались на доверие и договорённости между участниками.',
    today: 'Нам близка эта идея связи между людьми. Handshake помогает найти встречную заявку или предложение провайдера, сравнить итоговые суммы и договориться об обмене — с понятными правилами и прозрачными условиями.',
    source: 'Об истории хавалы — Википедия',
    sourceUrl: 'https://ru.wikipedia.org/wiki/Хавала',
    about: 'Больше о Handshake',
  },
  en: {
    eyebrow: 'WHY HANDSHAKE',
    title: 'Trust begins with a handshake.',
    history: 'Long before digital transfers, people could give money to a broker in one city while the recipient collected it from the broker’s partner in another. In hawala, these arrangements relied on trust between participants.',
    today: 'That human connection inspires Handshake: find a matching request or a provider’s offer, compare the final amounts and agree on an exchange, with clear rules and transparent terms.',
    source: 'The history of hawala — Wikipedia',
    sourceUrl: 'https://en.wikipedia.org/wiki/Hawala',
    about: 'More about Handshake',
  },
};

export function brandStory(language = 'ru') {
  const story = stories[language] || stories.ru;
  const pair = nextCityPair();
  const city = index => `<span class="brand-story-city"><span data-story-city="${pair[index]}">${cityLabel(pair[index], language)}</span></span>`;
  return `<section class="brand-story" aria-labelledby="brand-story-title" data-no-i18n>
    <div class="brand-story-route" aria-hidden="true" data-city-language="${language === 'en' ? 'en' : 'ru'}">${city(0)}<span class="brand-story-arrow">→</span><span class="brand-story-wordmark">handshake.</span><span class="brand-story-arrow">→</span>${city(1)}</div>
    <div class="brand-story-copy"><span class="eyebrow">${story.eyebrow}</span><h2 id="brand-story-title">${story.title}</h2><p>${story.history}</p><p>${story.today}</p><div class="brand-story-links"><a href="${story.sourceUrl}" target="_blank" rel="noopener noreferrer">${story.source}</a><button type="button" class="text-button" data-action="about">${story.about}</button></div></div>
  </section>`;
}

export function startCityRotation(root) {
  const route = root.querySelector('.brand-story-route');
  if (!route) return () => {};
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
