// Average sRGB colour of small boxes in a screenshot. Usage: node scripts/sample.mjs img.png x,y,w,h ...
import { chromium } from '@playwright/test';
import { resolve, dirname } from 'node:path';
import { writeFileSync, unlinkSync, readFileSync } from 'node:fs';
const [img, ...boxes] = process.argv.slice(2);
const tmp = resolve(dirname(img), '.sample.html');
writeFileSync(tmp, `<img id=i src="data:image/png;base64,${readFileSync(img).toString('base64')}">`);
const b = await chromium.launch();
const p = await b.newPage();
await p.goto(`file://${tmp}`);
await p.waitForFunction(() => document.getElementById('i').complete);
const out = await p.evaluate((boxes) => {
  const im = document.getElementById('i');
  const c = document.createElement('canvas');
  c.width = im.naturalWidth; c.height = im.naturalHeight;
  const g = c.getContext('2d'); g.drawImage(im, 0, 0);
  return boxes.map((bx) => {
    const [x, y, w, h] = bx.split(',').map(Number);
    const d = g.getImageData(x, y, w, h).data; let r = 0, gg = 0, bb = 0;
    for (let i = 0; i < d.length; i += 4) { r += d[i]; gg += d[i + 1]; bb += d[i + 2]; }
    const n = d.length / 4; return `${bx} -> rgb(${(r / n) | 0}, ${(gg / n) | 0}, ${(bb / n) | 0})`;
  });
}, boxes);
console.log(out.join('\n'));
unlinkSync(tmp); await b.close();
