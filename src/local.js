const lookupPlate = require('./lookupPlate');
const config = require('./puppeteer/config');
const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch({
        headless: false,
        slowMo: process.env.SLOWMO_MS,
        dumpio: !!config.DEBUG,
        // use chrome installed by puppeteer
    });
    await lookupPlate(browser)
    .then((result) => console.log(result))
    .catch((err) => console.error(err));
    await browser.close();
})();
