const fs        = require('fs');
const { exec }    = require('child_process');

const produce   = require('./src/services/produceSet');
const serialize = require('serialize-javascript');
const getAuth   = require('./src/services/getAuth');

const url       = '<URL_WITH_HTTP/HTTPS>'
const filename  = '<FILENAME_WITHOUT_EXTENSION>'

async function runAuto(url, filename) {
  let authFile  = "";

  try {
    authFile    = require(`./auth/${filename}.json`);
  } catch {
    await getAuth(url, filename);
    authFile    = require(`./auth/${filename}.json`);
  }

  const runFile = produce(authFile);

  const file    = `(function(){const login = ${serialize(runFile)};\n\nlogin.run();})();`;

  fs.writeFile(`./login/${filename}.js`, file, (err) => {
    if (err) {
      console.error(err);
      return;
    }

    exec(`minify ./login/${filename}.js > ./login/${filename}.min.js`, (err, stdout, stderr) => { });

    console.log(`Running file has been saved to ${filename}.js`);
  });
}

runAuto(url, filename)