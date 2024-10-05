const playwright = require("playwright");
const fs = require("fs");

async function getAuth(url, authFilename) {
	const browser = await playwright.firefox.launch({ headless: false });
	const context = await browser.newContext();
	const page = await context.newPage();

	await page.goto(url);

	await page.waitForTimeout(70000);
	const storageState = await context.storageState();

	const myJSON = JSON.stringify(storageState, null, 2);
	console.log(myJSON);

	fs.writeFile(`./auth/${authFilename}.json`, myJSON, (err) => {
		if (err) {
			console.error(err, "yahoo");
			return;
		}
		console.log(`JSON data has been saved to ${authFilename}.json`);
	});
	await browser.close();
}

module.exports = getAuth;
