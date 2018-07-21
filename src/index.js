const Tesseract = require('tesseract.js');

const setup = require('./starter-kit/setup');
const screenshotDOMElement = require('./screenshotDOMElement.js');

exports.handler = async (event, context, callback) => {
  // For keeping the browser launch
  context.callbackWaitsForEmptyEventLoop = false;
  const browser = await setup.getBrowser();
  console.log(event);
  exports.run(browser, event.state, event.number).then(
    (result) => callback(null, result)
  ).catch(
    (err) => callback(err)
  );
};

exports.run = async (browser, state = 'DC', number = 'ey9285') => {
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

  return captcha;
};
