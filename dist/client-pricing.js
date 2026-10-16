// Pricing is independent of endpoints, the order book and presentation formatting.
const cryptoCurrencies = new Set(['USDT', 'USDC']);

function positive(value, label) {
  if (!['number', 'string'].includes(typeof value) || String(value).trim() === '') throw new Error(`${label}: укажите число.`);
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) throw new Error(`${label}: укажите положительное конечное число.`);
  return number;
}

function rounded(value, code, up = false) {
  const factor = cryptoCurrencies.has(code) ? 1e6 : 100;
  const scaled = value * factor;
  if (!Number.isFinite(scaled)) throw new Error('Сумма обмена слишком велика.');
  const epsilon = Number.EPSILON * Math.max(1, Math.abs(scaled)) * 4;
  return (up ? Math.ceil(scaled - epsilon) : Math.round(scaled + epsilon)) / factor;
}

export function calculateClientPricing(draft, { referenceRate } = {}) {
  const pricingMode = draft?.pricingMode === undefined ? 'auto' : draft.pricingMode;
  if (!['auto', 'manual'].includes(pricingMode)) throw new Error('Выберите автоматический или свой курс.');
  if (!draft?.give?.currency || !draft?.receive?.currency) throw new Error('Выберите валюты обмена.');
  if (draft.give.currency === draft.receive.currency) throw new Error('Выберите разные валюты для отправки и получения.');
  const amount = positive(rounded(positive(draft.amount, 'Сумма отправки'), draft.give.currency), 'Сумма отправки');
  if (pricingMode === 'manual') {
    const manualRate = positive(draft.manualRate, 'Свой курс');
    const minReceive = positive(rounded(amount * manualRate, draft.receive.currency, true), 'Минимальная сумма получения');
    return { pricingMode, amount, minReceive, rate: manualRate, manualRate };
  }
  const minimum = draft.minReceive ?? amount * positive(referenceRate, 'Демонстрационный курс');
  const minReceive = positive(rounded(positive(minimum, 'Минимальная сумма получения'), draft.receive.currency), 'Минимальная сумма получения');
  return { pricingMode, amount, minReceive, rate: minReceive / amount };
}

// Display units only: callers must keep the original rate for calculations.
export function rateDisplay(value) {
  const rate = positive(value, 'Курс');
  const exponent = rate < 0.01 ? Math.ceil(-Math.log10(rate)) : 0;
  const base = 10 ** exponent;
  const quote = base * rate;
  if (!Number.isFinite(base) || !Number.isFinite(quote)) throw new Error('Курс слишком мал для отображения.');
  return { base, quote };
}
