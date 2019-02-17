/* eslint-disable no-undef */
const Tesseract = require('tesseract.js');

const screenshotDOMElement = require('./screenshotDOMElement.js');

module.exports = async (browser, state = 'DC', number = 'ey9285') => {
  console.log('lookup Plate');
  const page = await browser.newPage();
  console.log('browser page created');
  await page.setViewport({ height: 768, width: 1024 });
  await page.goto(
    'https://prodpci.etimspayments.com/pbw/include/dc_parking/input.jsp',
    { waitUntil: ['domcontentloaded', 'networkidle0'] }
  );

  console.log('loaded');

  try {
    // Enter license plate number
    await page.type('[name=plateNumber]', number);
    console.log('typed number');

    // Set state
    await page.evaluate(state => {
      document.querySelector('[name=statePlate]').value = state;
    }, state);
    console.log('set state');
  } catch (e) {
    return {error: "error filling in form, maybe it's down? https://prodpci.etimspayments.com/pbw/include/dc_parking/input.jsp cc @schep_"};
  }

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
    if (document.querySelector('[name=selectForm]') === null) {
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

  const total = await page.evaluate(() => {
    const totalInput = document.querySelector('input[name=totalAmount]');
    if (totalInput) {
      return totalInput.value.replace('$', '');
    }
    return Number(
      document
        .querySelector('[name=selectForm]')
        .textContent.match(
          /(The total of all your citations and fees is:|You have a total of \d+\sticket\(s\) on your account in the amount of) \$(\d+\.\d+)/
        )[2]
    );
  });

  const regNode = await page.evaluate(
    () => document.querySelector('.reg') !== null
  );
  if (regNode) {
    await screenshotDOMElement(page, {
      path: '/tmp/tickets.png',
      selector: '.reg>table',
      padding: 4
    });
  } else {
    // more than I'd like, but the page DOM sucks
    await screenshotDOMElement(page, {
      path: '/tmp/tickets.png',
      selector: '[name=selectForm]',
      padding: 4
    });
  }
  console.log('screenshoted tickets!');

  const html = await page.evaluate(() => document.body.innerHTML);

  return { path: '/tmp/tickets.png', total, html };
};
/* eslint-disable no-enable */
