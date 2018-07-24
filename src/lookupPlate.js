/* eslint-disable no-undef */
const {readFileSync} = require('fs');
const Tesseract = require('tesseract.js');

const screenshotDOMElement = require('./screenshotDOMElement.js');

module.exports = async (browser, client, state = 'DC', number = 'ey9285') => {
  const page = await browser.newPage();
  await page.setViewport({height: 768, width: 1024});
  await page.goto('https://prodpci.etimspayments.com/pbw/include/dc_parking/input.jsp',
   {waitUntil: ['domcontentloaded', 'networkidle0']}
  );

  console.log('loaded');

  // Enter license plate number
  await page.type('[name=plateNumber]', number);
  console.log('typed number');

  // Set state
  await page.evaluate((state) => {
    document.querySelector('[name=statePlate]').value = state;
  }, state);
  console.log('set state');

  // solve the captcha >:D
  await screenshotDOMElement(page, {
    path: '/tmp/captcha.png',
    selector: '#captcha',
    padding: 4,
  });
  console.log('screened captcha');
  const {text} = await Tesseract.recognize('/tmp/captcha.png');
  console.log('solved captcha');
  const captcha = text.replace(/\D/g, '');
  await page.type('[name=captchaSText]', captcha);
  console.log('typed captcha');

  // avoid to timeout waitForNavigation() after click()
  await Promise.all([
    page.waitForNavigation(),
    page.keyboard.press('Enter'),
  ]);
  console.log('submited form');

  const error = await page.evaluate(
    () => document.querySelector('.error') &&
      document.querySelector('.error').textContent);
  if (error && error.match && error.match(/Please enter the characters/)) {
    return 'captcha error';
  } else if (error) {
    return error;
  }
  console.log('checked errors');

  await screenshotDOMElement(page, {
    path: '/tmp/tickets.png',
    selector: '.reg>table',
    padding: 4,
  });
  console.log('screenshoted tickets!');

  if (client) {
    console.log('lets tweet!');
    const data = readFileSync('/tmp/tickets.png');
    console.log('loaded image');
    return new Promise((resolve, reject) => client.post(
      'media/upload',
      {media: data},
      function(error, media) {
        if (!error) {
          // If successful, a media object will be returned.
          console.log(media);

          // Lets tweet it
          const status = {
            status: `${state} ${number} has outstanding tickets:`,
            media_ids: media.media_id_string,
          };

          client.post('statuses/update', status,
                      function(error, tweet) {
                        if (!error) {
                          console.log(tweet);
                          resolve();
                        } else {
                          console.log('problem tweeting', error);
                          reject(error);
                        }
                      });
        } else {
          console.log('problem uploading', error);
          reject(error);
        }
      }));
  }

  return captcha;
};
/* eslint-disable no-enable */
