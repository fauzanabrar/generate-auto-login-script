const { chromium, firefox } = require('playwright');


async function tryLogin(url, filename){
  const browser = await firefox.launch({headless:false});
  const context = await browser.newContext({
    storageState: `./${filename}.json`
  });

  const page = await context.newPage();
  await page.goto(url);

  await page.waitForTimeout(10000);
  await browser.close();
}

const url       = '<URL_WITH_HTTP/HTTPS>'
const filename = '<FILENAME>'

tryLogin(url, filename);
