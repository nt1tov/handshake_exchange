export function formatMoney(value, language = 'ru') {
  const amount = Number(value);
  return Number.isFinite(amount)
    ? new Intl.NumberFormat(language === 'en' ? 'en-US' : 'ru-RU', {
      minimumFractionDigits: 2, maximumFractionDigits: 2,
    }).format(amount)
    : '—';
}
