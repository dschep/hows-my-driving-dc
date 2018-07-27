/* eslint-disable no-undef */
const Tesseract = require('tesseract.js');

const screenshotDOMElement = require('./screenshotDOMElement.js');

module.exports = async (browser, state = 'DC', number = 'ey9285') => {
  const page = await browser.newPage();
  await page.setViewport({ height: 768, width: 1024 });
  await page.goto(
    'https://prodpci.etimspayments.com/pbw/include/dc_parking/input.jsp',
    { waitUntil: ['domcontentloaded', 'networkidle0'] }
  );

  console.log('loaded');

  // Enter license plate number
  await page.type('[name=plateNumber]', number);
  console.log('typed number');

  // Set state
  await page.evaluate(state => {
    document.querySelector('[name=statePlate]').value = state;
  }, state);
  console.log('set state');

  // solve the captcha >:D
  await screenshotDOMElement(page, {
    path: '/tmp/captcha.png',
    selector: '#captcha',
    padding: 4
  });
  console.log('screened captcha');
  const { text } = await Tesseract.recognize('/tmp/captcha.png');
  console.log('solved captcha');
  const captcha = text.replace(/\D/g, '');
  await page.type('[name=captchaSText]', captcha);
  console.log('typed captcha');

  // avoid to timeout waitForNavigation() after click()
  await Promise.all([page.waitForNavigation(), page.keyboard.press('Enter')]);
  console.log('submited form');

  const error = await page.evaluate(() => {
    if (document.querySelector('.reg>table') === null) {
      return (
        document.querySelector('.error') &&
        document.querySelector('.error').textContent
      );
    }
  });
  if (error && error.match && error.match(/Please enter the characters/)) {
    return { error: 'captcha error' };
  } else if (error) {
    return { error };
  }
  console.log('checked errors');

  const total = await page.evaluate(() =>
    Number(
      document.querySelector('input[name=totalAmount]').value.replace('$', '')
    )
  );

  await screenshotDOMElement(page, {
    path: '/tmp/tickets.png',
    selector: '.reg>table',
    padding: 4
  });
  console.log('screenshoted tickets!');

  return { path: '/tmp/tickets.png', total };
};
/* eslint-disable no-enable */
