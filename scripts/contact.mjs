// Build a labelled contact sheet from screenshots. Usage:
//   node scripts/contact.mjs out.png 3 review/m1/a.png review/m1/b.png ...
import { chromium } from '@playwright/test';
import { resolve, basename, dirname } from 'node:path';
import { writeFileSync, unlinkSync } from 'node:fs';
const [out, cols, ...files] = process.argv.slice(2);
const w = Number(process.env.SHEET_W || 1800);
const cw = Math.floor(w / Number(cols));
const html = `<html><body style="margin:0;background:#222;display:grid;grid-template-columns:repeat(${cols},${cw}px);gap:0">
${files.map((f) => `<figure style="margin:0;position:relative"><img src="file://${resolve(f)}" style="width:${cw}px;display:block"><figcaption style="position:absolute;left:6px;top:4px;font:600 14px system-ui;color:#fff;text-shadow:0 0 3px #000">${basename(f, '.png')}</figcaption></figure>`).join('')}
</body></html>`;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: w, height: 800 } });
const tmp = resolve(dirname(files[0]), '.contact.html');
writeFileSync(tmp, html);
await page.goto(`file://${tmp}`, { waitUntil: 'load' });
unlinkSync(tmp);
await page.screenshot({ path: out, fullPage: true });
await browser.close();
