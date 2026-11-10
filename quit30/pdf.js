// book.html -> Quit_in_30_Days_eBook.pdf (6 x 9 in) and page previews
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  await p.goto('file://' + path.join(__dirname, 'book.html'), { waitUntil: 'networkidle' });
  await p.evaluate(() => document.fonts.ready);
  await p.pdf({ path: path.join(__dirname, 'Quit_in_30_Days_eBook.pdf'), width: '6in', height: '9in', printBackground: true });
  await b.close();
  console.log('ok');
})();
