// Генерация иконок и splash из public/logo.svg.
// Источник правды — один SVG: меняем его и перегенерируем всё остальное.
//
//   node scripts/gen-icons.mjs
//
// Результат:
//   resources/icon.png              1024×1024 — общая иконка (Android, iOS)
//   resources/icon-foreground.png   прозрачный слой для adaptive icon
//   resources/icon-background.png   фон adaptive icon
//   resources/splash.png            2732×2732 — заставка Android
//   build/icon.ico                  многоразмерная иконка Windows (exe + установщик)

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import sharp from 'sharp';

const BRAND = '#0f766e';
const ICON_SIZE = 1024;
const SPLASH_SIZE = 2732;
const ICO_SIZES = [16, 24, 32, 48, 64, 128, 256];

const logoSvg = await readFile('public/logo.svg', 'utf8');

// Белая марка без подложки — для foreground и splash.
const markSvg = logoSvg
  .replace(/<rect[^>]*\/>\s*/, '')
  .replace('<svg ', `<svg fill="${BRAND}" `)
  .replace(/fill="#ffffff"/g, 'fill="#ffffff"');

const markPng = await sharp(Buffer.from(markSvg), { density: 384 })
  .trim({ threshold: 1 })
  .resize(560, 560, { fit: 'inside' })
  .png()
  .toBuffer();

await mkdir('resources', { recursive: true });
await mkdir('build', { recursive: true });

// Основная иконка: логотип на брендовом фоне, во весь квадрат.
const iconPng = await sharp({
  create: { width: ICON_SIZE, height: ICON_SIZE, channels: 4, background: BRAND },
})
  .composite([{ input: await sharp(Buffer.from(logoSvg), { density: 384 }).resize(ICON_SIZE, ICON_SIZE).png().toBuffer() }])
  .png()
  .toBuffer();

await writeFile('resources/icon.png', iconPng);

// Adaptive icon: фон отдельно, марка отдельно с полями безопасной зоны.
await writeFile(
  'resources/icon-background.png',
  await sharp({ create: { width: ICON_SIZE, height: ICON_SIZE, channels: 4, background: BRAND } }).png().toBuffer(),
);

await writeFile(
  'resources/icon-foreground.png',
  await sharp({ create: { width: ICON_SIZE, height: ICON_SIZE, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: markPng, gravity: 'center' }])
    .png()
    .toBuffer(),
);

// Splash: брендовый фон, марка по центру.
await writeFile(
  'resources/splash.png',
  await sharp({ create: { width: SPLASH_SIZE, height: SPLASH_SIZE, channels: 4, background: BRAND } })
    .composite([{ input: await sharp(markPng).resize(900, 900).toBuffer(), gravity: 'center' }])
    .png()
    .toBuffer(),
);

// ICO: контейнер с PNG-кадрами, поддержан Windows Vista+.
const frames = [];
for (const size of ICO_SIZES) {
  frames.push({ size, buf: await sharp(iconPng).resize(size, size).png().toBuffer() });
}

const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(frames.length, 4);

let offset = 6 + 16 * frames.length;
const entries = frames.map(({ size, buf }) => {
  const entry = Buffer.alloc(16);
  entry.writeUInt8(size === 256 ? 0 : size, 0);
  entry.writeUInt8(size === 256 ? 0 : size, 1);
  entry.writeUInt8(0, 2);
  entry.writeUInt8(0, 3);
  entry.writeUInt16LE(1, 4);
  entry.writeUInt16LE(32, 6);
  entry.writeUInt32LE(buf.length, 8);
  entry.writeUInt32LE(offset, 12);
  offset += buf.length;
  return entry;
});

await writeFile('build/icon.ico', Buffer.concat([header, ...entries, ...frames.map((f) => f.buf)]));

const pngFiles = [
  'resources/icon.png',
  'resources/icon-foreground.png',
  'resources/icon-background.png',
  'resources/splash.png',
];

const sizes = {};
for (const file of pngFiles) {
  const meta = await sharp(file).metadata();
  sizes[file] = `${meta.width}×${meta.height}${meta.hasAlpha ? ', alpha' : ''}`;
}

const ico = await readFile('build/icon.ico');
sizes['build/icon.ico'] = `${ico.readUInt16LE(4)} кадров, ${Math.round(ico.length / 1024)} КБ`;

console.log('Готово:');
for (const [file, info] of Object.entries(sizes)) console.log(`  ${file.padEnd(34)} ${info}`);
