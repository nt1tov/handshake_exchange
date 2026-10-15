import qrcode from './vendor/qrcode-generator-2.0.4.mjs';

export function createQRCode(url) {
  if (typeof url !== 'string' || !/^https?:\/\//.test(url) || url.length > 2000 || /[^\x21-\x7e]/.test(url)) {
    throw new Error('Ссылка слишком длинная или некорректна для QR-кода.');
  }
  const parsed = new URL(url);
  if (!parsed.hostname || parsed.username || parsed.password) throw new Error('Некорректная ссылка для QR-кода.');
  const code = qrcode(0, 'M');
  code.addData(url, 'Byte');
  code.make();
  const svg = code.createSvgTag({ cellSize: 4, margin: 16 });
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
