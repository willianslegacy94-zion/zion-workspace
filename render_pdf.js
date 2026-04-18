// Renderiza cada página do PDF como PNG para inspeção visual
const { createCanvas } = require('canvas');
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.mjs');
const fs = require('fs');
const path = require('path');

pdfjsLib.GlobalWorkerOptions.workerSrc = false;

async function renderPDF(pdfPath, scale = 0.5) {
  const data = new Uint8Array(fs.readFileSync(pdfPath));
  const pdf  = await pdfjsLib.getDocument({ data, disableFontFace: true }).promise;
  console.log(`Páginas: ${pdf.numPages}`);

  for (let i = 1; i <= pdf.numPages; i++) {
    const page     = await pdf.getPage(i);
    const viewport = page.getViewport({ scale });
    const canvas   = createCanvas(viewport.width, viewport.height);
    const ctx      = canvas.getContext('2d');

    await page.render({ canvasContext: ctx, viewport }).promise;

    const outFile = path.join(__dirname, `preview_page${i}.png`);
    fs.writeFileSync(outFile, canvas.toBuffer('image/png'));
    console.log(`Salvo: ${outFile}`);
  }
}

renderPDF('PARA Dr. José Osmando (1).pdf', 0.5).catch(console.error);
