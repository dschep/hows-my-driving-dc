// cribbed from https://gist.github.com/malyw/b4e8284e42fdaeceab9a67a9b0263743
/**
 * Takes a screenshot of a DOM element on the page, with optional padding.
 *
 * @param {Page} page - pupeteer page object
 * @param {!{path:string, selector:string, padding:(number|undefined)}=} opts
 * @return {!Promise<!Buffer>}
 */
async function screenshotDOMElement(page, opts = {}) {
  const padding = 'padding' in opts ? opts.padding : 0;
  const path = 'path' in opts ? opts.path : null;
  const selector = opts.selector;

  if (!selector) {
    throw Error('Please provide a selector.');
  }

  const rect = await page.evaluate(selector => {
    // eslint-disable-next-line no-undef
    const element = document.querySelector(selector);
    if (!element) {
      return null;
    }
    const { x, y, width, height } = element.getBoundingClientRect();
    return { left: x, top: y, width, height, id: element.id };
  }, selector);

  if (!rect) {
    throw Error(`Could not find element that matches selector: ${selector}.`);
  }

  return await page.screenshot({
    path,
    clip: {
      x: rect.left - padding,
      y: rect.top - padding,
      width: rect.width + padding * 2,
      height: rect.height + padding * 2
    }
  });
}

module.exports = screenshotDOMElement;
