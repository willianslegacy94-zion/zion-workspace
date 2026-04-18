import { createCanvas } from 'canvas';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Node.js não usa worker thread para pdfjs — desabilitar via fake worker
const workerPath = new URL('./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs', import.meta.url);
pdfjsLib.GlobalWorkerOptions.workerSrc = workerPath.href;

const data = new Uint8Array(readFileSync(join(__dirname, 'PARA Dr. José Osmando (1).pdf')));
const pdf  = await pdfjsLib.getDocument({ data, disableFontFace: true }).promise;
console.log(`Páginas: ${pdf.numPages}`);

for (let i = 1; i <= pdf.numPages; i++) {
  const page     = await pdf.getPage(i);
  const viewport = page.getViewport({ scale: 0.5 });
  const canvas   = createCanvas(viewport.width, viewport.height);
  const ctx      = canvas.getContext('2d');

  await page.render({ canvasContext: ctx, viewport }).promise;

  const outFile = join(__dirname, `preview_page${i}.png`);
  writeFileSync(outFile, canvas.toBuffer('image/png'));
  console.log(`Salvo: preview_page${i}.png (${viewport.width}x${viewport.height})`);
}
