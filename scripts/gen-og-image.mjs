// Renders scripts/og-image-template.html to public/og-image.png at 1200x630.
// Run with: pnpm node scripts/gen-og-image.mjs
//
// Uses Playwright (already in devDependencies via @playwright/test). Requires
// a one-time `pnpm playwright install chromium` if the browser binary isn't
// already present on this machine.

import { chromium } from '@playwright/test';
import { fileURLToPath, pathToFileURL } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const htmlPath = resolve(__dirname, 'og-image-template.html');
const outPath = resolve(__dirname, '..', 'public', 'og-image.png');

const browser = await chromium.launch();
try {
  const page = await browser.newPage({
    viewport: { width: 1200, height: 630 },
    deviceScaleFactor: 1,
  });
  await page.goto(pathToFileURL(htmlPath).toString());
  await page.screenshot({ path: outPath, type: 'png', omitBackground: false });
  console.log(`Wrote ${outPath}`);
} finally {
  await browser.close();
}
