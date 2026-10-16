import { CURRENCIES } from './domain.js';

const tracks = [
  { rx: .415, ry: .34, tilt: -18, phase: -72 * Math.PI / 180, period: 36 },
  { rx: .35, ry: .425, tilt: 24, phase: -24 * Math.PI / 180, period: 36 },
  { rx: .43, ry: .365, tilt: -38, phase: 128 * Math.PI / 180, period: 36 },
  { rx: .385, ry: .39, tilt: 42, phase: 138 * Math.PI / 180, period: 36 },
];
const initialCodes = ['RUB', 'USD', 'EUR', 'USDT'];
const shuffled = values => {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index--) {
    const other = Math.floor(Math.random() * (index + 1));
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
};
function position(track, angle, width, height) {
  const tilt = track.tilt * Math.PI / 180;
  const x = Math.cos(angle) * width * track.rx, y = Math.sin(angle) * height * track.ry;
  return { x: x * Math.cos(tilt) - y * Math.sin(tilt), y: x * Math.sin(tilt) + y * Math.cos(tilt) };
}

export function currencyOrbits() {
  return `<div class="home-hero-art currency-orbits" aria-hidden="true">
    ${tracks.map((track, index) => {
      const currency = CURRENCIES.find(item => item.code === initialCodes[index]);
      const point = position(track, track.phase, 100, 100);
      return `<span class="currency-orbits__track" style="width:${track.rx * 200}%;height:${track.ry * 200}%;transform:translate(-50%,-50%) rotate(${track.tilt}deg)"></span><span class="currency-orbits__satellite" data-orbit="${index}" style="left:${50 + point.x}%;top:${50 + point.y}%"><span class="currency-orbits__card" data-currency="${currency.code}"><span class="currency-orbits__glyph">${currency.symbol}</span><span class="currency-orbits__code">${currency.code}</span></span></span>`;
    }).join('')}
    <div class="home-art-logo"><img src="./favicon.svg" width="84" height="84" alt=""><span>handshake<span class="home-art-period">.</span></span></div>
  </div>`;
}

export function startCurrencyOrbits(root) {
  const art = root.querySelector('.currency-orbits');
  if (!art) return () => {};
  const satellites = [...art.querySelectorAll('[data-orbit]')];
  const cards = satellites.map(item => item.querySelector('[data-currency]'));
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let disposed = false, visible = false, frame, timer, lastFrame, elapsed = 0, nextCard = 0;
  let width = art.clientWidth, height = art.clientHeight;
  let queue = shuffled(CURRENCIES.map(item => item.code).filter(code => !initialCodes.includes(code)));
  const animations = new Set();
  const canRun = () => !disposed && visible && !document.hidden && !motion.matches && width > 0 && height > 0;

  const paint = () => satellites.forEach((satellite, index) => {
    const track = tracks[index];
    const angle = track.phase + elapsed / (track.period * 1000) * Math.PI * 2;
    const point = position(track, angle, width, height);
    satellite.style.left = `${width / 2 + point.x}px`;
    satellite.style.top = `${height / 2 + point.y}px`;
  });
  const tick = timestamp => {
    if (!canRun()) return;
    if (lastFrame !== undefined) elapsed += Math.min(timestamp - lastFrame, 64);
    lastFrame = timestamp;
    paint();
    frame = requestAnimationFrame(tick);
  };
  const stop = () => {
    cancelAnimationFrame(frame);
    clearTimeout(timer);
    lastFrame = undefined;
    for (const animation of animations) animation.cancel();
    animations.clear();
  };
  const animate = async (card, frames, options) => {
    const animation = card.animate(frames, options);
    animations.add(animation);
    try { await animation.finished; }
    finally { animations.delete(animation); animation.cancel(); }
  };
  const schedule = () => {
    clearTimeout(timer);
    if (canRun()) timer = setTimeout(swapCurrency, 2600);
  };
  async function swapCurrency() {
    if (!canRun()) return;
    const card = cards[nextCard++ % cards.length];
    const visibleCodes = cards.map(item => item.dataset.currency);
    queue = queue.filter(code => !visibleCodes.includes(code));
    if (!queue.length) queue = shuffled(CURRENCIES.map(item => item.code).filter(code => !visibleCodes.includes(code)));
    const currency = CURRENCIES.find(item => item.code === queue.shift());
    if (!currency) return;
    try {
      await animate(card, [{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(.88)' }], { duration: 220, easing: 'ease-in', fill: 'forwards' });
      if (!canRun()) return;
      card.dataset.currency = currency.code;
      card.querySelector('.currency-orbits__glyph').textContent = currency.symbol;
      card.querySelector('.currency-orbits__code').textContent = currency.code;
      await animate(card, [{ opacity: 0, transform: 'scale(.88)' }, { opacity: 1, transform: 'scale(1)' }], { duration: 380, easing: 'cubic-bezier(.2,.7,.2,1)', fill: 'both' });
    } catch (error) {
      if (error.name !== 'AbortError') throw error;
    } finally { schedule(); }
  }
  const update = () => {
    stop();
    paint();
    if (canRun()) { frame = requestAnimationFrame(tick); schedule(); }
  };
  const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; update(); }, { threshold: .1 });
  const resize = new ResizeObserver(() => { width = art.clientWidth; height = art.clientHeight; update(); });
  observer.observe(art);
  resize.observe(art);
  motion.addEventListener('change', update);
  document.addEventListener('visibilitychange', update);
  paint();
  return () => {
    disposed = true;
    stop();
    observer.disconnect();
    resize.disconnect();
    motion.removeEventListener('change', update);
    document.removeEventListener('visibilitychange', update);
  };
}
