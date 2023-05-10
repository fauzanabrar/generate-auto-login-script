const fs        = require('fs');
const produce   = require('./services/produceSet');
const serialize = require('serialize-javascript');
const getAuth   = require('./services/getAuth');

const url       = '<URL_WITH_HTTP/HTTPS>'
const filename  = '<FILENAME_WITHOUT_EXTENSION>'

async function runAuto(url, filename) {
  let authFile  = ''

  try {
    authFile    = require(`./auth/${filename}.json`);
  } catch {
    await getAuth(url, filename)
    authFile    = require(`./auth/${filename}.json`);
  }
  
  const runFile = produce(authFile);
  
  const file    = `const login = ${serialize(runFile)};\n\nlogin.run();`

  fs.writeFile(`./login/${filename}.js`, file, (err) => {
    if (err) {
      console.error(err);
      return;
    }

    console.log(`Running file has been saved to ${filename}.js`);
  });
}

runAuto(url, filename)