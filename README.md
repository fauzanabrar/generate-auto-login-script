# Semi Auto Login with Playwright and Browser Console

## Installation
requires:
- node.js
- npm
- playwright

install package:
```
npm install
```

## How to 
change url and filename that you want to login in `index.js` and run the file.
```
npm start
``` 
If you never login before there is a window pop up for login to the website.
After login auth file will be generated and this is can be used to login with script. 
then authentication file will be in folder auth and login script will be in folder login.
copy all of the script in `login/<filename>.js` and paste it to the console (you can try it in incognito browser). 

Sometimes you need to try other browser.

to try login you need to change url and filename in `/services/tryLogin.js` and run with:
```
npm run try
```