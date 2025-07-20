import { DEFAULT_INTERCEPT_RESOLUTION_PRIORITY } from 'puppeteer';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import AdblockerPlugin from 'puppeteer-extra-plugin-adblocker';
import fs from 'fs';

// Lecture de l'URL depuis les arguments de la ligne de commande
const url = process.argv[2];

if (!url) {
  console.error('Erreur : Veuillez fournir une URL en argument.\nUsage : node script.js <URL>');
  process.exit(1);
}

puppeteer.use(StealthPlugin());
puppeteer.use(AdblockerPlugin({
  interceptResolutionPriority: DEFAULT_INTERCEPT_RESOLUTION_PRIORITY,
}));

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    defaultViewport: null,
    userDataDir: './user_data',
  });

  const page = await browser.newPage();
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  
  await new Promise(resolve => setTimeout(resolve, 30000));

  if (await page.$('#accept-btn')) {
    await page.click('#accept-btn');
  }
  
  let chaptersData: {name: string, number: number}[] = await Promise.all(Array.from(await page.$$('select#selectChapitres option')).map(async (option) => {
    const value = await option.evaluate(el => el.textContent);
    let chapterNumber = value ? value.trim().split(' ')[1] : '';
    
    if (value && chapterNumber) {
      chapterNumber = chapterNumber.replace(/[^0-9.]/g, '');
      return { name: value.trim(), number: parseFloat(chapterNumber) };
    }
    return undefined;
  })).then(data => data.filter(item => item !== undefined)) || [];

  if(!chaptersData.length) {
    console.error('Aucun chapitre trouvé.');
    await browser.close();
    return;
  }

  chaptersData = chaptersData.sort((a, b) => a.number - b.number);

  const finalData: {
    title: string;
    chapters: { image: string | null; number: number }[][];
  } = {
    title: await page.evaluate(() => document.querySelector('#titreOeuvre')?.textContent?.trim() || ''),
    chapters: []
  };

  for (const chapter of chaptersData) {
    console.log(`Traitement du chapitre : ${chapter.name} (${chapter.number})`);
    await page.select('select#selectChapitres', chapter.name);

    await new Promise(resolve => setTimeout(resolve, 30000));

    const pages = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('#scansPlacement img.lazy')).map((page, index) => {
        return {
          image: page.getAttribute('src'),
          number: index + 1
        };
      });
    });

    if (!pages.length) {
      continue;
    }

    finalData.chapters.push(pages);
  }

  const slugify = (str: string) => str.toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^_+|_+$/g, '');

  const outputPath = `./output/${slugify(finalData.title)}.json`;

  fs.mkdirSync('./output', { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(finalData, null, 2));

  console.log(`Fichier sauvegardé dans : ${outputPath}`);
})();
