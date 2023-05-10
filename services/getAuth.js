const playwright = require('playwright');

async function getAuth(url, authFilename) {
  const browser = await playwright.firefox.launch({headless:false});
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(url);
  
  await page.waitForTimeout(30000)
  const storageState = await context.storageState();
  
  // Restore the storage state
  await context.addCookies(storageState.cookies);

  const myJSON = JSON.stringify(storageState, null, 2);

  fs.writeFile(`./auth/${authFilename}.json`, myJSON, async (err) => {
    if (err) {
      console.error(err);
      return;
    }
    console.log(`JSON data has been saved to ${authFilename}.json`);
    await browser.close();
  });
}

module.exports = getAuth;