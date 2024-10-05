const fs = require("fs");
const { exec } = require("child_process");

const produce = require("./src/services/produceSet");
const serialize = require("serialize-javascript");
const getAuth = require("./src/services/getAuth");
const { info } = require("./info");

const url = info.url;
const filename = info.fileName;

async function runAuto(url, filename) {
	// create directory if it doesn't exist
	if (!fs.existsSync("./auth")) {
		fs.mkdirSync("./auth");
	}

	if (!fs.existsSync("./login")) {
		fs.mkdirSync("./login");
	}

	let authFile = info.authFileName;

	try {
		authFile = require(`./auth/${filename}.json`);
	} catch {
		await getAuth(url, filename);
		authFile = require(`./auth/${filename}.json`);
	}

	const runFile = produce(authFile);

	const file = `(function(){const login = ${serialize(runFile)};\n\nlogin.run();})();`;

	fs.writeFile(`./login/${filename}.js`, file, (err) => {
		if (err) {
			console.error(err);
			return;
		}

		exec(
			`minify ./login/${filename}.js > ./login/${filename}.min.js`,
			(err, stdout, stderr) => {},
		);

		console.log(`Running file has been saved to ${filename}.js`);
	});
}

runAuto(url, filename);
