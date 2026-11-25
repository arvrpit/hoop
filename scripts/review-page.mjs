// Turns dist-review/index.html into the page body published as the shareable review artifact
// (the artifact host adds its own <html>/<head>/<body>). Run after `npm run build:review`.
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
const html = readFileSync('dist-review/index.html', 'utf8');
const src = html.match(/<script type="module"[^>]*src="([^"]+)"/)[1];
const cssHref = html.match(/<link rel="stylesheet"[^>]*href="([^"]+)"/)?.[1];
const css = cssHref ? readFileSync(`dist-review/${cssHref.replace(/^\.\//, '')}`, 'utf8') : '';
mkdirSync('review/artifact', { recursive: true });
writeFileSync(
  'review/artifact/index.html',
  `<title>Hoop Look Test</title>
<style>
  :root { color-scheme: dark; --table: #3a2f27; --ink: #efe6da; }
  html, body, #root { height: 100%; }
  body { margin: 0; background: var(--table); color: var(--ink); overflow: hidden;
    font-family: ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif; }
  ${css}
</style>
<div id="root"></div>
<script type="module" crossorigin src="${src.replace(/^\.\//, './')}"></script>
`,
);
console.log('assets:', readdirSync('dist-review/assets').join(', '));
