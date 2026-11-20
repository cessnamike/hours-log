// Prints tools/paper-log.html to public/paper-log.pdf (one US Letter page).
// Needs playwright-core and a Chromium browser. Usage:
//   node tools/make-paper-log.mjs [path-to-browser]
// Default browser: Microsoft Edge on Windows. playwright-core is not a project
// dependency; set PLAYWRIGHT_FROM to a folder whose node_modules has it.
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const from = process.env.PLAYWRIGHT_FROM || path.join(here, '..');
const { chromium } = createRequire(path.join(from, 'package.json'))('playwright-core');
const browserPath = process.argv[2] || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';

const browser = await chromium.launch({ executablePath: browserPath, headless: true });
const page = await browser.newPage();
await page.goto(pathToFileURL(path.join(here, 'paper-log.html')).href);
await page.pdf({ path: path.join(here, '..', 'public', 'paper-log.pdf'), format: 'Letter', preferCSSPageSize: true, printBackground: true });
const pages = await page.evaluate(() => Math.ceil(document.body.scrollHeight / (11 * 96 - 0.9 * 96)));
await browser.close();
console.log(`Wrote public/paper-log.pdf (about ${pages} page${pages === 1 ? '' : 's'})`);
