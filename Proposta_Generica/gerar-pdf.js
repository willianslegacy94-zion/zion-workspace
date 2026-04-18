const puppeteer = require('puppeteer');
const path = require('path');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();

  await page.setViewport({ width: 1366, height: 768 });

  const htmlPath = path.resolve(__dirname, 'proposta.html');
  await page.goto(`file:///${htmlPath}`, { waitUntil: 'networkidle0' });

  // aguarda fontes carregarem
  await new Promise(r => setTimeout(r, 2000));

  await page.pdf({
    path: path.resolve(__dirname, 'Proposta Zion Ops - Generica.pdf'),
    width: '1366px',
    height: '768px',
    printBackground: true,
    pageRanges: '',
  });

  await browser.close();
  console.log('PDF gerado com sucesso!');
})();
