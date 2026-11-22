// Prints tools/flyer.html to public/flyer.pdf (one US Letter page, wall poster)
// and public/flyer.png (the same page as a picture, 1632x2112, for Facebook and
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

// Picture: the Letter page at 96 px/in, 2x scale, with the print margins drawn as white space.
const pic = await browser.newPage({ viewport: { width: 816, height: 1056 }, deviceScaleFactor: 2 });
await pic.goto(src);
await pic.emulateMedia({ media: 'print' });
await pic.addStyleTag({ content: 'html{background:#fff} body{padding:0.45in 0.55in;height:11in;overflow:hidden;background:#fff}' });
await pic.screenshot({ path: path.join(here, '..', 'public', 'flyer.png'), clip: { x: 0, y: 0, width: 816, height: 1056 } });

await browser.close();
console.log(`Wrote public/flyer.pdf (about ${pages} page${pages === 1 ? '' : 's'}) and public/flyer.png`);
