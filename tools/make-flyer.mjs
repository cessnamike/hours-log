// Prints tools/flyer.html to public/flyer.pdf (one US Letter page, wall poster)
// and public/flyer.png (the poster as a 1639x2048 picture, for Facebook and
// for the preview on /poster/).
// Needs playwright-core and a Chromium browser. Usage:
//   node tools/make-flyer.mjs [path-to-browser]
// The QR code is tools/flyer-qr.svg (made once with the npm package qrcode).
// Default browser: Microsoft Edge on Windows. playwright-core is not a project
// dependency; set PLAYWRIGHT_FROM to a folder whose node_modules has it.
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const from = process.env.PLAYWRIGHT_FROM || path.join(here, '..');
const { chromium } = createRequire(path.join(from, 'package.json'))('playwright-core');
const browserPath = process.argv[2] || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const src = pathToFileURL(path.join(here, 'flyer.html')).href;

const browser = await chromium.launch({ executablePath: browserPath, headless: true });
const page = await browser.newPage();
await page.goto(src);
await page.pdf({ path: path.join(here, '..', 'public', 'flyer.pdf'), format: 'Letter', preferCSSPageSize: true, printBackground: true });
const pages = await page.evaluate(() => Math.ceil(document.body.scrollHeight / (11 * 96 - 0.9 * 96)));

// Picture for Facebook: the poster's printable area (7.4in wide) with thin white margins,
// framed at 4:5 (Facebook's tallest feed shape, so nothing is cropped) and 2048 px tall
// (Facebook's largest size before it shrinks a photo). Result: 1638x2048.
const PAD = 28, H_PX = 2048, RATIO = 0.8;
const measure = await browser.newPage({ viewport: { width: 710, height: 1000 } });
await measure.goto(src); await measure.emulateMedia({ media: 'print' });
await measure.addStyleTag({ content: 'body{width:710px}' });
const contentH = await measure.evaluate(() => document.body.scrollHeight);
const totalH = contentH + 2 * PAD, totalW = Math.round(totalH * RATIO);
const pic = await browser.newPage({ viewport: { width: totalW, height: totalH }, deviceScaleFactor: H_PX / totalH });
await pic.goto(src); await pic.emulateMedia({ media: 'print' });
await pic.addStyleTag({ content: `html{background:#fff} body{width:710px;margin:${PAD}px auto;background:#fff}` });
await pic.screenshot({ path: path.join(here, '..', 'public', 'flyer.png'), clip: { x: 0, y: 0, width: totalW, height: totalH } });

await browser.close();
console.log(`Wrote public/flyer.pdf (about ${pages} page${pages === 1 ? '' : 's'}) and public/flyer.png`);
